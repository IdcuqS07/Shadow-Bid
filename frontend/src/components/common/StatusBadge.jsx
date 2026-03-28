import { Badge } from "@/components/ui/badge";

const statusConfig = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-transparent" },
  closed: { label: "Closed", className: "bg-blue-100 text-blue-700 border-transparent" },
  reveal_open: { label: "Closed", className: "bg-blue-100 text-blue-700 border-transparent" },
  challenge: {
    label: "Challenge",
    className: "bg-amber-100 text-amber-700 border-transparent",
  },
  pending_settlement: {
    label: "Challenge",
    className: "bg-amber-100 text-amber-700 border-transparent",
  },
  settled: { label: "Settled", className: "bg-slate-200 text-slate-700 border-transparent" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-transparent" },
  disputed: { label: "Disputed", className: "bg-rose-100 text-rose-700 border-transparent" },
  committed: { label: "Committed", className: "bg-violet-100 text-violet-700 border-transparent" },
  revealed: { label: "Revealed", className: "bg-sky-100 text-sky-700 border-transparent" },
};

export const StatusBadge = ({ status, testId }) => {
  const config = statusConfig[status] || {
    label: status,
    className: "bg-slate-100 text-slate-700 border-transparent",
  };

  return (
    <Badge className={config.className} data-testid={testId}>
      {config.label}
    </Badge>
  );
};
