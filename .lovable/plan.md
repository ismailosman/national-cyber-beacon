

## Comprehensive PDF Security Report

### Problem
The current PDF report generator (`generate-scan-report/index.ts`) only renders vulnerability scanner findings. When a scan returns zero vulnerabilities (score 100/A), the entire report is blank -- no scanner breakdown, no findings, nothing useful. Meanwhile, the scan data contains valuable recon information (Nmap, SSL, DNS, WHOIS, WhatWeb) that is completely ignored by the PDF.

### What Will Change

**`supabase/functions/generate-scan-report/index.ts`** -- Major enhancement to include all scan data:

**Page 1 -- Executive Summary (enhanced)**
- Keep existing: header, target info, score gauge, vulnerability summary boxes
- Add: Recon Status Summary showing pass/fail indicators for each check performed
- Add: Scanner Breakdown now always shows scanners even if they returned 0 findings (shows "0 - Clean" instead of hiding them)

**Page 2 -- Infrastructure & Recon Report (NEW)**
- SSL/TLS Assessment: Extract from `recon_results.sslscan` -- protocol versions enabled/disabled, certificate details, cipher suites, heartbleed status. Show pass/fail badges.
- Open Ports: Parse `recon_results.nmap` -- list open ports with services, show risk assessment
- DNS Configuration: Parse `recon_results.dns` -- nameservers, DNSSEC status, record types
- Technology Stack: Parse `recon_results.whatweb` -- detected technologies (server, frameworks, cookies)
- Domain Registration: Parse `recon_results.whois` -- registrar, creation/expiry dates, nameservers

**Page 3+ -- Detailed Findings (existing, unchanged)**
- Vulnerability details with remediation (only rendered if findings exist)

**Page N -- Remediation Action Plan (existing, unchanged)**
- Prioritized remediation steps (only rendered if findings exist)

### Technical Approach

The recon data parsing will extract structured information from raw tool outputs:

```text
sslscan output  ->  Extract: TLS versions, cipher suites, cert validity, heartbleed status
nmap output     ->  Extract: Open ports, services, OS detection
whatweb output  ->  Extract: Server type, frameworks, cookies, headers
whois output    ->  Extract: Registrar, dates, nameservers, DNSSEC
dns output      ->  Extract: Nameservers, record types
```

Each section will use pass/fail indicators:
- Green checkmark for secure configurations (TLS 1.2+, no heartbleed, etc.)
- Red X for issues (old TLS versions, exposed ports, missing DNSSEC)

### Email Attachment
The PDF attachment in `send-pentest-email` is already implemented from the previous change. Once the PDF content is comprehensive, the attachment will automatically contain the full report. No changes needed to the email function.

### Files Modified
- `supabase/functions/generate-scan-report/index.ts` -- Add recon data parsing and rendering (Infrastructure & Recon page)
