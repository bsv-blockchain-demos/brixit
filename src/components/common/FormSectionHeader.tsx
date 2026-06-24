export function FormSectionHeader({ title, required, description }: { title: string; required?: boolean; description?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <h3 className="text-xl font-display font-bold leading-none" style={{ color: 'var(--text-dark)' }}>{title}</h3>
        {required && (
          <span
            aria-label="Required"
            className="text-xl font-bold leading-none"
            style={{ color: 'var(--action-danger)' }}
          >
            *
          </span>
        )}
      </div>
      {description && (
        <p className="text-sm mt-1.5 leading-snug" style={{ color: 'var(--text-mid)' }}>
          {description}
        </p>
      )}
    </div>
  );
}
