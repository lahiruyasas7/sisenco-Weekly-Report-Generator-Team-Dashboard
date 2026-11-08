import type { TeamReportStatus } from '@/lib/types';

const statusPresentation: Record<
  TeamReportStatus,
  { label: string; className: string }
> = {
  NOT_STARTED: {
    label: 'Not started',
    className: 'bg-[#eef0ee] text-[#48534e]',
  },
  DRAFT: { label: 'Draft', className: 'bg-[#fff0d9] text-[#8a4b0c]' },
  SUBMITTED: { label: 'Submitted', className: 'bg-[#e1edff] text-[#24518a]' },
  NEEDS_CORRECTION: {
    label: 'Needs correction',
    className: 'bg-[#fff0d9] text-[#8a4b0c]',
  },
  APPROVED: { label: 'Approved', className: 'bg-[#d4f1e6] text-[#17654e]' },
};

export function TeamStatusBadge({ status }: { status: TeamReportStatus }) {
  const presentation = statusPresentation[status];
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${presentation.className}`}
    >
      {presentation.label}
    </span>
  );
}
