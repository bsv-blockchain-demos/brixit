type RoleChipProps = {
  /** 'admin' | 'contributor' | 'user' (accepts any string for convenience). */
  role: string;
  className?: string;
};

/**
 * Canonical role/status pill used everywhere a user role is shown.
 *
 * Roles are a *status*, so they use the neutral `select-*` tokens — never the
 * `destructive` (danger/delete) or `action-primary` (CTA) colors.
 *   - admin  → steel filled  (bg-select-bg / text-select-fg)
 *   - others → neutral outline (surface-canvas + hairline border)
 */
export function RoleChip({ role, className = '' }: RoleChipProps) {
  const styles =
    role === 'admin'
      ? 'bg-select-bg text-select-fg'
      : 'bg-surface-canvas text-text-mid border border-hairline';
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full capitalize ${styles} ${className}`}>
      {role}
    </span>
  );
}
