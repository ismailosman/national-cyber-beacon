

## Visual Security Scanner Report + Dashboard Link Fix

### 1. Fix Dashboard Sidebar Link

**`src/components/layout/Sidebar.tsx`** (line 12)
- Change `{ to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true }` to `{ to: '/dashboard', ... }`
- This ensures clicking the Dashboard icon navigates to `/dashboard` instead of the landing page `/`

---

### 2. Create Visual Report Component for Security Scanner

**New file: `src/components/scanner/ScanReportCharts.tsx`**

A Recharts-powered visual report component (matching the DAST Scanner style) that receives `ScanResult` data and renders:

- **Overall Security Score Gauge** -- using the existing `CircularGauge` component with a calculated score (100 - criticals x 25 - highs x 10 - mediums x 3 - lows x 1, clamped 0-100) and letter grade (A-F)
- **Severity Distribution Donut Chart** -- Recharts `PieChart` showing critical/high/medium/low/info counts with matching colors (red, orange, yellow, blue, gray)
- **Scanner Breakdown Bar Chart** -- Horizontal `BarChart` showing findings per tool (Semgrep, Nuclei, ZAP, Nikto) with colored bars
- **Summary Cards Row** -- Color-coded stat cards for Total Findings, Critical, High, Medium, Low counts (same style as DAST Scanner's summary cards)

---

### 3. Redesign ScanResults with Professional Report Layout

**`src/components/scanner/ScanResults.tsx`** -- Full rewrite to match DAST Scanner style:

- **Header section**: Scan metadata (type, target, time, status) with status badge
- **Charts section** (when status is "done"): Import and render `ScanReportCharts` with the score gauge + donut + bar chart in a grid layout
- **Findings Table**: Replace raw JSON/YAML dumps with a structured expandable table (like the DAST scanner) showing:
  - Each tool (Nuclei, Semgrep, ZAP, Nikto) as collapsible rows
  - Per-finding rows with severity badge, name, description, matched location
  - Status icons (pass/fail) and evidence expandable sections
- **Progress section**: Keep the existing running state with animated progress bars

The raw `<pre>` blocks for ZAP and Nikto results will be replaced with parsed, readable findings in the same table format.

---

### Technical Details

- **Recharts** (already installed v2.15.4) -- PieChart, BarChart, Cell, RadialBarChart
- **CircularGauge** (existing component at `src/components/dashboard/CircularGauge.tsx`) -- reused for score display
- Score formula: `max(0, 100 - (critical * 25 + high * 10 + medium * 3 + low * 1))`
- Grade thresholds match DAST scanner: A (90+), B (75+), C (60+), D (40+), F (<40)
- Color palette: Critical=#dc2626, High=#f97316, Medium=#eab308, Low=#3b82f6, Info=#6b7280
- Dark theme styling consistent with existing SOC aesthetic (gray-900 backgrounds, border-gray-800)

