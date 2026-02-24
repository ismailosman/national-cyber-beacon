import { useState } from "react";
import { ScanSummary } from "@/types/security";
import StatusBadge from "./StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toETLocaleString } from "@/lib/dateUtils";

interface Props {
  scans: ScanSummary[];
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll?: () => Promise<void>;
  activeScanId?: string;
}

export default function ScanHistory({ scans, onView, onDelete, onClearAll, activeScanId }: Props) {
  const [clearing, setClearing] = useState(false);
  if (scans.length === 0) return null;

  const clearableCount = scans.filter(s => s.status === "done" || s.status === "error").length;

  async function handleClear() {
    if (!onClearAll) return;
    setClearing(true);
    try { await onClearAll(); } finally { setClearing(false); }
  }

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">📋 History</h3>
        {clearableCount > 0 && onClearAll && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20" disabled={clearing}>
                <Trash2 className="w-3 h-3 mr-1" />
                {clearing ? "Clearing…" : "Clear All"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear scan history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {clearableCount} completed/failed scan{clearableCount !== 1 ? "s" : ""}. Running scans will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
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
                {toETLocaleString(s.created_at)}
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
