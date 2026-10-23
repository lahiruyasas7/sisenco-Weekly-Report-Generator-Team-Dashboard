import type { ReportStatus } from '@/lib/types';

const labels: Record<ReportStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  NEEDS_CORRECTION: 'Needs correction',
  APPROVED: 'Approved',
};

const colors: Record<ReportStatus, string> = {
  DRAFT: 'bg-[#eef0ee] text-[#48534e]',
  SUBMITTED: 'bg-[#e1edff] text-[#24518a]',
  NEEDS_CORRECTION: 'bg-[#fff0d9] text-[#8a4b0c]',
  APPROVED: 'bg-[#d4f1e6] text-[#17654e]',
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${colors[status]}`}
    >
      {labels[status]}
    </span>
  );
}
