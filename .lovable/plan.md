

## Make Attack Lines Thick and Highly Visible

### Overview
Increase line widths across all arc rendering layers to match the reference image, which shows bold, prominent attack lines with strong glow.

### Changes

**File: `src/pages/CyberMap.tsx`** -- Increase all line widths

| Layer | Line | Current | New |
|-------|------|---------|-----|
| Guide rail (dim base arc) | 781 | `1.2` | `2.5` |
| Glow trail | 806 | `6` | `14` |
| Core bright line | 820 | `1.5` | `3.5` |
| Impact ring 1 | 864 | `1.5` | `2.5` |
| Impact ring 2 (flash) | 881 | `2.5` | `3.5` |
| Impact ring 3 (outer) | 894 | `1.5` | `2.5` |

Also increase glow intensity:
- **Line 808**: `shadowBlur` from `12` to `20` for stronger glow trail effect
- **Line 804**: glow alpha from `0.25` to `0.4` for more visible trailing glow
- **Line 779**: base guide rail alpha from `0.18` to `0.25` so the full arc path is more visible

### Result
Attack arcs will appear bold and prominent like the reference image, with thick glowing lines that are easy to see against the dark map background.

