import { supabase } from '@/integrations/supabase/client';
import { calculateSecurityScore } from './calculateScore';

export async function snapshotDailyScores(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Check if today's snapshot exists
  const { data: existing } = await supabase
    .from('security_score_history')
    .select('id')
    .eq('recorded_date', today)
    .limit(1);

  if (existing && existing.length > 0) return;

  // Get all active monitored organizations
  const { data: orgs } = await supabase
    .from('organizations_monitored')
    .select('id, name, sector, url')
    .eq('is_active', true);

  if (!orgs || orgs.length === 0) return;

  // Calculate scores and prepare inserts
  const rows: any[] = [];
  for (const org of orgs) {
    try {
      const score = await calculateSecurityScore(org.id);

      // Get uptime percent
      const { data: uptimeLogs } = await supabase.from('uptime_logs')
        .select('status').eq('organization_id', org.id)
        .order('checked_at', { ascending: false }).limit(30);

      let uptimePercent = null;
      if (uptimeLogs && uptimeLogs.length > 0) {
        const upCount = uptimeLogs.filter(u => u.status === 'up').length;
        uptimePercent = Math.round((upCount / uptimeLogs.length) * 10000) / 100;
      }

      rows.push({
        organization_id: org.id,
        organization_name: org.name,
        sector: org.sector,
        security_score: score.total,
        uptime_percent: uptimePercent,
        ssl_valid: score.sslValid,
        threats_count: score.threatsCount,
        recorded_date: today,
      });
    } catch (e) {
      console.error(`Score snapshot failed for ${org.name}:`, e);
    }
  }

  if (rows.length > 0) {
    await supabase.from('security_score_history').insert(rows);
  }
}
