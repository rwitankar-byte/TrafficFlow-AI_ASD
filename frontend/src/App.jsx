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
  Hospital as HospitalIcon,
  Server
} from 'lucide-react';

/**
 * ==============================================================================
 * SMART TRAFFIC MANAGEMENT SYSTEM (4 JUNCTIONS + EMERGENCY GREEN CORRIDOR)
 * ==============================================================================
 * Connected directly to Node.js/Express Backend API (http://localhost:3000)
 * 
 * CORE ARCHITECTURE:
 * 1. Frontend: Visual SVG Map, Sliders, Live Countdown, Ambulance Animation
 * 2. Backend: 4-Tier Density Algorithm, Cycle Queueing, Hospital Pathfinding
 * 3. Communication: Real-time REST API calls to /api/traffic/decision
 * ==============================================================================
 */

const API_BASE_URL = 'http://localhost:3000/api/traffic';

// Map Coordinates & Configuration
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

/**
 * Helper to call Backend Decision API (/api/traffic/decision)
 */
async function callBackendDecision(payload) {
  try {
    const res = await fetch(`${API_BASE_URL}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend API unavailable on port 3000:', err.message);
    return null;
  }
}

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

  // 6. Backend API Connection & Decision Data State
  const [backendStatus, setBackendStatus] = useState('connecting'); // 'connected' | 'offline' | 'connecting'
  const [backendData, setBackendData] = useState(null);

  // ============================================================================
  // FETCH LATEST ALGORITHM METRICS FROM BACKEND
  // ============================================================================
  useEffect(() => {
    let isMounted = true;

    async function syncWithBackend() {
      const data = await callBackendDecision({
        vehicles,
        ambulance: ambulance ? { junction: ambulance.junction, progress: ambulance.progress } : null,
        currentGreen: activeGreen,
        isNextCycle: false
      });

      if (isMounted) {
        if (data && data.status === 'success') {
          setBackendStatus('connected');
          setBackendData(data);
        } else {
          setBackendStatus('offline');
        }
      }
    }

    syncWithBackend();
    return () => { isMounted = false; };
  }, [vehicles, ambulance?.junction]);

  // ============================================================================
  // USER ACTION HANDLERS
  // ============================================================================
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

  // Add ambulance at a random location & fetch corridor route from backend
  const handleAddRandomAmbulance = async () => {
    const startCandidates = ['J1', 'J2', 'J3'];
    const randomJunction = startCandidates[Math.floor(Math.random() * startCandidates.length)];

    // Call backend API to calculate shortest route to hospital & emergency preemption
    const decision = await callBackendDecision({
      vehicles,
      ambulance: { junction: randomJunction, progress: 0 },
      isNextCycle: false
    });

    const path = decision?.ambulance?.corridorPath || (
      randomJunction === 'J1' ? ['J1', 'J2', 'J4', 'HOSPITAL'] :
      randomJunction === 'J2' ? ['J2', 'J4', 'HOSPITAL'] : ['J3', 'J4', 'HOSPITAL']
    );

    setAmbulance({
      junction: randomJunction,
      path: path,
      progress: 0,
    });

    if (decision && decision.status === 'success') {
      setBackendStatus('connected');
      setBackendData(decision);
    }

    // If live monitoring is running, give green light immediately to ambulance junction!
    if (isMonitoring) {
      setActiveGreen(randomJunction);
      setCountdown(decision?.greenDuration || 45);
      setSignalColor('GREEN');
      if (decision?.message) {
        setLogs((prev) => [decision.message, ...prev.slice(0, 9)]);
      }
    }
  };

  const handleClearAmbulance = () => {
    setAmbulance(null);
  };

  // Submit / Toggle Live Monitoring: delegates initial priority to backend
  const handleToggleMonitoring = async () => {
    const nextMonitoring = !isMonitoring;
    setIsMonitoring(nextMonitoring);

    if (nextMonitoring) {
      // Call backend API to decide who gets green first
      const decision = await callBackendDecision({
        vehicles,
        ambulance: ambulance ? { junction: ambulance.junction, progress: ambulance.progress } : null,
        isNextCycle: false
      });

      if (decision && decision.activeGreen) {
        setBackendStatus('connected');
        setBackendData(decision);
        setActiveGreen(decision.activeGreen);
        setCountdown(decision.greenDuration);
        setSignalColor('GREEN');
        setLogs([decision.message]);
      } else {
        // Fallback if backend offline
        const highestJunction = Object.entries(vehicles).sort((a, b) => b[1] - a[1])[0][0];
        setActiveGreen(highestJunction);
        setCountdown(45);
        setSignalColor('GREEN');
        setLogs([`⚡ Local Fallback: ${highestJunction} started.`]);
      }
    }
  };

  const handleReset = () => {
    setIsMonitoring(false);
    setVehicles(DEFAULT_VEHICLES);
    setAmbulance(null);
    setSelectedJunction('J1');
    setLogs([]);
  };

  // ============================================================================
  // REAL-TIME 1-SECOND SIMULATION LOOP (Backend-Driven Cycle Transitions)
  // ============================================================================
  useEffect(() => {
    if (!isMonitoring) return;

    const timer = setInterval(async () => {
      // 1. Advance ambulance progress if active
      if (ambulance) {
        setAmbulance((prev) => {
          if (!prev) return null;
          if (prev.progress >= 100) return prev;
          return { ...prev, progress: prev.progress + 2 };
        });
      }

      // 2. Decrement countdown
      setCountdown((prevCount) => {
        if (prevCount > 1) return prevCount - 1;

        if (signalColor === 'GREEN') {
          // Switch to safe 3-second Yellow clearance
          setSignalColor('YELLOW');
          return 3;
        } else {
          // Yellow finished: request next signal phase from backend!
          setSignalColor('GREEN');

          // Trigger asynchronous backend rotation
          (async () => {
            const nextDecision = await callBackendDecision({
              vehicles,
              ambulance: ambulance ? { junction: ambulance.junction, progress: ambulance.progress } : null,
              currentGreen: activeGreen,
              isNextCycle: true
            });

            if (nextDecision && nextDecision.activeGreen) {
              setBackendStatus('connected');
              setBackendData(nextDecision);
              setActiveGreen(nextDecision.activeGreen);
              setLogs((prev) => [nextDecision.message, ...prev.slice(0, 9)]);
              setCountdown(nextDecision.greenDuration);
            } else {
              // Fallback if backend temporarily disconnected
              const remaining = Object.keys(JUNCTIONS).filter((j) => j !== activeGreen);
              const nextJ = remaining.sort((a, b) => vehicles[b] - vehicles[a])[0];
              setActiveGreen(nextJ);
              setCountdown(35);
            }
          })();

          return 35; // temporary placeholder until backend async promise resolves
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isMonitoring, signalColor, activeGreen, vehicles, ambulance]);

  // Total cars in network
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

  // Frontend styling dictionary based on backend tier levels
  const TIER_THEME = {
    LOW: { color: '#10b981', badge: 'bg-emerald-500/20 text-emerald-400' },
    MEDIUM: { color: '#06b6d4', badge: 'bg-cyan-500/20 text-cyan-400' },
    HIGH: { color: '#f59e0b', badge: 'bg-amber-500/20 text-amber-400' },
    VERY_HIGH: { color: '#ef4444', badge: 'bg-rose-500/20 text-rose-400' }
  };

  // Helper to extract tier info returned by backend and apply frontend styling
  const getJunctionTier = (jId) => {
    const rawTier = backendData?.junctions?.[jId];
    if (rawTier) {
      const theme = TIER_THEME[rawTier.level] || TIER_THEME.MEDIUM;
      return {
        ...rawTier,
        ...theme
      };
    }
    // Fallback if backend initializing
    const count = vehicles[jId] || 0;
    if (count <= 19) return { name: 'Low', greenTime: 15, ...TIER_THEME.LOW };
    if (count <= 50) return { name: 'Medium', greenTime: 25, ...TIER_THEME.MEDIUM };
    if (count <= 80) return { name: 'High', greenTime: 35, ...TIER_THEME.HIGH };
    return { name: 'Very High', greenTime: 45, ...TIER_THEME.VERY_HIGH };
  };

  // ============================================================================
  // USER INTERFACE (JSX)
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
              <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Smart Traffic System <span className="text-cyan-400">(4-Junction Grid)</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Adaptive Signal Control &bull; Emergency Green Corridor &bull; Full-Stack Architecture
              </p>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2">
            {/* Backend Connection Indicator */}
            <div 
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-colors ${
                backendStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
              title={backendStatus === 'connected' ? 'Connected to Node.js backend on port 3000' : 'Backend offline - start backend with npm run dev'}
            >
              <Server className="w-3.5 h-3.5" />
              <span className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>Backend: {backendStatus === 'connected' ? 'Connected (:3000)' : 'Offline'}</span>
            </div>

            {/* Monitoring Status Badge */}
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
        
        {/* INTERACTIVE TRAFFIC MAP + FIXED HOSPITAL */}
        <section className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-800/80 gap-2">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Live 2D Intersection Grid (SVG)
              </h2>
              <p className="text-xs text-slate-400">
                Interactive road map showing J1, J2, J3, J4 signals &bull; Green indicates active traffic flow
              </p>
            </div>

            {/* Current Active Signal Badge */}
            {isMonitoring && (
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-slate-400">Active Phase:</span>
                <span
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 ${
                    signalColor === 'GREEN'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      signalColor === 'GREEN' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {activeGreen} ({signalColor} - {countdown}s)
                </span>
              </div>
            )}
          </div>

          {/* SVG Map Canvas */}
          <div className="w-full bg-[#070b14] rounded-xl border border-slate-800/80 flex items-center justify-center p-2 sm:p-4">
            <svg
              viewBox="0 0 680 430"
              className="w-full max-w-2xl h-auto select-none"
              style={{ maxHeight: '420px' }}
            >
              {/* City Background & Grid */}
              <rect x="0" y="0" width="680" height="430" fill="#070b14" rx="10" />

              {/* Asphalt Roads */}
              {/* Horizontal Roads */}
              <rect x="60" y="105" width="460" height="50" fill="#1e293b" rx="4" />
              <rect x="60" y="285" width="580" height="50" fill="#1e293b" rx="4" />

              {/* Vertical Roads */}
              <rect x="155" y="30" width="50" height="370" fill="#1e293b" rx="4" />
              <rect x="395" y="30" width="50" height="370" fill="#1e293b" rx="4" />

              {/* Dashed Centerlines */}
              <line x1="60" y1="130" x2="520" y2="130" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />
              <line x1="60" y1="310" x2="620" y2="310" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />
              <line x1="180" y1="30" x2="180" y2="400" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />
              <line x1="420" y1="30" x2="420" y2="400" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />

              {/* Glowing Ambulance Green Corridor Route */}
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
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="10 6"
                  className="animate-pulse"
                  opacity="0.9"
                />
              )}

              {/* CITY HOSPITAL LOCATION */}
              <g transform={`translate(${HOSPITAL.x}, ${HOSPITAL.y})`}>
                <rect x="-40" y="-35" width="80" height="70" rx="10" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2.5" />
                <HospitalIcon x="-14" y="-24" width="28" height="28" className="text-rose-400" color="#f43f5e" />
                <text x="0" y="18" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  HOSPITAL
                </text>
                <text x="0" y="30" textAnchor="middle" fill="#a5b4fc" fontSize="8" fontFamily="monospace">
                  City Medical
                </text>
              </g>

              {/* THE FOUR JUNCTIONS (J1, J2, J3, J4) */}
              {Object.values(JUNCTIONS).map((j) => {
                const isSelected = selectedJunction === j.id;
                const isGreen = isMonitoring && activeGreen === j.id;
                const isYellow = isGreen && signalColor === 'YELLOW';
                const count = vehicles[j.id];
                const tier = getJunctionTier(j.id);

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

                    {/* Traffic Light Circle */}
                    <circle
                      cx="0"
                      cy="8"
                      r="12"
                      fill={isYellow ? '#f59e0b' : isGreen ? '#10b981' : '#ef4444'}
                      className={isGreen ? 'animate-pulse' : ''}
                    />

                    {/* Timer or Count text */}
                    {isMonitoring && isGreen ? (
                      <text x="0" y="12" textAnchor="middle" fill="#000000" fontSize="11" fontWeight="black" fontFamily="monospace">
                        {countdown}
                      </text>
                    ) : (
                      <text x="0" y="12" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="monospace">
                        {count}
                      </text>
                    )}

                    {/* Tier badge text under junction */}
                    <text x="0" y="48" textAnchor="middle" fill={tier.color || '#94a3b8'} fontSize="9" fontWeight="bold" fontFamily="monospace">
                      {tier.name} ({count})
                    </text>
                  </g>
                );
              })}

              {/* Moving Ambulance Animation */}
              {ambulance && ambCoords && (
                <g transform={`translate(${ambCoords.x}, ${ambCoords.y})`}>
                  <circle cx="0" cy="0" r="16" fill="#dc2626" className="animate-ping" opacity="0.4" />
                  <rect x="-14" y="-14" width="28" height="28" rx="6" fill="#ffffff" stroke="#ef4444" strokeWidth="2.5" />
                  <Siren x="-9" y="-9" width="18" height="18" color="#dc2626" />
                  <text x="0" y="-18" textAnchor="middle" fill="#f87171" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    AMBULANCE ({ambulance.progress}%)
                  </text>
                </g>
              )}
            </svg>
          </div>
        </section>

        {/* CONTROLS & MANAGEMENT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* VEHICLE MANAGEMENT (SLIDERS) */}
          <section className="md:col-span-2 rounded-2xl bg-[#0b1329] border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Vehicle Management &amp; Density Sliders
              </h3>
              
              {/* Presets */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => applyPreset('DEFAULT')}
                  className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Proposal
                </button>
                <button
                  onClick={() => applyPreset('BALANCED')}
                  className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Balanced
                </button>
                <button
                  onClick={() => applyPreset('HEAVY')}
                  className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Rush Hour
                </button>
              </div>
            </div>

            {/* Sliders for all 4 Junctions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.values(JUNCTIONS).map((j) => {
                const count = vehicles[j.id];
                const tier = getJunctionTier(j.id);
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
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${tier.badge || 'bg-slate-800 text-slate-300'}`}>
                        {tier.name} ({tier.greenTime}s Green)
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">Cars Waiting:</span>
                        <span className="text-white font-bold">{count} vehicles</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="120"
                        value={count}
                        onChange={(e) => handleVehicleChange(j.id, e.target.value)}
                        className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* AMBULANCE DISPATCH & HOSPITAL CORRIDOR */}
          <section className="rounded-2xl bg-[#0b1329] border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Siren className="w-4 h-4 text-rose-400" />
                Emergency Vehicle Control
              </h3>

              <p className="text-xs text-slate-400">
                Spawns an ambulance on a random junction. Backend automatically computes shortest route and overrides signals to <strong>City Hospital</strong>.
              </p>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Ambulance Status:</span>
                  <span className={`font-bold ${ambulance ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`}>
                    {ambulance ? `ACTIVE at ${ambulance.junction}` : 'NOT SPAWNED'}
                  </span>
                </div>
                {ambulance && (
                  <div className="text-[11px] font-mono text-emerald-400">
                    Route: {ambulance.path.join(' ➔ ')}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleAddRandomAmbulance}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-lg shadow-rose-950/50"
              >
                <Shuffle className="w-4 h-4" />
                <span>SPAWN RANDOM AMBULANCE</span>
              </button>

              {ambulance && (
                <button
                  onClick={handleClearAmbulance}
                  className="w-full py-2 px-3 rounded-xl text-xs font-mono text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
                >
                  Clear Ambulance
                </button>
              )}
            </div>
          </section>
        </div>

        {/* SUBMIT BUTTON & LIVE MONITORING TRIGGER */}
        <section className="rounded-2xl bg-[#0b1329] border border-slate-800 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Submission &amp; Live Monitoring Engine
              </h3>
              <p className="text-xs text-slate-400">
                Submit current traffic state to Node.js backend. The decision engine will initiate live signal cycling.
              </p>
            </div>

            <button
              onClick={handleToggleMonitoring}
              className={`py-3 px-6 rounded-xl font-black text-sm flex items-center justify-center gap-2 tracking-wider transition-all shadow-xl ${
                isMonitoring
                  ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/40'
              }`}
            >
              {isMonitoring ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>PAUSE LIVE MONITORING</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>SUBMIT &amp; START LIVE MONITORING</span>
                </>
              )}
            </button>
          </div>

          {/* LIVE LOGS FEED */}
          {isMonitoring && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Backend Decision Log Feed:
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

        {/* Viva Reference Summary */}
        <section className="rounded-xl bg-[#091122]/70 border border-slate-800 p-4 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-bold text-white mb-2">
            <Award className="w-4 h-4 text-cyan-400" />
            <span>Backend Logic: 4-Tier Adaptive Timing Algorithm</span>
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
        Total Cars in Grid: {totalCars} &bull; Backend: Node.js Express (:3000) &bull; Frontend: React Vite (:5173)
      </footer>
    </div>
  );
}
