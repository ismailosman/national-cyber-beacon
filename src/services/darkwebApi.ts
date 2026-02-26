import { supabase } from '@/integrations/supabase/client';
import type { DarkWebScan, DarkWebScanListItem } from '@/types/darkweb';

const darkwebPathCandidates = (path: string): string[] => {
  if (path.startsWith('/darkweb/')) {
    // Upstream darkweb routes are served behind /api/* on the scanner backend.
    return [`/api${path}`, path];
  }

  return [path];
};

const isProxyRouteNotFound = (status: number, responseText: string) => {
  return status === 502 && responseText.includes('"status":404');
};

const proxyFetch = async (path: string, method = 'GET', body?: unknown) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token ?? anonKey;
  const candidates = darkwebPathCandidates(path);

  let lastError = 'Request failed';

  for (let i = 0; i < candidates.length; i += 1) {
    const candidatePath = candidates[i];
    const url = `${supabaseUrl}/functions/v1/security-scanner-proxy?path=${encodeURIComponent(candidatePath)}`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    if (!res.ok) {
      const canFallback = i < candidates.length - 1;
      if (canFallback && isProxyRouteNotFound(res.status, text)) {
        lastError = `Route not found for ${candidatePath}`;
        continue;
      }

      throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
    }

    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('API returned invalid JSON');
    }
  }

  throw new Error(lastError);
};

export const startDarkWebScan = async (
  domain: string,
  emails: string[],
  keywords: string[]
): Promise<{ scan_id: string }> => {
  return proxyFetch('/darkweb/scan', 'POST', { domain, emails, keywords });
};

export const getDarkWebScan = async (scanId: string): Promise<DarkWebScan> => {
  return proxyFetch(`/darkweb/scan/${scanId}`);
};

export const listDarkWebScans = async (): Promise<DarkWebScanListItem[]> => {
  const data = await proxyFetch('/darkweb/scans');
  return Array.isArray(data) ? data : data?.scans ?? [];
};

export const pollDarkWebScan = (
  scanId: string,
  onUpdate: (scan: DarkWebScan) => void
): (() => void) => {
  let active = true;

  const run = async () => {
    while (active) {
      try {
        const scan = await getDarkWebScan(scanId);
        onUpdate(scan);
        if (scan.darkweb_status === 'done' || scan.darkweb_status === 'error') break;
      } catch (err) {
        console.error('[DarkWeb Poll]', err);
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  };

  run();
  return () => { active = false; };
};
