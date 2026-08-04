/**
 * city-positions.ts — the ONE source of truth for building coordinates
 * (x, z world units). city-layout renders from this table and the camera
 * frames from it — no duplicated coordinates anywhere.
 */
export const BUILDING_POSITIONS: Readonly<Record<string, readonly [number, number]>> = {
  // Downtown corporate & civic cluster (DT)
  'DT-Corp1': [-10, 75],
  'DT-Corp2': [10, 75],
  'DT-Corp3': [0, 60],
  'DT-Corp4': [-15, 60],
  'DT-Corp5': [15, 60],
  'DT-Corp6': [-25, 75],
  'DT-Corp7': [25, 75],
  'DT-Mall1': [0, 88],
  'DT-Hosp': [30, 68],
  'DT-Gov1': [15, 45],
  'SUB-DT': [0, 48],

  // Industrial District (IN)
  'IN-Fact1': [60, 35],
  'IN-Fact2': [75, 20],
  'IN-Fact3': [65, -5],
  'SUB-IN': [78, 35],
  'GEN-Thermal1': [85, 65],

  // Residential North Estates & Apartments (RN)
  'RN-Sch1': [-50, 25],
  'RN-EV1': [-5, 50],
  'RN-House1': [-60, 40],
  'RN-House2': [-52, 40],
  'RN-House3': [-68, 20],
  'RN-House4': [-60, 20],
  'RN-House5': [-58, 0],
  'RN-House6': [-50, 0],
  'RN-House7': [-62, -8],
  'RN-Apt1': [-42, 38],
  'RN-Apt2': [-42, 18],
  'SUB-RN': [-55, 48],

  // Residential South Estates & Apartments (RS)
  'RS-Sch2': [-30, -50],
  'RS-EV2': [55, 25],
  'RS-House1': [-38, -35],
  'RS-House2': [-32, -35],
  'RS-House3': [-44, -35],
  'RS-House4': [-53, -55],
  'RS-House5': [-47, -55],
  'RS-House6': [-53, -62],
  'RS-House7': [-38, -70],
  'RS-House8': [-32, -70],
  'RS-House9': [-44, -70],
  'RS-Apt1': [-22, -45],
  'RS-Apt2': [-22, -65],
  'SUB-RS': [-45, -35],

  // Airport & EV Infrastructure (AP)
  'AP-EV3': [-40, -25],

  // Renewable Energy Park (Solar, Wind, Battery Storage)
  'RN-Solar': [-80, 75],
  'BESS-1': [-72, 55],
  'BESS-2': [45, 75],
  'GEN-Wind1': [-90, 30],
  'GEN-Wind2': [-95, 0],
};

/** Building world position as a three-tuple (y = ground). */
export function buildingPosition3(id: string): readonly [number, number, number] | null {
  const p = BUILDING_POSITIONS[id];
  return p === undefined ? null : [p[0], 0, p[1]];
}
