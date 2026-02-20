

## Plan: Add ITU National Cybersecurity Index Radar Chart

### What This Does
When the ITU National Cybersecurity Index framework is selected on the Compliance page, a radar/spider chart will appear above the controls table showing the 5 pillars scored 0-100% each, giving a visual snapshot of Somalia's national cybersecurity maturity.

### How It Works
Each of the 5 ITU pillars (Legal, Technical, Organizational, Capacity, Cooperation) gets a score calculated from its assessed controls using the same formula already in use: `(passing x 1.0 + partial x 0.5) / total_assessed x 100`. The radar chart uses the same Recharts RadarChart component already used on the Organization Detail page.

### Changes

**File: `src/pages/Compliance.tsx`**

1. Import `RadarChart`, `Radar`, `PolarGrid`, `PolarAngleAxis`, `PolarRadiusAxis`, `ResponsiveContainer`, and `Tooltip` from `recharts`
2. After the score summary cards (line ~269) and before the domain filter tabs, add a conditional block that only renders when `selectedFrameworkKey === 'itu-nci'`:
   - Compute per-pillar scores by grouping assessments by their control's domain
   - Render a glass-card containing a `RadarChart` with the 5 pillars as axes
   - Show the overall ITU score (average of all 5 pillars) in the center or beside the chart
   - Include a legend showing each pillar's individual score percentage
3. Style the chart to match the existing SOC dark theme (cyan stroke, dark polar grid, matching fonts)

No database changes or new dependencies needed -- Recharts is already installed and RadarChart is already used elsewhere in the project.
