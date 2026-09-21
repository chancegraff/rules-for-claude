#!/usr/bin/env python3
"""antibland.py — the decisioning layer that consumes slide_scores.json.

Two moments of consumption, mirroring the two data formats the pipeline uses:

  1. SELECTION  (content `block`  ->  which canonical `template_slide` to duplicate)
     rank_templates() / suggest() score every candidate template by how well its
     *capacity* (data-viz / density / impact, from slide_scores.json) matches what
     the *content* wants — and prefer the vivid home over the flat one when both fit.

  2. GATE       (a finished plan's `template_slide` list  ->  pass/flag)
     vividness_report() computes deck-level impact/proof metrics from the scores
     and flags a deck that is BLAND even though it may pass the look-monotony check
     (varied layouts can still all be low-impact, text-heavy, and proof-free).

preflight_lint.py folds vividness_report() in beside variety_report() and
transitions_report(); the two HARD floors gate the build (override with --force),
everything else advises. Set GATE_ON_VIVIDNESS = False to make it advisory-only.

No external deps; never touches the .pptx. Scores are loaded from slide_scores.json
next to this file (produced by the rating pass); if it's missing the gate no-ops
so a missing scores file can never break a build.
"""
from __future__ import annotations
import json, re
from pathlib import Path

# When True, vividness_report()['ok'] (the two hard floors) contributes to
# preflight's ok_to_build, so a bland deck is refused unless --force. Flip to
# False to keep vividness purely advisory while you calibrate thresholds.
GATE_ON_VIVIDNESS = True

# --------------------------------------------------------------------------- #
# scores  (the artifact produced by the rating pass)
# --------------------------------------------------------------------------- #
_SCORES_PATH = Path(__file__).parent / "slide_scores.json"
try:
    _RAW = json.loads(_SCORES_PATH.read_text())
    SCORES = {int(k): v for k, v in _RAW.get("scores", {}).items()}
except (OSError, ValueError):
    SCORES = {}                      # missing/invalid -> gate no-ops (see below)

# Which score-categories are "body" slides (carry the argument) vs structural
# punctuation (covers/dividers/closers) vs high-impact punctuation.
STRUCTURAL = {"title_opener", "agenda", "end"}
PUNCTUATION = {"section_breaker", "statement", "testimonial"}   # intentionally vivid, sparse


def axes(n: int):
    s = SCORES.get(n)
    return (s["data_viz"], s["text_density"], s["high_impact"]) if s else (None, None, None)


# Candidate canonical slides per content family — a CURATED selection list (it
# intentionally spans categories, e.g. `stat_trio` also lists the KPI slides),
# NOT a slide→category map. The authoritative per-slide category is
# slide_scores.json (the rating pass); reconcile against it when the deck
# changes. preflight_lint._FAMILY_RANGES/_SLIDE_LOOK keep separate coarse
# groupings for the variety check — a different job, so the three maps are
# deliberately not merged (different projections, not duplicates).
FAMILY_CANDIDATES = {
    "statement":        [60, 61, 62, 116],
    "title_prose":      [63, 64, 66, 68, 73, 74, 75, 76, 77],
    "content_columns":  [67, 69, 70, 71, 72, 78, 79],
    "stat_trio":        [80, 92, 104, 106, 107],       # "big number" homes
    "card_grid":        [81, 82, 83, 84, 149, 150, 151, 152, 153, 154, 155, 158],
    "caption_grid":     [85, 86, 87, 88, 89],
    "comparison_table": [96, 97, 103, 156, 157],
    "timeline":         [91, 159, 160, 161, 162, 163, 164],
    "dataviz_bar":      [93, 94, 95, 110],
    "dataviz_trend":    [98, 105, 109, 112],
    "dataviz_pie":      [99],
    "dataviz_stacked":  [101, 102, 111],
    "dataviz_table":    [96, 97],
    "dataviz_matrix":   [103],
    "kpi":              [92, 104, 106, 107, 80],
    "testimonial":      [49, 50, 51, 52, 53, 54, 55, 56, 57, 58],
    "case_study":       [118, 119, 120],
    "extended_bullets": list(range(131, 149)),
    # --- structural punctuation -------------------------------------------
    # These four families existed in slide_scores.json but had NO entry here
    # and no branch in rank_templates(), so a cover / agenda / divider / closer
    # fell through to the "score all 142 slides" fallback and ranked garbage
    # (a cover matched a data-viz slide). Purely additive: these keys were
    # previously unreachable, so nothing that worked before can regress.
    "title_opener":     [13, 14, 15, 16, 17, 18, 19, 21, 22],
    "agenda":           [24, 25, 26, 27, 28],
    "section_breaker":  list(range(30, 48)),
    "end":              [126, 127, 128, 129],
}

_NUMISH = re.compile(r"(\$\s?\d|\d+\s?%|\b\d[\d,\.]{1,}\b|\bx\d|\d+×)")


