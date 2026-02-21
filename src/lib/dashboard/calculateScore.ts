import { supabase } from '@/integrations/supabase/client';

export interface ScoreBreakdown {
  total: number;
  sslValid: boolean;
  sslPoints: number;
  uptimePercent: number;
  uptimePoints: number;
  headersCount: number;
  headersPoints: number;
  portsExposed: boolean;
  portsPoints: number;
  cdnWaf: boolean;
  cdnWafPoints: number;
  emailAuth: boolean;
  emailPoints: number;
  noWarnings: boolean;
  warningsPoints: number;
  threatsCount: number;
}

export async function calculateSecurityScore(orgId: string): Promise<ScoreBreakdown> {
  const breakdown: ScoreBreakdown = {
    total: 0, sslValid: false, sslPoints: 0, uptimePercent: 0, uptimePoints: 0,
    headersCount: 0, headersPoints: 0, portsExposed: false, portsPoints: 0,
    cdnWaf: false, cdnWafPoints: 0, emailAuth: false, emailPoints: 0,
    noWarnings: true, warningsPoints: 0, threatsCount: 0,
  };

  // SSL check
  const { data: ssl } = await supabase.from('ssl_logs').select('is_valid')
    .eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(1);
  if (ssl?.[0]?.is_valid) { breakdown.sslValid = true; breakdown.sslPoints = 20; }

  // Uptime check (last 30 entries)
  const { data: uptime } = await supabase.from('uptime_logs').select('status')
    .eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(30);
  if (uptime && uptime.length > 0) {
    const upCount = uptime.filter(u => u.status === 'up').length;
    breakdown.uptimePercent = Math.round((upCount / uptime.length) * 10000) / 100;
    if (breakdown.uptimePercent > 99) breakdown.uptimePoints = 15;
    else if (breakdown.uptimePercent > 95) breakdown.uptimePoints = 10;
  }

  // Security headers
  const { data: headers } = await supabase.from('early_warning_logs').select('details')
    .eq('organization_id', orgId).eq('check_type', 'security_headers')
    .order('checked_at', { ascending: false }).limit(1);
  if (headers?.[0]?.details) {
    const d = headers[0].details as any;
    const present = d.present_headers || d.headers_found || [];
    breakdown.headersCount = Array.isArray(present) ? present.length : 0;
    breakdown.headersPoints = Math.min(breakdown.headersCount * 3, 21);
  }

  // Open ports
  const { data: ports } = await supabase.from('early_warning_logs').select('details, risk_level')
    .eq('organization_id', orgId).eq('check_type', 'open_ports')
    .order('checked_at', { ascending: false }).limit(1);
  if (ports?.[0]) {
    breakdown.portsExposed = ports[0].risk_level !== 'safe';
    breakdown.portsPoints = breakdown.portsExposed ? 0 : 10;
  } else {
    breakdown.portsPoints = 10; // assume safe if no data
  }

  // CDN/WAF
  const { data: ddos } = await supabase.from('ddos_risk_logs').select('has_cdn, has_waf')
    .eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(1);
  if (ddos?.[0]) {
    breakdown.cdnWaf = ddos[0].has_cdn || ddos[0].has_waf;
    breakdown.cdnWafPoints = breakdown.cdnWaf ? 7 : 0;
  }

  // Email auth (SPF/DMARC)
  const { data: email } = await supabase.from('early_warning_logs').select('details, risk_level')
    .eq('organization_id', orgId).eq('check_type', 'email_security')
    .order('checked_at', { ascending: false }).limit(1);
  if (email?.[0]) {
    breakdown.emailAuth = email[0].risk_level === 'safe';
    breakdown.emailPoints = breakdown.emailAuth ? 7 : 0;
  }

  // Critical warnings
  const { data: warnings } = await supabase.from('early_warning_logs').select('id')
    .eq('organization_id', orgId).eq('risk_level', 'critical').limit(1);
  breakdown.noWarnings = !warnings || warnings.length === 0;
  breakdown.warningsPoints = breakdown.noWarnings ? 20 : 0;

  // Threats count
  const { count } = await supabase.from('alerts').select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId).eq('status', 'open');
  breakdown.threatsCount = count || 0;

  breakdown.total = breakdown.sslPoints + breakdown.uptimePoints + breakdown.headersPoints +
    breakdown.portsPoints + breakdown.cdnWafPoints + breakdown.emailPoints + breakdown.warningsPoints;

  return breakdown;
}
