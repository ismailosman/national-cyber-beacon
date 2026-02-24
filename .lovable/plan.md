

## Allow Custom Target URL + Verify Report

### 1. Make Target URL Editable in ScanForm

**`src/components/scanner/ScanForm.tsx`**
- Replace the hardcoded readonly "https://cyberdefense.so" display with an editable URL input field
- Add `targetUrl` state initialized to `https://cyberdefense.so` as a default
- Update the `onScan` callback signature to pass `targetUrl` as a third parameter: `onScan(type, repoUrl, targetUrl)`
- Update the Props interface: `onScan: (type: ScanType, repoUrl?: string, targetUrl?: string) => void`
- Add URL validation (required, type="url")
- Update DAST description to say "ZAP + Nuclei + Nikto against your target" instead of hardcoding cyberdefense.so

### 2. Wire Target URL Through SecurityDashboard

**`src/components/scanner/SecurityDashboard.tsx`**
- Update `handleStartScan` to accept and forward `targetUrl` parameter
- Pass it to `startScan(type, repoUrl, targetUrl)` which already supports the parameter (it defaults to cyberdefense.so in securityApi.ts)

### 3. No Backend Changes Needed

The `startScan` function in `src/services/securityApi.ts` already accepts a `targetUrl` parameter (line 33) and passes it as `target_url` to the API. The edge function proxy forwards everything. Only the UI was hardcoded.

### 4. Verify Report Rendering

After implementation, navigate to `/security-scanner`, run a DAST scan against a chosen site, and verify:
- Charts render (severity donut, scanner breakdown, score gauge)
- Expandable findings table works
- Scan metadata displays correctly

