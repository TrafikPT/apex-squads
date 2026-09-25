/**
 * Maps GEP's internal names (legend codenames, map ids, weapon codes) to the
 * display names the dashboard uses. Unknown values fall back to something
 * readable instead of failing, so a new season only makes names look rough.
 */
import { OTHER_WEAPON } from './ui/weapons';

/** "[SOY] name" / "[SOY]name" -> "name": the kill feed drops the space after the clan tag. */
export function baseName(name: string): string {
  return name.replace(/^\[[^\]]*\]\s*/, '').trim();
}

/** Every legend's display name. Keep in step with ui/assets/legends (scripts/fetch-legend-portraits.mjs). */
const LEGENDS = [
  'Alter', 'Ash', 'Axle', 'Ballistic', 'Bangalore', 'Bloodhound', 'Catalyst', 'Caustic', 'Conduit', 'Crypto',
  'Fuse', 'Gibraltar', 'Horizon', 'Lifeline', 'Loba', 'Mad Maggie', 'Mirage', 'Newcastle', 'Octane', 'Pathfinder',
  'Rampart', 'Revenant', 'Seer', 'Sparrow', 'Valkyrie', 'Vantage', 'Wattson', 'Wraith',
];
const LEGEND_KEYS = new Set(LEGENDS.map((l) => l.toLowerCase().replace(/\s+/g, '')));

/**
 * Apex's anonymous mode shows a player to others as their legend plus four
 * digits ("Fuse2676", "Mad Maggie1234"), and the roster never has that name:
 * such players can't be identified or looked up (DESIGN.md §9.1).
 */
export function isAnonymousName(name: string): boolean {
  const m = /^(.+?)\d{4}$/.exec(baseName(name));
  return !!m && LEGEND_KEYS.has(m[1].toLowerCase().replace(/\s+/g, ''));
}

/**
 * Codenames that differ from the display name. Artemis is Sparrow (confirmed:
 * my only legend in 43 matches); overdrive as Axle is inferred, the only
 * unmatched codename when Axle was in my squads (DESIGN.md §9.1).
 */
const LEGEND_CODENAMES: Record<string, string> = {
  maggie: 'Mad Maggie',
  madmaggie: 'Mad Maggie',
  artemis: 'Sparrow',
  overdrive: 'Axle',
};

/** "#character_catalyst_NAME" -> "Catalyst". */
export function legendName(raw: string): string {
  const code = /^#character_(.+)_NAME$/.exec(raw)?.[1] ?? raw;
  const known = LEGEND_CODENAMES[code.toLowerCase()];
  if (known) return known;
  return code
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const MAPS: [RegExp, string][] = [
  [/^mp_rr_canyonlands/, 'Kings Canyon'],
  [/^mp_rr_desertlands/, "World's Edge"],
  [/^mp_rr_olympus/, 'Olympus'],
  [/^mp_rr_tropic_island/, 'Storm Point'],
  [/^mp_rr_divided_moon/, 'Broken Moon'],
  [/^mp_rr_district/, 'E-District'],
];

/** Keyed on map_id: map_name is "UNKNOWN" for some maps. */
export function mapName(mapId: string | null, fallbackName: string | null): string {
  if (mapId) for (const [re, name] of MAPS) if (re.test(mapId)) return name;
  if (fallbackName && fallbackName !== 'UNKNOWN') return fallbackName;
  return mapId ?? 'Unknown';
}

/**
 * Weapon names as the dashboard knows them (src/ui/weapons.ts), from either
 * `inUse` display names ("VK-47 Flatline") or kill feed codes ("flatline").
 */
const WEAPONS: Record<string, string> = {
  // inUse display names
  'r-301 carbine': 'R-301', 'vk-47 flatline': 'Flatline', havoc: 'Havoc', 'havoc rifle': 'Havoc',
  'hemlok burst ar': 'Hemlok', 'nemesis burst ar': 'Nemesis', 'r-99': 'R-99', 'r-99 smg': 'R-99',
  'volt smg': 'Volt', 'alternator smg': 'Alternator', 'c.a.r. smg': 'CAR', 'prowler burst pdw': 'Prowler',
  peacekeeper: 'Peacekeeper', 'mastiff shotgun': 'Mastiff', 'eva-8 auto': 'EVA-8', 'mozambique shotgun': 'Mozambique',
  'm600 spitfire': 'Spitfire', devotion: 'Devotion', 'devotion lmg': 'Devotion', 'l-star emg': 'L-STAR', 'rampage lmg': 'Rampage',
  '30-30 repeater': '30-30 Repeater', 'g7 scout': 'G7 Scout', 'triple take': 'Triple Take', 'bocek compound bow': 'Bocek',
  sentinel: 'Sentinel', 'longbow dmr': 'Longbow', 'charge rifle': 'Charge Rifle', 'kraber .50-cal sniper': 'Kraber',
  wingman: 'Wingman', 're-45 auto': 'RE-45', p2020: 'P2020',
  // kill feed codes
  r301: 'R-301', flatline: 'Flatline', energy_ar: 'Havoc', hemlok: 'Hemlok', nemesis: 'Nemesis',
  r97: 'R-99', volt: 'Volt', alternator: 'Alternator', car: 'CAR', prowler: 'Prowler',
  mastiff: 'Mastiff', eva8: 'EVA-8', mozambique: 'Mozambique',
  spitfire: 'Spitfire', esaw: 'Devotion', lstar: 'L-STAR', dragon: 'Rampage',
  repeater: '30-30 Repeater', g7: 'G7 Scout', triple_take: 'Triple Take', bow: 'Bocek',
  longbow: 'Longbow', charge_rifle: 'Charge Rifle', sniper: 'Kraber',
  r45: 'RE-45',
};

/**
 * A gun's dashboard name, or null for anything that isn't a gun (melee,
 * heals, grenades, abilities, empty hands): that damage counts as "Other".
 */
export function weaponName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw
    .toLowerCase()
    .replace(/_(akimbo_active|takeover|crate|gold)$/, '')
    .trim();
  return WEAPONS[key] ?? null;
}

/** Grenades as the kill feed names them: "rui/ordnance_icons/grenade_frag". */
const ORDNANCE: Record<string, string> = {
  grenade_frag: 'Frag Grenade', grenade_incendiary: 'Thermite Grenade', grenade_arc: 'Arc Star',
};

/** A grenade's name from its kill feed code, or null. */
export function ordnanceName(raw: string | null | undefined): string | null {
  return ORDNANCE[raw?.split('/').pop() ?? ''] ?? null;
}

/** weaponName(), with non-guns grouped as the dashboard's "Other". */
export function weaponOrOther(raw: string | null | undefined): string {
  return weaponName(raw) ?? OTHER_WEAPON;
}
