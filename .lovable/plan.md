

## Increase Continent Fill Opacity for Better Visibility

### Problem
The current continent fill colors use very low opacity (0.12), making them barely visible against the dark map background. The "WebGL" error is an environment limitation, not a code issue.

### Changes

**File: `src/pages/CyberMap.tsx`** (lines 1007-1023)

Increase the alpha values in each continent's `rgba()` color from `0.12` to `0.25` for a noticeably stronger tint while still keeping the dark SOC aesthetic:

| Continent      | Before                        | After                         |
|----------------|-------------------------------|-------------------------------|
| Africa         | `rgba(245,158,11,0.12)`       | `rgba(245,158,11,0.25)`       |
| Europe         | `rgba(59,130,246,0.12)`       | `rgba(59,130,246,0.25)`       |
| Asia           | `rgba(20,184,166,0.12)`       | `rgba(20,184,166,0.25)`       |
| North America  | `rgba(168,85,247,0.12)`       | `rgba(168,85,247,0.25)`       |
| South America  | `rgba(34,197,94,0.12)`        | `rgba(34,197,94,0.25)`        |
| Oceania        | `rgba(244,63,94,0.12)`        | `rgba(244,63,94,0.25)`        |

This doubles the visibility while keeping the fills translucent enough not to obscure country boundaries or the Somalia highlight.

