

## Add Continent Color Fills to the Cyber Map

### What changes

Add a subtle colored fill for each continent on the map, inserted between the country boundary lines and the Somalia highlight layer. This will make continents visually distinct while keeping the dark SOC theme.

### Color scheme

Each continent gets a unique, low-opacity fill color that is visible but not overwhelming:

- **Africa**: Warm amber/gold (`rgba(245, 158, 11, 0.12)`)
- **Europe**: Cool blue (`rgba(59, 130, 246, 0.12)`)
- **Asia**: Teal/green (`rgba(20, 184, 166, 0.12)`)
- **North America**: Purple (`rgba(168, 85, 247, 0.12)`)
- **South America**: Green (`rgba(34, 197, 94, 0.12)`)
- **Oceania**: Pink/rose (`rgba(244, 63, 94, 0.12)`)
- **Antarctica**: Light gray (`rgba(148, 163, 184, 0.08)`)

### Technical approach

In `src/pages/CyberMap.tsx`, after the `country-boundary-lines` layer is added (~line 995) and before the `somalia-fill` layer (~line 998), insert a single new fill layer called `continent-fills` that uses a Mapbox `match` expression on the `iso_3166_1` property to assign colors by country code.

The implementation uses one fill layer with a large `match` expression mapping ~200 ISO country codes to their continent color, with a transparent default fallback. This is more performant than adding 7 separate layers.

### Changes

**File: `src/pages/CyberMap.tsx`** (single edit, ~lines 996-997)

Insert a new `continent-fills` layer between `country-boundary-lines` and `somalia-fill`:

```typescript
// Continent fill colors for visibility
map.addLayer({
  id: 'continent-fills',
  type: 'fill',
  source: 'country-boundaries',
  'source-layer': 'country_boundaries',
  paint: {
    'fill-color': [
      'match', ['get', 'iso_3166_1'],
      // Africa (amber)
      'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW',
      'rgba(245,158,11,0.12)',
      // Europe (blue)
      'AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU','SM','RS','SK','SI','ES','SE','CH','UA','GB','VA',
      'rgba(59,130,246,0.12)',
      // Asia (teal)
      'AF','AM','AZ','BH','BD','BT','BN','KH','CN','GE','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE',
      'rgba(20,184,166,0.12)',
      // North America (purple)
      'AG','BS','BB','BZ','CA','CR','CU','DM','DO','SV','GD','GT','HT','HN','JM','MX','NI','PA','KN','LC','VC','TT','US',
      'rgba(168,85,247,0.12)',
      // South America (green)
      'AR','BO','BR','CL','CO','EC','GY','PY','PE','SR','UY','VE',
      'rgba(34,197,94,0.12)',
      // Oceania (rose)
      'AU','FJ','KI','MH','FM','NR','NZ','PW','PG','WS','SB','TO','TV','VU',
      'rgba(244,63,94,0.12)',
      // Default (transparent)
      'rgba(0,0,0,0)'
    ],
    'fill-opacity': 1,
  },
});
```

This single layer + match expression approach keeps rendering fast while giving each continent a distinct tint. Somalia's brighter cyan highlight will still stand out on top.
