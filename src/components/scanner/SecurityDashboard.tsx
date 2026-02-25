import { useState, useEffect, useRef, useCallback } from "react";
import { ScanResult, ScanSummary, ScanType } from "@/types/security";
import { startScan, listScans, getScan, deleteScan, checkHealth, pollScan } from "@/services/securityApi";
import { computeStats, getGrade } from "./ScanReportCharts";
import { sendScanCompletedEmail, sendCriticalAlertEmail, hasCriticalFindings } from "@/services/emailService";
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
  const [clientEmail, setClientEmail] = useState<string | undefined>();
  const [clientName, setClientName] = useState<string | undefined>();
  const [grades, setGrades] = useState<Record<string, { grade: string; score: number }>>({});

  // Track scan IDs that have already had emails sent to prevent duplicates
  const emailedScans = useRef<Set<string>>(new Set());

  useEffect(() => {
    checkHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
    fetchHistory();
  }, []);

  // Resume polling for in-progress scans on mount (resilience to page reloads)
  useEffect(() => {
    if (history.length === 0) return;
    const inProgress = history.find(s => s.status === "queued" || s.status === "running");
    if (inProgress && !scanning) {
      setScanning(true);
      const stop = pollScan(inProgress.scan_id, (result) => {
        setActiveScan(result);
        if (result.status === "done" || result.status === "error") {
          setScanning(false);
          fetchHistory();
        }
      });
      setStopPoll(() => stop);
    }
  }, [history.length]); // only run when history first loads

  // Safety-net: send emails when activeScan becomes "done"
  useEffect(() => {
    if (!activeScan || activeScan.status !== "done") return;
    if (emailedScans.current.has(activeScan.scan_id)) return;

    emailedScans.current.add(activeScan.scan_id);

    const email = clientEmail;
    const name = clientName;

    (async () => {
      try {
        await sendScanCompletedEmail(activeScan, email, name);
        console.log("✅ Scan completed email sent");
      } catch (err) {
        console.error("Email error:", err);
      }
      if (hasCriticalFindings(activeScan)) {
        try {
          await sendCriticalAlertEmail(activeScan, email, name);
          console.log("🚨 Critical alert email sent");
        } catch (err) {
          console.error("Critical alert email error:", err);
        }
      }
    })();
  }, [activeScan?.status, activeScan?.scan_id]);

  async function fetchHistory() {
    try {
      const { scans } = await listScans();
      setHistory(scans);
    } catch {}
  }

  async function handleStartScan(type: ScanType, repoUrl?: string, targetUrl?: string, email?: string, name?: string) {
    setError(null);
    setScanning(true);
    setActiveScan(null);
    setClientEmail(email);
    setClientName(name);
    stopPoll?.();

    try {
      const { scan_id } = await startScan(type, repoUrl, targetUrl);
      const stop = pollScan(scan_id, (result) => {
        setActiveScan(result);
        if (result.status === "done") {
          setScanning(false);
          fetchHistory();
          cacheGrade(result);
        }
        if (result.status === "error") {
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

  function cacheGrade(result: ScanResult) {
    if (result.status === "done") {
      const stats = computeStats(result);
      const g = getGrade(stats.score);
      setGrades(prev => ({ ...prev, [result.scan_id]: { grade: g.grade, score: stats.score } }));
    }
  }

  async function handleViewScan(scanId: string) {
    try {
      const result = await getScan(scanId);
      setActiveScan(result);
      cacheGrade(result);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteScan(scanId: string) {
    await deleteScan(scanId);
    fetchHistory();
    if (activeScan?.scan_id === scanId) setActiveScan(null);
  }

  async function handleClearAll() {
    const toClear = history.filter(s => s.status === "done" || s.status === "error");
    await Promise.all(toClear.map(s => deleteScan(s.scan_id)));
    if (activeScan && toClear.some(s => s.scan_id === activeScan.scan_id)) {
      setActiveScan(null);
    }
    fetchHistory();
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
            onClearAll={handleClearAll}
            activeScanId={activeScan?.scan_id}
            grades={grades}
          />
        </div>

        {/* Right column */}
        <div className="lg:col-span-2">
          {activeScan ? (
            <ScanResults result={activeScan} clientEmail={clientEmail} clientName={clientName} />
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
