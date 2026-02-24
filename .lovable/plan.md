

## Fix Missing Country Flags

### Problem
The `COUNTRY_ISO` lookup map in `CyberMap.tsx` (line 14-24) only has ~24 country entries, but the attack simulation uses 40+ countries across all corridors. Any country not in the map falls back to `'un'` (the UN flag), which is why Bolivia, Morocco, Mauritania, and many others show the wrong flag.

### Solution
Expand the `COUNTRY_ISO` map to include every country that appears in the attack data (sources and targets), plus common countries that Mapbox might return when clicking on the map.

### Changes

**File: `src/pages/CyberMap.tsx` (lines 14-24)**

Add the following missing country ISO codes to the `COUNTRY_ISO` record:

| Country | ISO | Source |
|---------|-----|--------|
| Tunisia | tn | GLOBAL_SOUTH_TARGETS |
| Libya | ly | GLOBAL_SOUTH_TARGETS |
| Cameroon | cm | GLOBAL_SOUTH_TARGETS |
| Qatar | qa | GLOBAL_SOUTH_TARGETS |
| Morocco | ma | GLOBAL_SOUTH_TARGETS |
| DR Congo | cd | GLOBAL_SOUTH_TARGETS |
| Senegal | sn | GLOBAL_SOUTH_TARGETS |
| Mozambique | mz | GLOBAL_SOUTH_TARGETS |
| Angola | ao | GLOBAL_SOUTH_TARGETS |
| Algeria | dz | GLOBAL_SOUTH_TARGETS |
| Belgium | be | EU_TARGETS |
| Spain | es | EU_TARGETS |
| Italy | it | EU_TARGETS |
| Sweden | se | EU_TARGETS |
| Argentina | ar | EU_THREAT_SOURCES |
| Colombia | co | EU_THREAT_SOURCES |
| Chile | cl | THREAT_SOURCES |
| Venezuela | ve | EU_THREAT_SOURCES |
| Ghana | gh | THREAT_SOURCES |

Also add common countries users might click on the map that aren't in the attack data:

| Country | ISO |
|---------|-----|
| Bolivia | bo |
| Paraguay | py |
| Mauritania | mr |
| Mexico | mx |
| Peru | pe |
| Uruguay | uy |
| Ecuador | ec |
| Afghanistan | af |
| Iraq | iq |
| Syria | sy |
| Yemen | ye |
| Jordan | jo |
| Lebanon | lb |
| Oman | om |
| UAE | ae |
| Kuwait | kw |
| Bahrain | bh |
| Myanmar | mm |
| Thailand | th |
| Philippines | ph |
| Malaysia | my |
| Bangladesh | bd |
| Sri Lanka | lk |
| Nepal | np |
| Poland | pl |
| Czech Republic | cz |
| Austria | at |
| Switzerland | ch |
| Norway | no |
| Denmark | dk |
| Finland | fi |
| Portugal | pt |
| Greece | gr |
| Ireland | ie |
| Hungary | hu |
| Serbia | rs |
| Croatia | hr |
| Bulgaria | bg |
| Slovakia | sk |
| Lithuania | lt |
| Latvia | lv |
| Estonia | ee |
| Moldova | md |
| Belarus | by |
| Georgia | ge |
| Armenia | am |
| Azerbaijan | az |
| Kazakhstan | kz |
| Uzbekistan | uz |
| Mongolia | mn |
| Taiwan | tw |
| New Zealand | nz |
| Australia | au |
| Papua New Guinea | pg |
| Fiji | fj |
| Cuba | cu |
| Jamaica | jm |
| Haiti | ht |
| Dominican Republic | do |
| Honduras | hn |
| Guatemala | gt |
| Costa Rica | cr |
| Panama | pa |
| Nicaragua | ni |
| El Salvador | sv |
| Trinidad and Tobago | tt |
| Zambia | zm |
| Zimbabwe | zw |
| Botswana | bw |
| Namibia | na |
| Madagascar | mg |
| Mali | ml |
| Niger | ne |
| Burkina Faso | bf |
| Ivory Coast | ci |
| Benin | bj |
| Togo | tg |
| Sierra Leone | sl |
| Liberia | lr |
| Guinea | gn |
| Gambia | gm |
| Gabon | ga |
| Congo | cg |
| Central African Republic | cf |
| Chad | td |
| Eritrea | er |
| Malawi | mw |
| Lesotho | ls |
| Eswatini | sz |
| Somalia | so |

This comprehensive list covers virtually every country a user could click on the world map, ensuring the correct flag is always displayed instead of the UN default.

### Technical Note
The flags are loaded from `https://flagcdn.com/w40/{iso}.png`. The ISO codes used are the standard ISO 3166-1 alpha-2 codes (lowercase). The fallback `'un'` will still work for any truly obscure or unrecognized territory names that Mapbox might return.

