
## Use Circular Logo on CAPTCHA Page

### What Changes

**1. Store the uploaded logo in the media storage bucket** -- Copy the uploaded circular eagle logo to the project assets, then upload it to the storage media bucket as `logo-circle.png` via an edge function.

**2. Update TurnstileGate to use the new logo** -- Change the CAPTCHA page to load the circular logo from the public storage URL instead of the current shield logo import.

### Technical Details

**Step 1: Copy uploaded image to project**
- Copy `user-uploads://682071AD-C08E-4DEF-B7D4-6888D0C43BC5.png` to `src/assets/logo-circle.png` (for local reference)

**Step 2: Update the upload-logo edge function**
- Modify `supabase/functions/upload-logo/index.ts` to also upload the circular logo as `logo-circle.png` to the media bucket (or create a one-time upload approach)

**Step 3: Update `src/pages/TurnstileGate.tsx`**
- Change the logo import from `@/assets/logo.png` to `@/assets/logo-circle.png`
- Update the image styling to be rounded (`rounded-full`) to match the circular logo shape, and size it to `w-12 h-12`

```typescript
// Line 2
import logo from "@/assets/logo-circle.png";

// Line 107-111: update class
<img
  src={logo}
  alt="Somalia Cyber Defence"
  className="w-12 h-12 rounded-full"
/>
```

### Files Modified
- `src/assets/logo-circle.png` (new -- copied from upload)
- `src/pages/TurnstileGate.tsx` (update logo import and styling)
- `supabase/functions/upload-logo/index.ts` (upload logo-circle.png to media bucket)
