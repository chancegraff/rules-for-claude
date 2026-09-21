#!/usr/bin/env python3
"""audit_pptx.py — read-only mechanical audit of a canonical PPTX.

This is the FIRST step of the slide system. It walks every slide's OOXML and
records every mechanical fact it can find, with NO extrapolation. It is the only
sanctioned source of geometry for the rest of the pipeline (formatting-rules and
slot-contracts). If a number isn't in here, keep it as an explicit owner question
rather than guessing it.

What it captures, per text-bearing element (shapes, pictures, AND table cells):
  - slide number, element kind (sp / pic / tbl_cell), shape name
  - geometry x/y/w/h in inches, prstGeom, rotation, flipH/flipV
  - fill color (srgb or scheme), line/border presence
  - bodyPr padding (l/t/r/b), anchor, wrap, autofit kind
  - per-paragraph: algn, marL (hanging indent), lnSpc, spcBef/spcAft,
    full canonical text (NEVER truncated), char count, dominant font + size,
    bold/italic
  - explicit_line_hint / explicit_char_hint parsed from the placeholder text
    (designer-authored fit hints are ground truth — see playbook anti-pattern #8)
  - z-order index (order of insertion in spTree — matters for overlap, #6)

Outputs (next to --out):
  audit.json         full nested record, one entry per slide
  audit_shapes.csv   flat, one row per text-bearing element — for spot-checking
  families.json      slides clustered by structural signature (template families)
  audit_summary.txt  human-readable counts, fonts, palette, family table

Tables are handled explicitly (playbook anti-pattern #10): a <a:tbl> inside a
<p:graphicFrame> nests text in tbl/tr/tc/txBody and most naive audits skip it.

Usage:
  python audit_pptx.py --pptx /path/to/deck.pptx --out /path/to/_audit
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import re
import shutil
import tempfile
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
EMU_PER_INCH = 914400.0

LINE_HINT_NUMBERS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9,
}

# Default OOXML bodyPr insets when the attribute is absent (ECMA-376 defaults).
DEF_PAD = {"l": 0.1, "t": 0.05, "r": 0.1, "b": 0.05}


# --------------------------------------------------------------------------- #
# low-level helpers
# --------------------------------------------------------------------------- #
def emu_to_in(v):
    if v is None:
        return None
    try:
        return round(int(v) / EMU_PER_INCH, 4)
    except (TypeError, ValueError):
        return None


def sz_to_pt(v):
    if v is None:
        return None
    try:
        return round(int(v) / 100.0, 2)
    except (TypeError, ValueError):
        return None


def get_fill(parent):
    """Return a fill descriptor for an spPr/rPr/tcPr-like element."""
    if parent is None:
        return None
    sf = parent.find("a:solidFill", NS)
    if sf is not None:
        srgb = sf.find("a:srgbClr", NS)
        if srgb is not None:
            return srgb.get("val", "").upper()
        sch = sf.find("a:schemeClr", NS)
        if sch is not None:
            return f"scheme:{sch.get('val')}"
    if parent.find("a:noFill", NS) is not None:
        return "none"
    if parent.find("a:gradFill", NS) is not None:
        return "gradient"
    if parent.find("a:blipFill", NS) is not None:
        return "image"
    return None


def parse_line_hint(text):
    if not text:
        return None
    t = text.lower()
    for word, n in LINE_HINT_NUMBERS.items():
        if f" {word} line" in t or f" {word}-line" in t or t.startswith(f"{word} line"):
            return n
    m = re.search(r"(\d+)[\s-]*line", t)
    if m:
        return int(m.group(1))
    return None


def parse_char_hint(text):
    if not text:
        return None
    m = re.search(r"(\d+)\s*[-–]\s*(\d+)\s+character", text)
    if m:
        return [int(m.group(1)), int(m.group(2))]
    m = re.search(r"(?:roughly|around|approximately|~)\s*(\d+)\s+character", text)
    if m:
        return [int(m.group(1)), int(m.group(1))]
    m = re.search(r"<\s*(\d+)\s+character", text)
    if m:
        return [None, int(m.group(1))]
    m = re.search(r"less than\s+(\d+)\s+character", text)
    if m:
        return [None, int(m.group(1))]
    m = re.search(r"(\d+)\s+character", text)
    if m:
        return [int(m.group(1)), int(m.group(1))]
    return None


# --------------------------------------------------------------------------- #
# txBody extraction (shared by shapes and table cells)
# --------------------------------------------------------------------------- #
def extract_txbody(txBody):
    """Return (bodyPr_dict, paragraphs_list). paragraphs hold full text."""
    body = {}
    bodyPr = txBody.find("a:bodyPr", NS)
    if bodyPr is not None:
        body["pad_l_in"] = emu_to_in(bodyPr.get("lIns")) if bodyPr.get("lIns") else DEF_PAD["l"]
        body["pad_t_in"] = emu_to_in(bodyPr.get("tIns")) if bodyPr.get("tIns") else DEF_PAD["t"]
        body["pad_r_in"] = emu_to_in(bodyPr.get("rIns")) if bodyPr.get("rIns") else DEF_PAD["r"]
        body["pad_b_in"] = emu_to_in(bodyPr.get("bIns")) if bodyPr.get("bIns") else DEF_PAD["b"]
        body["anchor"] = bodyPr.get("anchor", "t")
        body["wrap"] = bodyPr.get("wrap", "square")
        if bodyPr.find("a:normAutofit", NS) is not None:
            body["autofit"] = "normAutofit"
        elif bodyPr.find("a:spAutoFit", NS) is not None:
            body["autofit"] = "spAutoFit"
        elif bodyPr.find("a:noAutofit", NS) is not None:
            body["autofit"] = "noAutofit"
        else:
            body["autofit"] = None
    else:
        body.update({f"pad_{k}_in": v for k, v in DEF_PAD.items()})
        body["anchor"] = "t"
        body["wrap"] = "square"
        body["autofit"] = None

    paragraphs = []
    for p in txBody.findall("a:p", NS):
        ppr = p.find("a:pPr", NS)
        para = {"algn": None, "marL_in": 0.0, "indent_in": 0.0,
                "lnSpc_pct": None, "spcBef_pt": None, "spcAft_pt": None,
                "bullet": None, "runs": []}
        if ppr is not None:
            para["algn"] = ppr.get("algn")
            if ppr.get("marL"):
                para["marL_in"] = emu_to_in(ppr.get("marL"))
            if ppr.get("indent"):
                para["indent_in"] = emu_to_in(ppr.get("indent"))
            ln = ppr.find("a:lnSpc/a:spcPct", NS)
            if ln is not None:
                para["lnSpc_pct"] = round(int(ln.get("val")) / 1000.0, 2)
            sb = ppr.find("a:spcBef/a:spcPts", NS)
            if sb is not None:
                para["spcBef_pt"] = round(int(sb.get("val")) / 100.0, 2)
            sa = ppr.find("a:spcAft/a:spcPts", NS)
            if sa is not None:
                para["spcAft_pt"] = round(int(sa.get("val")) / 100.0, 2)
            if ppr.find("a:buChar", NS) is not None:
                para["bullet"] = ppr.find("a:buChar", NS).get("char")
            elif ppr.find("a:buAutoNum", NS) is not None:
                para["bullet"] = "auto-num"
            elif ppr.find("a:buNone", NS) is not None:
                para["bullet"] = "none"
        for run in p.findall("a:r", NS):
            rpr = run.find("a:rPr", NS)
            t_el = run.find("a:t", NS)
            rec = {"text": (t_el.text or "") if t_el is not None else ""}
            if rpr is not None:
                rec["sz_pt"] = sz_to_pt(rpr.get("sz"))
                rec["bold"] = rpr.get("b") == "1"
                rec["italic"] = rpr.get("i") == "1"
                latin = rpr.find("a:latin", NS)
                rec["font"] = latin.get("typeface") if latin is not None else None
                rec["color"] = get_fill(rpr)
            para["runs"].append(rec)
        # also catch field runs (a:fld) that carry text
        for fld in p.findall("a:fld", NS):
            t_el = fld.find("a:t", NS)
            if t_el is not None and t_el.text:
                para["runs"].append({"text": t_el.text, "font": None})
        paragraphs.append(para)
    return body, paragraphs


def summarize_paragraphs(paragraphs):
    """Add aggregate, per-paragraph derived fields."""
    non_empty = [p for p in paragraphs
                 if any(r.get("text", "").strip() for r in p["runs"])]
    text_per_para, chars_per_para, font_per_para, size_per_para = [], [], [], []
    indent_per_para, line_hints, char_hints = [], [], [],
    line_hints = []
    char_hints = []
    for p in non_empty:
        joined = "".join(r.get("text", "") for r in p["runs"])
        text_per_para.append(joined)
        chars_per_para.append(len(joined))
        f = next((r.get("font") for r in p["runs"] if r.get("font")), None)
        s = next((r.get("sz_pt") for r in p["runs"] if r.get("sz_pt")), None)
        font_per_para.append(f)
        size_per_para.append(s)
        indent_per_para.append(p.get("marL_in", 0.0))
        line_hints.append(parse_line_hint(joined))
        char_hints.append(parse_char_hint(joined))
    return {
        "n_paragraphs": len(non_empty),
        "canonical_text_per_paragraph": text_per_para,
        "canonical_chars_per_paragraph": chars_per_para,
        "per_paragraph_font": font_per_para,
        "per_paragraph_font_size_pt": size_per_para,
        "per_paragraph_indent_in": indent_per_para,
        "explicit_line_hint_per_paragraph": line_hints,
        "explicit_char_hint_per_paragraph": char_hints,
        "dominant_font_face": next((f for f in font_per_para if f), None),
        "dominant_font_size_pt": next((s for s in size_per_para if s), None),
    }


# --------------------------------------------------------------------------- #
# element extractors
# --------------------------------------------------------------------------- #
def xfrm_of(spPr):
    out = {}
    if spPr is None:
        return out
    xfrm = spPr.find("a:xfrm", NS)
    if xfrm is None:
        return out
    off = xfrm.find("a:off", NS)
    ext = xfrm.find("a:ext", NS)
    if off is not None:
        out["x_in"] = emu_to_in(off.get("x"))
        out["y_in"] = emu_to_in(off.get("y"))
    if ext is not None:
        out["w_in"] = emu_to_in(ext.get("cx"))
        out["h_in"] = emu_to_in(ext.get("cy"))
    if xfrm.get("rot"):
        out["rot_deg"] = round(int(xfrm.get("rot")) / 60000.0, 2)
    if xfrm.get("flipH") == "1":
        out["flipH"] = True
    if xfrm.get("flipV") == "1":
        out["flipV"] = True
    return out


def extract_sp(sp, z):
    nv = sp.find("p:nvSpPr/p:cNvPr", NS)
    spPr = sp.find("p:spPr", NS)
    txBody = sp.find("p:txBody", NS)
    rec = {"kind": "sp", "z": z,
           "shape_name": nv.get("name") if nv is not None else None}
    rec.update(xfrm_of(spPr))
    if spPr is not None:
        prst = spPr.find("a:prstGeom", NS)
        rec["geom"] = prst.get("prst") if prst is not None else None
        rec["fill"] = get_fill(spPr)
        ln = spPr.find("a:ln", NS)
        rec["has_line"] = ln is not None and ln.find("a:noFill", NS) is None
    if txBody is not None:
        body, paras = extract_txbody(txBody)
        rec.update(body)
        rec["paragraphs"] = paras
        rec.update(summarize_paragraphs(paras))
    return rec


def extract_pic(pic, z, rels):
    nv = pic.find("p:nvPicPr/p:cNvPr", NS)
    spPr = pic.find("p:spPr", NS)
    rec = {"kind": "pic", "z": z,
           "shape_name": nv.get("name") if nv is not None else None}
    rec.update(xfrm_of(spPr))
    if spPr is not None:
        prst = spPr.find("a:prstGeom", NS)
        rec["geom"] = prst.get("prst") if prst is not None else None
    blip = pic.find("p:blipFill/a:blip", NS)
    if blip is not None:
        embed = blip.get(f"{{{NS['r']}}}embed")
        rec["image_rel"] = embed
        rec["image_file"] = rels.get(embed)
    # crop (srcRect) percentages
    src = pic.find("p:blipFill/a:srcRect", NS)
    if src is not None:
        rec["crop"] = {k: round(int(src.get(k, "0")) / 1000.0, 2)
                       for k in ("l", "t", "r", "b") if src.get(k)}
    return rec


def extract_table(gf, z):
    """Return a table record + one cell-level record per non-empty cell."""
    nv = gf.find("p:nvGraphicFramePr/p:cNvPr", NS)
    xfrm = gf.find("p:xfrm", NS)
    trec = {"kind": "tbl", "z": z,
            "shape_name": nv.get("name") if nv is not None else None}
    if xfrm is not None:
        off = xfrm.find("a:off", NS)
        ext = xfrm.find("a:ext", NS)
        if off is not None:
            trec["x_in"] = emu_to_in(off.get("x"))
            trec["y_in"] = emu_to_in(off.get("y"))
        if ext is not None:
            trec["w_in"] = emu_to_in(ext.get("cx"))
            trec["h_in"] = emu_to_in(ext.get("cy"))
    tbl = gf.find("a:graphic/a:graphicData/a:tbl", NS)
    cells = []
    if tbl is None:
        return trec, cells
    grid = tbl.find("a:tblGrid", NS)
    col_w = []
    if grid is not None:
        col_w = [emu_to_in(gc.get("w")) for gc in grid.findall("a:gridCol", NS)]
    trec["col_widths_in"] = col_w
    rows = tbl.findall("a:tr", NS)
    trec["n_rows"] = len(rows)
    trec["n_cols"] = len(col_w)
    trec["row_heights_in"] = [emu_to_in(tr.get("h")) for tr in rows]
    for ri, tr in enumerate(rows):
        for ci, tc in enumerate(tr.findall("a:tc", NS)):
            txBody = tc.find("a:txBody", NS)
            tcPr = tc.find("a:tcPr", NS)
            crec = {"kind": "tbl_cell", "z": z,
                    "shape_name": f"{trec['shape_name']}[r{ri}c{ci}]",
                    "row": ri, "col": ci,
                    "col_w_in": col_w[ci] if ci < len(col_w) else None}
            if tcPr is not None:
                crec["fill"] = get_fill(tcPr)
                # border presence (must precede fill in valid OOXML — anti-pattern #4)
                crec["borders"] = [b.tag.split('}')[-1]
                                   for b in tcPr
                                   if b.tag.split('}')[-1].startswith("ln")]
            if txBody is not None:
                body, paras = extract_txbody(txBody)
                crec.update(body)
                crec["paragraphs"] = paras
                crec.update(summarize_paragraphs(paras))
            cells.append(crec)
    return trec, cells


# --------------------------------------------------------------------------- #
# tree walk
# --------------------------------------------------------------------------- #
def walk(elem, out, rels, counter):
    for child in list(elem):
        tag = child.tag.split("}")[-1]
        if tag == "sp":
            counter[0] += 1
            if child.find("p:txBody", NS) is not None:
                out.append(extract_sp(child, counter[0]))
        elif tag == "pic":
            counter[0] += 1
            out.append(extract_pic(child, counter[0], rels))
        elif tag == "graphicFrame":
            counter[0] += 1
            if child.find("a:graphic/a:graphicData/a:tbl", NS) is not None:
                trec, cells = extract_table(child, counter[0])
                out.append(trec)
                out.extend(cells)
        elif tag == "grpSp":
            counter[0] += 1
            walk(child, out, rels, counter)


def load_rels(slides_dir, n):
    rels = {}
    rp = slides_dir / "_rels" / f"slide{n}.xml.rels"
    if not rp.exists():
        return rels
    root = ET.parse(rp).getroot()
    for rel in root:
        rid = rel.get("Id")
        target = rel.get("Target", "")
        rels[rid] = target.split("/")[-1]
    return rels


# --------------------------------------------------------------------------- #
# structural signature for clustering into template families
# --------------------------------------------------------------------------- #
def signature(shapes):
    """A coarse structural fingerprint used to group near-identical slides."""
    n_text = sum(1 for s in shapes if s.get("paragraphs"))
    n_pic = sum(1 for s in shapes if s["kind"] == "pic")
    n_tbl = sum(1 for s in shapes if s["kind"] == "tbl")
    geoms = Counter(s.get("geom") for s in shapes
                    if s["kind"] == "sp" and s.get("geom"))
    n_round = geoms.get("roundRect", 0)
    n_ell = geoms.get("ellipse", 0)
    # bucket text count so tiny differences collapse together
    tb = (n_text // 2) * 2
    return f"t{tb}_p{n_pic}_tbl{n_tbl}_rr{min(n_round,8)}_el{min(n_ell,6)}"


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pptx", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    tmp = Path(tempfile.mkdtemp())
    try:
        with zipfile.ZipFile(args.pptx) as zf:
            zf.extractall(tmp)
        slides_dir = tmp / "ppt" / "slides"
        slide_files = sorted(slides_dir.glob("slide*.xml"),
                             key=lambda p: int(re.findall(r"\d+", p.stem)[0]))

        # presentation size
        pres = ET.parse(tmp / "ppt" / "presentation.xml").getroot()
        sz = pres.find("p:sldSz", NS)
        slide_w = emu_to_in(sz.get("cx"))
        slide_h = emu_to_in(sz.get("cy"))

        audit = {"source": Path(args.pptx).name,
                 "slide_w_in": slide_w, "slide_h_in": slide_h, "slides": {}}
        for sf in slide_files:
            n = int(re.findall(r"\d+", sf.stem)[0])
            rels = load_rels(slides_dir, n)
            root = ET.parse(sf).getroot()
            spTree = root.find("p:cSld/p:spTree", NS)
            shapes = []
            walk(spTree, shapes, rels, [0])
            audit["slides"][str(n)] = {"signature": signature(shapes),
                                       "shapes": shapes}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # ---- write audit.json
    (out_dir / "audit.json").write_text(
        json.dumps(audit, indent=1, ensure_ascii=False))

    # ---- flat CSV (one row per text-bearing element)
    cols = ["slide", "kind", "shape_name", "z", "geom", "fill",
            "x_in", "y_in", "w_in", "h_in",
            "pad_l_in", "pad_t_in", "pad_r_in", "pad_b_in", "anchor",
            "n_paragraphs", "dominant_font_face", "dominant_font_size_pt",
            "explicit_line_hint", "explicit_char_hint",
            "canonical_text"]
    with (out_dir / "audit_shapes.csv").open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for n, sd in audit["slides"].items():
            for s in sd["shapes"]:
                if not s.get("paragraphs"):
                    continue
                hints_l = [h for h in s.get("explicit_line_hint_per_paragraph", []) if h]
                hints_c = [h for h in s.get("explicit_char_hint_per_paragraph", []) if h]
                w.writerow([
                    n, s["kind"], s.get("shape_name"), s.get("z"),
                    s.get("geom"), s.get("fill"),
                    s.get("x_in"), s.get("y_in"), s.get("w_in"), s.get("h_in"),
                    s.get("pad_l_in"), s.get("pad_t_in"), s.get("pad_r_in"),
                    s.get("pad_b_in"), s.get("anchor"),
                    s.get("n_paragraphs"), s.get("dominant_font_face"),
                    s.get("dominant_font_size_pt"),
                    hints_l[0] if hints_l else "",
                    hints_c[0] if hints_c else "",
                    " ¶ ".join(s.get("canonical_text_per_paragraph", []))[:400],
                ])

    # ---- family clustering
    families = defaultdict(list)
    for n, sd in audit["slides"].items():
        families[sd["signature"]].append(int(n))
    fam_sorted = sorted(families.items(), key=lambda kv: -len(kv[1]))
    fam_out = {sig: sorted(slides) for sig, slides in fam_sorted}
    (out_dir / "families.json").write_text(json.dumps(fam_out, indent=1))

    # ---- summary
    fonts = Counter()
    sizes = Counter()
    fills = Counter()
    n_text_total = 0
    n_tbl = 0
    for sd in audit["slides"].values():
        for s in sd["shapes"]:
            if s["kind"] == "tbl":
                n_tbl += 1
            if s.get("paragraphs"):
                n_text_total += 1
                for f in s.get("per_paragraph_font", []):
                    if f:
                        fonts[f] += 1
                for z in s.get("per_paragraph_font_size_pt", []):
                    if z:
                        sizes[z] += 1
            if s.get("fill") and s["kind"] == "sp":
                fills[s["fill"]] += 1
    lines = []
    lines.append(f"source: {audit['source']}")
    lines.append(f"slide size: {slide_w} x {slide_h} in")
    lines.append(f"slides: {len(audit['slides'])}")
    lines.append(f"text-bearing elements: {n_text_total}")
    lines.append(f"tables: {n_tbl}")
    lines.append(f"distinct structural families: {len(fam_out)}")
    lines.append("\nTop fonts (by paragraph):")
    for f, c in fonts.most_common(15):
        lines.append(f"  {c:5d}  {f}")
    lines.append("\nTop font sizes (pt):")
    for z, c in sizes.most_common(15):
        lines.append(f"  {c:5d}  {z}")
    lines.append("\nTop shape fills:")
    for f, c in fills.most_common(20):
        lines.append(f"  {c:5d}  {f}")
    lines.append("\nLargest template families (signature -> count: example slides):")
    for sig, slides in fam_sorted[:25]:
        ex = ", ".join(str(x) for x in sorted(slides)[:8])
        lines.append(f"  {len(slides):3d}  {sig:28s}  [{ex}]")
    (out_dir / "audit_summary.txt").write_text("\n".join(lines))
    print("\n".join(lines))
    print(f"\nWrote: audit.json, audit_shapes.csv, families.json, audit_summary.txt -> {out_dir}")


if __name__ == "__main__":
    main()
