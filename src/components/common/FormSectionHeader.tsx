export function FormSectionHeader({ title, required }: { title: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <h3 className="text-xl font-display font-bold leading-none" style={{ color: 'var(--text-dark)' }}>{title}</h3>
      {required && (
        <span
          className="text-sm font-medium leading-none"
          style={{ color: 'var(--green-mid)' }}
        >
          Required
        </span>
      )}
    </div>
  );
}
