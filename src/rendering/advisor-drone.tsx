import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useAppFlowStore } from '../state/app-flow-store';

const BRIEFING_TEXT = [
  "Hey. I'm your advisor for this shift. Here's the deal — in a minute, a crisis is going to hit this grid. Temperatures spike, demand spikes, and if total load goes past what the network can carry, something goes dark.",
  "You get to decide what. Cut AC somewhere, delay an EV charger, fire up a solar reserve, or shed a zone outright if you have to. The hospital never goes dark — that's not optional. Everything else is a real trade-off.",
  "One more thing: the easiest zones to shed are usually the ones that can least afford it. Keep an eye on that. I'll tell you what I'd do, but you're the one making the call.",
  "Ready when you are."
];

export function AdvisorDrone({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const droneRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.MeshStandardMaterial>(null);
  const enterSimulation = useAppFlowStore((s) => s.enterSimulation);
  
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Set initial spawn position when enabled
  useEffect(() => {
    if (enabled && droneRef.current) {
      const offset = new THREE.Vector3(5, -15, -2); // Spawn below and slightly back
      offset.applyQuaternion(camera.quaternion);
      droneRef.current.position.copy(camera.position.clone().add(offset));
    }
  }, [enabled, camera]);

  // Typewriter effect
  useEffect(() => {
    if (!enabled || currentParagraph >= BRIEFING_TEXT.length) {
      if (currentParagraph >= BRIEFING_TEXT.length) setIsDone(true);
      return;
    }
    
    setIsTyping(true);
    const textToType = BRIEFING_TEXT[currentParagraph];
    if (!textToType) return;
    let charIndex = 0;
    
    const interval = setInterval(() => {
      setTypedText(textToType.substring(0, charIndex + 1));
      charIndex++;
      if (charIndex === textToType.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 30); // typing speed
    
    return () => clearInterval(interval);
  }, [enabled, currentParagraph]);

  const handleNext = () => {
    if (isTyping) {
      // Skip typing
      setTypedText(BRIEFING_TEXT[currentParagraph] || '');
      setIsTyping(false);
    } else {
      setCurrentParagraph(p => p + 1);
    }
  };

  useFrame(({ clock }) => {
    if (!enabled || !droneRef.current) return;

    // Gentle hover animation
    droneRef.current.position.y += Math.sin(clock.elapsedTime * 3) * 0.005;

    // Glowing core animation
    if (coreRef.current) {
      coreRef.current.emissiveIntensity = 1 + Math.sin(clock.elapsedTime * 5) * 0.5;
    }

    // Follow the camera: position slightly in front and right of the camera
    const offset = new THREE.Vector3(3, -1, -5); // right, down, forward
    offset.applyQuaternion(camera.quaternion);
    const targetPos = camera.position.clone().add(offset);
    
    // Smooth follow
    droneRef.current.position.lerp(targetPos, 0.05);
    // Look at camera
    droneRef.current.lookAt(camera.position);
  });

  if (!enabled) return null;

  return (
    <group ref={droneRef} position={[0, -100, 0]}>
      {/* Advisor Drone Geometry */}
      {/* Main chassis */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.3, 0.4, 6]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Glowing core (eye) */}
      <mesh position={[0, 0, 0.2]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial ref={coreRef} color="#818cf8" emissive="#818cf8" emissiveIntensity={1} />
      </mesh>
      {/* Floating rings */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <torusGeometry args={[0.6, 0.05, 8, 24]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <torusGeometry args={[0.4, 0.05, 8, 24]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>

      {/* HTML Chat Bubble */}
      <Html position={[0, 1.2, 0]} center zIndexRange={[100, 0]}>
        <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-indigo-500/50 rounded-xl p-4 shadow-2xl animate-fade-in-up flex flex-col pointer-events-auto" style={{ width: '320px' }}>
          <div className="text-indigo-400 font-bold mb-2 text-sm uppercase flex items-center gap-2">
            🤖 AI Advisor
          </div>
          
          <div className="text-white text-[15px] font-medium leading-relaxed min-h-[100px] mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
            {currentParagraph < BRIEFING_TEXT.length ? typedText : BRIEFING_TEXT[BRIEFING_TEXT.length - 1]}
          </div>

          <div className="flex justify-end mt-auto">
            {!isDone ? (
              <button
                onClick={handleNext}
                className="text-indigo-300 hover:text-white text-sm font-semibold transition-colors"
              >
                {isTyping ? 'Skip >' : 'Next >'}
              </button>
            ) : (
              <button
                onClick={enterSimulation}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(79,70,229,0.5)] transition-all"
              >
                Start Crisis
              </button>
            )}
          </div>
          
          {/* Bubble tail */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-t-[15px] border-t-indigo-500/50 border-r-[10px] border-r-transparent"></div>
        </div>
      </Html>
    </group>
  );
}
