import { useState } from "react";
import { ScanType } from "@/types/security";
import { Loader2 } from "lucide-react";

interface Props {
  onScan: (type: ScanType, repoUrl?: string, targetUrl?: string, clientEmail?: string, clientName?: string) => void;
  scanning: boolean;
  apiOnline: boolean | null;
}

const SCAN_TYPES = [
  {
    value: "dast" as ScanType,
    label: "DAST Only",
    icon: "🌐",
    desc: "ZAP + Nuclei + Nikto against your target",
  },
  {
    value: "sast" as ScanType,
    label: "SAST Only",
    icon: "🔍",
    desc: "Semgrep static analysis on your source code",
  },
  {
    value: "full" as ScanType,
    label: "Full Scan",
    icon: "⚡",
    desc: "SAST + DAST running in parallel",
  },
];

export default function ScanForm({ onScan, scanning, apiOnline }: Props) {
  const [selectedType, setSelectedType] = useState<ScanType>("dast");
  const [repoUrl, setRepoUrl] = useState("https://github.com/ismailosman/national-cyber-beacon");
  const [targetUrl, setTargetUrl] = useState("https://cyberdefense.so");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const needsRepo = selectedType === "sast" || selectedType === "full";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiOnline) return;
    onScan(selectedType, needsRepo ? repoUrl : undefined, targetUrl, clientEmail || undefined, clientName || undefined);
  }

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">🚀 Launch Scan</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Scan type selector */}
        <div className="space-y-2">
          {SCAN_TYPES.map((t) => (
            <label key={t.value} className="flex items-start gap-3 p-3 rounded-lg border border-gray-800 hover:border-gray-700 cursor-pointer transition-colors">
              <input
                type="radio"
                name="scanType"
                checked={selectedType === t.value}
                onChange={() => setSelectedType(t.value)}
                className="mt-1 accent-green-500"
              />
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Repo URL (only for SAST/Full) */}
        {needsRepo && (
          <div className="space-y-1">
            <label className="text-xs text-gray-400 font-medium">
              GitHub Repository URL *
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
              required={needsRepo}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
          </div>
        )}

        {/* Target URL */}
        <div className="space-y-1">
          <label className="text-xs text-gray-400 font-medium">Target URL *</label>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://example.com"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Client Notifications */}
        <div className="border-t border-gray-700 pt-4 mt-2">
          <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">
            Client Notifications (optional)
          </p>
          <div className="space-y-2">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="Client email"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={scanning || !apiOnline}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {scanning ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning...
            </span>
          ) : (
            `Start ${SCAN_TYPES.find((t) => t.value === selectedType)?.label}`
          )}
        </button>

        {apiOnline === false && (
          <p className="text-xs text-red-400 text-center">
            API is offline — check cybersomalia.com
          </p>
        )}
      </form>
    </div>
  );
}
