
# Fix: Reduce "Attacks Today" Counter to a Realistic Number

## The Problem

Line 87 of `src/hooks/useLiveAttacks.ts` seeds the starting daily attack count at:

```typescript
const BASE_COUNT = Math.floor(2_000_000 + Math.random() * 6_000_000);
// → random value between 2,000,000 and 8,000,000
```

This is far too large. The user wants it capped under 1,000,000, and more importantly, it should reflect a plausible daily attack count for Somalia's national cyber threat context.

## The Fix

Change `BASE_COUNT` to a realistic range of **3,000 – 15,000** attacks per day. This is:
- Credible for a developing-nation CERT
- Still impressive enough to look meaningful on the dashboard
- Grows naturally throughout the day as the live mock generator adds ~1 attack/second

The comment explaining the old logic ("2M–8M range like professional threat maps") will also be updated to reflect the new intent.

## Single Line Change

**File:** `src/hooks/useLiveAttacks.ts`, **Line 86–87**

```typescript
// Before:
// Seed with realistic daily count (2M–8M range like professional threat maps)
const BASE_COUNT = Math.floor(2_000_000 + Math.random() * 6_000_000);

// After:
// Seed with a credible daily count for a national CERT context (3K–15K range)
const BASE_COUNT = Math.floor(3_000 + Math.random() * 12_000);
```

## Result

- The counter on the landing page, cyber map, and threat map will now show values like **"4,287"** or **"11,943"** instead of **"5,342,891"**
- The counter still increments by 1 with each simulated attack (every ~0.3–1 second), so it grows naturally during the session
- No other files need changing — `useLiveAttacks` is the single source of truth for this value
