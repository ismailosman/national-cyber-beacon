import { supabase } from '@/integrations/supabase/client';
import type { DarkWebScan, DarkWebScanListItem } from '@/types/darkweb';

const proxyFetch = async (path: string, method = 'GET', body?: unknown) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token ?? anonKey;

  const url = `${supabaseUrl}/functions/v1/api-proxy?path=${encodeURIComponent(path)}`;

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
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('API returned invalid JSON');
  }
};

export const startDarkWebScan = async (
  domain: string,
  emails: string[],
  keywords: string[],
  usernames: string[] = []
): Promise<{ scan_id: string }> => {
  return proxyFetch('/darkweb/scan', 'POST', { domain, emails, keywords, usernames });
};

export const getDarkWebScan = async (scanId: string): Promise<DarkWebScan> => {
  return proxyFetch(`/darkweb/scan/${scanId}`);
};

export const listDarkWebScans = async (): Promise<DarkWebScanListItem[]> => {
  const data = await proxyFetch('/darkweb/scans');
  const scans = Array.isArray(data) ? data : data?.scans ?? [];
  return scans.map((s: Record<string, unknown>) => ({
    ...s,
    domain: (s.domain ?? s.target ?? '') as string,
    darkweb_status: (s.darkweb_status ?? s.status ?? 'unknown') as string,
  })) as DarkWebScanListItem[];
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
