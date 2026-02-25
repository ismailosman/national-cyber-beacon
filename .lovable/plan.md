## Update Hero Section Heading Text and Color

### Change

In `src/components/landing/HeroSection.tsx`, update the hero heading from "Secure Your Business with Advanced Cyber Defense" to "Precision Cyber Defense for High-Risk Environments" — all in white (removing the red accent span).

### Technical Detail

**File: `src/components/landing/HeroSection.tsx**` (lines 28-31)

- Replace the current `<h1>` content (which splits text between white and a red `<span>`) with a single line of all-white text:

```tsx
<h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] text-white tracking-tight">
  Precision Cyber Defense for High-Risk Environments
</h1>
```

One file, one small change. Also disable turnstile capture when editing and using lovable preview the main page and /cyber-map page. Only use captcha for the domain of the site cyberdefense.so