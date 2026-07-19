import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { useAppFlowStore } from '../state/app-flow-store';

export function ArrivalCamera({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const finishArrival = useAppFlowStore((s) => s.finishArrival);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  // We'll tween a target vector for the camera to look at
  const lookAtTarget = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (!enabled) return;

    // The starting point is exactly where the Hero orbit left off.
    // The camera is already looking at 0,0,0.

    // Calculate final DroneCamera starting position:
    // Drone is at (0, 10, 50), yaw 0, pitch -0.2
    // armLength = 8
    // offset = (0, 3 + 8*sin(-0.2), -8*cos(-0.2)) => approx (0, 1.4, -7.8)
    // Wait, DroneCamera offset is:
    // x: -sin(0) * 8 * cos(-0.2) = 0
    // y: 3 + 8 * sin(-0.2) = 3 + 8 * -0.198 = 1.41
    // z: -cos(0) * 8 * cos(-0.2) = -8 * 0.98 = -7.84
    // Wait, in DroneCamera: desired = dronePos + offset.
    // So camera pos = (0, 11.41, 42.16)
    // camera lookAt = dronePos + (0, 1.5, 0) = (0, 11.5, 50)
    
    // Oh, wait, in drone-camera.tsx:
    // const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    // So yaw = 0 means looking +Z! (Wait, standard THREE is -Z, but if forward is +Z...)
    // If offset z is -cos(yaw), then it's -Z. So camera is behind drone (towards -Z).
    // Let's just hardcode the final position to smoothly hand off to DroneCamera.
    const finalPos = new THREE.Vector3(0, 13, 58); // Slightly further back for safety
    const finalLookAt = new THREE.Vector3(0, 11.5, 50);

    // Waypoint 1: High wide lateral/top-down shot
    const highPos = new THREE.Vector3(0, 250, 40);
    const highLookAt = new THREE.Vector3(0, 0, 0);

    const tl = gsap.timeline({
      onComplete: () => {
        finishArrival();
      }
    });
    timelineRef.current = tl;

    // 1. Arc up to the high wide shot (2 seconds)
    tl.to(camera.position, {
      x: highPos.x,
      y: highPos.y,
      z: highPos.z,
      duration: 2.5,
      ease: 'power2.inOut',
    }, 0);
    
    tl.to(lookAtTarget.current, {
      x: highLookAt.x,
      y: highLookAt.y,
      z: highLookAt.z,
      duration: 2.5,
      ease: 'power2.inOut',
    }, 0);

    // 2. Descend smoothly down to street level behind the drone (3 seconds)
    tl.to(camera.position, {
      x: finalPos.x,
      y: finalPos.y,
      z: finalPos.z,
      duration: 3,
      ease: 'power3.inOut',
    }, 2.5);

    tl.to(lookAtTarget.current, {
      x: finalLookAt.x,
      y: finalLookAt.y,
      z: finalLookAt.z,
      duration: 3,
      ease: 'power3.inOut',
    }, 2.5);

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [enabled, camera, finishArrival]);

  useFrame(() => {
    if (!enabled) return;
    camera.lookAt(lookAtTarget.current);
  });

  return null;
}
