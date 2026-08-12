/**
 * city-buildings.tsx — Procedural building and infrastructure types for Meridian Bay.
 *
 * Section 2 & 4 of the product spec: Hospital, Schools, Corporate Towers,
 * Substations, Battery Storage, Power Plants, Wind Turbines, Industrial Factories,
 * High/Low Income Houses, Solar Farms, Streetlights, Transmission Pylons,
 * and Green Infrastructure (trees, parks, pond).
 *
 * Each building has a distinct, recognizable silhouette and emissive lighting
 * properties that react dynamically to live simulation events and operator decisions.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type * as THREE from 'three';

/**
 * Pointer handlers every clickable city asset accepts. These were `any`,
 * which switched off type checking on 33 props and accounted for most of the
 * lint errors in this file.
 */
export type CityAssetClick = (event: ThreeEvent<MouseEvent>) => void;
export type CityAssetPointer = (event: ThreeEvent<PointerEvent>) => void;

interface CityAssetHandlers {
  onClick?: CityAssetClick;
  onPointerDown?: CityAssetPointer;
  onPointerUp?: CityAssetPointer;
}

/**
 * Spreads only the handlers that were actually supplied. `exactOptionalPropertyTypes`
 * is on, so passing an explicit `undefined` to R3F's `EventHandlers` is a type error.
 */
/** Callers pass their own optional props straight through, so the input side
 * must tolerate an explicit `undefined` even though the output side may not. */
interface CityAssetHandlerInput {
  onClick?: CityAssetClick | undefined;
  onPointerDown?: CityAssetPointer | undefined;
  onPointerUp?: CityAssetPointer | undefined;
}

function handlers(h: CityAssetHandlerInput): CityAssetHandlers {
  const out: CityAssetHandlers = {};
  if (h.onClick !== undefined) out.onClick = h.onClick;
  if (h.onPointerDown !== undefined) out.onPointerDown = h.onPointerDown;
  if (h.onPointerUp !== undefined) out.onPointerUp = h.onPointerUp;
  return out;
}

// ---------------------------------------------------------------------------
// Design Palette & Materials
// ---------------------------------------------------------------------------
const ROOF_GREEN = '#4a7c59'; // Sustainable rooftop greenery
const SOLAR_BLUE = '#2563eb'; // High-efficiency solar panels
const GLASS_TINT = '#1e3a5f'; // Corporate glass facade
const HOSPITAL_WHITE = '#e2e8f0'; // Hospital facade
const CROSS_RED = '#ef4444'; // Red cross emergency marker
const SCHOOL_WARM = '#92400e'; // Warm educational brick
const EV_CANOPY = '#334155'; // EV station canopy
const CHARGE_GLOW = '#22c55e'; // Green charge glow
const INDUSTRIAL_GRAY = '#475569'; // Heavy industrial steel
const SUBSTATION_YELLOW = '#eab308'; // High-voltage warning yellow
const BATTERY_CYAN = '#06b6d4'; // Grid battery energy storage

