

## Update ScanQueuePanel API_BASE

Update the `API_BASE` constant in `src/pages/ScanQueuePanel.tsx` from the placeholder to your actual Kali VPS address.

### Change

**File: `src/pages/ScanQueuePanel.tsx`**

Replace:
```typescript
const API_BASE = "http://YOUR_KALI_VPS_IP:5000";
```

With:
```typescript
const API_BASE = "http://187.77.222.249:5000";
```

### Notes
- Using the IP address directly since the socket.io connection needs a direct endpoint
- If `cybersomalia.com` resolves to that IP and has port 5000 open, we could alternatively use `http://cybersomalia.com:5000`
- For production use from the HTTPS site, the browser may block mixed content (HTTP WebSocket from HTTPS page). If that happens, you'll need to set up SSL on the VPS or proxy the WebSocket through a domain with HTTPS.

