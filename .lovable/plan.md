

## Make Verified Findings Interactive with Expanded Details

### Problem
The verified finding cards are not clickable/interactive. The "Evidence" collapsible trigger doesn't look clickable (no cursor pointer, no visual affordance), and the cards lack detailed remediation guidance and check metadata from `verified_checks`.

### Solution
Enhance each finding card to be fully interactive with:
1. Fix the Evidence collapsible to be visually clickable (cursor-pointer, hover effects, chevron rotation)
2. Add a "Recommendation" section to each finding with remediation guidance
3. Add a detailed "Scan Summary" panel below findings showing `verified_checks` data (uptime status, SSL details, header grade, DNS records status, DDoS protection status)

### Changes in `src/pages/OrgDetail.tsx`

**1. Fix Evidence Collapsible Interactivity**
- Add `cursor-pointer` to `CollapsibleTrigger`
- Add chevron rotation animation on open state (track with Collapsible `open` prop)
- Add hover background effect to the trigger
- Make the entire evidence section more prominent

**2. Add Remediation Text per Category**
Create a `getRemediation(category, severity)` helper that returns actionable fix guidance:
- Uptime/CRITICAL: "Investigate server health, check hosting provider status, verify DNS configuration"
- SSL/CRITICAL: "Renew or install a valid SSL certificate immediately"
- DDoS Protection/MEDIUM: "Consider deploying a CDN/WAF like Cloudflare, AWS Shield, or Akamai"
- Security Headers/HIGH: "Add missing headers to your web server configuration (nginx/Apache) or CDN settings"
- DNS Security/MEDIUM: "Add SPF/DMARC TXT records to your DNS zone to prevent email spoofing"

Display this as a small "Recommendation" line under each finding with a lightbulb icon.

**3. Add Verified Checks Summary Panel**
Below the findings list, add a summary grid showing the structured `verified_checks` data:
- Uptime: verdict badge (ONLINE/OFFLINE) with method and status code
- SSL: valid badge, days until expiry, issuer, common name
- Headers: score bar, grade badge, list of missing headers
- DNS: SPF present/absent, DMARC present/absent, zone transfer status
- DDoS: verdict badge, list of detected providers

This gives users a complete at-a-glance view of all check results even for passing checks.

### File Modified
- `src/pages/OrgDetail.tsx` -- fix collapsible interactivity, add remediation text, add checks summary panel
