# React.FC with Inline Props

Every React component is declared as `React.FC` with its props typed INLINE in the generic parameter. Never declare an `interface` or a `type` alias for a component's props: not exported, not file-local, not once for a long prop list.

```tsx
// CORRECT
export const ProfilesTable: React.FC<{ companyRef: CompanyFragmentType }> = ({ companyRef }) => {

// INCORRECT: a props interface
interface ProfilesTableProps { companyRef: CompanyFragmentType; }
export const ProfilesTable = ({ companyRef }: ProfilesTableProps) => {
```

- The ban is on DECLARING a props type. Referencing existing types inside the inline literal (generated `$key` types, shared enums, `EntryPointComponentProps`) is fine.
- `React.FC` no longer includes `children`. A component that takes children puts `children: React.ReactNode` in the inline type, or wraps with `React.PropsWithChildren<{...}>`.
- Scope: components being written, and components you touch. An untouched component stays as it is.
- A copy or a mirror keeps its original's exact declaration shape, `React.VFC` and a named props interface included.
- An agent brief for React work carries this rule.

Sits with the other component-shape rules: [no-ternaries](no-ternaries.md), [no-let-in-components](no-let-in-components.md), no `any`/casts (global standards).
