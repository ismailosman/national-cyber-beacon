import { useState, useEffect } from "react";
import { ScanResult, ScanSummary, ScanType } from "@/types/security";
import { startScan, listScans, getScan, deleteScan, checkHealth, pollScan } from "@/services/securityApi";
import ScanForm from "./ScanForm";
import ScanResults from "./ScanResults";
import ScanHistory from "./ScanHistory";
import { Shield } from "lucide-react";

export default function SecurityDashboard() {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [activeScan, setActiveScan] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stopPoll, setStopPoll] = useState<(() => void) | null>(null);

  useEffect(() => {
    checkHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const { scans } = await listScans();
      setHistory(scans);
    } catch {}
  }

  async function handleStartScan(type: ScanType, repoUrl?: string) {
    setError(null);
    setScanning(true);
    setActiveScan(null);
    stopPoll?.();

    try {
      const { scan_id } = await startScan(type, repoUrl);
      const stop = pollScan(scan_id, (result) => {
        setActiveScan(result);
        if (result.status === "done" || result.status === "error") {
          setScanning(false);
          fetchHistory();
        }
      });
      setStopPoll(() => stop);
    } catch (err: any) {
      setError(err.message);
      setScanning(false);
    }
  }

  async function handleViewScan(scanId: string) {
    try {
      const result = await getScan(scanId);
      setActiveScan(result);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteScan(scanId: string) {
    await deleteScan(scanId);
    fetchHistory();
    if (activeScan?.scan_id === scanId) setActiveScan(null);
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 border border-green-700/50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">CyberDefense Scanner</h1>
              <p className="text-xs text-muted-foreground">Powered by CyberSomalia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${apiOnline === true ? "bg-green-500" : apiOnline === false ? "bg-red-500" : "bg-gray-500 animate-pulse"}`} />
            <span className="text-xs text-muted-foreground">
              {apiOnline === true ? "API Online" : apiOnline === false ? "API Offline" : "Checking..."}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-400">⚠ {error}</p>
            </div>
          )}
          <ScanForm onScan={handleStartScan} scanning={scanning} apiOnline={apiOnline} />
          <ScanHistory
            scans={history}
            onView={handleViewScan}
            onDelete={handleDeleteScan}
            activeScanId={activeScan?.scan_id}
          />
        </div>

        {/* Right column */}
        <div className="lg:col-span-2">
          {activeScan ? (
            <ScanResults result={activeScan} />
          ) : (
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl flex flex-col items-center justify-center py-20">
              <span className="text-4xl mb-4">🛡️</span>
              <p className="text-sm font-medium text-foreground">Ready to Scan</p>
              <p className="text-xs text-muted-foreground mt-1">
                Initiate a SAST, DAST, or Full scan from the panel on the left.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
