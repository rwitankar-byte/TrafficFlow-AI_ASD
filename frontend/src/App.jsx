import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Siren, 
  Play, 
  Pause, 
  RotateCcw, 
  Shuffle, 
  CheckCircle2, 
  Activity, 
  Award,
  Sliders,
  Hospital as HospitalIcon
} from 'lucide-react';

/**
 * ==============================================================================
 * SMART TRAFFIC MANAGEMENT SYSTEM (4 JUNCTIONS + EMERGENCY GREEN CORRIDOR)
 * ==============================================================================
 * Designed for 3rd Year Capstone / Final Year Project.
 * Everything is in this single, clean file so you can easily understand,
 * modify, and explain it during your viva or presentation!
 * 
 * CORE FEATURES:
 * 1. Interactive Traffic Map: 4 junctions (J1, J2, J3, J4) + roads in SVG
 * 2. Vehicle Management: Sliders to control vehicle counts at each junction
 * 3. Random Ambulance Placement: Button to spawn an ambulance at any random junction
 * 4. Hospital Location: Fixed City Hospital at (580, 310) next to Junction 4
 * 5. Live Monitoring: Begins once you click the "SUBMIT" button
 * ==============================================================================
 */

// ==============================================================================
// SECTION 1: MAP COORDINATES & CONFIGURATION
// ==============================================================================
const JUNCTIONS = {
  J1: { id: 'J1', name: 'Junction 1', label: 'North-West (Grand Ave)', x: 180, y: 130 },
  J2: { id: 'J2', name: 'Junction 2', label: 'North-East (Metro Blvd)', x: 420, y: 130 },
  J3: { id: 'J3', name: 'Junction 3', label: 'South-West (Outer Ring)', x: 180, y: 310 },
  J4: { id: 'J4', name: 'Junction 4', label: 'South-East (Expressway)', x: 420, y: 310 },
};

// Fixed Hospital Location (connected to Junction 4 on the right)
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

// ==============================================================================
// SECTION 2: 4-TIER ALGORITHM (Explain this in viva!)
// ==============================================================================
// Rule:
// - Tier 1: Low (0 to 19 vehicles)       -> 15 seconds Green Light
// - Tier 2: Medium (20 to 50 vehicles)   -> 25 seconds Green Light
// - Tier 3: High (51 to 80 vehicles)     -> 35 seconds Green Light
// - Tier 4: Very High (> 80 vehicles)    -> 45 seconds Green Light
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

