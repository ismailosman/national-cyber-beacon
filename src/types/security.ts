export type ScanType = "sast" | "dast" | "full";

export type ScanStatus = "queued" | "running" | "done" | "error";

export interface SemgrepFinding {
  check_id: string;
  path: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
  extra: {
    message: string;
    severity: string;
    metadata?: Record<string, any>;
  };
}

export interface NucleiFinding {
  template: string;
  info: {
    name: string;
    severity: string;
    description?: string;
    tags?: string[];
  };
  matched_at: string;
  timestamp: string;
}

export interface ZapAlert {
  alert: string;
  riskdesc: string;
  confidence: string;
  desc: string;
  solution: string;
  reference: string;
  url: string;
}

export interface SASTResults {
  semgrep?: {
    findings_count: number;
    findings: SemgrepFinding[];
    errors: any[];
  };
  error?: string;
}

export interface DASTResults {
  nikto?: { raw?: string; vulnerabilities?: any[] };
  nuclei?: { findings_count: number; findings: NucleiFinding[] };
  zap?: { site?: any[]; raw?: string };
  error?: string;
}

export interface ScanResult {
  scan_id: string;
  status: ScanStatus;
  type: ScanType;
  target: string;
  repo_url?: string;
  created_at: string;
  sast_status?: ScanStatus | null;
  dast_status?: ScanStatus | null;
  sast_started?: string;
  sast_finished?: string;
  dast_started?: string;
  dast_finished?: string;
  sast_results?: SASTResults;
  dast_results?: DASTResults;
}

export interface ScanSummary {
  scan_id: string;
  status: ScanStatus;
  type: ScanType;
  target: string;
  created_at: string;
}
