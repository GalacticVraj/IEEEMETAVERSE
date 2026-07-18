import type { ReactElement } from 'react';

export interface LandingPageProps {
  onEnter: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps): ReactElement {
  return (
    <div className="relative h-screen w-full overflow-hidden flex flex-col bg-[#F8FAFC]">
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 z-0 w-full h-[130%] object-cover object-top opacity-80"
        src="REPLACE_WITH_YOUR_GRIDGUARD_LOOP.mp4"
      />

      {/* Navigation Bar */}
      <div className="relative z-10 w-full flex justify-center pt-4 md:pt-6 px-4">
        <nav className="flex items-center gap-6 bg-white/70 backdrop-blur-md rounded-xl px-4 md:px-6 py-3 shadow-sm">
          {/* Logo SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            className="w-6 h-6 fill-[#0B2545]"
            aria-label="GridGuard Logo"
          >
            <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z" />
            <path d="M 256 128 L 128 128 L 0 0 L 128 0 Z" />
          </svg>
          
          {/* Links */}
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-[#0B2545]/80">
            <a href="#" className="hover:text-[#0B2545] transition-opacity">Systems</a>
            <a href="#" className="hover:text-[#0B2545] transition-opacity">Ethics & Data</a>
            <a href="#" className="hover:text-[#0B2545] transition-opacity">Roadmap</a>
            <a href="#" className="hover:text-[#0B2545] transition-opacity">Team</a>
          </div>
        </nav>
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 mt-8 md:mt-16">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-xl border border-[#0B2545]/10 bg-white/70 backdrop-blur-sm px-4 py-2 text-sm font-medium text-[#0B2545]">
          <div className="bg-[#F4A300] rounded w-5 h-5 flex items-center justify-center text-white text-xs">
            ⚡
          </div>
          Built for IEEE Metaverse Grand Challenge 2026
        </div>

        {/* Heading */}
        <h1 className="font-['Instrument_Serif'] text-4xl sm:text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-[#0B2545] max-w-4xl">
          Break the grid <br />
          before it breaks you
        </h1>

        {/* Subtitle */}
        <p className="mt-5 sm:mt-6 max-w-3xl text-xs sm:text-sm md:text-base leading-relaxed text-[#0B2545]/70">
          Step into a live power-grid crisis in Meridian Bay, a small coastal city on the day a record heatwave hits. Every choice you make — cutting AC, activating solar, delaying EV charging — has a visible, immediate consequence. No diagrams, no textbooks. Just the grid, live, and an AI advisor coaching you through it.
        </p>

        {/* CTA Button */}
        <button
          onClick={onEnter}
          className="mt-7 sm:mt-8 rounded-xl bg-[#FEFEFE] px-6 sm:px-8 py-3 sm:py-3.5 text-sm font-semibold text-[#0B2545] shadow-[0px_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0px_6px_16px_rgba(0,0,0,0.2)] transition-all duration-300 cursor-pointer"
        >
          Enter the Simulation
        </button>
      </div>
    </div>
  );
}
