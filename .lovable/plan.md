

## Upgrade LeakCheck Section with Pro API v2 Rich Data

### Overview
Replace the generic `FindingsTable` rendering for the LeakCheck tab with a custom rich section that groups findings by type, shows detailed breach cards with severity-based styling, and displays API quota remaining.

### Changes

**`src/pages/DarkWebMonitor.tsx`**

1. **New `LeakCheckSection` component** (inline, after `CavalierSection`):
   - Accepts `findings` array and `quotaRemaining` number
   - Groups findings into 3 sub-sections with headers:
     - "Domain Breaches" (`type === "domain_breach"`)
     - "Email Breaches" (`type === "email_breach"`)
     - "Keyword Mentions" (`type === "keyword_mention"`)
   - Within each group, sort CRITICAL findings first, then HIGH, then MEDIUM
   - Each finding card shows:
     - Left border color: red (CRITICAL), orange (HIGH), yellow (MEDIUM)
     - Severity badge with matching color
     - `breach_name` in bold + `breach_date` in grey beside it
     - `email` and `username` if present
     - If `has_password === true`, show red pill badge "🔑 Password Exposed"
     - `fields` array rendered as small grey chip tags (e.g., `[email] [password] [phone]`)
     - `message` in small grey text
   - If 0 findings: green checkmark "No credential leaks detected"
   - Footer note: "API quota remaining: X queries" in grey text

2. **Replace LeakCheck tab content**: In the `TabsContent` for the `leakcheck` key, render `LeakCheckSection` instead of `FindingsTable`

3. **Update summary stats**: Add leakcheck findings count to `augmentedTotal`, and count CRITICAL/HIGH leakcheck findings into `augmentedCritical`/`augmentedHigh` (same pattern as cavalier augmentation)

### Finding Card Layout
```text
+-----------------------------------------------------------+
| [RED BORDER]  [CRITICAL]  breach_name  |  breach_date     |
|  email: user@example.com   username: admin                 |
|  🔑 Password Exposed                                      |
|  [email] [username] [password] [phone]                     |
|  "Found in breach database with exposed credentials"       |
+-----------------------------------------------------------+
```

### Files Modified
- `src/pages/DarkWebMonitor.tsx` -- add `LeakCheckSection` component, wire it into the leakcheck tab, update summary stat augmentation

### No other files changed
All existing sections, styling, types, and API code remain untouched.

