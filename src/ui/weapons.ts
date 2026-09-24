/** Weapon catalogue: which class each gun belongs to (update when weapons are added). */

export const WEAPON_CLASSES = ['Assault rifle', 'SMG', 'Shotgun', 'LMG', 'Marksman', 'Sniper', 'Pistol'] as const;
export type WeaponClass = (typeof WEAPON_CLASSES)[number] | 'Other';

/** Name used in the data for damage that isn't from a gun (grenades, abilities). */
export const OTHER_WEAPON = 'Other';

const CLASS_OF: Record<string, WeaponClass> = {
  'R-301': 'Assault rifle', Flatline: 'Assault rifle', Havoc: 'Assault rifle', Hemlok: 'Assault rifle', Nemesis: 'Assault rifle',
  'R-99': 'SMG', Volt: 'SMG', Alternator: 'SMG', CAR: 'SMG', Prowler: 'SMG',
  Peacekeeper: 'Shotgun', Mastiff: 'Shotgun', 'EVA-8': 'Shotgun', Mozambique: 'Shotgun',
  Spitfire: 'LMG', Devotion: 'LMG', 'L-STAR': 'LMG', Rampage: 'LMG',
  '30-30 Repeater': 'Marksman', 'G7 Scout': 'Marksman', 'Triple Take': 'Marksman', Bocek: 'Marksman',
  Sentinel: 'Sniper', Longbow: 'Sniper', 'Charge Rifle': 'Sniper', Kraber: 'Sniper',
  Wingman: 'Pistol', 'RE-45': 'Pistol', P2020: 'Pistol',
};

export function weaponClass(weapon: string): WeaponClass {
  return CLASS_OF[weapon] ?? 'Other';
}

export function weaponLabel(weapon: string): string {
  return weapon === OTHER_WEAPON ? 'Grenades & abilities' : weapon;
}