# --------------------------------------------------------------------------- #
# 1. content-need profile  (what does THIS block want?)
# --------------------------------------------------------------------------- #
def _all_text(block) -> str:
    out = []
    def walk(v):
        if isinstance(v, str): out.append(v)
        elif isinstance(v, dict): [walk(x) for x in v.values()]
        elif isinstance(v, list): [walk(x) for x in v]
    walk(block)
    return " ".join(out)


def _density_band(words: int) -> int:
    return 1 if words <= 15 else 2 if words <= 40 else 3 if words <= 90 else 4 if words <= 150 else 5


def content_profile(block: dict) -> dict:
    """Score the incoming content on the SAME three axes as the templates, plus
    the signals that drove it — so a mismatch is explainable."""
    text = _all_text(block); words = len(text.split())
    nums = len(_NUMISH.findall(text))
    k = set(block.keys())
    cards = block.get("cards") or []
    first_card = cards[0] if cards else {}
    signals = []

    # data-viz NEED
    if block.get("chart") or "milestones" in k:
        dv = 5; signals.append("explicit chart/timeline")
    elif "headers" in k and "rows" in k:
        dv = 5; signals.append("tabular (headers+rows)")
    elif cards and ("number" in first_card or "caption" in first_card):
        dv = 4; signals.append("stat cards (numbers)")
    elif nums >= 3:
        dv = 3; signals.append(f"{nums} numeric tokens in copy")
    elif nums >= 1:
        dv = 2; signals.append(f"{nums} numeric token(s)")
    else:
        dv = 1

    # impact OPPORTUNITY (how punchy the content COULD be)
    if "statement" in k or "quote" in k:
        hi = 5; signals.append("single statement/quote -> hero moment")
    elif cards and len(cards) == 1 and ("number" in first_card):
        hi = 5; signals.append("one headline number -> hero stat")
    elif block.get("title_slide") or block.get("section_breaker"):
        hi = 4
    elif cards or "columns" in k:
        hi = 3; signals.append("grouped ideas")
    elif "bullets" in k or "prose" in k:
        hi = 2; signals.append("list/prose (flat by default)")
    else:
        hi = 2
    # very dense prose caps its own punch
    td = _density_band(words)
    if td >= 5 and hi > 2:
        hi = 2; signals.append("very dense -> punch diluted")

    return {"data_viz_need": dv, "text_density": td, "impact_opportunity": hi,
            "words": words, "signals": signals}


# --------------------------------------------------------------------------- #
# 2. selection advisor  (block -> ranked candidate template slides)
# --------------------------------------------------------------------------- #
DEFAULT_WEIGHTS = {"density": 1.0, "impact": 1.3, "dataviz": 1.2}


def rank_templates(block: dict, candidates=None, weights=DEFAULT_WEIGHTS):
    prof = content_profile(block)
    if candidates is None:
        cands = set()
        k = set(block.keys())
        if block.get("chart"):
            cands |= set(FAMILY_CANDIDATES["dataviz_bar"] + FAMILY_CANDIDATES["dataviz_trend"]
                         + FAMILY_CANDIDATES["kpi"])
        if "headers" in k and "rows" in k: cands |= set(FAMILY_CANDIDATES["comparison_table"])
        if "statement" in k: cands |= set(FAMILY_CANDIDATES["statement"])
        if "quote" in k: cands |= set(FAMILY_CANDIDATES["testimonial"])
        # structural punctuation — previously unhandled (see FAMILY_CANDIDATES)
        if "milestones" in k: cands |= set(FAMILY_CANDIDATES["timeline"])
        if block.get("title_slide"): cands |= set(FAMILY_CANDIDATES["title_opener"])
        if block.get("agenda"): cands |= set(FAMILY_CANDIDATES["agenda"])
        if block.get("section_breaker"): cands |= set(FAMILY_CANDIDATES["section_breaker"])
        if block.get("closing"): cands |= set(FAMILY_CANDIDATES["end"])
        if block.get("cards"):
            fc = (block["cards"][0] if block["cards"] else {})
            cands |= set(FAMILY_CANDIDATES["stat_trio" if ("number" in fc or "caption" in fc)
                                           else "card_grid"])
        if "columns" in k: cands |= set(FAMILY_CANDIDATES["content_columns"])
        if "bullets" in k or "prose" in k:
            cands |= set(FAMILY_CANDIDATES["title_prose"] + FAMILY_CANDIDATES["content_columns"]
                         + FAMILY_CANDIDATES["extended_bullets"])
        # A structural slide is structural, full stop — a cover must not compete
        # against body families just because it also carries a subtitle's words.
        structural = set()
        if block.get("title_slide"): structural |= set(FAMILY_CANDIDATES["title_opener"])
        if block.get("agenda"): structural |= set(FAMILY_CANDIDATES["agenda"])
        if block.get("section_breaker"): structural |= set(FAMILY_CANDIDATES["section_breaker"])
        if block.get("closing"): structural |= set(FAMILY_CANDIDATES["end"])
        if structural:
            cands = structural
        candidates = sorted(cands) or sorted(SCORES)
    scored = []
    for n in candidates:
        dv, td, hi = axes(n)
        if dv is None:
            continue
        density_match = 1 - abs(td - prof["text_density"]) / 4.0
        dataviz_fit = 1.0 if dv >= prof["data_viz_need"] else dv / max(prof["data_viz_need"], 1)
        impact = hi / 5.0
        score = (weights["density"] * density_match
                 + weights["impact"] * impact
                 + weights["dataviz"] * dataviz_fit)
        scored.append({"slide": n, "score": round(score, 3), "dv": dv, "td": td, "hi": hi})
    scored.sort(key=lambda r: -r["score"])
    return prof, scored