// ---------------------------------------------------------------------------
// Hospital — Priority Infrastructure (Beacon, Red Cross, Emergency Aura)
// ---------------------------------------------------------------------------
export function Hospital({
  position,
  isPrioritized = false,
  onClick,
  onPointerDown,
  onPointerUp,
}: {
  position: [number, number, number];
  isPrioritized?: boolean;
  onClick?: CityAssetClick;
  onPointerDown?: CityAssetPointer;
  onPointerUp?: CityAssetPointer;
}) {
  const beaconRef = useRef<THREE.MeshStandardMaterial>(null);
  const auraRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beaconRef.current) {
      beaconRef.current.emissiveIntensity = isPrioritized
        ? 0.8 + Math.sin(t * 6) * 0.6
        : 0.4 + Math.sin(t * 3) * 0.3;
    }
    if (auraRef.current) {
      auraRef.current.opacity = isPrioritized ? 0.25 + Math.sin(t * 4) * 0.15 : 0.05;
    }
  });

  return (
    <group position={position} {...handlers({ onClick, onPointerDown, onPointerUp })}>
      {/* Priority Emergency Ground Aura */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5, 14, 32]} />
        <meshStandardMaterial
          ref={auraRef}
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={1.2}
          transparent
          opacity={0.1}
        />
      </mesh>

      {/* Main central tower */}
      <mesh position={[0, 10, 0]} castShadow receiveShadow>
        <boxGeometry args={[7, 20, 6]} />
        <meshStandardMaterial color={HOSPITAL_WHITE} roughness={0.35} metalness={0.2} />
      </mesh>

      {/* East & West Wings */}
      <mesh position={[-5.5, 6, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.5, 12, 5]} />
        <meshStandardMaterial color={HOSPITAL_WHITE} roughness={0.4} />
      </mesh>
      <mesh position={[5.5, 6, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.5, 12, 5]} />
        <meshStandardMaterial color={HOSPITAL_WHITE} roughness={0.4} />
      </mesh>

      {/* Red Cross on roof */}
      <mesh position={[0, 20.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 6.5]} />
        <meshStandardMaterial color={CROSS_RED} emissive={CROSS_RED} emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 20.15, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[2.2, 6.5]} />
        <meshStandardMaterial color={CROSS_RED} emissive={CROSS_RED} emissiveIntensity={0.9} />
      </mesh>

      {/* Emergency Beacon Light */}
      <mesh position={[0, 21.2, 0]}>
        <sphereGeometry args={[0.6, 12, 12]} />
        <meshStandardMaterial
          ref={beaconRef}
          color={CROSS_RED}
          emissive={CROSS_RED}
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Ambulance Bay / Helipad Pad */}
      <mesh position={[0, 0.05, 5.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 5]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* Plazas & Trees */}
      <Tree position={[-4, 0, 6.5]} scale={0.7} />
      <Tree position={[4, 0, 6.5]} scale={0.7} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// School — Mid-height brick building, playground & solar array
