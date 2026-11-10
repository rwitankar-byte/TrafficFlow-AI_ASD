import React, { useState } from 'react';
import { Car, Activity, Hospital as HospitalIcon, Sliders, Award } from 'lucide-react';

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

// Default initial vehicle counts from project proposal
const DEFAULT_VEHICLES = {
  J1: 80,
  J2: 50,
  J3: 15,
  J4: 100,
};

// 4-Tier Density Algorithm
function getTierInfo(vehicleCount) {
  const count = Number(vehicleCount) || 0;
  if (count <= 19) {
    return { name: 'Low', greenTime: 15, color: '#10b981', badge: 'bg-emerald-500/20 text-emerald-400' };
  }
  if (count <= 50) {
    return { name: 'Medium', greenTime: 25, color: '#06b6d4', badge: 'bg-cyan-500/20 text-cyan-400' };
  }
  if (count <= 80) {
    return { name: 'High', greenTime: 35, color: '#f59e0b', badge: 'bg-amber-500/20 text-amber-400' };
  }
  return { name: 'Very High', greenTime: 45, color: '#ef4444', badge: 'bg-rose-500/20 text-rose-400' };
}

export default function App() {
  const [vehicles, setVehicles] = useState(DEFAULT_VEHICLES);
  const [selectedJunction, setSelectedJunction] = useState('J1');

  // Requirement 2: Adjust vehicle counts
  const handleVehicleChange = (junctionId, count) => {
    const val = Math.max(0, Math.min(120, Number(count) || 0));
    setVehicles((prev) => ({ ...prev, [junctionId]: val }));
  };

  const applyPreset = (presetName) => {
    if (presetName === 'DEFAULT') setVehicles({ J1: 80, J2: 50, J3: 15, J4: 100 });
    if (presetName === 'BALANCED') setVehicles({ J1: 40, J2: 40, J3: 40, J4: 40 });
    if (presetName === 'LIGHT') setVehicles({ J1: 15, J2: 12, J3: 18, J4: 10 });
    if (presetName === 'HEAVY') setVehicles({ J1: 95, J2: 85, J3: 90, J4: 110 });
  };

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
                (Click any junction to adjust vehicles)
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
                const count = vehicles[j.id];
                const tier = getTierInfo(count);

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

                    <text x="0" y="-12" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="monospace">
                      {j.id}
                    </text>

                    {/* Vehicle Count Badge */}
                    <rect x="-26" y="-4" width="52" height="18" rx="4" fill="#020617" stroke="#334155" />
                    <text x="0" y="9" textAnchor="middle" fill={tier.color} fontSize="10" fontWeight="bold" fontFamily="monospace">
                      {count} veh
                    </text>

                    {/* Signal Lights */}
                    <g transform="translate(0, 22)">
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

        {/* ============================================================== */}
        {/* REQUIREMENT 2: VEHICLE MANAGEMENT CONTROLS                     */}
        {/* ============================================================== */}
        <section className="bg-[#091122] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>Vehicle Management &amp; Controls</span>
              </h2>
              <p className="text-xs text-slate-400">
                Adjust vehicle counts for the 4 junctions.
              </p>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <button
                onClick={() => applyPreset('DEFAULT')}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700"
              >
                Default
              </button>
              <button
                onClick={() => applyPreset('BALANCED')}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
              >
                Balanced (40)
              </button>
              <button
                onClick={() => applyPreset('HEAVY')}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
              >
                Rush Hour
              </button>
            </div>
          </div>

          {/* Sliders for all 4 Junctions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.values(JUNCTIONS).map((j) => {
              const count = vehicles[j.id];
              const tier = getTierInfo(count);
              const isSelected = selectedJunction === j.id;

              return (
                <div
                  key={j.id}
                  onClick={() => setSelectedJunction(j.id)}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-950 border-cyan-500/70 ring-1 ring-cyan-500/30'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-white text-sm">{j.id}</span>
                      <span className="text-[11px] text-slate-400 block">{j.label}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${tier.badge}`}>
                      {tier.name} ({tier.greenTime}s Green)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="120"
                      value={count}
                      onChange={(e) => handleVehicleChange(j.id, e.target.value)}
                      className="flex-1 accent-cyan-400 cursor-pointer h-2 bg-slate-900 rounded-lg"
                    />
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={count}
                      onChange={(e) => handleVehicleChange(j.id, e.target.value)}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center text-sm font-bold focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Viva Reference Summary */}
        <section className="rounded-xl bg-[#091122]/70 border border-slate-800 p-4 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-bold text-white mb-2">
            <Award className="w-4 h-4 text-cyan-400" />
            <span>Viva Summary: 4-Tier Adaptive Timing Algorithm</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="bg-slate-950/80 p-2 rounded border border-emerald-900/40 text-emerald-300">
              <strong>Tier 1: Low (0-19)</strong>
              <div>➔ 15s Green Light</div>
            </div>
            <div className="bg-slate-950/80 p-2 rounded border border-cyan-900/40 text-cyan-300">
              <strong>Tier 2: Med (20-50)</strong>
              <div>➔ 25s Green Light</div>
            </div>
            <div className="bg-slate-950/80 p-2 rounded border border-amber-900/40 text-amber-300">
              <strong>Tier 3: High (51-80)</strong>
              <div>➔ 35s Green Light</div>
            </div>
            <div className="bg-slate-950/80 p-2 rounded border border-rose-900/40 text-rose-300">
              <strong>Tier 4: V.High (&gt;80)</strong>
              <div>➔ 45s Green Light</div>
            </div>
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
