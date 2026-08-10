# React.FC with Inline Props

Every React component is declared as `React.FC` with its props typed INLINE in the generic parameter. NEVER declare an `interface` or `type` alias for a component's props — not exported, not file-local, not "just this once for a big prop list."

```tsx
// CORRECT
export const ProfilesTable: React.FC<{ companyRef: CompanyFragmentType }> = ({ companyRef }) => {

// CORRECT — existing/generic types composed inline (no new props declaration)
const SubscriberDetailPageV2: React.FC<EntryPointComponentProps<{ query: QueryType }>> = ({ queries }) => {

// INCORRECT — props interface
interface ProfilesTableProps { companyRef: CompanyFragmentType; }
export const ProfilesTable = ({ companyRef }: ProfilesTableProps) => {

// INCORRECT — inline props but no React.FC
export const ProfilesTable = ({ companyRef }: { companyRef: CompanyFragmentType }) => {
```

- The ban is on DECLARING a props type; referencing existing types inside the inline literal (generated `$key` types, shared enums, `EntryPointComponentProps`) is fine.
- Modern `@types/react` `React.FC` does not include `children` implicitly; when a component takes children, put `children: React.ReactNode` in the inline type (or wrap with `React.PropsWithChildren<{...}>`).
- Scope: components being written or substantively edited. Leave untouched existing components alone (churn); when a touched component violates this, fix it as part of the touch.
- **Copies/mirrors are exempt**: when copying or mirroring an original that uses `React.VFC` or a named props interface, keep the original's exact declaration shape. `VFC` is acceptable when appropriate; "converting" a copy to FC-inline is unwanted divergence (Chance, USP-805 round 3). This rule governs NEW components only.
- Agent briefs for React work must state this rule explicitly; reject teammate work that declares props types.

Sits with the other component-shape rules: [no-ternaries](no-ternaries.md), [no-let-in-components](no-let-in-components.md), no `any`/casts (global standards).
