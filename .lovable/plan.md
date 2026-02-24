

## Update CAPTCHA Page Logo

### Change
Replace the favicon image on the Turnstile CAPTCHA gate page with the project's shield logo.

### File: `src/pages/TurnstileGate.tsx`

**Line 1**: Add an import for the logo asset:
```typescript
import logo from "@/assets/logo.png";
```

**Line 107**: Change the `img` src from `"/favicon.png"` to `{logo}` and slightly increase the size for better visibility:
```tsx
<img
  src={logo}
  alt="Somalia Cyber Defence"
  className="w-10 h-10"
/>
```

That's it — a two-line change to swap the logo source and use the proper asset import.