// ==============================================================================
// SECTION 3: MAIN APP COMPONENT
// ==============================================================================
export default function App() {
  // 1. Vehicle counts state for all 4 junctions
  const [vehicles, setVehicles] = useState(DEFAULT_VEHICLES);

  // 2. Currently selected junction for editing (J1, J2, J3, J4)
  const [selectedJunction, setSelectedJunction] = useState('J1');

  // 3. Ambulance State: null when not placed, or object with junction and progress
  const [ambulance, setAmbulance] = useState(null);

  // 4. Live Monitoring submission state: false = setup mode, true = live monitoring active
  const [isMonitoring, setIsMonitoring] = useState(false);

  // 5. Active Green Light state during monitoring
  const [activeGreen, setActiveGreen] = useState('J4'); // default busiest junction
  const [countdown, setCountdown] = useState(45);
  const [signalColor, setSignalColor] = useState('GREEN'); // 'GREEN' | 'YELLOW'
  const [logs, setLogs] = useState([]);

  // ============================================================================
  // SECTION 4: USER ACTION HANDLERS
  // ============================================================================
  // Update vehicle count for a specific junction
  const handleVehicleChange = (junctionId, count) => {
    const val = Math.max(0, Math.min(120, Number(count) || 0));
    setVehicles((prev) => ({ ...prev, [junctionId]: val }));
  };

  // Quick Preset buttons (light, balanced, heavy, proposal default)
  const applyPreset = (presetName) => {
    if (presetName === 'DEFAULT') setVehicles({ J1: 80, J2: 50, J3: 15, J4: 100 });
    if (presetName === 'BALANCED') setVehicles({ J1: 40, J2: 40, J3: 40, J4: 40 });
    if (presetName === 'LIGHT') setVehicles({ J1: 15, J2: 12, J3: 18, J4: 10 });
    if (presetName === 'HEAVY') setVehicles({ J1: 95, J2: 85, J3: 90, J4: 110 });
  };

  // Requirement 3: Add ambulance at a random location
  const handleAddRandomAmbulance = () => {
    const startCandidates = ['J1', 'J2', 'J3'];
    const randomJunction = startCandidates[Math.floor(Math.random() * startCandidates.length)];

    // Path to City Hospital (connected to J4)
    let path = [];
    if (randomJunction === 'J1') path = ['J1', 'J2', 'J4', 'HOSPITAL'];
    else if (randomJunction === 'J2') path = ['J2', 'J4', 'HOSPITAL'];
    else path = ['J3', 'J4', 'HOSPITAL'];

    setAmbulance({
      junction: randomJunction,
      path: path,
      progress: 0, // 0% to 100% towards hospital
    });

    // If live monitoring is running, give green light immediately to ambulance junction!
    if (isMonitoring) {
      setActiveGreen(randomJunction);
      setCountdown(45);
      setSignalColor('GREEN');
    }
  };

  // Clear ambulance
  const handleClearAmbulance = () => {
    setAmbulance(null);
  };

  // Requirement 5: "Once submitted, live monitoring will begin"
  const handleToggleMonitoring = () => {
    const nextMonitoring = !isMonitoring;
    setIsMonitoring(nextMonitoring);

    // If starting live monitoring now:
    if (nextMonitoring) {
      if (ambulance) {
        // Priority to ambulance junction
        setActiveGreen(ambulance.junction);
        setCountdown(45);
        setSignalColor('GREEN');
        setLogs((prev) => [
          `🚨 Emergency Green Corridor Active: Priority green assigned to ${ambulance.junction} for Ambulance to City Hospital.`,
          ...prev,
        ]);
      } else {
        // Priority to junction with highest vehicle count
        const sorted = Object.entries(vehicles).sort((a, b) => b[1] - a[1]);
        const highestJunction = sorted[0][0];
        const tier = getTierInfo(vehicles[highestJunction]);

        setActiveGreen(highestJunction);
        setCountdown(tier.greenTime);
        setSignalColor('GREEN');
        setLogs([
          `⚡ Live Monitoring Started: ${highestJunction} has highest traffic (${vehicles[highestJunction]} cars, ${tier.name} Tier) -> ${tier.greenTime}s Green.`,
        ]);
      }
    }
  };

  // Reset entire simulation to defaults
  const handleReset = () => {
    setIsMonitoring(false);
    setVehicles(DEFAULT_VEHICLES);
    setAmbulance(null);
    setSelectedJunction('J1');
    setLogs([]);
  };

  // ============================================================================
  // SECTION 5: REAL-TIME 1-SECOND SIMULATION LOOP
  // ============================================================================
  useEffect(() => {
    if (!isMonitoring) return;

    const timer = setInterval(() => {
      // 1. Advance ambulance progress if active
      if (ambulance) {
        setAmbulance((prev) => {
          if (!prev) return null;
          if (prev.progress >= 100) return prev; // reached hospital
          return { ...prev, progress: prev.progress + 2 };
        });
      }

      // 2. Decrement countdown
      setCountdown((prevCount) => {
        if (prevCount > 1) return prevCount - 1;

        // When countdown reaches 1:
        if (signalColor === 'GREEN') {
          // Switch to 3-second Yellow clearance
          setSignalColor('YELLOW');
          return 3;
        } else {
          // Yellow finished: switch green light to next junction!
          setSignalColor('GREEN');

          // If ambulance is active, cycle along its path
          if (ambulance) {
            const pathJunctions = ambulance.path.filter((p) => p !== 'HOSPITAL');
            const currentIndex = pathJunctions.indexOf(activeGreen);
            const nextJunction = pathJunctions[(currentIndex + 1) % pathJunctions.length] || 'J4';

            setActiveGreen(nextJunction);
            setLogs((prev) => [
              `🚨 Corridor Shift: Green light passed forward to ${nextJunction} for oncoming ambulance.`,
              ...prev.slice(0, 9),
            ]);
            return 45;
          }

          // Otherwise, pick next highest traffic junction
          const allJunctions = Object.keys(JUNCTIONS);
          const otherJunctions = allJunctions.filter((j) => j !== activeGreen);
          const nextJunction = otherJunctions.sort((a, b) => vehicles[b] - vehicles[a])[0];
          const tier = getTierInfo(vehicles[nextJunction]);

          setActiveGreen(nextJunction);
          setLogs((prev) => [
            `🔄 Adaptive Shift: Switched green light to ${nextJunction} (${vehicles[nextJunction]} cars, ${tier.name} Tier) -> ${tier.greenTime}s.`,
            ...prev.slice(0, 9),
          ]);
          return tier.greenTime;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isMonitoring, signalColor, activeGreen, vehicles, ambulance]);

  // Compute total cars in network
  const totalCars = Object.values(vehicles).reduce((a, b) => a + Number(b), 0);

  // Compute live ambulance coordinate on the map along path
  const getAmbulanceCoordinates = () => {
    if (!ambulance) return null;
    const p = ambulance.progress;

    if (ambulance.junction === 'J1') {
      // J1(180, 130) -> J2(420, 130) -> J4(420, 310) -> Hospital(580, 310)
      if (p <= 33) {
        const r = p / 33;
        return { x: 180 + (420 - 180) * r, y: 130 };
      } else if (p <= 66) {
        const r = (p - 33) / 33;
        return { x: 420, y: 130 + (310 - 130) * r };
      } else {
        const r = (p - 66) / 34;
        return { x: 420 + (580 - 420) * r, y: 310 };
      }
    } else if (ambulance.junction === 'J2') {
      // J2(420, 130) -> J4(420, 310) -> Hospital(580, 310)
      if (p <= 50) {
        const r = p / 50;
        return { x: 420, y: 130 + (310 - 130) * r };
      } else {
        const r = (p - 50) / 50;
        return { x: 420 + (580 - 420) * r, y: 310 };
      }
    } else {
      // J3(180, 310) -> J4(420, 310) -> Hospital(580, 310)
      if (p <= 60) {
        const r = p / 60;
        return { x: 180 + (420 - 180) * r, y: 310 };
      } else {
        const r = (p - 60) / 40;
        return { x: 420 + (580 - 420) * r, y: 310 };
      }
    }
  };

  const ambCoords = getAmbulanceCoordinates();

  // ============================================================================
  // SECTION 6: USER INTERFACE (JSX)
  // ============================================================================
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

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 border ${
                isMonitoring
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isMonitoring ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'
                }`}
              />
              {isMonitoring ? 'LIVE MONITORING ACTIVE' : 'SETUP MODE'}
            </span>

            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="Reset All"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
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
              <span>Interactive Traffic Map</span>
              <span className="text-xs font-normal text-slate-400">
                (Click any junction to adjust vehicles)
              </span>
            </h2>

            {/* Map Legend */}
            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Green
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Red
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <Siren className="w-3.5 h-3.5" /> Ambulance
              </span>
              <span className="flex items-center gap-1 text-cyan-300">
                <HospitalIcon className="w-3.5 h-3.5" /> Hospital
              </span>
            </div>
          </div>

          {/* SVG Canvas Map */}
          <div className="w-full bg-[#070b14] rounded-xl border border-slate-800/80 p-2 flex justify-center overflow-hidden">
            <svg viewBox="0 0 700 420" className="w-full max-w-[700px] h-auto select-none">
              {/* Asphalt Gray Roads */}
              {/* Horizontal top road (J1 to J2) */}
              <rect x="60" y="105" width="480" height="50" fill="#182030" rx="4" />
              {/* Horizontal bottom road (J3 to J4 & Hospital) */}
              <rect x="60" y="285" width="560" height="50" fill="#182030" rx="4" />
              {/* Vertical left road (J1 to J3) */}
              <rect x="155" y="30" width="50" height="360" fill="#182030" rx="4" />
              {/* Vertical right road (J2 to J4) */}
              <rect x="395" y="30" width="50" height="360" fill="#182030" rx="4" />

              {/* Dashed Centerlines */}
              <line x1="60" y1="130" x2="540" y2="130" stroke="#eab308" strokeWidth="2" strokeDasharray="8,8" />
              <line x1="60" y1="310" x2="620" y2="310" stroke="#eab308" strokeWidth="2" strokeDasharray="8,8" />
              <line x1="180" y1="30" x2="180" y2="390" stroke="#eab308" strokeWidth="2" strokeDasharray="8,8" />
              <line x1="420" y1="30" x2="420" y2="390" stroke="#eab308" strokeWidth="2" strokeDasharray="8,8" />

              {/* Glowing Emergency Green Corridor when Ambulance is placed */}
              {ambulance && (
                <path
                  d={
                    ambulance.junction === 'J1'
                      ? 'M 180 130 L 420 130 L 420 310 L 580 310'
                      : ambulance.junction === 'J2'
                      ? 'M 420 130 L 420 310 L 580 310'
                      : 'M 180 310 L 420 310 L 580 310'
                  }
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="6"
                  strokeDasharray="10,6"
                  className="animate-pulse"
                />
              )}

              {/* REQUIREMENT 4: FIXED HOSPITAL LOCATION (Adjacent to Junction 4) */}
              <g transform={`translate(${HOSPITAL.x}, ${HOSPITAL.y})`}>
                <rect x="-35" y="-35" width="70" height="70" rx="8" fill="#0f172a" stroke="#ef4444" strokeWidth="2.5" />
                {/* Red Cross */}
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
                const isGreen = isMonitoring && activeGreen === j.id;
                const isYellow = isGreen && signalColor === 'YELLOW';
                const count = vehicles[j.id];
                const tier = getTierInfo(count);

                return (
                  <g
                    key={j.id}
                    transform={`translate(${j.x}, ${j.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelectedJunction(j.id)}
                  >
                    {/* Junction Box */}
                    <rect
                      x="-35"
                      y="-35"
                      width="70"
                      height="70"
                      rx="8"
                      fill="#111c33"
                      stroke={isSelected ? '#06b6d4' : isGreen ? '#10b981' : '#334155'}
                      strokeWidth={isSelected || isGreen ? '3' : '1.5'}
                    />

                    {/* Junction Name */}
                    <text x="0" y="-12" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="monospace">
                      {j.id}
                    </text>

                    {/* Vehicle Count Badge */}
                    <rect x="-26" y="-4" width="52" height="18" rx="4" fill="#020617" stroke="#334155" />
                    <text x="0" y="9" textAnchor="middle" fill={tier.color} fontSize="10" fontWeight="bold" fontFamily="monospace">
                      {count} veh
                    </text>

                    {/* Signal Lights (🔴 🟡 🟢) */}
                    <g transform="translate(0, 22)">
                      <circle cx="-12" cy="0" r="4" fill={isMonitoring ? (!isGreen ? '#ef4444' : '#450a0a') : '#ef4444'} />
                      <circle cx="0" cy="0" r="4" fill={isMonitoring && isYellow ? '#f59e0b' : '#451a03'} />
                      <circle cx="12" cy="0" r="4" fill={isMonitoring && isGreen && !isYellow ? '#10b981' : '#022c22'} />
                    </g>

                    {/* Active Countdown Badge when Green */}
                    {isMonitoring && isGreen && (
                      <g transform="translate(0, -42)">
                        <rect x="-20" y="-10" width="40" height="20" rx="4" fill="#020617" stroke="#10b981" strokeWidth="1.5" />
                        <text x="0" y="4" textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="bold" fontFamily="monospace">
                          {countdown}s
                        </text>
                      </g>
                    )}

                    {/* Static Ambulance Marker before simulation starts */}
                    {ambulance && ambulance.junction === j.id && !isMonitoring && (
                      <g transform="translate(0, -44)">
                        <rect x="-26" y="-9" width="52" height="18" rx="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                        <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                          🚑 SPAWNED
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* REQUIREMENT 3: MOVING AMBULANCE PARTICLE */}
              {ambulance && isMonitoring && ambCoords && (
                <g transform={`translate(${ambCoords.x}, ${ambCoords.y})`}>
                  <circle r="14" fill="#ef4444" className="animate-ping opacity-60" />
                  <rect x="-14" y="-8" width="28" height="16" rx="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                    🚑
                  </text>
                </g>
              )}
            </svg>
          </div>
        </section>

        {/* ============================================================== */}
        {/* REQUIREMENT 2, 3, 5: VEHICLE CONTROLS, AMBULANCE, SUBMIT BUTTON */}
        {/* ============================================================== */}
        <section className="bg-[#091122] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>Vehicle Management &amp; Controls</span>
              </h2>
              <p className="text-xs text-slate-400">
                Adjust vehicle counts for the 4 junctions, optionally place an ambulance, and start monitoring.
              </p>
            </div>

            {/* Quick Presets */}
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

                  {/* Range Slider & Number Input */}
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

          {/* REQUIREMENT 3: RANDOM AMBULANCE PLACEMENT */}
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Siren className="w-4 h-4 text-rose-400 animate-pulse" />
                <span className="text-sm font-bold text-white">Emergency Vehicle Dispatch</span>
              </div>
              <p className="text-xs text-rose-200/80 mt-0.5">
                {ambulance
                  ? `🚑 Ambulance placed at ${ambulance.junction}! Green Corridor path: ${ambulance.path.join(' → ')}`
                  : 'Place an emergency ambulance at a random junction to trigger Green Corridor Preemption.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddRandomAmbulance}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-rose-900/40"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Place Random Ambulance</span>
              </button>

              {ambulance && (
                <button
                  onClick={handleClearAmbulance}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* REQUIREMENT 5: SUBMIT & START LIVE MONITORING BUTTON */}
          <div className="pt-2">
            <button
              onClick={handleToggleMonitoring}
              className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.99] ${
                isMonitoring
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 shadow-cyan-500/20'
              }`}
            >
              {isMonitoring ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>PAUSE MONITORING / EDIT VEHICLES</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>SUBMIT &amp; START LIVE MONITORING</span>
                </>
              )}
            </button>
          </div>

          {/* LIVE LOGS FEED (Visible when monitoring) */}
          {isMonitoring && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Live Signal Decision Log:
              </span>
              <div className="space-y-1.5 max-h-28 overflow-y-auto font-mono text-xs">
                {logs.map((log, index) => (
                  <div key={index} className="p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 3rd Year Viva Reference Summary */}
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

      {/* Simple Footer */}
      <footer className="border-t border-slate-800/80 py-3 text-center text-xs text-slate-500 font-mono">
        Total Cars in Grid: {totalCars} &bull; City Hospital: Fixed at (580, 310) &bull; 4-Junction Controller
      </footer>
    </div>
  );
}
