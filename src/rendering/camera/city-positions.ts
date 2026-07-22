/**
 * city-positions.ts — the ONE source of truth for building coordinates
 * (x, z world units). city-layout renders from this table and the camera
 * frames from it — no duplicated coordinates anywhere.
 */
export const BUILDING_POSITIONS: Readonly<Record<string, readonly [number, number]>> = {
  // Downtown corporate cluster
  'DT-Corp1': [-10, 75],
  'DT-Corp2': [10, 75],
  'DT-Corp3': [0, 60],
  'DT-Corp4': [-15, 60],
  'DT-Corp5': [15, 60],
  'DT-Hosp': [30, 68],
  'DT-Gov1': [15, 45],

  // Schools
  'RN-Sch1': [-50, 25],
  'RS-Sch2': [-30, -50],

  // EV stations
  'RN-EV1': [-5, 50],
  'RS-EV2': [55, 25],
  'AP-EV3': [-40, -25],

  // Residential North estates
  'RN-House1': [-60, 40],
  'RN-House2': [-52, 40],
  'RN-House3': [-68, 20],
  'RN-House4': [-60, 20],
  'RN-House5': [-58, 0],
  'RN-House6': [-50, 0],
  'RN-House7': [-62, -8],

  // Residential South community
  'RS-House1': [-38, -35],
  'RS-House2': [-32, -35],
  'RS-House3': [-44, -35],
  'RS-House4': [-53, -55],
  'RS-House5': [-47, -55],
  'RS-House6': [-53, -62],
  'RS-House7': [-38, -70],
  'RS-House8': [-32, -70],
  'RS-House9': [-44, -70],

  // Solar farm
  'RN-Solar': [-80, 75],
};

/** Building world position as a three-tuple (y = ground). */
export function buildingPosition3(id: string): readonly [number, number, number] | null {
  const p = BUILDING_POSITIONS[id];
  return p === undefined ? null : [p[0], 0, p[1]];
}
