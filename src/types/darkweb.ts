export interface DarkWebScanRequest {
  domain: string;
  emails: string[];
  keywords: string[];
}

export interface DarkWebFinding {
  [key: string]: unknown;
}

export interface DarkWebSourceResult {
  findings: DarkWebFinding[];
  error?: string;
}

export interface DarkWebResults {
  ransomware: DarkWebSourceResult;
  hibp: DarkWebSourceResult;
  pastes: DarkWebSourceResult;
  ahmia: DarkWebSourceResult;
  intelx: DarkWebSourceResult;
  github: DarkWebSourceResult;
}

export interface DarkWebSummary {
  total_findings: number;
  critical: number;
  high: number;
  medium: number;
}

export interface DarkWebScan {
  scan_id: string;
  domain?: string;
  target?: string;
  darkweb_status: 'queued' | 'running' | 'done' | 'error';
  darkweb_phase?: string;
  darkweb_summary: DarkWebSummary | null;
  darkweb_results: DarkWebResults | null;
  created_at?: string;
}

export interface DarkWebScanListItem {
  scan_id: string;
  domain: string;
  darkweb_status: string;
  darkweb_phase: string;
  created_at: string;
  darkweb_summary: DarkWebSummary | null;
}
