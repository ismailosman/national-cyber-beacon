

## Fix: 405 Method Not Allowed on `/scan/jobs`

### Problem
The upstream scan queue API at `cybersomalia.com/scan/jobs` returns **405 Method Not Allowed** because the proxy sends a **GET** request, but the API expects **POST**.

### Solution
Change the `fetch` call for listing jobs from GET to POST in the edge function.

### Change
**File: `supabase/functions/scan-queue-proxy/index.ts`** (line 87-91)

Update the list jobs fetch to use POST method:

```typescript
const upstream = await fetch(`${API_BASE}/scan/jobs`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "x-api-key": API_KEY,
  },
  body: JSON.stringify({}),
});
```

This is a one-line-scope fix -- just adding `method: "POST"`, `Content-Type` header, and an empty JSON body to the existing fetch call for listing jobs.

