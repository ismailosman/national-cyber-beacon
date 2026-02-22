

## Landing Page Updates: Bigger Logo, Replace Contact Section, AI-Generated Image, Email Integration

### Overview
Four changes to the landing page: enlarge the navbar logo, replace the "Contact Us" section with a two-column evaluation/consultation request page (inspired by the reference image), generate an AI image of a Somali cybersecurity professional, and create a backend function to send form submissions to osmando@gmail.com via the existing Resend integration.

### Changes

#### 1. Navbar Logo -- Make Bigger
**File:** `src/components/landing/Navbar.tsx`
- Change logo height from `h-8` to `h-12` for better visibility

#### 2. Remove "Contact Us" Section, Replace with Consultation Request Page
**File:** `src/components/landing/ContactSection.tsx` -- Complete rewrite

Inspired by the reference image (Dell-style two-column layout):

**Left column (info side, blue/dark background `#1a1a2e` or brand-tinted):**
- Heading: "CyberDefense Security Solutions Evaluation"
- AI-generated image of a Somali cybersecurity professional (see item 3)
- Description text about CyberDefense services
- Brief pitch about real-time monitoring, threat detection, infrastructure protection

**Right column (form side, accent background `#FF4D2E` or similar):**
- Heading: "Submit your consultation request today."
- Subtext: "Our team will respond within 24 hours."
- Form fields (two-column grid where appropriate):
  - First Name, Last Name
  - Company, Title (dropdown: CTO, CISO, IT Manager, Other)
  - Phone, Business Email
  - Choose Service Interest (checkboxes): Threat Detection, Real-Time Monitoring, Infrastructure Protection, Incident Response, DAST Scanning, Compliance Assessment
  - Country, Organization Size
  - Comments (textarea)
  - Submit button

On submit, the form calls a new edge function that sends the data to osmando@gmail.com.

#### 3. AI-Generated Image of Somali Cybersecurity Professional
- Use the Lovable AI image generation (google/gemini-2.5-flash-image) to generate a professional image
- The image will be generated at build time via an edge function, or we can generate it once and save to storage
- Approach: Generate the image using the AI model in a new edge function, save to storage bucket, and reference it from the contact section
- Simpler approach: Use the AI gateway from an edge function called once, store the result, and display it

**Recommended approach:** Create the image via an edge function `generate-professional-image` that generates and caches it in Supabase Storage. The ContactSection fetches it from storage. Alternatively, generate it locally during development and commit a static asset.

Given complexity, the simplest reliable approach: generate the image via the edge function on first request, cache in a storage bucket, and serve from there.

#### 4. Email Sending Edge Function
**File:** `supabase/functions/send-contact-form/index.ts` (new)

- Receives form data (all fields from the consultation form)
- Uses the existing `RESEND_API_KEY` secret
- Sends a formatted HTML email to osmando@gmail.com
- From address: noreply@cyberdefense.so (consistent with existing edge functions)
- Returns success/error response
- CORS headers included

#### 5. Update Landing.tsx
**File:** `src/pages/Landing.tsx`
- Remove `ContactSection` import and usage (replaced inline or kept as component with new content)
- The "Contact" nav item in the navbar still scrolls to this section, so keep `id="contact"` on the new section

#### 6. Navbar "Contact" Nav Item
Keep the "Contact" nav item -- it will scroll to the new consultation request section (same `id="contact"`).

### File Summary

| File | Action |
|---|---|
| `src/components/landing/Navbar.tsx` | Increase logo size from h-8 to h-12 |
| `src/components/landing/ContactSection.tsx` | Complete rewrite -- two-column consultation request form |
| `supabase/functions/send-contact-form/index.ts` | New -- sends form data email to osmando@gmail.com via Resend |
| `supabase/config.toml` | Add `[functions.send-contact-form]` with `verify_jwt = false` |
| `src/pages/Landing.tsx` | No structural change (still imports ContactSection) |

### Technical Details

**Edge function (`send-contact-form/index.ts`):**
- Uses `RESEND_API_KEY` (already configured)
- Sends to: osmando@gmail.com
- From: noreply@cyberdefense.so
- HTML email with all form fields formatted in a table
- Input validation for required fields (first name, last name, email)

**AI Image generation:**
- Will use a new edge function `generate-professional-image` that calls the Lovable AI gateway with google/gemini-2.5-flash-image model
- Prompt: "Professional portrait photo of a Somali man in business attire working as a cybersecurity professional, standing in a modern office environment, holding a laptop, professional lighting, corporate style"
- The generated image is stored in a Supabase Storage bucket (`public-assets`) and cached
- The ContactSection fetches the image URL from storage
- A storage bucket and policy will be created via migration

**Database migration needed:**
- Create a `public-assets` storage bucket (public, for the generated image)

