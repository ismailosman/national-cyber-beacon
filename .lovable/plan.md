

## Interactive Dashboard Redesign -- Command Center with Charts and Visualizations

This is a major redesign of the Dashboard page into a full command center with interactive charts, clickable elements, and real-time data visualization. The work is split into manageable components.

### New Database Table

Create a `security_score_history` table to store daily score snapshots for trend tracking:

- `id` (uuid, PK)
- `organization_id` (uuid, references organizations_monitored)
- `organization_name` (text)
- `sector` (text)
- `security_score` (integer)
- `uptime_percent` (numeric)
- `ssl_valid` (boolean)
- `threats_count` (integer)
- `recorded_date` (date, default CURRENT_DATE)
- `recorded_at` (timestamptz, default now())
- UNIQUE constraint on (organization_id, recorded_date)
- RLS: authenticated users can read, SuperAdmin/Analyst can write

### Files to Create

| File | Purpose |
|---|---|
| `src/lib/dashboard/calculateScore.ts` | Security score calculator -- computes score from SSL, uptime, headers, ports, DDoS, email checks |
| `src/lib/dashboard/snapshotScores.ts` | Daily snapshot function -- checks if today's snapshot exists, calculates and stores scores |
| `src/components/dashboard/TopStatsBar.tsx` | 5 clickable stat cards: Orgs, Uptime Rate, SSL Valid, Avg Security, Active Alerts |
| `src/components/dashboard/OrgScoresBarChart.tsx` | Horizontal bar chart of all org scores with sector filters, clickable bars navigate to org detail |
| `src/components/dashboard/ThreatDonutChart.tsx` | Donut chart showing threat distribution by severity, clickable segments |
| `src/components/dashboard/ScoreTrendChart.tsx` | 30-day area chart with overall/best/worst sector lines from security_score_history |
| `src/components/dashboard/ThreatTimelineChart.tsx` | Stacked area chart of daily threats by severity over 30 days |
| `src/components/dashboard/OrgCard.tsx` | Rich org card with mini sparkline, key metrics, progress bar, status icons |
| `src/components/dashboard/SectorComparison.tsx` | Collapsible table + radar chart comparing sectors |
| `src/components/dashboard/RiskHeatMap.tsx` | Grid heatmap: orgs (rows) vs security dimensions (columns) with colored cells |

### File to Modify

| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | Complete rewrite to compose all new sections: TopStatsBar, charts row, trend row, org grid, sector comparison, risk heat map |

### Technical Details

**Score Calculation** (`calculateScore.ts`):
- Queries latest SSL, uptime, early_warning, ddos_risk, dast_scan data for each org
- Scoring: SSL valid (+20), Uptime >99% (+15) / >95% (+10), No critical warnings (+20), Security headers per header (+3, max +21), No exposed ports (+10), CDN/WAF (+7), SPF/DMARC (+7)
- Returns breakdown object with total score and individual metrics

**Daily Snapshot** (`snapshotScores.ts`):
- Called once when dashboard loads
- Checks if today's date exists in security_score_history
- If not, calculates scores for all active orgs in organizations_monitored and bulk inserts
- Uses the calculateScore function

**TopStatsBar** component:
- 5 cards in a row: Organizations count, Uptime %, SSL valid ratio, Avg security score, Active alerts
- Each card clickable (navigates to relevant page via react-router)
- Pulse animation on alerts card when critical alerts exist
- Trend comparison vs last week shown as small arrow + text

**OrgScoresBarChart** (Recharts BarChart, horizontal):
- Queries all orgs and their calculated scores
- Color-coded bars: green (90+), light green (75-89), yellow (60-74), orange (40-59), red (0-39)
- Sector filter buttons above chart
- onClick handler navigates to `/organizations/{id}`
- Dashed reference line at score 70

**ThreatDonutChart** (Recharts PieChart with inner radius):
- Aggregates severity counts from alerts + early_warning_logs
- Center label shows total count
- onClick on segments can set a filter state lifted to Dashboard

**ScoreTrendChart** (Recharts AreaChart):
- Reads from security_score_history grouped by date
- 3 lines: overall average, best sector avg, worst sector avg
- Shaded area between best/worst
- Shows "Collecting trend data..." if fewer than 2 days of data

**ThreatTimelineChart** (Recharts AreaChart, stacked):
- Groups early_warning_logs + alerts by day and severity over 30 days
- 4 stacked colored areas
- Spike detection: marks days with 3x average

**OrgCard** component:
- Mini Recharts sparkline (tiny AreaChart, 14-day data from security_score_history)
- Key metrics: SSL status, uptime %, active threats, DAST grade
- Bottom progress bar colored by score
- Status icons row: Headers, Ports, Email, DNS, WAF
- Click navigates to org detail page

**SectorComparison** (collapsible):
- Table grouping orgs by sector with averages
- Recharts RadarChart comparing sectors across 5 dimensions
- Click sector row to filter org grid

**RiskHeatMap**:
- Table with orgs as rows, security dimensions as columns
- Each cell colored green/yellow/red based on latest check data
- Tooltip on hover showing details

**Responsive Layout**:
- Desktop: 2 charts per row, 3 org cards per row
- Tablet: 1 chart per row, 2 cards per row
- Mobile: fully stacked

**Auto-refresh**:
- React Query refetchInterval of 5 minutes on all dashboard queries
- "Last updated: X min ago" indicator in header

**Data Sources** (all from existing tables, no new edge functions):
- `organizations_monitored` -- org list
- `ssl_logs` -- SSL validity
- `uptime_logs` -- uptime status
- `early_warning_logs` -- headers, ports, email, DNS checks
- `ddos_risk_logs` -- CDN/WAF status
- `dast_scan_results` -- DAST grades
- `alerts` -- active alerts
- `threat_events` -- threat counts
- `security_score_history` (new) -- daily score snapshots for trends

