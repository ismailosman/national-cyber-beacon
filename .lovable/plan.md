

## Make Hero Headline Fully Red

### Change
Update the headline in `src/components/landing/HeroSection.tsx` so that "Secure Your Business with" is the same red color (`#FF4D2E`) as "Advanced Cyber Defense", making the entire headline uniformly red/orange.

### Technical Detail
- **File:** `src/components/landing/HeroSection.tsx`
- Change the `h1` text color from `text-white` to `text-[#FF4D2E]`
- Remove the separate `<span className="text-[#FF4D2E]">` wrapper around "Advanced Cyber Defense" since the whole heading will now share the same color

