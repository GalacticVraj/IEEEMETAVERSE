/**
 * HeroOverlay.tsx — The hero mode overlay rendered ON TOP of the live 3D scene.
 *
 * Section 1.1: The background is NOT a pre-recorded video — it's the actual
 * Three.js city scene rendered live in a slow auto-orbit. This overlay just
 * provides the glass-panel headline and CTA over the running canvas.
 */
import type { ReactElement } from 'react';
import { useAppFlowStore } from '../../state/app-flow-store';

export function HeroOverlay(): ReactElement {
  const enterCity = useAppFlowStore((s) => s.enterCity);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col pointer-events-none"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Navigation bar */}
      <div className="w-full flex justify-center pt-5 px-4 pointer-events-auto animate-slide-down">
        <nav className="glass-panel flex items-center gap-6 px-6 py-3">
          {/* Logo */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="w-6 h-6" aria-label="GridGuard Logo">
            <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z" fill="#74C69D" />
            <path d="M 256 128 L 128 128 L 0 0 L 128 0 Z" fill="#2D6A4F" />
          </svg>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium" style={{ color: 'rgba(216, 243, 220, 0.8)' }}>
            <a href="#" className="hover:text-white transition-colors">Systems</a>
            <a href="#" className="hover:text-white transition-colors">Ethics &amp; Data</a>
            <a href="#" className="hover:text-white transition-colors">Roadmap</a>
            <a href="#" className="hover:text-white transition-colors">Team</a>
          </div>
        </nav>
      </div>

      {/* Hero content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium animate-fade-in-up glass-panel pointer-events-auto"
          style={{ color: '#D8F3DC', animationDelay: '0.2s', animationFillMode: 'both' }}
        >
          <div className="rounded w-5 h-5 flex items-center justify-center text-white text-xs" style={{ background: '#F4A300' }}>⚡</div>
          Built for IEEE Metaverse Grand Challenge 2026
        </div>

        {/* Heading */}
        <h1
          className="animate-fade-in-up"
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 'clamp(2.5rem, 7vw, 6rem)',
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            color: '#D8F3DC',
            maxWidth: '800px',
            animationDelay: '0.4s',
            animationFillMode: 'both',
            textShadow: '0 2px 40px rgba(0,0,0,0.5)',
          }}
        >
          Break the grid<br />before it breaks you
        </h1>

        {/* Subtitle */}
        <p
          className="animate-fade-in-up"
          style={{
            marginTop: '1.5rem',
            maxWidth: '640px',
            fontSize: 'clamp(0.8rem, 1.5vw, 1rem)',
            lineHeight: 1.7,
            color: 'rgba(216, 243, 220, 0.7)',
            animationDelay: '0.6s',
            animationFillMode: 'both',
          }}
        >
          Step into a live power-grid crisis in Meridian Bay, a coastal city on the day a record
          heatwave hits. Every choice you make — cutting AC, activating solar, delaying EV charging —
          has a visible, immediate consequence.
        </p>

        {/* CTA */}
        <button
          onClick={enterCity}
          className="btn-moss animate-fade-in-up animate-pulse-glow pointer-events-auto"
          style={{ marginTop: '2rem', animationDelay: '0.8s', animationFillMode: 'both', fontSize: '16px', padding: '14px 36px' }}
        >
          🌿 Enter City
        </button>
      </div>

      {/* Bottom attribution */}
      <div
        className="pb-6 text-center text-xs animate-fade-in"
        style={{ color: 'rgba(216, 243, 220, 0.35)', animationDelay: '1s', animationFillMode: 'both' }}
      >
        GridGuard © 2026 — Simulation-Based Energy Literacy
      </div>
    </div>
  );
}
