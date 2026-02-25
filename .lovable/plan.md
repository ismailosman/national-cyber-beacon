

## Fix: Scan Report Not Showing Data

### Root Cause

The Kali backend returns vulnerability scan results under the key **`vuln_results`**, but the entire frontend (ScanReport, ScanReportCharts, ScanResults, email service) reads from **`dast_results`**.

When you visit `https://cyberdefense.so/scan/0e0769ab-...`:
1. The page loads and fetches the scan data successfully (HTTP 200)
2. The data arrives with `vuln_results: { nikto, nuclei, zap, sqlmap }`
3. The frontend looks for `dast_results` -- which is `undefined`
4. All charts show "No findings", all tables are empty -- the report appears blank

### Solution

Normalize the response in `getScan()` (in `src/services/securityApi.ts`) to map `vuln_results` to `dast_results` when the latter is missing. This is the smallest, safest fix -- one place, all downstream components work automatically.

### Changes

**File: `src/services/securityApi.ts`** -- Update `getScan` function

After fetching the scan result, add a normalization step:

```typescript
export async function getScan(scanId: string): Promise<ScanResult> {
  const raw: any = await proxyRequest(`/scan/${scanId}`);
  // Backend uses "vuln_results" but frontend expects "dast_results"
  if (raw.vuln_results && !raw.dast_results) {
    raw.dast_results = raw.vuln_results;
  }
  return raw as ScanResult;
}
```

This also fixes:
- The email report link (PDF download button on the report page)
- The severity charts and grade calculation
- The detailed findings table
- The "Send Report" email feature from the report page

No other files need changes.
