import { ScanSummary } from "@/types/security";
import StatusBadge from "./StatusBadge";

interface Props {
  scans: ScanSummary[];
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  activeScanId?: string;
}

export default function ScanHistory({ scans, onView, onDelete, activeScanId }: Props) {
  if (scans.length === 0) return null;

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-3">📋 History</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {scans.map((s) => (
          <div
            key={s.scan_id}
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              activeScanId === s.scan_id
                ? "border-green-700 bg-green-900/20"
                : "border-gray-800 hover:border-gray-700 bg-gray-800/30"
            }`}
            onClick={() => onView(s.scan_id)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono text-gray-300 uppercase">{s.type}</span>
                <StatusBadge status={s.status} small />
              </div>
              <p className="text-xs text-gray-500 truncate">
                {new Date(s.created_at).toLocaleString()}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.scan_id);
              }}
              className="text-gray-600 hover:text-red-400 text-xs ml-2 shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
