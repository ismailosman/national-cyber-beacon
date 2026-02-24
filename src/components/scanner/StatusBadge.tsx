import { ScanStatus } from "@/types/security";

const STATUS_CONFIG: Record<ScanStatus, { label: string; classes: string; dot: string }> = {
  queued:  { label: "Queued",  classes: "bg-gray-800 text-gray-400 border-gray-700",    dot: "bg-gray-500" },
  running: { label: "Running", classes: "bg-yellow-900/30 text-yellow-400 border-yellow-700", dot: "bg-yellow-400 animate-pulse" },
  done:    { label: "Done",    classes: "bg-green-900/30 text-green-400 border-green-700",  dot: "bg-green-500" },
  error:   { label: "Error",   classes: "bg-red-900/30 text-red-400 border-red-700",    dot: "bg-red-500" },
};

export default function StatusBadge({
  status,
  small = false,
}: {
  status: ScanStatus;
  small?: boolean;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full font-medium ${
      small ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1"
    } ${config.classes}`}>
      <span className={`rounded-full ${small ? "w-1.5 h-1.5" : "w-2 h-2"} ${config.dot}`} />
      {config.label}
    </span>
  );
}
