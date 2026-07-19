/**
 * city-buildings.tsx — All procedural building types for Meridian Bay.
 *
 * Section 2 of the product spec: Hospital, Schools, Corporate Towers,
 * EV Charging Stations, Houses (high/low income), Solar Farm, and
 * Green Infrastructure (trees, parks, pond).
 *
 * Each building has a distinct silhouette so players can identify types at a glance.
 * Buildings pulse with emissive light and respond to load state during Active Crisis.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Shared colors from the green sustainable palette
// ---------------------------------------------------------------------------
const ROOF_GREEN = '#4a7c59';       // visible rooftop greenery
const SOLAR_BLUE = '#2563eb';       // solar panels
const GLASS_TINT = '#1e3a5f';       // corporate glass
const HOSPITAL_WHITE = '#d4dce4';   // hospital facade
const CROSS_RED = '#E63946';        // red cross marker
const SCHOOL_WARM = '#8b6914';      // warm school facade
const EV_CANOPY = '#334155';        // EV station canopy
const CHARGE_GLOW = '#22c55e';      // charge indicator

// ---------------------------------------------------------------------------
// Hospital — tallest boxy form, white facade, red cross, garden plaza
// ---------------------------------------------------------------------------
export function Hospital({ position, onClick, onPointerDown, onPointerUp }: { position: [number, number, number]; onClick?: any; onPointerDown?: any; onPointerUp?: any }) {
  const beaconRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (beaconRef.current) {
      beaconRef.current.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 3) * 0.5;
    }
  });

  return (
    <group position={position} onClick={onClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {/* Main building */}
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[7, 20, 6]} />
        <meshStandardMaterial color={HOSPITAL_WHITE} roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Wing */}
      <mesh position={[-5, 5, 0]}>
        <boxGeometry args={[4, 10, 5]} />
        <meshStandardMaterial color={HOSPITAL_WHITE} roughness={0.5} />
      </mesh>
      {/* Red Cross on roof */}
      <mesh position={[0, 20.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 6]} />
        <meshStandardMaterial color={CROSS_RED} emissive={CROSS_RED} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 20.2, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[2, 6]} />
        <meshStandardMaterial color={CROSS_RED} emissive={CROSS_RED} emissiveIntensity={0.8} />
      </mesh>
      {/* Beacon light */}
      <mesh position={[0, 21, 0]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshStandardMaterial ref={beaconRef} color={CROSS_RED} emissive={CROSS_RED} emissiveIntensity={0.5} />
      </mesh>
      {/* Garden plaza at base */}
      <mesh position={[0, 0.05, 5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color="#2d6a4f" />
      </mesh>
      {/* Garden trees */}
      <Tree position={[-3, 0, 6]} scale={0.6} />
      <Tree position={[3, 0, 6]} scale={0.6} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// School — mid-height, warm facade, green playground, rooftop solar panels
// ---------------------------------------------------------------------------
export function School({ position, onClick, onPointerDown, onPointerUp }: { position: [number, number, number]; onClick?: any; onPointerDown?: any; onPointerUp?: any }) {
  return (
    <group position={position} onClick={onClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {/* Main building */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[8, 8, 5]} />
        <meshStandardMaterial color={SCHOOL_WARM} roughness={0.6} />
      </mesh>
      {/* Entrance */}
      <mesh position={[0, 2, 2.6]}>
        <boxGeometry args={[3, 4, 0.5]} />
        <meshStandardMaterial color="#6d5210" />
      </mesh>
      {/* Rooftop solar panels */}
      {[-2, 0, 2].map((x, i) => (
        <mesh key={i} position={[x, 8.2, 0]} rotation={[-0.4, 0, 0]}>
          <boxGeometry args={[1.8, 0.1, 2.5]} />
          <meshStandardMaterial color={SOLAR_BLUE} emissive={SOLAR_BLUE} emissiveIntensity={0.3} metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      {/* Playground / field */}
      <mesh position={[6, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5, 6]} />
        <meshStandardMaterial color="#3a8c5a" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Courthouse — moderate height, columned facade (Tier 2)
// ---------------------------------------------------------------------------
export function Courthouse({ position, onClick, onPointerDown, onPointerUp }: { position: [number, number, number]; onClick?: any; onPointerDown?: any; onPointerUp?: any }) {
  return (
    <group position={position} onClick={onClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {/* Main building block */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[10, 10, 8]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
      </mesh>
      {/* Roof pediment (classic triangle) */}
      <mesh position={[0, 11, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[6.5, 3, 4]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
      </mesh>
      {/* Front steps */}
      <mesh position={[0, 0.5, 5]}>
        <boxGeometry args={[6, 1, 3]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      {/* Columns */}
      {[-3, -1, 1, 3].map((x, i) => (
        <mesh key={i} position={[x, 5, 4.5]}>
          <cylinderGeometry args={[0.3, 0.4, 10, 8]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Corporate Tower — tall glass high-rise, tinted windows, rooftop greenery
// ---------------------------------------------------------------------------
export function CorporateTower({ position, height = 18, onClick, onPointerDown, onPointerUp }: { position: [number, number, number]; height?: number; onClick?: any; onPointerDown?: any; onPointerUp?: any }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime * 1.5 + position[0]) * 0.15;
    }
  });

  return (
    <group position={position} onClick={onClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {/* Main tower */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[4.5, height, 4.5]} />
        <meshStandardMaterial ref={matRef} color={GLASS_TINT} emissive="#3b82f6" emissiveIntensity={0.3} metalness={0.8} roughness={0.15} transparent opacity={0.9} />
      </mesh>
      {/* Window line accents */}
      {Array.from({ length: Math.floor(height / 3) }, (_, i) => (
        <mesh key={i} position={[0, 2 + i * 3, 2.3]}>
          <boxGeometry args={[4, 0.15, 0.1]} />
          <meshStandardMaterial color="#94a3b8" emissive="#94a3b8" emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* Rooftop terrace with greenery */}
      <mesh position={[0, height + 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color={ROOF_GREEN} />
      </mesh>
      <Tree position={[-1, height, -1]} scale={0.3} />
      <Tree position={[1, height, 1]} scale={0.3} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// EV Charging Station — solar canopy, parked cars with charge glow
// ---------------------------------------------------------------------------
export function EvStation({ position, onClick, onPointerDown, onPointerUp }: { position: [number, number, number]; onClick?: any; onPointerDown?: any; onPointerUp?: any }) {
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      glowRef.current.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 2) * 0.4;
    }
  });

  return (
    <group position={position} onClick={onClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {/* Solar canopy */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[8, 0.2, 5]} />
        <meshStandardMaterial color={SOLAR_BLUE} emissive={SOLAR_BLUE} emissiveIntensity={0.2} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Canopy support pillars */}
      {([[-3, -2], [3, -2], [-3, 2], [3, 2]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 2, z]}>
          <cylinderGeometry args={[0.15, 0.15, 4, 6]} />
          <meshStandardMaterial color={EV_CANOPY} />
        </mesh>
      ))}
      {/* Parked cars */}
      {([{ x: -2, col: '#4a90d9' }, { x: 0, col: '#2d6a4f' }, { x: 2, col: '#8b6914' }] as const).map((car, i) => (
        <group key={i} position={[car.x, 0, 0]}>
          {/* Car body */}
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[1.5, 0.8, 2.5]} />
            <meshStandardMaterial color={car.col} />
          </mesh>
          <mesh position={[0, 1.1, -0.2]}>
            <boxGeometry args={[1.3, 0.5, 1.2]} />
            <meshStandardMaterial color={car.col} />
          </mesh>
          {/* Charge cable glow */}
          <mesh position={[0.9, 0.5, 0]}>
            <sphereGeometry args={[0.15, 6, 6]} />
            <meshStandardMaterial ref={i === 0 ? glowRef : null} color={CHARGE_GLOW} emissive={CHARGE_GLOW} emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Houses — two income tiers sharing similar base geometry
// ---------------------------------------------------------------------------
export function HouseHigh({ position, onClick, onPointerDown, onPointerUp }: { position: [number, number, number]; onClick?: any; onPointerDown?: any; onPointerUp?: any }) {
  return (
    <group position={position} onClick={onClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {/* House body — larger footprint */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[4, 4, 3.5]} />
        <meshStandardMaterial color="#5c6b4f" roughness={0.6} />
      </mesh>
      {/* Peaked roof */}
      <mesh position={[0, 4.8, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[3.5, 2, 4]} />
        <meshStandardMaterial color="#8b4513" roughness={0.7} />
      </mesh>
      {/* Rooftop solar panels */}
      <mesh position={[0, 5.5, -0.3]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[2.5, 0.08, 1.8]} />
        <meshStandardMaterial color={SOLAR_BLUE} emissive={SOLAR_BLUE} emissiveIntensity={0.25} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Driveway EV charger */}
      <mesh position={[3, 0.6, 0]}>
        <boxGeometry args={[0.4, 1.2, 0.4]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[3, 1.3, 0]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color={CHARGE_GLOW} emissive={CHARGE_GLOW} emissiveIntensity={0.8} />
      </mesh>
      {/* Garden */}
      <mesh position={[-3, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, 3]} />
        <meshStandardMaterial color="#3a8c5a" />
      </mesh>
    </group>
  );
}

export function HouseLow({ position, onClick, onPointerDown, onPointerUp }: { position: [number, number, number]; onClick?: any; onPointerDown?: any; onPointerUp?: any }) {
  return (
    <group position={position} onClick={onClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {/* House body — smaller footprint, no solar, no EV */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[3, 3, 2.5]} />
        <meshStandardMaterial color="#5c6148" roughness={0.7} />
      </mesh>
      {/* Simple flat roof */}
      <mesh position={[0, 3.1, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[3.4, 0.3, 2.9]} />
        <meshStandardMaterial color="#6b5c3e" roughness={0.8} />
      </mesh>
      {/* Small window */}
      <mesh position={[0, 1.5, 1.3]}>
        <boxGeometry args={[1, 0.8, 0.05]} />
        <meshStandardMaterial color="#87ceeb" emissive="#87ceeb" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Solar Farm — angled panel field
// ---------------------------------------------------------------------------
export function SolarFarm({ position, onClick, onPointerDown, onPointerUp }: { position: [number, number, number]; onClick?: any; onPointerDown?: any; onPointerUp?: any }) {
  const panelRows = 4;
  const panelCols = 5;

  return (
    <group position={position} onClick={onClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {Array.from({ length: panelRows }, (_, r) =>
        Array.from({ length: panelCols }, (_, c) => (
          <group key={`${r}-${c}`} position={[(c - 2) * 3, 0, (r - 1.5) * 3]}>
            {/* Panel support */}
            <mesh position={[0, 0.8, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 1.6, 4]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
            {/* Panel face */}
            <mesh position={[0, 1.8, 0.3]} rotation={[-0.5, 0, 0]}>
              <boxGeometry args={[2.5, 0.06, 2]} />
              <meshStandardMaterial color={SOLAR_BLUE} emissive="#3b82f6" emissiveIntensity={0.25} metalness={0.95} roughness={0.05} />
            </mesh>
          </group>
        ))
      )}
      {/* Ground base */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial color="#2d4a3e" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tree — reusable green infrastructure
// ---------------------------------------------------------------------------
export function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 3, 6]} />
        <meshStandardMaterial color="#5c3a1e" />
      </mesh>
      {/* Canopy */}
      <mesh position={[0, 4, 0]}>
        <sphereGeometry args={[1.8, 8, 6]} />
        <meshStandardMaterial color="#2d6a4f" roughness={0.8} />
      </mesh>
      <mesh position={[0.5, 3.2, 0.5]}>
        <sphereGeometry args={[1.2, 6, 5]} />
        <meshStandardMaterial color="#3a8c5a" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Park / Greenway strip
// ---------------------------------------------------------------------------
export function Park({ position, size = [20, 12] }: { position: [number, number, number]; size?: [number, number] }) {
  return (
    <group position={position}>
      {/* Grass */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#3a8c5a" />
      </mesh>
      {/* Path */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, size[1] * 0.8]} />
        <meshStandardMaterial color="#c8b88a" />
      </mesh>
      {/* Scattered trees */}
      <Tree position={[-4, 0, -3]} scale={0.8} />
      <Tree position={[3, 0, 2]} scale={0.7} />
      <Tree position={[-2, 0, 4]} scale={0.9} />
      <Tree position={[5, 0, -1]} scale={0.6} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Pond / Wetland patch
// ---------------------------------------------------------------------------
export function Pond({ position }: { position: [number, number, number] }) {
  const waterRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.emissiveIntensity = 0.1 + Math.sin(clock.elapsedTime * 0.8) * 0.05;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5, 16]} />
        <meshStandardMaterial ref={waterRef} color="#1a5276" emissive="#2980b9" emissiveIntensity={0.1} metalness={0.3} roughness={0.2} transparent opacity={0.85} />
      </mesh>
      {/* Reeds */}
      {[-3, -1, 2, 4].map((x, i) => (
        <mesh key={i} position={[x, 1, 3.5]}>
          <cylinderGeometry args={[0.04, 0.06, 2, 4]} />
          <meshStandardMaterial color="#556b2f" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Road segment
// ---------------------------------------------------------------------------
export function Road({ from, to, width = 2 }: { from: [number, number]; to: [number, number]; width?: number }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const mx = (from[0] + to[0]) / 2;
  const mz = (from[1] + to[1]) / 2;

  return (
    <group position={[mx, 0.04, mz]} rotation={[0, angle, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      {/* Center line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.15, length]} />
        <meshStandardMaterial color="#f4a300" emissive="#f4a300" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

