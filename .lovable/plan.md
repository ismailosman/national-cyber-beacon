

## Replace Hero Section Background Video

### Overview
Replace the current hero section background video (`/herosection.mp4`) with the Shutterstock preview video URL, using it as a direct source in the video element.

### Changes

**File: `src/components/landing/HeroSection.tsx`**

Update the video `<source>` element to point to the new Shutterstock URL and change the type from `video/mp4` to `video/webm`:

```text
Before:
  <source src="/herosection.mp4" type="video/mp4" />

After:
  <source src="https://www.shutterstock.com/shutterstock/videos/3814669891/preview/stock-footage-fast-code-and-screen-with-software-cybersecurity-or-it-for-overload-or-digital-glitch-tech.webm" type="video/webm" />
```

Keep the existing `<source src="/herosection.mp4" type="video/mp4" />` as a fallback in case the external URL fails to load (e.g., due to CORS or network issues).

### Files Modified
- `src/components/landing/HeroSection.tsx` -- update video source URL

### Notes
- The Shutterstock preview URL is a `.webm` file, so it needs the correct MIME type
- The local `/herosection.mp4` is kept as a fallback source
- No other files need changes

