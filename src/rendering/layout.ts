/**
 * Static 2D layout positions for the Meridian Bay grid nodes.
 * Positions are in Three.js world units (x, z) for a top-down view.
 * Y is always 0 (ground plane). The city is 200 × 200 units.
 *
 * Zone layout (approximate):
 *   GN1 (top-left)  DT cluster (top-centre)  GS1 (right)
 *   RN cluster      AP cluster               IN cluster
 *   RS cluster      HB cluster
 */
export const BUS_POSITIONS: Readonly<Record<string, [number, number]>> = {
  // Generation North (top-left)
  GN1: [-75, 80],

  // Downtown cluster (top-centre)
  DT1: [-10, 75],
  DT2: [10, 75],
  DT3: [0, 60],
  DT4: [-15, 60],
  DT5: [15, 60],

  // Generation South (right)
  GS1: [80, 65],

  // Industrial cluster (right-centre)
  IN1: [65, 35],
  IN2: [75, 15],
  IN3: [65, -5],

  // Residential North (left-centre)
  RN1: [-55, 35],
  RN2: [-65, 15],
  RN3: [-55, -5],

  // Residential South (bottom-left)
  RS1: [-35, -40],
  RS2: [-50, -60],
  RS3: [-35, -75],

  // Airport (bottom-centre)
  AP1: [10, -50],
  AP2: [25, -65],

  // Harbor (bottom-right)
  HB1: [50, -45],
  HB2: [65, -60],
};

/** Zone colour (for bus markers and building tints). */
export const ZONE_COLOR: Readonly<Record<string, string>> = {
  DT: '#60a5fa', // Downtown — blue
  IN: '#f97316', // Industrial — orange
  RN: '#4ade80', // Residential North — green
  RS: '#86efac', // Residential South — light green
  AP: '#c084fc', // Airport — purple
  HB: '#fb923c', // Harbor — amber
};

/** Which zone each bus belongs to (for colouring). */
export const BUS_ZONE: Readonly<Record<string, string>> = {
  DT1: 'DT', DT2: 'DT', DT3: 'DT', DT4: 'DT', DT5: 'DT',
  IN1: 'IN', IN2: 'IN', IN3: 'IN',
  RN1: 'RN', RN2: 'RN', RN3: 'RN',
  RS1: 'RS', RS2: 'RS', RS3: 'RS',
  AP1: 'AP', AP2: 'AP',
  HB1: 'HB', HB2: 'HB',
  GN1: 'RN',
  GS1: 'IN',
};
