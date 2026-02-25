import { supabase } from '@/integrations/supabase/client';
import type { DarkWebScan, DarkWebScanListItem } from '@/types/darkweb';

const invoke = async (path: string, method = 'GET', body?: unknown) => {
  const params = new URLSearchParams({ path });
  const url = `security-scanner-proxy?${params}`;

  const options: Record<string, unknown> = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }

  const { data, error } = await supabase.functions.invoke(url.split('?')[0], {
    body: method === 'GET' ? undefined : body,
    method: method as 'GET' | 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  // For GET requests, we need to pass the path via query params
  // The edge function reads `path` from URL search params
  if (error) throw new Error(error.message ?? 'Request failed');
  return data;
};

const proxyFetch = async (path: string, method = 'GET', body?: unknown) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token ?? anonKey;

  const url = `${supabaseUrl}/functions/v1/security-scanner-proxy?path=${encodeURIComponent(path)}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
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
