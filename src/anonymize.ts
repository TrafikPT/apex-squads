/**
 * Replaces other players' names and platform IDs in recordings with stable
 * aliases ("Player-001"), so real matches can live in git as test data. The
 * local player and an explicit keep-list stay as they are. The same person
 * gets the same alias in every file, so squad and teammate stats still work.
 */
import { baseName, isAnonymousName } from './game-names';
import type { RecordLine } from './recorder';

/** Payload fields holding a player name, per GEP key (`_N` = numbered keys). */
const NAME_FIELDS: Record<string, string[]> = {
  roster_N: ['name'],
  teammate_N: ['name'],
  legendSelect_N: ['playerName'],
  kill_feed: ['attackerName', 'victimName', 'local_player_name'],
  damage: ['targetName'],
  player: ['player_name', 'in_game_player_name'],
};
const ID_FIELDS: Record<string, string[]> = { roster_N: ['platform_id', 'origin_id'] };
/** Keys whose value is itself a bare name. */
const NAME_KEYS = new Set(['name']);

export interface AnonymizeResult {
  lines: RecordLine[];
  aliases: number;
  /** Original names/IDs still present in the output: must be empty. */
  leaks: string[];
}

export function anonymize(lines: RecordLine[], keepNames: string[]): AnonymizeResult {
  const keep = new Set(keepNames.map(baseName));
  const keepIds = new Set<string>();
  // The local player is "me": always kept, with their IDs.
  for (const l of lines) {
    const p = decode(l.value);
    if (l.category === 'me' && NAME_KEYS.has(l.key ?? '') && typeof l.value === 'string') keep.add(baseName(l.value));
    if (isObject(p) && fieldKey(l.key) === 'roster_N' && typeof p.name === 'string') {
      if (p.is_local === '1' || p.is_local === true) keep.add(baseName(p.name));
    }
  }
  for (const l of lines) {
    const p = decode(l.value);
    if (isObject(p) && fieldKey(l.key) === 'roster_N' && typeof p.name === 'string' && keep.has(baseName(p.name))) {
      for (const f of ID_FIELDS.roster_N) if (typeof p[f] === 'string') keepIds.add(p[f] as string);
    }
  }

  const nameAlias = new Map<string, string>();
  const idAlias = new Map<string, string>();
  const aliasName = (name: string): string => {
    const base = baseName(name);
    // Anonymous-mode names ("Fuse2676") are already made up by the game.
    if (!base || keep.has(base) || isAnonymousName(base)) return name;
    let alias = nameAlias.get(base);
    if (!alias) nameAlias.set(base, (alias = `Player-${String(nameAlias.size + 1).padStart(3, '0')}`));
    // Keep the clan-tag shape ("[TAG] x" vs "[TAG]x"): parsing it is part of what the data tests.
    const tag = /^\[[^\]]*\](\s*)/.exec(name);
    return tag ? `[CLN]${tag[1]}${alias}` : alias;
  };
  const aliasId = (id: string): string => {
    if (!id || keepIds.has(id)) return id;
    let alias = idAlias.get(id);
    if (!alias) idAlias.set(id, (alias = String(9_000_000_000_000 + idAlias.size + 1)));
    return alias;
  };

  const out = lines.map((l) => {
    const k = fieldKey(l.key);
    if (l.category !== 'me' && NAME_KEYS.has(l.key ?? '') && typeof l.value === 'string') {
      return { ...l, value: aliasName(l.value) };
    }
    const names = NAME_FIELDS[k];
    const ids = ID_FIELDS[k];
    if (!names && !ids) return l;
    const wasString = typeof l.value === 'string';
    const p = decode(l.value);
    if (!isObject(p)) return l;
    const copy: Record<string, unknown> = { ...p };
    for (const f of names ?? []) if (typeof copy[f] === 'string') copy[f] = aliasName(copy[f] as string);
    for (const f of ids ?? []) if (typeof copy[f] === 'string') copy[f] = aliasId(copy[f] as string);
    return { ...l, value: wasString ? JSON.stringify(copy) : copy };
  });

  return { lines: out, aliases: nameAlias.size, leaks: findLeaks(out, [...nameAlias.keys()], [...idAlias.keys()]) };
}

/** Looks for replaced names/IDs anywhere in the serialized output, including double-encoded payloads. */
function findLeaks(lines: RecordLine[], names: string[], ids: string[]): string[] {
  // Weapon ids aren't names, even when a player is called the same ("dragon" is the Rampage).
  const text = lines
    .map((l) => JSON.stringify(l))
    .join('\n')
    .replace(/(\\*"weaponName\\*":\\*")[^"\\]*/g, '$1');
  const escapes = (s: string) => {
    const once = JSON.stringify(s).slice(1, -1);
    return [s, once, JSON.stringify(once).slice(1, -1)];
  };
  // Very short or digit-only names ("1", "Why?.") also occur as ordinary values.
  const checkable = names.filter((n) => n.length >= 4 && /\p{L}/u.test(n));
  // Whole words only: players called "Peace" or "Damage" aren't leaked by "Peacekeeper"/"totalDamageDealt".
  const found = (e: string) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u').test(text);
  return [...checkable, ...ids].filter((s) => escapes(s).some(found));
}

function fieldKey(key: string | null): string {
  return (key ?? '').replace(/_\d+$/, '_N');
}

function decode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
