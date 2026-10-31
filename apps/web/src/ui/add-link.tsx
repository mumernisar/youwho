'use client';

import { useTracker } from './add-department';

export function AddDepartmentLink() {
  const { openAdd } = useTracker();
  return (
    <button type="button" onClick={openAdd} className="min-h-11 text-sm underline underline-offset-2 hover:no-underline">
      Add your department
    </button>
  );
}
