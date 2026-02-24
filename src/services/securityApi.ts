import { ScanResult, ScanSummary, ScanType } from "@/types/security";

const API_BASE = import.meta.env.VITE_SECURITY_API_URL;
const API_KEY = import.meta.env.VITE_SECURITY_API_KEY;

if (!API_BASE || !API_KEY) {
  console.error("Missing VITE_SECURITY_API_URL or VITE_SECURITY_API_KEY");
}

const headers = () => ({
  "Content-Type": "application/json",
  "x-api-key": API_KEY,
});

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API Error");
  }
  return res.json();
}

export async function checkHealth(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${API_BASE}/health`);
  return handleResponse(res);
}

export async function startScan(
  type: ScanType,
  repoUrl?: string,
  targetUrl = "https://cyberdefense.so"
): Promise<{ scan_id: string; status: string; message: string }> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      scan_type: type,
      repo_url: repoUrl || null,
      target_url: targetUrl,
    }),
  });
  return handleResponse(res);
}

export async function getScan(scanId: string): Promise<ScanResult> {
  const res = await fetch(`${API_BASE}/scan/${scanId}`, {
    headers: headers(),
  });
  return handleResponse(res);
}

export async function listScans(): Promise<{ scans: ScanSummary[] }> {
  const res = await fetch(`${API_BASE}/scans`, {
    headers: headers(),
  });
  return handleResponse(res);
}

export async function deleteScan(scanId: string): Promise<{ deleted: string }> {
  const res = await fetch(`${API_BASE}/scan/${scanId}`, {
    method: "DELETE",
    headers: headers(),
  });
  return handleResponse(res);
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