def suggest(block: dict):
    prof, ranked = rank_templates(block)
    best = ranked[0] if ranked else None
    bland_flag = None
    if best and (prof["data_viz_need"] >= 4 or prof["impact_opportunity"] >= 4):
        if best["dv"] <= 1 and best["hi"] <= 2:
            bland_flag = "content has vivid potential but top candidate is flat"
    return {"profile": prof, "best": best, "top3": ranked[:3], "bland_flag": bland_flag}


# --------------------------------------------------------------------------- #
# 3. deck-level gate  (plan's template_slide list -> vividness verdict)
# --------------------------------------------------------------------------- #
def vividness_report(plan_slides, *, floors=None) -> dict:
    """Complements preflight_lint.variety_report(). Monotony catches REPEATED
    looks; this catches a FLAT deck — low impact, no proof, walls of text — even
    when the looks differ. Two HARD floors gate; the rest advise. If the scores
    file is missing, this no-ops (ok=True) so a build can never break on it."""
    F = {"min_dataviz": 1, "min_argument_for_dataviz": 4, "max_bland_run": 2,
         "max_bland_ratio": 0.5, "min_mean_impact": 2.5, "want_hero_on": 6}
    if floors:
        F.update(floors)

    if not SCORES:
        return {"ok": True, "hard": [], "warnings": ["slide_scores.json not found — "
                "vividness gate inactive"], "metrics": {}, "bland_slides": []}

    nums = [s.get("template_slide") for s in plan_slides
            if isinstance(s.get("template_slide"), int)]
    def cat(n): return (SCORES.get(n) or {}).get("category", "other")
    body = [n for n in nums if n in SCORES and cat(n) not in STRUCTURAL]
    argu = [n for n in body if cat(n) not in PUNCTUATION]    # the "wall of words" risk lives here
    warn, hard = [], []

    if not body:
        return {"ok": True, "hard": [], "warnings": [], "metrics": {}, "bland_slides": []}

    impacts = [axes(n)[2] for n in body]
    mean_impact = round(sum(impacts) / len(impacts), 2)
    dataviz_slides = [n for n in nums if (axes(n)[0] or 0) >= 4]
    hero_slides = [n for n in body if (axes(n)[2] or 0) >= 4]
    bland_slides = [n for n in argu if (axes(n)[2] or 0) <= 2 and (axes(n)[0] or 0) <= 1]
    bland_ratio = round(len(bland_slides) / max(len(argu), 1), 2)

    # longest run of low-impact argument slides (look-agnostic — the gap monotony misses)
    run = best = 0
    for n in argu:
        if (axes(n)[2] or 0) <= 2:
            run += 1; best = max(best, run)
        else:
            run = 0
    longest_bland_run = best

    # HARD floor 1: a deck with a real body that shows no data as a visual reads
    # as assertion. Small decks (fewer than min_argument_for_dataviz argument
    # slides) are exempt — a 3-slide statement deck needn't add a chart.
    if len(argu) >= F["min_argument_for_dataviz"] and len(dataviz_slides) < F["min_dataviz"]:
        hard.append(f"no data-viz slide (dv>=4) across {len(argu)} argument slides — proof reads "
                    f"as assertion; route one metric-bearing slide to a chart/KPI (80/92/95/107/109…)")
    # HARD floor 2: a wall of low-impact text, regardless of look variety.
    if longest_bland_run > F["max_bland_run"]:
        hard.append(f"{longest_bland_run} low-impact text slides in a row — break the wall "
                    f"with a stat, quote, statement, or visual")
    # soft advisories
    if bland_ratio > F["max_bland_ratio"] and len(argu) >= 4:
        warn.append(f"{int(bland_ratio*100)}% of argument slides are flat text (impact<=2, no viz) "
                    f"— reach for richer families")
    if len(body) >= F["want_hero_on"] and not hero_slides:
        warn.append("no high-impact moment (impact>=4) — add a full-bleed statement, hero stat, or quote")
    if mean_impact < F["min_mean_impact"] and len(body) >= 4:
        warn.append(f"deck skews flat (mean body impact {mean_impact} < {F['min_mean_impact']})")

    return {
        "ok": not hard,                       # only the two hard floors gate; rest advise
        "hard": hard, "warnings": warn,
        "metrics": {"mean_body_impact": mean_impact, "n_body": len(body),
                    "n_argument": len(argu), "dataviz_slides": dataviz_slides,
                    "hero_slides": hero_slides, "bland_ratio": bland_ratio,
                    "longest_bland_run": longest_bland_run},
        "bland_slides": bland_slides,
    }
