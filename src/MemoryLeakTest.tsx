import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { BusMarkers, GeneratorMarkers, GroundPlane, TransmissionLines } from './rendering/grid-scene';
import { CityLayout } from './rendering/city-layout';

export function MemoryLeakTest() {
  const [mounted, setMounted] = useState(true);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count < 20) {
      const timer = setTimeout(() => {
        setMounted(!mounted);
        setCount(c => c + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [mounted, count]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div style={{ position: 'absolute', zIndex: 10, background: 'white', padding: 10 }}>
        Mount Count: {count} <br/>
        Status: {mounted ? 'Mounted' : 'Unmounted'}
      </div>
      {mounted && (
        <Canvas>
          <GroundPlane />
          <TransmissionLines />
          <BusMarkers />
          <GeneratorMarkers />
          <CityLayout />
        </Canvas>
      )}
    </div>
  );
}