// ---------------------------------------------------------------------------
export function School({
  position,
  onClick,
  onPointerDown,
  onPointerUp,
}: {
  position: [number, number, number];
  onClick?: CityAssetClick;
  onPointerDown?: CityAssetPointer;
  onPointerUp?: CityAssetPointer;
}) {
  return (
    <group position={position} {...handlers({ onClick, onPointerDown, onPointerUp })}>
      <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[9, 9, 6]} />
        <meshStandardMaterial color={SCHOOL_WARM} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.2, 3.1]}>
        <boxGeometry args={[3.2, 4.4, 0.5]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      {/* Solar array on roof */}
      {[-2.5, 0, 2.5].map((x, i) => (
        <mesh key={i} position={[x, 9.15, 0]} rotation={[-0.35, 0, 0]}>
          <boxGeometry args={[2, 0.1, 2.8]} />
          <meshStandardMaterial
            color={SOLAR_BLUE}
            emissive={SOLAR_BLUE}
            emissiveIntensity={0.3}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      ))}
      {/* Athletic Field */}
      <mesh position={[7.5, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 8]} />
        <meshStandardMaterial color="#166534" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Courthouse / Civic Hall — Classic architecture
// ---------------------------------------------------------------------------
export function Courthouse({
  position,
  onClick,
  onPointerDown,
  onPointerUp,
}: {
  position: [number, number, number];
  onClick?: CityAssetClick;
  onPointerDown?: CityAssetPointer;
  onPointerUp?: CityAssetPointer;
}) {
  return (
    <group position={position} {...handlers({ onClick, onPointerDown, onPointerUp })}>
      <mesh position={[0, 5.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[11, 11, 8.5]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.45} />
      </mesh>
      <mesh position={[0, 12, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[7, 3.5, 4]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.6, 5]}>
        <boxGeometry args={[7, 1.2, 3]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      {[-3.2, -1.1, 1.1, 3.2].map((x, i) => (
        <mesh key={i} position={[x, 5.5, 4.6]}>
          <cylinderGeometry args={[0.35, 0.45, 11, 8]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Corporate Tower & Commercial High-Rise
// ---------------------------------------------------------------------------
export function CorporateTower({
  position,
  height = 20,
  rotation = 0,
  onClick,
  onPointerDown,
  onPointerUp,
}: {
  position: [number, number, number];
  height?: number;
  rotation?: number;
  onClick?: CityAssetClick;
  onPointerDown?: CityAssetPointer;
  onPointerUp?: CityAssetPointer;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.emissiveIntensity =
        0.25 + Math.sin(clock.elapsedTime * 1.5 + position[0]) * 0.12;
    }
  });

  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      {...handlers({ onClick, onPointerDown, onPointerUp })}
    >
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, height, 5]} />
        <meshStandardMaterial
          ref={matRef}
          color={GLASS_TINT}
          emissive="#3b82f6"
          emissiveIntensity={0.25}
          metalness={0.85}
          roughness={0.15}
          transparent
          opacity={0.92}
        />
      </mesh>
      {Array.from({ length: Math.floor(height / 3.2) }, (_, i) => (
        <mesh key={i} position={[0, 2.5 + i * 3.2, 2.55]}>
          <boxGeometry args={[4.4, 0.2, 0.1]} />
          <meshStandardMaterial color="#94a3b8" emissive="#60a5fa" emissiveIntensity={0.3} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.4, 4.4]} />
        <meshStandardMaterial color={ROOF_GREEN} />
      </mesh>
      <Tree position={[-1.2, height, -1.2]} scale={0.35} />
      <Tree position={[1.2, height, 1.2]} scale={0.35} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Commercial Complex — Shopping & Multi-tier Retail Hub
// ---------------------------------------------------------------------------
export function CommercialComplex({
  position,
  onClick,
  onPointerDown,
  onPointerUp,
}: {
  position: [number, number, number];
  onClick?: CityAssetClick;
  onPointerDown?: CityAssetPointer;
  onPointerUp?: CityAssetPointer;
}) {
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      glowRef.current.emissiveIntensity = 0.35 + Math.sin(clock.elapsedTime * 2) * 0.15;
    }
  });

  return (
    <group position={position} {...handlers({ onClick, onPointerDown, onPointerUp })}>
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[14, 6, 10]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>
      <mesh position={[0, 7.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 3, 7]} />
        <meshStandardMaterial
          ref={glowRef}
          color="#1e293b"
          emissive="#60a5fa"
          emissiveIntensity={0.35}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 1.5, 5.5]}>
        <boxGeometry args={[6, 0.2, 2.5]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// EV Charging Station
// ---------------------------------------------------------------------------
export function EvStation({
  position,
  onClick,
  onPointerDown,
  onPointerUp,
}: {
  position: [number, number, number];
  onClick?: CityAssetClick;
  onPointerDown?: CityAssetPointer;
  onPointerUp?: CityAssetPointer;
}) {
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      glowRef.current.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 2.5) * 0.4;
    }
  });

  return (
    <group position={position} {...handlers({ onClick, onPointerDown, onPointerUp })}>
      <mesh position={[0, 4.2, 0]}>
        <boxGeometry args={[8.5, 0.25, 5.5]} />
        <meshStandardMaterial
          color={SOLAR_BLUE}
          emissive={SOLAR_BLUE}
          emissiveIntensity={0.25}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      {(
        [
          [-3.2, -2.2],
          [3.2, -2.2],
          [-3.2, 2.2],
          [3.2, 2.2],
        ] as const
      ).map(([x, z], i) => (
        <mesh key={i} position={[x, 2.1, z]}>
          <cylinderGeometry args={[0.16, 0.16, 4.2, 6]} />
          <meshStandardMaterial color={EV_CANOPY} />
        </mesh>
      ))}
      {(
        [
          { x: -2.2, col: '#38bdf8' },
          { x: 0, col: '#10b981' },
          { x: 2.2, col: '#f59e0b' },
        ] as const
      ).map((car, i) => (
        <group key={i} position={[car.x, 0, 0]}>
          <mesh position={[0, 0.65, 0]}>
            <boxGeometry args={[1.6, 0.85, 2.6]} />
            <meshStandardMaterial color={car.col} />
          </mesh>
          <mesh position={[0, 1.2, -0.2]}>
            <boxGeometry args={[1.4, 0.55, 1.3]} />
            <meshStandardMaterial color={car.col} />
          </mesh>
          <mesh position={[0.95, 0.55, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial
              ref={i === 0 ? glowRef : null}
              color={CHARGE_GLOW}
              emissive={CHARGE_GLOW}
              emissiveIntensity={0.7}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Houses & Apartments
// ---------------------------------------------------------------------------
export function HouseHigh({
  position,
  onClick,
  onPointerDown,
  onPointerUp,
}: {
  position: [number, number, number];
  onClick?: CityAssetClick;
  onPointerDown?: CityAssetPointer;
  onPointerUp?: CityAssetPointer;
}) {
  return (
    <group position={position} {...handlers({ onClick, onPointerDown, onPointerUp })}>
      <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 4.4, 3.8]} />
        <meshStandardMaterial color="#475569" roughness={0.65} />
      </mesh>
      <mesh position={[0, 5.2, 0]}>
        <coneGeometry args={[3.8, 2.2, 4]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>
      <mesh position={[0, 5.9, -0.3]} rotation={[-0.45, 0, 0]}>
        <boxGeometry args={[2.6, 0.08, 1.9]} />
        <meshStandardMaterial
          color={SOLAR_BLUE}
          emissive={SOLAR_BLUE}
          emissiveIntensity={0.3}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      <mesh position={[3.2, 0.6, 0]}>
        <boxGeometry args={[0.4, 1.2, 0.4]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[3.2, 1.3, 0]}>
        <sphereGeometry args={[0.14, 6, 6]} />
        <meshStandardMaterial color={CHARGE_GLOW} emissive={CHARGE_GLOW} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

export function HouseLow({
  position,
  onClick,
  onPointerDown,
  onPointerUp,
}: {
  position: [number, number, number];
  onClick?: CityAssetClick;
  onPointerDown?: CityAssetPointer;
  onPointerUp?: CityAssetPointer;
}) {
  return (
    <group position={position} {...handlers({ onClick, onPointerDown, onPointerUp })}>
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 3.2, 2.7]} />
        <meshStandardMaterial color="#525252" roughness={0.75} />
      </mesh>
      <mesh position={[0, 3.3, 0]}>
        <boxGeometry args={[3.6, 0.35, 3.1]} />
        <meshStandardMaterial color="#404040" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.6, 1.4]}>
        <boxGeometry args={[1.1, 0.85, 0.06]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

export function HighDensityApartment({
  position,
  onClick,
}: {
  position: [number, number, number];
  onClick?: CityAssetClick;
}) {
  return (
    <group position={position} {...handlers({ onClick })}>
      <mesh position={[0, 7.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[7, 15, 6]} />
        <meshStandardMaterial color="#64748b" roughness={0.5} />
      </mesh>
      {Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => (
          <mesh key={`${r}-${c}`} position={[(c - 1) * 2, 3 + r * 3, 3.05]}>
            <boxGeometry args={[1.2, 1.5, 0.05]} />
            <meshStandardMaterial color="#fef08a" emissive="#fde047" emissiveIntensity={0.3} />
          </mesh>
        )),
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Power Infrastructure: Substation & Transformer Yard
// ---------------------------------------------------------------------------
export function Substation({
  position,
  isOverloaded = false,
  onClick,
}: {
  position: [number, number, number];
  isOverloaded?: boolean;
  onClick?: CityAssetClick;
}) {
  const humRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (humRef.current) {
      const spd = isOverloaded ? 12 : 3;
      humRef.current.emissiveIntensity = 0.4 + Math.sin(clock.elapsedTime * spd) * 0.3;
    }
  });

  return (
    <group position={position} {...handlers({ onClick })}>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>
      {[-3, 3].map((x, i) => (
        <group key={i} position={[x, 2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[3, 4, 3]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
          </mesh>
          {[-0.8, 0, 0.8].map((bz, j) => (
            <mesh key={j} position={[0, 2.5, bz]}>
              <cylinderGeometry args={[0.2, 0.25, 1.2, 8]} />
              <meshStandardMaterial color={SUBSTATION_YELLOW} />
            </mesh>
          ))}
          <mesh position={[0, 4.3, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial
              ref={i === 0 ? humRef : null}
              color={isOverloaded ? '#ef4444' : '#eab308'}
              emissive={isOverloaded ? '#ef4444' : '#eab308'}
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[10, 0.15, 0.15]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Power Infrastructure: Battery Energy Storage System (BESS)
// ---------------------------------------------------------------------------
export function BatteryStorage({
  position,
  isActive = false,
  onClick,
}: {
  position: [number, number, number];
  isActive?: boolean;
  onClick?: CityAssetClick;
}) {
  const pulseRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (pulseRef.current) {
      const spd = isActive ? 6 : 1.5;
      pulseRef.current.emissiveIntensity = isActive
        ? 0.7 + Math.sin(clock.elapsedTime * spd) * 0.4
        : 0.2;
    }
  });

  return (
    <group position={position} {...handlers({ onClick })}>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {[-4, 0, 4].map((x, i) => (
        <group key={i} position={[x, 1.5, 0]}>
          <mesh castShadow>
            <boxGeometry args={[3, 3, 7]} />
            <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.5} />
          </mesh>

          <mesh position={[0, 1.55, 3.55]}>
            <boxGeometry args={[2.5, 0.2, 0.1]} />
            <meshStandardMaterial
              ref={i === 1 ? pulseRef : null}
              color={BATTERY_CYAN}
              emissive={BATTERY_CYAN}
              emissiveIntensity={isActive ? 0.9 : 0.3}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Power Generation: Thermal Plant & Cooling Towers
// ---------------------------------------------------------------------------
export function ThermalGenerator({
  position,
  isTripped = false,
  onClick,
}: {
  position: [number, number, number];
  isTripped?: boolean;
  onClick?: CityAssetClick;
}) {
  const faultRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (faultRef.current && isTripped) {
      faultRef.current.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 8) * 0.5;
    }
  });

  return (
    <group position={position} {...handlers({ onClick })}>
      <mesh position={[0, 5, 0]} castShadow receiveShadow>
        <boxGeometry args={[14, 10, 10]} />
        <meshStandardMaterial color={INDUSTRIAL_GRAY} roughness={0.5} metalness={0.4} />
      </mesh>

      <mesh position={[-9, 8, -2]}>
        <cylinderGeometry args={[2.5, 4, 16, 16]} />
        <meshStandardMaterial color="#64748b" roughness={0.7} />
      </mesh>

      <mesh position={[-9, 8, 5]}>
        <cylinderGeometry args={[2.5, 4, 16, 16]} />
        <meshStandardMaterial color="#64748b" roughness={0.7} />
      </mesh>

      <mesh position={[5, 12, -3]}>
        <cylinderGeometry args={[0.6, 0.9, 24, 12]} />
        <meshStandardMaterial color="#475569" />
      </mesh>

      <mesh position={[5, 24.3, -3]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshStandardMaterial
          ref={faultRef}
          color={isTripped ? '#ef4444' : '#22c55e'}
          emissive={isTripped ? '#ef4444' : '#22c55e'}
          emissiveIntensity={isTripped ? 1.0 : 0.4}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Renewable Power: Wind Turbine
// ---------------------------------------------------------------------------
export function WindTurbine({
  position,
  speed = 1.5,
  isTripped = false,
  onClick,
}: {
  position: [number, number, number];
  speed?: number;
  isTripped?: boolean;
  onClick?: CityAssetClick;
}) {
  const bladesRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (bladesRef.current && !isTripped) {
      bladesRef.current.rotation.z -= delta * speed;
    }
  });

  return (
    <group position={position} {...handlers({ onClick })}>
      <mesh position={[0, 9, 0]}>
        <cylinderGeometry args={[0.3, 0.7, 18, 10]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 18, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 2.5, 10]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <group ref={bladesRef} position={[0, 18, 1.3]}>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
          <group key={i} rotation={[0, 0, angle]}>
            <mesh position={[0, 5, 0]}>
              <boxGeometry args={[0.35, 10, 0.08]} />
              <meshStandardMaterial color="#f1f5f9" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Industrial Factory
// ---------------------------------------------------------------------------
export function IndustrialFactory({
  position,
  isActive = true,
  onClick,
}: {
  position: [number, number, number];
  isActive?: boolean;
  onClick?: CityAssetClick;
}) {
  const lightRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (lightRef.current) {
      lightRef.current.emissiveIntensity = isActive
        ? 0.35 + Math.sin(clock.elapsedTime * 2) * 0.1
        : 0.05;
    }
  });

  return (
    <group position={position} {...handlers({ onClick })}>
      <mesh position={[0, 3.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[12, 7, 9]} />
        <meshStandardMaterial
          ref={lightRef}
          color="#334155"
          emissive="#f97316"
          emissiveIntensity={isActive ? 0.35 : 0.05}
          roughness={0.6}
        />
      </mesh>

      {[-4, 0, 4].map((x, i) => (
        <mesh key={i} position={[x, 7.8, 0]} rotation={[0, 0, Math.PI / 6]}>
          <boxGeometry args={[3.2, 1.5, 8.8]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      ))}

      <mesh position={[-4, 8.5, 3]}>
        <cylinderGeometry args={[0.5, 0.7, 6, 8]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh position={[4, 8.5, 3]}>
        <cylinderGeometry args={[0.5, 0.7, 6, 8]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Solar Farm Field
// ---------------------------------------------------------------------------
export function SolarFarm({
  position,
  isActive = true,
  onClick,
  onPointerDown,
  onPointerUp,
}: {
  position: [number, number, number];
  isActive?: boolean;
  onClick?: CityAssetClick;
  onPointerDown?: CityAssetPointer;
  onPointerUp?: CityAssetPointer;
}) {
  const panelRows = 4;
  const panelCols = 5;
  const panelRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (panelRef.current) {
      panelRef.current.emissiveIntensity = isActive
        ? 0.3 + Math.sin(clock.elapsedTime * 1.8) * 0.15
        : 0.1;
    }
  });

  return (
    <group position={position} {...handlers({ onClick, onPointerDown, onPointerUp })}>
      {Array.from({ length: panelRows }, (_, r) =>
        Array.from({ length: panelCols }, (_, c) => (
          <group key={`${r}-${c}`} position={[(c - 2) * 3.2, 0, (r - 1.5) * 3.2]}>
            <mesh position={[0, 0.75, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 1.5, 4]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
            <mesh position={[0, 1.7, 0.25]} rotation={[-0.45, 0, 0]}>
              <boxGeometry args={[2.6, 0.06, 2.1]} />
              <meshStandardMaterial
                ref={r === 0 && c === 0 ? panelRef : null}
                color={SOLAR_BLUE}
                emissive="#3b82f6"
                emissiveIntensity={isActive ? 0.3 : 0.1}
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
          </group>
        )),
      )}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[19, 15]} />
        <meshStandardMaterial color="#14532d" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// StreetLight & Transmission Pylon Infrastructure
// ---------------------------------------------------------------------------
export function StreetLight({
  position,
  intensity = 1.0,
}: {
  position: [number, number, number];
  intensity?: number;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 5, 6]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[0.4, 4.9, 0]} rotation={[0, 0, Math.PI / 3]}>
        <cylinderGeometry args={[0.04, 0.04, 1.2, 6]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[0.8, 4.7, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial
          color="#fef08a"
          emissive="#fde047"
          emissiveIntensity={0.8 * intensity}
        />
      </mesh>
    </group>
  );
}

export function TransmissionPylon({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 7.5, 0]}>
        <cylinderGeometry args={[0.2, 0.8, 15, 4]} />
        <meshStandardMaterial color="#64748b" wireframe />
      </mesh>
      {[-3, 0, 3].map((yOff, i) => (
        <mesh key={i} position={[0, 11 + yOff, 0]}>
          <boxGeometry args={[7 - i * 0.8, 0.2, 0.2]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Green Infrastructure Assets: Tree, Park, Pond, Road
// ---------------------------------------------------------------------------
export function Tree({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 3, 6]} />
        <meshStandardMaterial color="#5c3a1e" />
      </mesh>
      <mesh position={[0, 4, 0]}>
        <sphereGeometry args={[1.8, 8, 6]} />
        <meshStandardMaterial color="#166534" roughness={0.8} />
      </mesh>
      <mesh position={[0.5, 3.2, 0.5]}>
        <sphereGeometry args={[1.2, 6, 5]} />
        <meshStandardMaterial color="#15803d" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function Park({
  position,
  size = [20, 12],
}: {
  position: [number, number, number];
  size?: [number, number];
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#15803d" />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, size[1] * 0.85]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <Tree position={[-4, 0, -3]} scale={0.85} />
      <Tree position={[3, 0, 2]} scale={0.75} />
      <Tree position={[-2, 0, 4]} scale={0.9} />
      <Tree position={[5, 0, -1]} scale={0.65} />
    </group>
  );
}

export function Pond({ position }: { position: [number, number, number] }) {
  const waterRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.emissiveIntensity = 0.12 + Math.sin(clock.elapsedTime * 0.8) * 0.05;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5.5, 20]} />
        <meshStandardMaterial
          ref={waterRef}
          color="#0369a1"
          emissive="#38bdf8"
          emissiveIntensity={0.12}
          metalness={0.4}
          roughness={0.15}
          transparent
          opacity={0.88}
        />
      </mesh>
      {[-3, -1, 2, 4].map((x, i) => (
        <mesh key={i} position={[x, 0.8, 3.8]}>
          <cylinderGeometry args={[0.04, 0.06, 1.8, 4]} />
          <meshStandardMaterial color="#4d7c0f" />
        </mesh>
      ))}
    </group>
  );
}

export function Road({
  from,
  to,
  width = 2.5,
}: {
  from: [number, number];
  to: [number, number];
  width?: number;
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const mx = (from[0] + to[0]) / 2;
  const mz = (from[1] + to[1]) / 2;

  return (
    <group position={[mx, 0.035, mz]} rotation={[0, angle, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.15, length]} />
        <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}
