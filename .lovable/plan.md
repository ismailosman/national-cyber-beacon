## Fix Scan Queue Connection via HTTPS/WSS Proxy

### Problem

The Lovable app is served over HTTPS but the Scan Queue tries to connect directly to `http://187.77.222.249:5000` via WebSocket. Browsers block this as "mixed content" -- the connection never even starts, which is why it always shows "Disconnected".

### Solution

Create a backend function that acts as an HTTP proxy to the Kali VPS. The frontend will poll this proxy instead of using a direct WebSocket connection. This avoids mixed content entirely since the frontend only talks to the secure backend URL.

### Changes

**1. Create `supabase/functions/scan-queue-proxy/index.ts**`

A backend function that proxies requests to the Kali VPS:

- `GET /scan-queue-proxy` -- forwards to `http://187.77.222.249:5000/api/jobs` to get current job list
- `POST /scan-queue-proxy` -- forwards to `http://187.77.222.249:5000/api/scan/start` to start a new scan

This keeps the insecure HTTP call server-side where there are no browser restrictions.

**2. Update `src/pages/ScanQueuePanel.tsx**`

Replace the socket.io WebSocket connection with a polling approach:

- Remove `socket.io-client` usage entirely
- Use `setInterval` to poll the proxy function every 3 seconds for job updates
- Use `supabase.functions.invoke("scan-queue-proxy")` for both fetching jobs and starting scans
- Keep the same UI (connection indicator shows "LIVE" when polling succeeds, "Disconnected" on errors)

### Why polling instead of WebSocket?

Backend functions are stateless HTTP handlers -- they cannot maintain persistent WebSocket connections. Polling every 3 seconds provides near-real-time updates and is reliable. The UI experience remains essentially the same.

### Technical Details

The proxy function structure:

```text
GET  -> fetch("http://187.77.222.249:5000/api/jobs") -> return JSON
POST -> fetch("http://187.77.222.249:5000/api/scan/start", body) -> return JSON
```

The frontend polling loop:

```text
setInterval(() => {
  supabase.functions.invoke("scan-queue-proxy", { method: "GET" })
    -> update jobs state
}, 3000)
```

### Files

- **New**: `supabase/functions/scan-queue-proxy/index.ts`
- **Edit**: `src/pages/ScanQueuePanel.tsx` (replace socket.io with polling via proxy)
- **Edit**: `supabase/config.toml` (add function config with `verify_jwt = false`)  
  
Please add this  
const API_BASE = "[https://cybersomalia.com](https://cybersomalia.com)"; // no port needed