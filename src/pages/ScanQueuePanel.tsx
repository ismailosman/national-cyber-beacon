import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

const API_BASE = "http://187.77.222.249:5000";

type JobStatus = "queued" | "running" | "completed" | "failed";

interface Job {
  id: string;
  status: JobStatus;
  scan_type: string;
  target: string;
  progress: number;
  log?: string;
  started_at?: string;
  created_at: string;
}

const statusColors: Record<JobStatus, string> = {
  queued:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  running:   "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  failed:    "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusIcons: Record<JobStatus, string> = {
  queued:    "⏳",
  running:   "⚡",
  completed: "✅",
  failed:    "❌",
};

function ProgressBar({ progress, status }: { progress: number; status: JobStatus }) {
  const color =
    status === "failed" ? "bg-destructive"
    : status === "completed" ? "bg-green-500"
    : "bg-blue-500";

  return (
    <div className="w-full bg-muted rounded-full h-1.5 mt-2">
      <div
        className={`h-1.5 rounded-full transition-all duration-500 ${color} ${
          status === "running" ? "animate-pulse" : ""
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const elapsed = job.started_at
    ? Math.round((Date.now() - new Date(job.started_at).getTime()) / 1000)
    : null;

  return (
    <div className={`border rounded-lg p-4 mb-3 ${statusColors[job.status]}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusIcons[job.status]}</span>
          <span className="font-bold text-sm">{job.scan_type}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[job.status]}`}>
            {job.status.toUpperCase()}
          </span>
        </div>
        {job.status === "running" && elapsed !== null && (
          <span className="text-xs text-muted-foreground">{elapsed}s elapsed</span>
        )}
      </div>
      <div className="text-xs text-muted-foreground truncate mb-1">
        🎯 <span className="font-mono">{job.target}</span>
      </div>
      {job.log && (
        <div className="text-xs text-muted-foreground/70 italic mb-1">
          → {job.log}
        </div>
      )}
      <ProgressBar progress={job.progress || 0} status={job.status} />
      <div className="flex justify-between mt-2 text-xs text-muted-foreground/60">
        <span>ID: {job.id?.slice(0, 8)}...</span>
        <span>{new Date(job.created_at).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

export default function ScanQueuePanel() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [connected, setConnected] = useState(false);
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState("DAST");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(API_BASE, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("jobs_snapshot", (data: Job[]) => {
      setJobs(data);
    });

    socket.on("job_update", (updatedJob: Job) => {
      setJobs((prev) => {
        const exists = prev.find((j) => j.id === updatedJob.id);
        if (exists) {
          return prev.map((j) => (j.id === updatedJob.id ? updatedJob : j));
        }
        return [updatedJob, ...prev];
      });
    });

    return () => { socket.disconnect(); };
  }, []);

  const startScan = async () => {
    if (!target.trim()) return;
    await fetch(`${API_BASE}/api/scan/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan_type: scanType, target }),
    });
    setTarget("");
  };

  const queued    = jobs.filter((j) => j.status === "queued");
  const running   = jobs.filter((j) => j.status === "running");
  const completed = jobs.filter((j) => j.status === "completed" || j.status === "failed");

  return (
    <div className="bg-card text-foreground p-6 rounded-xl min-h-screen font-mono">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-neon-cyan">🔍 Scan Queue</h1>
        <span className={`text-xs px-3 py-1 rounded-full border ${
          connected
            ? "bg-green-500/20 text-green-400 border-green-500/30"
            : "bg-red-500/20 text-red-400 border-red-500/30"
        }`}>
          {connected ? "● LIVE" : "○ Disconnected"}
        </span>
      </div>

      {/* Start Scan */}
      <div className="bg-background rounded-lg p-4 mb-6 border border-border">
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest">New Scan</p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setScanType("DAST")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
              scanType === "DAST"
                ? "bg-blue-500/30 text-blue-300 border-blue-500"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            DAST
          </button>
          <button
            onClick={() => setScanType("SAST")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
              scanType === "SAST"
                ? "bg-purple-500/30 text-purple-300 border-purple-500"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            SAST
          </button>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-neon-cyan"
            placeholder={scanType === "DAST" ? "https://target.com" : "/path/to/code"}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startScan()}
          />
          <button
            onClick={startScan}
            className="bg-neon-cyan/80 hover:bg-neon-cyan text-background px-4 py-2 rounded-lg text-sm font-bold transition-all"
          >
            Start
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Queued",    count: queued.length,    color: "text-yellow-400" },
          { label: "Running",   count: running.length,   color: "text-blue-400" },
          { label: "Completed", count: completed.length, color: "text-green-400" },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-background rounded-lg p-3 text-center border border-border">
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Running Jobs */}
      {running.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">⚡ Running</p>
          {running.map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      )}

      {/* Queued Jobs */}
      {queued.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">⏳ Queued</p>
          {queued.map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      )}

      {/* Completed/Failed */}
      {completed.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">📋 History</p>
          {completed.slice(0, 10).map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      )}

      {jobs.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No scans yet. Start your first scan above.
        </div>
      )}
    </div>
  );
}
