

## Skip Turnstile CAPTCHA on Preview

### Problem
The Turnstile CAPTCHA on the root route (`/`) is failing in the Lovable preview environment because the preview domain isn't authorized in the Cloudflare Turnstile site configuration, blocking access to the Cyber Attack Map.

### Solution
Update `src/App.tsx` to detect whether the app is running on the preview domain and bypass Turnstile in that case, going directly to the CyberMap. Turnstile will still protect the published/production site.

### Technical Details

**File: `src/App.tsx`** (line 75)

Replace:
```tsx
<Route path="/" element={<TurnstileGate />} />
```

With logic that checks `window.location.hostname` -- if it includes `lovable.app` or `localhost`, render `<CyberMap />` directly; otherwise render `<TurnstileGate />`.

This can be done inline:
```tsx
<Route path="/" element={
  window.location.hostname.includes('lovable.app') || window.location.hostname === 'localhost'
    ? <CyberMap />
    : <TurnstileGate />
} />
```

One file changed, one line modified.
