
# Somalia Cyber Defense Observatory — Build Plan

## Overview
A dark-themed, enterprise-grade SOC (Security Operations Center) dashboard built with React + Vite + Supabase. It monitors cybersecurity posture for Somali government institutions and banks with real automated checks, live alerts, role-based access, and PDF reporting.

---

## 1. Database Schema (Supabase)

### Tables to create:
- **organizations** — name, sector (Government/Bank), domain, risk_score, status, last_scanned_at
- **security_checks** — org_id, check_type (SSL/HTTPS/headers/DNS/uptime), result (pass/fail/warn), details, checked_at
- **alerts** — org_id, type, severity, message, is_read, created_at
- **risk_score_history** — org_id, score, recorded_at (for trend graphs)
- **user_roles** — user_id, role (SuperAdmin / OrgAdmin / Analyst / Auditor)

### RLS Policies:
- SuperAdmin: full access to all tables
- OrgAdmin: read/write only their assigned organization
- Analyst: read-only access to security_checks and alerts
- Auditor: read-only access to all data, no mutations

---

## 2. Pages & Routing

### `/` — National Dashboard (main view)
- Animated circular gauge: **National Cyber Security Score (0–100)**
- Stats row: total organizations, active alerts, orgs at risk
- Risk trend line chart (Recharts) — 30-day score history
- Real-time alert sidebar on the right
- Auto-updates via Supabase Realtime subscriptions

### `/organizations` — Organization Grid
- Filterable cards by sector (All / Government / Bank)
- Each card: org name, domain, risk score badge, status pill (Secure / Warning / Critical)
- Color-coded borders: green → yellow → red by severity
- Clicking a card navigates to its detail page

### `/organizations/:id` — Organization Detail
- Score breakdown radar/bar chart showing the 6 scoring components
- Security check results table (SSL, HTTPS, headers, DNS, uptime) with timestamps
- Alert history for that org
- "Run Scan Now" button triggers the edge function manually

### `/alerts` — Alert Center
- Filterable alert list: all / unread / by severity
- Mark as read, bulk dismiss
- Alert types: score drop below 60, cert expiry < 15 days, missing headers, website offline

### `/reports` — Report Generator
- Select organization + date range
- Preview: risk posture summary, score history chart, check results table, recommendations
- "Download PDF" button calls Supabase Edge Function that generates the PDF using jsPDF

### `/settings` — Admin Only
- Add / remove organizations
- Manage users and role assignments
- Trigger manual full scan

---

## 3. Security Check Engine (Supabase Edge Function: `run-security-checks`)
Runs real HTTP checks against each organization's domain:
- **SSL validity** — verify cert exists and days until expiry
- **HTTPS enforcement** — check HTTP→HTTPS redirect
- **Security headers** — check for HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **DNS resolution** — verify domain resolves
- **Uptime** — HTTP response status check

Results stored in `security_checks` table after each scan.

---

## 4. Risk Scoring Engine
After each scan, automatically recalculates risk score per organization:
- TLS Security: 15%
- Security Headers: 15%
- Availability/Uptime: 10%
- Vulnerability signals: 20%
- Patch signals: 20%
- Threat activity: 20%

Writes new score to `organizations.risk_score` and appends a record to `risk_score_history`.

---

## 5. Automated Scheduling (Edge Function: `scheduled-scan`)
- Uses Supabase `pg_cron` to trigger scans every 6 hours
- Loops through all organizations, runs checks, recalculates scores, creates alerts where thresholds are breached

---

## 6. Alert Engine (inside scan function)
Auto-creates alerts when:
- Risk score drops below 60
- SSL certificate expires in < 15 days
- Critical security headers missing
- Domain/website is offline

---

## 7. PDF Report (Edge Function: `generate-report`)
- Accepts org_id + date range
- Pulls data from Supabase
- Generates PDF with: org name, current score, score trend, check results, risk breakdown, tailored recommendations
- Returns PDF as downloadable binary

---

## 8. Visual Design
- **Dark SOC theme**: deep navy/charcoal background (#0d1117 style)
- **Neon accents**: cyan (#00f5ff), green (#00ff88), amber (#ffaa00), red (#ff4444)
- **Animated gauge**: SVG circular progress with glow effect, animates on load
- **Animated metric lines**: subtle pulsing connection lines between dashboard KPIs
- **Recharts**: dark-styled line, bar, and radar charts with glowing strokes
- **Card design**: glassmorphism panels with colored left borders indicating severity
- **Mobile-responsive**: sidebar collapses to bottom nav on mobile

---

## 9. Seed Data (5–8 organizations)
Pre-loaded mix of:
- 3 government institutions (e.g., Ministry of Finance, Central Bank of Somalia, NISA)
- 3–5 banks (e.g., Dahabshiil Bank, Premier Bank, Salaam Somali Bank)
- Varied risk scores and statuses to showcase all UI states

---

## 10. Authentication & Roles
- Supabase Auth (email/password)
- Role stored in `user_roles` table (separate from profiles)
- RLS enforces data access by role
- Login page with dark SOC-themed design
- Role badge shown in top navigation

