import { ScanResult, NucleiFinding, SemgrepFinding } from "@/types/security";
import StatusBadge from "./StatusBadge";
import { Loader2 } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-900/40 text-red-400 border-red-800",
  high: "bg-orange-900/40 text-orange-400 border-orange-800",
  medium: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  low: "bg-blue-900/40 text-blue-400 border-blue-800",
  info: "bg-gray-800 text-gray-400 border-gray-700",
  error: "bg-red-900/40 text-red-400 border-red-800",
  warning: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
};

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${SEVERITY_COLORS[s] || SEVERITY_COLORS.info}`}>
      {severity}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-white border-b border-gray-800 pb-2">{title}</h4>
      {children}
    </div>
  );
}

export default function ScanResults({ result }: { result: ScanResult }) {
  const nucleiFindings = result.dast_results?.nuclei?.findings || [];
  const semgrepFindings = result.sast_results?.semgrep?.findings || [];

  const durationStr = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    return secs > 60 ? `${Math.round(secs / 60)}m ${secs % 60}s` : `${secs}s`;
  };

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Scan Results</h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{result.scan_id}</p>
          </div>
          <StatusBadge status={result.status} />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Type", value: result.type.toUpperCase() },
            { label: "Target", value: result.target.replace("https://", "") },
            { label: "Started", value: new Date(result.created_at).toLocaleTimeString() },
            { label: "SAST", value: result.sast_status ?? "N/A" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-sm text-white font-medium">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Progress */}
        {result.status === "running" && (
          <div className="mt-4 space-y-2">
            {result.sast_status && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 w-10">SAST</span>
                <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                  <div className={`h-full rounded-full transition-all ${result.sast_status === "done" ? "bg-green-500 w-full" : "bg-yellow-500 w-1/2 animate-pulse"}`} />
                </div>
                <span className="text-gray-500">{result.sast_status}</span>
              </div>
            )}
            {result.dast_status && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 w-10">DAST</span>
                <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                  <div className={`h-full rounded-full transition-all ${result.dast_status === "done" ? "bg-green-500 w-full" : "bg-yellow-500 w-1/3 animate-pulse"}`} />
                </div>
                <span className="text-gray-500">{result.dast_status}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* Summary cards */}
        {result.status === "done" && (
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Semgrep Findings",
                count: result.sast_results?.semgrep?.findings_count ?? 0,
                color: "text-yellow-400",
                show: !!result.sast_results,
              },
              {
                label: "Nuclei Findings",
                count: result.dast_results?.nuclei?.findings_count ?? 0,
                color: "text-orange-400",
                show: !!result.dast_results?.nuclei,
              },
              {
                label: "ZAP Alerts",
                count: result.dast_results?.zap?.site?.[0]?.alerts?.length ?? 0,
                color: "text-red-400",
                show: !!result.dast_results?.zap,
              },
            ]
              .filter((c) => c.show)
              .map((card) => (
                <div key={card.label} className="bg-gray-800/50 rounded-lg p-3 text-center border border-gray-700/50">
                  <p className={`text-2xl font-bold ${card.color}`}>{card.count}</p>
                  <p className="text-xs text-gray-400 mt-1">{card.label}</p>
                </div>
              ))}
          </div>
        )}

        {/* Nuclei Results */}
        {nucleiFindings.length > 0 && (
          <Section title="🔬 Nuclei Findings">
            <div className="space-y-2">
              {nucleiFindings.map((f: NucleiFinding, i) => (
                <div key={i} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={f.info.severity} />
                    <span className="text-sm text-white font-medium">{f.info.name}</span>
                  </div>
                  {f.info.description && (
                    <p className="text-xs text-gray-400 mb-1">{f.info.description}</p>
                  )}
                  <p className="text-xs text-gray-500 font-mono">{f.matched_at}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Semgrep Results */}
        {semgrepFindings.length > 0 && (
          <Section title="🔍 Semgrep Findings">
            <div className="space-y-2">
              {semgrepFindings.map((f: SemgrepFinding, i) => (
                <div key={i} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={f.extra.severity} />
                    <span className="text-sm text-white font-medium">{f.check_id.split(".").slice(-1)[0]}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{f.extra.message}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    {f.path}:{f.start.line}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Nikto Results */}
        {result.dast_results?.nikto && (
          <Section title="🛡️ Nikto Results">
            <pre className="text-xs text-gray-300 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 overflow-x-auto whitespace-pre-wrap max-h-64">
              {result.dast_results.nikto.raw ||
                JSON.stringify(result.dast_results.nikto, null, 2)}
            </pre>
          </Section>
        )}

        {/* ZAP Results */}
        {result.dast_results?.zap && (
          <Section title="⚡ ZAP Results">
            <pre className="text-xs text-gray-300 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 overflow-x-auto whitespace-pre-wrap max-h-64">
              {JSON.stringify(result.dast_results.zap, null, 2).slice(0, 3000)}
            </pre>
          </Section>
        )}

        {/* No results yet */}
        {result.status === "running" && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-green-500 mx-auto mb-3" />
            <p className="text-sm text-white font-medium">Scan in progress...</p>
            <p className="text-xs text-gray-500 mt-1">This can take 5–15 minutes</p>
          </div>
        )}
      </div>
    </div>
  );
}
