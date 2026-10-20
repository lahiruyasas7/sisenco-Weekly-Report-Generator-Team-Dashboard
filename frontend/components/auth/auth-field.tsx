import type { ReactNode } from 'react';

type AuthFieldProps = {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
};

export const authInputClassName =
  'h-9 w-full rounded-md border border-[#c9ccc7] bg-white px-2.5 text-sm text-[#202623] outline-none transition focus:border-[#0c7c72] focus:ring-2 focus:ring-[#0c7c72]/15';

export function AuthField({ id, label, error, children }: AuthFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] text-[#545f5b]">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
