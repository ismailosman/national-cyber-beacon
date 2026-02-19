

# Add Realistic Attack Names + Source State/Country to Live Feed

## What's Changing

The live feed currently shows generic attack type labels (e.g., "Malware", "DDoS"). Based on the reference screenshot, each feed entry should instead display:

1. **A realistic attack/signature name** as the title (e.g., "DNS MX record null prefix", "DONUT HUSKY", "NULL Encoding detected within a HT...")
2. **Timestamp + source state/country -> target state/country** on the second line (e.g., "13:07:34 United States -> CA, United States")
3. **Colored circle indicator** (amber/orange ring) instead of the left border stripe

## Changes

### 1. Add attack signature names and states to `useLiveAttacks.ts`

- Add a `name` field to the `LiveThreat` interface
- Add a `state` field to each source location (e.g., "Beijing" for China, "Moscow" for Russia, "CA" for USA, "Nairobi" for Kenya, etc.)
- Add a pool of ~30 realistic IDS/IPS signature names per attack type, deterministically picked by the seeded PRNG
- Add a `target_state` to Somalia targets (e.g., "Mogadishu", "Banaadir")

Attack name examples per type:
- **Malware**: "DONUT HUSKY", "Cobalt Strike Beacon", "Agent Tesla Keylogger", "Emotet Dropper Detected"
- **Phishing**: "DNS MX record null prefix", "Credential Harvest Form", "OAuth Token Phish Attempt"
- **Exploit**: "NULL Encoding detected within a HT...", "Apache Log4j RCE", "SMB EternalBlue Exploit"
- **DDoS**: "SYN Flood Volumetric Attack", "DNS Amplification Detected", "HTTP Slowloris Connection"
- **Intrusion**: "Brute Force SSH Login", "Lateral Movement via WMI", "Pass-the-Hash NTLM Relay"

### 2. Update feed UI in both desktop sidebar and mobile drawer (`CyberMap.tsx`)

Replace current feed entry layout with the reference-style design:

```text
Before:                              After:
┌──────────────────────────┐        ┌──────────────────────────┐
│ [flag] China -> Somalia  │        │ (o) DNS MX record null.. │
│ MALWARE          [HIGH]  │        │     13:07:34 Germany ->  │
│ 2s ago                   │        │     Berlin, Germany      │
└──────────────────────────┘        └──────────────────────────┘
```

Each entry will show:
- **Row 1**: Colored ring icon + attack signature name (truncated with ellipsis)
- **Row 2**: HH:MM:SS timestamp + source country -> state, target country
- Severity determines the ring color (critical=red, high=orange, medium=yellow, low=cyan)

### 3. Add header matching reference: "ATTACKS" with current rate

Replace "Live Feed" header with "ATTACKS" label and a "Current rate -- N --" control matching the reference screenshot style.

## Technical Details

### `src/hooks/useLiveAttacks.ts`

- Extend `LiveThreat` interface:
  ```typescript
  export interface LiveThreat {
    id: string;
    name: string;  // NEW: attack signature name
    source: { lat: number; lng: number; country: string; state: string };  // ADD state
    target: { lat: number; lng: number; country: string; state: string };  // ADD state
    attack_type: AttackType;
    severity: Severity;
    timestamp: number;
  }
  ```

- Add `state` to every entry in `THREAT_SOURCES`, `WEIGHTED_SOURCES`, and `SOMALIA_TARGETS`
- Add `ATTACK_SIGNATURES` map with ~6 realistic names per attack type
- In `generateDayThreat`, pick a signature name deterministically from the pool

### `src/pages/CyberMap.tsx`

- Update desktop feed entries (lines 1494-1530) and mobile feed entries (lines 1573-1594) to use new layout
- Replace `[flag] Country -> Somalia` with `(ring) Attack Name` on line 1, and `HH:MM:SS Source -> State, Target` on line 2
- Add `formatTime` helper to render `HH:MM:SS` from timestamp
- Update header from "Live Feed" to "ATTACKS" with current rate display

## Files Changed

| File | What |
|---|---|
| `src/hooks/useLiveAttacks.ts` | Add `name` and `state` fields, attack signature pool, deterministic name selection |
| `src/pages/CyberMap.tsx` | Update feed entry UI for desktop + mobile to match reference style |

