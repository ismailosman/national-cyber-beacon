import { ScanResult, ScanSummary, ScanType } from "@/types/security";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function proxyRequest<T>(path: string, method = "GET", body?: any): Promise<T> {
  const url = `${SUPABASE_URL}/functions/v1/security-scanner-proxy?path=${encodeURIComponent(path)}`;
  
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.error || "API Error");
  }
  return res.json();
}

export async function checkHealth(): Promise<{ status: string; version: string }> {
  return proxyRequest("/health");
}

export async function startScan(
  type: ScanType,
  repoUrl?: string,
  targetUrl = "https://cyberdefense.so"
): Promise<{ scan_id: string; status: string; message: string }> {
  const body: Record<string, any> = { scan_type: type };
  if (repoUrl) body.repo_url = repoUrl;
  if (type !== "sast" && targetUrl) body.target_url = targetUrl;
  return proxyRequest("/scan", "POST", body);
}

export async function getScan(scanId: string): Promise<ScanResult> {
  return proxyRequest(`/scan/${scanId}`);
}

export async function listScans(): Promise<{ scans: ScanSummary[] }> {
  return proxyRequest("/scans");
}

export async function deleteScan(scanId: string): Promise<{ deleted: string }> {
  return proxyRequest(`/scan/${scanId}`, "DELETE");
}

export function pollScan(
  scanId: string,
  onUpdate: (result: ScanResult) => void,
  intervalMs = 5000
): () => void {
  let active = true;

  const poll = async () => {
    while (active) {
      try {
        const result = await getScan(scanId);
        onUpdate(result);
        if (result.status === "done" || result.status === "error") break;
      } catch (err) {
        console.error("Poll error:", err);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };

  poll();
  return () => { active = false; };
}
