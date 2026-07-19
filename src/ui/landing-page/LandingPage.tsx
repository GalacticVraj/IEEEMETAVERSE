import { useEffect, useState, type ReactElement, type ReactNode } from 'react';

// --- FadeIn Component ---
function FadeIn({ children, delay = 0, duration = 1000 }: { children: ReactNode, delay?: number, duration?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className="transition-opacity"
      style={{
        opacity: visible ? 1 : 0,
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}

// --- AnimatedHeading Component ---
function AnimatedHeading({ text, delay = 200 }: { text: string, delay?: number }) {
  const [start, setStart] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setStart(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const lines = text.split('\n');
  let globalCharIndex = 0;
  const charDelay = 30; // ms

  return (
    <h1 
      className="text-4xl md:text-5xl lg:text-6xl xl:text-[5rem] font-normal mb-4 text-white leading-[1.1]"
      style={{ letterSpacing: '-0.04em' }}
    >
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className="block">
          {line.split('').map((char, charIndex) => {
            const currentDelay = globalCharIndex * charDelay;
            globalCharIndex++;
            return (
              <span
                key={charIndex}
                className="inline-block transition-all ease-out"
                style={{
                  opacity: start ? 1 : 0,
                  transform: start ? 'translateX(0)' : 'translateX(-18px)',
                  transitionDuration: '500ms',
                  transitionDelay: `${currentDelay}ms`,
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            );
          })}
        </div>
      ))}
    </h1>
  );
}

export interface LandingPageProps {
  onEnter: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps): ReactElement {
  return (
    <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
      {/* 
        The 3D city scene handles the background ("3D merge"). 
        We just provide the overlay UI.
      */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.2)', pointerEvents: 'none' }} />

      {/* Navigation Bar */}
      <div className="w-full px-6 md:px-12 lg:px-16 pt-6 pointer-events-auto z-10">
        <nav className="liquid-glass rounded-xl px-4 py-2 flex items-center justify-between">
          <div className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            GridGuard
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-300 font-medium">
            <a href="#" className="hover:text-white transition-colors">Systems</a>
            <a href="#" className="hover:text-white transition-colors">Ethics & Data</a>
            <a href="#" className="hover:text-white transition-colors">Roadmap</a>
            <a href="#" className="hover:text-white transition-colors">Team</a>
          </div>

          <button 
            onClick={onEnter}
            className="bg-white text-black px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Start Simulation
          </button>
        </nav>
      </div>

      {/* Hero Content (Bottom of viewport) */}
      <div className="px-6 md:px-12 lg:px-16 flex-1 flex flex-col justify-end pb-12 lg:pb-16 pointer-events-none z-10">
        <div className="lg:grid lg:grid-cols-2 lg:items-end w-full">
          
          {/* Left Column - Main content */}
          <div className="flex flex-col pointer-events-auto">
            <FadeIn delay={400} duration={800}>
              <div className="mb-4 inline-flex items-center gap-2 liquid-glass px-4 py-2 rounded-lg text-sm font-medium text-amber-400">
                Built for IEEE Metaverse Grand Challenge 2026
              </div>
            </FadeIn>

            <AnimatedHeading text="Break the grid\nbefore it breaks you." delay={200} />

            <FadeIn delay={800} duration={1000}>
              <p className="text-base md:text-lg text-gray-300 mb-5 max-w-xl">
                A live simulation of energy consequences. Every choice you make — cutting AC, activating solar, delaying EVs — has a visible, immediate consequence on the city.
              </p>
            </FadeIn>

            <FadeIn delay={1200} duration={1000}>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={onEnter}
                  className="bg-white text-black px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors cursor-pointer shadow-lg"
                >
                  Enter City
                </button>
                <button
                  className="liquid-glass border border-white/20 text-white px-8 py-3 rounded-lg font-medium hover:bg-white hover:text-black transition-all cursor-pointer shadow-lg"
                >
                  Explore Features
                </button>
              </div>
            </FadeIn>
          </div>

          {/* Right Column - Tag */}
          <div className="hidden lg:flex items-end justify-end pointer-events-auto mt-8 lg:mt-0">
            <FadeIn delay={1400} duration={1000}>
              <div className="liquid-glass border border-white/20 px-6 py-3 rounded-xl shadow-lg">
                <span className="text-lg md:text-xl lg:text-2xl font-light text-white tracking-wide">
                  Simulate. Balance. Survive.
                </span>
              </div>
            </FadeIn>
          </div>

        </div>
      </div>
    </div>
  );
}
