'use client';

import { useTracker } from './add-department';
import { Plus } from './icons';

export function AddDepartmentButton({ variant = 'secondary' }: { variant?: 'secondary' | 'card' }) {
  const { openAdd } = useTracker();
  if (variant === 'card') {
    return (
      <button
        type="button"
        onClick={openAdd}
        className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-5 text-ink-2 transition hover:border-brand hover:bg-brand-soft hover:text-brand"
      >
        <Plus className="h-6 w-6" />
        <span className="font-semibold">Add your department</span>
        <span className="text-sm text-muted">Paste the link of its Google Sites seating page</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={openAdd} className="btn btn-secondary btn-sm">
      <Plus className="h-4 w-4" />
      Add your department
    </button>
  );
}
