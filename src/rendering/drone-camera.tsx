import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { useAppFlowStore, AppMode } from '../state/app-flow-store';

interface DronePilotState {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  velocity: THREE.Vector3;
  speed: number;
  sprintMultiplier: number;
}

interface InputState {
  forward: boolean;
  back: boolean;
  right: boolean;
  left: boolean;
  up: boolean;
  down: boolean;
  sprint: boolean;
  mouseDeltaX: number;
  mouseDeltaY: number;
}

const MOUSE_SENSITIVITY = 0.002;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function DroneCamera({ enabled }: { enabled: boolean }) {
  const { camera, gl } = useThree();
  const mode = useAppFlowStore((s) => s.mode);
  const prevMode = useRef<AppMode>(mode);

  const droneState = useRef<DronePilotState>({
    position: new THREE.Vector3(0, 10, 50),
    yaw: 0,
    pitch: -0.2,
    velocity: new THREE.Vector3(),
    speed: 30,
    sprintMultiplier: 3,
  });

  const inputState = useRef<InputState>({
    forward: false,
    back: false,
    right: false,
    left: false,
    up: false,
    down: false,
    sprint: false,
    mouseDeltaX: 0,
    mouseDeltaY: 0,
  });

  const isPointerLocked = useRef(false);
  const transitionRef = useRef<{ isAnimating: boolean }>({ isAnimating: false });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled || !isPointerLocked.current) return;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp': inputState.current.forward = true; break;
        case 'KeyS':
        case 'ArrowDown': inputState.current.back = true; break;
        case 'KeyD':
        case 'ArrowRight': inputState.current.right = true; break;
        case 'KeyA':
        case 'ArrowLeft': inputState.current.left = true; break;
        case 'Space': inputState.current.up = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': inputState.current.sprint = true; break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!enabled) return;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp': inputState.current.forward = false; break;
        case 'KeyS':
        case 'ArrowDown': inputState.current.back = false; break;
        case 'KeyD':
        case 'ArrowRight': inputState.current.right = false; break;
        case 'KeyA':
        case 'ArrowLeft': inputState.current.left = false; break;
        case 'Space': inputState.current.up = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': inputState.current.sprint = false; break;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!enabled || !isPointerLocked.current) return;
      inputState.current.mouseDeltaX -= e.movementX;
      inputState.current.mouseDeltaY -= e.movementY;
    };

    const handlePointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === gl.domElement;
    };

    const handleClick = () => {
      if (enabled && !isPointerLocked.current) {
        gl.domElement.requestPointerLock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    gl.domElement.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [enabled, gl.domElement]);

  // Handle transition to Crisis Mode
  useEffect(() => {
    if (mode === AppMode.CrisisSelect && prevMode.current !== AppMode.CrisisSelect) {
      // Tween drone to a good vantage point
      transitionRef.current.isAnimating = true;
      const targetPos = new THREE.Vector3(0, 100, 150);
      const targetPitch = -0.5;
      const targetYaw = 0;

      gsap.to(droneState.current.position, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: 1.5,
        ease: 'power2.inOut'
      });
      gsap.to(droneState.current, {
        pitch: targetPitch,
        yaw: targetYaw,
        duration: 1.5,
        ease: 'power2.inOut',
        onComplete: () => {
          transitionRef.current.isAnimating = false;
        }
      });
      
      // Exit pointer lock if needed
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock();
      }
    }
    prevMode.current = mode;
  }, [mode, gl.domElement]);

  useFrame((_, delta) => {
    if (!enabled && !transitionRef.current.isAnimating) return;

    const state = droneState.current;
    const input = inputState.current;

    if (!transitionRef.current.isAnimating && isPointerLocked.current) {
      const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
      const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
      const move = new THREE.Vector3();
      
      if (input.forward) move.add(forward);
      if (input.back) move.sub(forward);
      if (input.right) move.add(right);
      if (input.left) move.sub(right);
      if (input.up) move.y += 1;
      if (input.down) move.y -= 1;
      
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(state.speed * (input.sprint ? state.sprintMultiplier : 1) * delta);
        state.position.add(move);
      }

      state.yaw += input.mouseDeltaX * MOUSE_SENSITIVITY;
      state.pitch = clamp(state.pitch + input.mouseDeltaY * MOUSE_SENSITIVITY, -1.0, 0.5);

      // Reset mouse deltas
      input.mouseDeltaX = 0;
      input.mouseDeltaY = 0;
      
      // Simple floor collision
      if (state.position.y < 2) state.position.y = 2;
    }

    // Update Follow Camera
    const armLength = 8;
    const offset = new THREE.Vector3(
      -Math.sin(state.yaw) * armLength * Math.cos(state.pitch),
      3 + armLength * Math.sin(state.pitch),
      -Math.cos(state.yaw) * armLength * Math.cos(state.pitch)
    );
    
    const desired = state.position.clone().add(offset);
    camera.position.lerp(desired, 0.15);
    camera.lookAt(state.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
  });

  return null;
}
