import React from 'react';
import { Car } from 'lucide-react';

/**
 * Smart Traffic Management System (4 Junctions + Emergency Corridor)
 * Clean, lightweight React setup for 3rd year engineering project.
 */
export default function App() {
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-[#0b1329] border-b border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center text-slate-950 font-black">
              <Car className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">
                Smart Traffic System <span className="text-cyan-400">(4-Junction Grid)</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Adaptive Signal Control &bull; Emergency Green Corridor &bull; 3rd Year Project
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        <div className="text-center py-12 text-slate-400">
          Initializing 4-Junction Traffic Simulation...
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-3 text-center text-xs text-slate-500 font-mono">
        Smart Traffic Management System &bull; 4-Junction Adaptive Grid
      </footer>
    </div>
  );
}
