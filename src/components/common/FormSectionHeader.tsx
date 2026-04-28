export function FormSectionHeader({ title, required }: { title: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <h3 className="text-xl font-display font-bold" style={{ color: 'var(--text-dark)' }}>{title}</h3>
      {required && (
        <span
          className="px-3 py-1 text-sm font-medium rounded-full"
          style={{ backgroundColor: 'var(--blue-pale)', color: 'var(--green-mid)' }}
        >
          Required
        </span>
      )}
    </div>
  );
}
