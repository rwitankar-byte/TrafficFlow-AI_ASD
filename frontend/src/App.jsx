import React, { useState } from 'react';
import { Car, Activity, Hospital as HospitalIcon } from 'lucide-react';

/**
 * ==============================================================================
 * 1. MAP CONFIGURATION: 4 JUNCTIONS + FIXED HOSPITAL
 * ==============================================================================
 */
const JUNCTIONS = {
  J1: { id: 'J1', name: 'Junction 1', label: 'North-West (Grand Ave)', x: 180, y: 130 },
  J2: { id: 'J2', name: 'Junction 2', label: 'North-East (Metro Blvd)', x: 420, y: 130 },
  J3: { id: 'J3', name: 'Junction 3', label: 'South-West (Outer Ring)', x: 180, y: 310 },
  J4: { id: 'J4', name: 'Junction 4', label: 'South-East (Expressway)', x: 420, y: 310 },
};

// Fixed Hospital Location (Requirement 4)
const HOSPITAL = {
  id: 'HOSPITAL',
  name: 'City Hospital',
  x: 580,
  y: 310,
};

export default function App() {
  const [selectedJunction, setSelectedJunction] = useState('J1');

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
        {/* ============================================================== */}
        {/* REQUIREMENT 1 & 4: INTERACTIVE TRAFFIC MAP + FIXED HOSPITAL    */}
        {/* ============================================================== */}
        <section className="bg-[#091122] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Interactive Traffic Map (4 Junctions)</span>
              <span className="text-xs font-normal text-slate-400">
                (Click any junction to select)
              </span>
            </h2>

            {/* Map Legend */}
            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Green Light
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Red Light
              </span>
              <span className="flex items-center gap-1 text-cyan-300">
                <HospitalIcon className="w-3.5 h-3.5" /> Fixed Hospital
              </span>
            </div>
          </div>

          {/* SVG Canvas Map */}
          <div className="w-full bg-[#070b14] rounded-xl border border-slate-800/80 p-2 flex justify-center overflow-hidden">
            <svg viewBox="0 0 700 420" className="w-full max-w-[700px] h-auto select-none">
              {/* Asphalt Gray Roads */}
              <rect x="60" y="105" width="480" height="50" fill="#182030" rx="4" />
              <rect x="60" y="285" width="560" height="50" fill="#182030" rx="4" />
              <rect x="155" y="30" width="50" height="360" fill="#182030" rx="4" />
              <rect x="395" y="30" width="50" height="360" fill="#182030" rx="4" />

              {/* Dashed Centerlines */}
              <line x1="60" y1="130" x2="540" y2="130" stroke="#eab308" strokeWidth="2" strokeDasharray="8,8" />
              <line x1="60" y1="310" x2="620" y2="310" stroke="#eab308" strokeWidth="2" strokeDasharray="8,8" />
              <line x1="180" y1="30" x2="180" y2="390" stroke="#eab308" strokeWidth="2" strokeDasharray="8,8" />
              <line x1="420" y1="30" x2="420" y2="390" stroke="#eab308" strokeWidth="2" strokeDasharray="8,8" />

              {/* REQUIREMENT 4: FIXED HOSPITAL LOCATION (Adjacent to Junction 4) */}
              <g transform={`translate(${HOSPITAL.x}, ${HOSPITAL.y})`}>
                <rect x="-35" y="-35" width="70" height="70" rx="8" fill="#0f172a" stroke="#ef4444" strokeWidth="2.5" />
                <rect x="-5" y="-18" width="10" height="36" fill="#ef4444" rx="2" />
                <rect x="-18" y="-5" width="36" height="10" fill="#ef4444" rx="2" />
                <text x="0" y="24" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                  HOSPITAL
                </text>
                <text x="0" y="44" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold" fontFamily="monospace">
                  FIXED LOCATION
                </text>
              </g>

              {/* REQUIREMENT 1: THE FOUR JUNCTIONS (J1, J2, J3, J4) */}
              {Object.values(JUNCTIONS).map((j) => {
                const isSelected = selectedJunction === j.id;

                return (
                  <g
                    key={j.id}
                    transform={`translate(${j.x}, ${j.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelectedJunction(j.id)}
                  >
                    <rect
                      x="-35"
                      y="-35"
                      width="70"
                      height="70"
                      rx="8"
                      fill="#111c33"
                      stroke={isSelected ? '#06b6d4' : '#334155'}
                      strokeWidth={isSelected ? '3' : '1.5'}
                    />

                    <text x="0" y="-10" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="monospace">
                      {j.id}
                    </text>

                    {/* Signal Lights */}
                    <g transform="translate(0, 16)">
                      <circle cx="-12" cy="0" r="4" fill="#ef4444" />
                      <circle cx="0" cy="0" r="4" fill="#451a03" />
                      <circle cx="12" cy="0" r="4" fill="#022c22" />
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-3 text-center text-xs text-slate-500 font-mono">
        City Hospital: Fixed at (580, 310) &bull; 4-Junction Controller
      </footer>
    </div>
  );
}
