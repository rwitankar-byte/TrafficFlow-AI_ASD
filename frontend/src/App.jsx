import React, { useState, useEffect, useRef } from 'react';
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
  Server,
  Compass
} from 'lucide-react';

/**
 * ==============================================================================
 * SMART TRAFFIC MANAGEMENT SYSTEM (4 JUNCTIONS x 4 DIRECTIONS = 16 SIGNALS)
 * ==============================================================================
 * Real-world 16-Signal Architecture:
 * - 4 Interconnected 4-Way Junctions (J1, J2, J3, J4)
 * - Each junction independently controls 4 directional signals (North, South, East, West)
 * - Total 16 Traffic Lights actively managed by Node.js backend
 * - Hospital Emergency Green Corridor dynamically clears the exact directional path
 * ==============================================================================
 */

const API_BASE_URL = 'http://localhost:3000/api/traffic';

// Map Coordinates & Configuration
const JUNCTIONS = {
  J1: { id: 'J1', name: 'Junction 1', label: 'North-West (Grand Ave)', x: 180, y: 130 },
  J2: { id: 'J2', name: 'Junction 2', label: 'North-East (Metro Blvd)', x: 440, y: 130 },
  J3: { id: 'J3', name: 'Junction 3', label: 'South-West (Outer Ring)', x: 180, y: 310 },
  J4: { id: 'J4', name: 'Junction 4', label: 'South-East (Expressway)', x: 440, y: 310 },
};

// Fixed Hospital Location (connected to Junction 4 on the East)
const HOSPITAL = {
  id: 'HOSPITAL',
  name: 'City Hospital',
  x: 600,
  y: 310,
};

// Default initial vehicle counts for all 16 directional approaches
const DEFAULT_NETWORK_VEHICLES = {
  J1: { north: 25, south: 20, east: 15, west: 20 }, // Sum: 80
  J2: { north: 15, south: 10, east: 15, west: 10 }, // Sum: 50
  J3: { north: 5,  south: 4,  east: 3,  west: 3  }, // Sum: 15
  J4: { north: 30, south: 25, east: 15, west: 30 }  // Sum: 100
};

// Frontend styling dictionary based on backend tier levels
const TIER_THEME = {
  LOW: { color: '#10b981', badge: 'bg-emerald-500/20 text-emerald-400' },
  MEDIUM: { color: '#06b6d4', badge: 'bg-cyan-500/20 text-cyan-400' },
  HIGH: { color: '#f59e0b', badge: 'bg-amber-500/20 text-amber-400' },
  VERY_HIGH: { color: '#ef4444', badge: 'bg-rose-500/20 text-rose-400' }
};

/**
 * Call Backend 16-Signal Decision API (/api/traffic/decision)
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

/**
 * Determine which junction the ambulance is physically located at based on route progress
 */
function getAmbulanceCurrentJunction(startJunction, progress) {
  if (progress >= 100) return 'HOSPITAL';
  if (startJunction === 'J1') {
    if (progress < 34) return 'J1';
    if (progress < 68) return 'J2';
    return 'J4';
  } else if (startJunction === 'J2') {
    if (progress < 50) return 'J2';
    return 'J4';
  } else if (startJunction === 'J3') {
    if (progress < 50) return 'J3';
    return 'J4';
  }
  return startJunction;
}

/**
 * Get active corridor segment SVG path for the junction where ambulance currently is
 */
function getActiveSegmentPath(ambulance) {
  if (!ambulance || ambulance.progress >= 100) return null;
  const currentJ = ambulance.currentJunction || ambulance.junction;
  if (currentJ === 'J1') return 'M 180 130 L 440 130';
  if (currentJ === 'J2') return 'M 440 130 L 440 310';
  if (currentJ === 'J3') return 'M 180 310 L 440 310';
  if (currentJ === 'J4') return 'M 440 310 L 600 310';
  return null;
}

export default function App() {
  // 1. Vehicle counts state for all 16 approaches (4 junctions x 4 directions)
  const [networkVehicles, setNetworkVehicles] = useState(DEFAULT_NETWORK_VEHICLES);

  // 2. Currently selected junction for editing sliders (J1, J2, J3, J4)
  const [selectedJunction, setSelectedJunction] = useState('J1');

  // 3. Ambulance State: null when not placed, or object with junction and progress
  const [ambulance, setAmbulance] = useState(null);

  // 4. Live Monitoring submission state: false = setup mode, true = live monitoring active
  const [isMonitoring, setIsMonitoring] = useState(false);

  // 5. Active directional green state for each junction: { J1: 'NORTH', J2: 'SOUTH', ... }
  const [activeSignals, setActiveSignals] = useState({
    J1: 'NORTH',
    J2: 'EAST',
    J3: 'NORTH',
    J4: 'WEST'
  });

  // Countdown timer for each junction
  const [countdowns, setCountdowns] = useState({
    J1: 25,
    J2: 15,
    J3: 15,
    J4: 25
  });

  const [logs, setLogs] = useState([]);
  const [backendStatus, setBackendStatus] = useState('connecting'); // 'connected' | 'offline'
  const [backendData, setBackendData] = useState(null);

  // Refs for real-time simulation interval to access latest state without interval recreation
  const networkVehiclesRef = useRef(networkVehicles);
  networkVehiclesRef.current = networkVehicles;

  const activeSignalsRef = useRef(activeSignals);
  activeSignalsRef.current = activeSignals;

  const ambulanceRef = useRef(ambulance);
  ambulanceRef.current = ambulance;

  const countdownsRef = useRef(countdowns);
  countdownsRef.current = countdowns;

  // ============================================================================
  // SYNC 16-SIGNAL DECISION WITH NODE.JS BACKEND (SETUP MODE ONLY)
  // ============================================================================
  useEffect(() => {
    // CRITICAL: While live monitoring is running, DO NOT call backend on vehicle reduction!
    if (isMonitoring) return;

    let isMounted = true;

    async function syncDecision() {
      const data = await callBackendDecision({
        networkVehicles,
        ambulance: ambulance ? {
          junction: ambulance.junction,
          currentJunction: ambulance.currentJunction || ambulance.junction,
          progress: ambulance.progress
        } : null,
        activeSignals
      });

      if (isMounted) {
        if (data && data.status === 'success') {
          setBackendStatus('connected');
          setBackendData(data);

          // Update active signals from backend calculation
          if (data.junctions) {
            const newActive = {};
            const newCountdowns = {};
            for (const [jId, jData] of Object.entries(data.junctions)) {
              newActive[jId] = jData.activeDirection;
              newCountdowns[jId] = jData.duration;
            }
            activeSignalsRef.current = newActive;
            countdownsRef.current = newCountdowns;
            setActiveSignals(newActive);
            setCountdowns(newCountdowns);
          }
        } else {
          setBackendStatus('offline');
        }
      }
    }

    syncDecision();
    return () => { isMounted = false; };
  }, [networkVehicles, ambulance?.junction, ambulance?.currentJunction, isMonitoring]);

  // ============================================================================
  // USER ACTION HANDLERS
  // ============================================================================
  // Update vehicle count for a specific direction at a specific junction
  const handleDirectionChange = (junctionId, direction, count) => {
    const val = Math.max(0, Math.min(100, Number(count) || 0));
    setNetworkVehicles((prev) => {
      const updated = {
        ...prev,
        [junctionId]: {
          ...prev[junctionId],
          [direction]: val
        }
      };
      networkVehiclesRef.current = updated;
      return updated;
    });
  };

  // Quick Presets
  const applyPreset = (presetName) => {
    let nextVehicles = DEFAULT_NETWORK_VEHICLES;
    if (presetName === 'BALANCED') {
      nextVehicles = {
        J1: { north: 20, south: 20, east: 20, west: 20 },
        J2: { north: 20, south: 20, east: 20, west: 20 },
        J3: { north: 20, south: 20, east: 20, west: 20 },
        J4: { north: 20, south: 20, east: 20, west: 20 }
      };
    } else if (presetName === 'RUSH_HOUR') {
      nextVehicles = {
        J1: { north: 60, south: 45, east: 30, west: 20 },
        J2: { north: 40, south: 20, east: 70, west: 35 },
        J3: { north: 15, south: 20, east: 10, west: 15 },
        J4: { north: 85, south: 50, east: 40, west: 65 }
      };
    }
    setNetworkVehicles(nextVehicles);
    networkVehiclesRef.current = nextVehicles;
  };

  // Spawn Ambulance at random junction and call backend for corridor
  const handleAddRandomAmbulance = async () => {
    const candidates = ['J1', 'J2', 'J3'];
    const randomJunction = candidates[Math.floor(Math.random() * candidates.length)];
    const corridorPath = randomJunction === 'J1' 
      ? ['J1', 'J2', 'J4', 'HOSPITAL'] 
      : randomJunction === 'J2' 
      ? ['J2', 'J4', 'HOSPITAL'] 
      : ['J3', 'J4', 'HOSPITAL'];

    const newAmb = {
      junction: randomJunction,
      currentJunction: randomJunction,
      path: corridorPath,
      progress: 0
    };

    setAmbulance(newAmb);
    ambulanceRef.current = newAmb;

    const data = await callBackendDecision({
      networkVehicles: networkVehiclesRef.current,
      ambulance: {
        junction: newAmb.junction,
        currentJunction: newAmb.currentJunction,
        progress: 0
      },
      activeSignals: activeSignalsRef.current
    });

    if (data && data.junctions) {
      setBackendStatus('connected');
      setBackendData(data);
      const newActive = {};
      const newCountdowns = {};
      for (const [jId, jData] of Object.entries(data.junctions)) {
        newActive[jId] = jData.activeDirection;
        newCountdowns[jId] = jData.duration;
      }
      activeSignalsRef.current = newActive;
      countdownsRef.current = newCountdowns;
      setActiveSignals(newActive);
      setCountdowns(newCountdowns);
      setLogs((prev) => [
        `🚨 Ambulance Dispatched at ${randomJunction}: Emergency GREEN granted at ${randomJunction} only! Other junctions continue AI adaptive logic.`,
        ...prev.slice(0, 9)
      ]);
    }
  };

  const handleClearAmbulance = async () => {
    setAmbulance(null);
    ambulanceRef.current = null;

    const data = await callBackendDecision({
      networkVehicles: networkVehiclesRef.current,
      ambulance: null,
      activeSignals: activeSignalsRef.current
    });

    if (data && data.junctions) {
      setBackendStatus('connected');
      setBackendData(data);
      const newActive = {};
      const newCountdowns = {};
      for (const [jId, jData] of Object.entries(data.junctions)) {
        newActive[jId] = jData.activeDirection;
        newCountdowns[jId] = jData.duration;
      }
      activeSignalsRef.current = newActive;
      countdownsRef.current = newCountdowns;
      setActiveSignals(newActive);
      setCountdowns(newCountdowns);
      setLogs((prev) => [
        `Ambulance Cleared: All 4 junctions restored to standard AI adaptive control.`,
        ...prev.slice(0, 9)
      ]);
    }
  };

  // Toggle Live Monitoring
  const handleToggleMonitoring = async () => {
    const nextState = !isMonitoring;
    setIsMonitoring(nextState);

    if (nextState) {
      const data = await callBackendDecision({
        networkVehicles: networkVehiclesRef.current,
        ambulance: ambulanceRef.current ? {
          junction: ambulanceRef.current.junction,
          currentJunction: ambulanceRef.current.currentJunction || ambulanceRef.current.junction,
          progress: ambulanceRef.current.progress
        } : null,
        activeSignals: activeSignalsRef.current
      });

      if (data && data.junctions) {
        setBackendStatus('connected');
        setBackendData(data);
        const newActive = {};
        const newCountdowns = {};
        for (const [jId, jData] of Object.entries(data.junctions)) {
          newActive[jId] = jData.activeDirection;
          newCountdowns[jId] = jData.duration;
        }
        activeSignalsRef.current = newActive;
        countdownsRef.current = newCountdowns;
        setActiveSignals(newActive);
        setCountdowns(newCountdowns);
        setLogs([`⚡ 16-Signal Live Monitoring Started across J1, J2, J3, J4.`]);
      }
    }
  };

  const handleReset = () => {
    setIsMonitoring(false);
    setNetworkVehicles(DEFAULT_NETWORK_VEHICLES);
    networkVehiclesRef.current = DEFAULT_NETWORK_VEHICLES;
    setAmbulance(null);
    ambulanceRef.current = null;
    setSelectedJunction('J1');
    setLogs([]);
  };

  // ============================================================================
  // REAL-TIME 1-SECOND SIMULATION LOOP ACROSS 4 JUNCTIONS
  // ============================================================================
  useEffect(() => {
    if (!isMonitoring) return;

    const timer = setInterval(async () => {
      const currentAmb = ambulanceRef.current;

      // 1. Advance ambulance progress & handoff emergency green between junctions
      if (currentAmb && currentAmb.progress < 100) {
        const nextProgress = Math.min(100, currentAmb.progress + 2);
        const nextJunction = getAmbulanceCurrentJunction(currentAmb.junction, nextProgress);
        const prevJunction = currentAmb.currentJunction || currentAmb.junction;

        const updatedAmb = {
          ...currentAmb,
          progress: nextProgress,
          currentJunction: nextJunction
        };
        ambulanceRef.current = updatedAmb;
        setAmbulance(updatedAmb);

        // Junction transition: only the junction where ambulance has actually arrived gets green!
        if (nextJunction !== prevJunction) {
          const res = await callBackendDecision({
            networkVehicles: networkVehiclesRef.current,
            ambulance: {
              junction: updatedAmb.junction,
              currentJunction: updatedAmb.currentJunction,
              progress: updatedAmb.progress
            },
            activeSignals: activeSignalsRef.current
          });

          if (res?.junctions) {
            setBackendData(res);
            const newActive = { ...activeSignalsRef.current };
            const newCounts = { ...countdownsRef.current };
            for (const [jId, jData] of Object.entries(res.junctions)) {
              newActive[jId] = jData.activeDirection;
              newCounts[jId] = jData.duration;
            }
            activeSignalsRef.current = newActive;
            countdownsRef.current = newCounts;
            setActiveSignals(newActive);
            setCountdowns(newCounts);

            if (nextJunction === 'HOSPITAL') {
              setLogs((prev) => [
                `🏥 Ambulance reached City Hospital safely! All 4 junctions running AI adaptive logic.`,
                ...prev.slice(0, 9)
              ]);
            } else {
              setLogs((prev) => [
                `🚨 Ambulance arrived at ${nextJunction}: Emergency GREEN granted! Junction ${prevJunction} returned to normal AI adaptive logic.`,
                ...prev.slice(0, 9)
              ]);
            }
          }
        }
      }

      // 2. Realistic Vehicle Flow: Dynamically reduce cars on active GREEN lanes
      // (CRITICAL: ZERO backend API calls while vehicles are simply decreasing)
      const junctionsToRotate = [];
      const updatedVehicles = { ...networkVehiclesRef.current };
      let hasVehicleChanges = false;

      for (const [jId, activeDir] of Object.entries(activeSignalsRef.current)) {
        if (!activeDir || activeDir === 'ALL_RED') continue;

        const isEmergencyAtThisJunction = ambulanceRef.current && 
          (ambulanceRef.current.currentJunction || ambulanceRef.current.junction) === jId &&
          ambulanceRef.current.progress < 100;

        const dirKey = activeDir.toLowerCase();
        const currentCount = updatedVehicles[jId]?.[dirKey] ?? 0;

        if (currentCount > 0) {
          // Random realistic discharge rate: 75% chance of 1-2 cars passing through green per second
          const discharge = Math.random() < 0.75 ? (Math.random() < 0.35 ? 2 : 1) : 0;
          if (discharge > 0) {
            hasVehicleChanges = true;
            const newCount = Math.max(0, currentCount - discharge);
            updatedVehicles[jId] = {
              ...updatedVehicles[jId],
              [dirKey]: newCount
            };

            // If queue reaches 0 and NOT in emergency preemption -> trigger backend rotation!
            if (newCount === 0 && !isEmergencyAtThisJunction) {
              junctionsToRotate.push(jId);
            }
          }
        } else {
          // Already 0 cars on green and not emergency -> rotate!
          if (!isEmergencyAtThisJunction) {
            junctionsToRotate.push(jId);
          }
        }
      }

      if (hasVehicleChanges) {
        networkVehiclesRef.current = updatedVehicles;
        setNetworkVehicles(updatedVehicles);
      }

      // 3. Decrement countdowns & execute backend logic ONLY when green queue reaches 0 OR countdown expires
      const nextCounts = { ...countdownsRef.current };

      for (const jId of Object.keys(JUNCTIONS)) {
        const isEmergencyAtThisJunction = ambulanceRef.current && 
          (ambulanceRef.current.currentJunction || ambulanceRef.current.junction) === jId &&
          ambulanceRef.current.progress < 100;

        // If junction is currently serving emergency ambulance, maintain green duration
        if (isEmergencyAtThisJunction) {
          nextCounts[jId] = 45;
          continue;
        }

        const isQueueEmpty = junctionsToRotate.includes(jId);
        const isTimerExpired = nextCounts[jId] <= 1;

        if (isQueueEmpty || isTimerExpired) {
          // Green lane vehicle count reached 0 OR green timer expired:
          // NOW PLAY BACKEND LOGIC TO DECIDE NEXT RED SIGNAL TO TURN GREEN!
          const reason = isQueueEmpty ? 'Empty Queue (0 Cars)' : 'Timer Expired';

          const res = await callBackendDecision({
            networkVehicles: networkVehiclesRef.current,
            ambulance: ambulanceRef.current ? {
              junction: ambulanceRef.current.junction,
              currentJunction: ambulanceRef.current.currentJunction || ambulanceRef.current.junction,
              progress: ambulanceRef.current.progress
            } : null,
            activeSignals: activeSignalsRef.current,
            rotatingJunction: jId
          });

          if (res?.junctions?.[jId]) {
            const jDecision = res.junctions[jId];
            activeSignalsRef.current = {
              ...activeSignalsRef.current,
              [jId]: jDecision.activeDirection
            };
            nextCounts[jId] = jDecision.duration;

            setActiveSignals((prevSignals) => ({
              ...prevSignals,
              [jId]: jDecision.activeDirection
            }));

            setLogs((prevLogs) => [
              `🔄 ${jId} [${reason}]: Backend AI selected ${jDecision.activeDirection} (${jDecision.duration}s Green).`,
              ...prevLogs.slice(0, 9)
            ]);
          } else {
            nextCounts[jId] = 15;
          }
        } else {
          nextCounts[jId] = Math.max(0, nextCounts[jId] - 1);
        }
      }

      countdownsRef.current = nextCounts;
      setCountdowns(nextCounts);

    }, 1000);

    return () => clearInterval(timer);
  }, [isMonitoring]);

  // Compute total cars in network across all 16 approaches
  const totalNetworkCars = Object.values(networkVehicles).reduce((acc, jCounts) => {
    return acc + Object.values(jCounts).reduce((a, b) => a + Number(b), 0);
  }, 0);

  // Live ambulance coordinate interpolation
  const getAmbulanceCoordinates = () => {
    if (!ambulance) return null;
    const p = ambulance.progress;

    if (ambulance.junction === 'J1') {
      if (p <= 33) {
        const r = p / 33;
        return { x: 180 + (440 - 180) * r, y: 130 };
      } else if (p <= 66) {
        const r = (p - 33) / 33;
        return { x: 440, y: 130 + (310 - 130) * r };
      } else {
        const r = Math.min(1, (p - 66) / 34);
        return { x: 440 + (600 - 440) * r, y: 310 };
      }
    } else if (ambulance.junction === 'J2') {
      if (p <= 50) {
        const r = p / 50;
        return { x: 440, y: 130 + (310 - 130) * r };
      } else {
        const r = Math.min(1, (p - 50) / 50);
        return { x: 440 + (600 - 440) * r, y: 310 };
      }
    } else { // J3
      if (p <= 50) {
        const r = p / 50;
        return { x: 180 + (440 - 180) * r, y: 310 };
      } else {
        const r = Math.min(1, (p - 50) / 50);
        return { x: 440 + (600 - 440) * r, y: 310 };
      }
    }
  };

  const ambCoords = getAmbulanceCoordinates();

  // Helper to get tier styling
  const getTierDetails = (count) => {
    if (count <= 19) return { name: 'Low', greenTime: 15, ...TIER_THEME.LOW };
    if (count <= 50) return { name: 'Medium', greenTime: 25, ...TIER_THEME.MEDIUM };
    if (count <= 80) return { name: 'High', greenTime: 35, ...TIER_THEME.HIGH };
    return { name: 'Very High', greenTime: 45, ...TIER_THEME.VERY_HIGH };
  };

  const selectedCounts = networkVehicles[selectedJunction] || { north: 0, south: 0, east: 0, west: 0 };
  const selectedTotal = Object.values(selectedCounts).reduce((a, b) => a + Number(b), 0);

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
                Smart Traffic System <span className="text-cyan-400 font-mono text-sm">(16 Traffic Signals)</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                4 Junctions &bull; 4 Directions Each (North, South, East, West) &bull; Hospital Green Corridor
              </p>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2">
            <div 
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-colors ${
                backendStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>Backend: {backendStatus === 'connected' ? 'Connected (:3000)' : 'Offline'}</span>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 border ${
                isMonitoring
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'}`} />
              {isMonitoring ? '16 SIGNALS ACTIVE' : 'SETUP MODE'}
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
        
        {/* INTERACTIVE 2D SVG MAP SHOWING ALL 16 TRAFFIC SIGNALS */}
        <section className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-800/80 gap-2">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Live 16-Signal Traffic Network (4 Approaches Per Junction)
              </h2>
              <p className="text-xs text-slate-400">
                Each junction has 4 directional traffic lights &bull; Green shows active flowing lane with countdown timer
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Green = Flowing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Red = Stopped
              </span>
            </div>
          </div>

          {/* SVG Map Canvas */}
          <div className="w-full bg-[#070b14] rounded-xl border border-slate-800/80 flex items-center justify-center p-2 sm:p-4">
            <svg
              viewBox="0 0 700 440"
              className="w-full max-w-3xl h-auto select-none"
              style={{ maxHeight: '440px' }}
            >
              {/* City Background */}
              <rect x="0" y="0" width="700" height="440" fill="#070b14" rx="12" />

              {/* Asphalt Roads */}
              <rect x="50" y="105" width="480" height="50" fill="#1e293b" rx="4" />
              <rect x="50" y="285" width="600" height="50" fill="#1e293b" rx="4" />
              <rect x="155" y="30" width="50" height="380" fill="#1e293b" rx="4" />
              <rect x="415" y="30" width="50" height="380" fill="#1e293b" rx="4" />

              {/* Dashed Centerlines */}
              <line x1="50" y1="130" x2="530" y2="130" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />
              <line x1="50" y1="310" x2="640" y2="310" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />
              <line x1="180" y1="30" x2="180" y2="410" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />
              <line x1="440" y1="30" x2="440" y2="410" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />

              {/* Ambulance Corridor Path Guide & Active Preempted Segment */}
              {ambulance && (
                <>
                  {/* Faint Planned Route Line */}
                  <path
                    d={
                      ambulance.junction === 'J1'
                        ? 'M 180 130 L 440 130 L 440 310 L 600 310'
                        : ambulance.junction === 'J2'
                        ? 'M 440 130 L 440 310 L 600 310'
                        : 'M 180 310 L 440 310 L 600 310'
                    }
                    fill="none"
                    stroke="#334155"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="6 6"
                    opacity="0.5"
                  />
                  {/* Localized Active Emergency Segment (pulsing green ONLY where ambulance currently is!) */}
                  {getActiveSegmentPath(ambulance) && (
                    <path
                      d={getActiveSegmentPath(ambulance)}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray="10 6"
                      className="animate-pulse"
                      opacity="0.95"
                    />
                  )}
                </>
              )}

              {/* CITY HOSPITAL (Connected to J4 East) */}
              <g transform={`translate(${HOSPITAL.x}, ${HOSPITAL.y})`}>
                <rect x="-42" y="-35" width="84" height="70" rx="10" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2.5" />
                <HospitalIcon x="-14" y="-24" width="28" height="28" className="text-rose-400" color="#f43f5e" />
                <text x="0" y="18" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  HOSPITAL
                </text>
                <text x="0" y="30" textAnchor="middle" fill="#a5b4fc" fontSize="8" fontFamily="monospace">
                  City Medical
                </text>
              </g>

              {/* THE FOUR JUNCTIONS WITH 4 DIRECTIONAL SIGNALS EACH (TOTAL 16 LIGHTS) */}
              {Object.values(JUNCTIONS).map((j) => {
                const isSelected = selectedJunction === j.id;
                const activeDir = activeSignals[j.id];
                const jCountdown = countdowns[j.id];
                const jCounts = networkVehicles[j.id];
                const jTotal = Object.values(jCounts).reduce((a, b) => a + Number(b), 0);

                // Emergency check: if ambulance is currently at this junction, exit direction is green for ambulance!
                const isEmergencyAtJunction = ambulance && 
                  (ambulance.currentJunction || ambulance.junction) === j.id && 
                  ambulance.progress < 100;

                // Check signal color for each of the 4 directions (RULE: 0 vehicles is ALWAYS RED, unless emergency)
                const isNorthGreen = isMonitoring && activeDir === 'NORTH' && (jCounts.north > 0 || (isEmergencyAtJunction && activeDir === 'NORTH'));
                const isSouthGreen = isMonitoring && activeDir === 'SOUTH' && (jCounts.south > 0 || (isEmergencyAtJunction && activeDir === 'SOUTH'));
                const isEastGreen  = isMonitoring && activeDir === 'EAST'  && (jCounts.east > 0 || (isEmergencyAtJunction && activeDir === 'EAST'));
                const isWestGreen  = isMonitoring && activeDir === 'WEST'  && (jCounts.west > 0 || (isEmergencyAtJunction && activeDir === 'WEST'));

                return (
                  <g
                    key={j.id}
                    transform={`translate(${j.x}, ${j.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelectedJunction(j.id)}
                  >
                    {/* Intersection Box */}
                    <rect
                      x="-40"
                      y="-40"
                      width="80"
                      height="80"
                      rx="8"
                      fill="#111c33"
                      stroke={isSelected ? '#06b6d4' : '#334155'}
                      strokeWidth={isSelected ? '3' : '1.5'}
                    />

                    {/* Junction Label & Total Cars */}
                    <text x="0" y="-8" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="monospace">
                      {j.id}
                    </text>
                    <text x="0" y="6" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                      {jTotal} cars
                    </text>

                    {/* Active Timer badge (Emergency indicator, Standby ALL RED, or Countdown) */}
                    {isMonitoring && (
                      <text 
                        x="0" 
                        y="20" 
                        textAnchor="middle" 
                        fill={isEmergencyAtJunction ? '#ef4444' : (jTotal === 0 ? '#ef4444' : '#38bdf8')} 
                        fontSize="9" 
                        fontWeight="bold" 
                        fontFamily="monospace"
                      >
                        {isEmergencyAtJunction ? `EMRG:${activeDir}` : (jTotal === 0 ? 'ALL RED' : `${activeDir}:${jCountdown}s`)}
                      </text>
                    )}

                    {/* 4 DIRECTIONAL TRAFFIC LIGHT HEADS (16 LIGHTS IN TOTAL) */}
                    
                    {/* 1. NORTH LIGHT (Top) */}
                    <circle cx="0" cy="-32" r="7" fill={isNorthGreen ? '#10b981' : '#ef4444'} className={isNorthGreen ? 'animate-pulse' : ''} />
                    <text x="0" y="-43" textAnchor="middle" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      N:{jCounts.north}
                    </text>

                    {/* 2. SOUTH LIGHT (Bottom) */}
                    <circle cx="0" cy="32" r="7" fill={isSouthGreen ? '#10b981' : '#ef4444'} className={isSouthGreen ? 'animate-pulse' : ''} />
                    <text x="0" y="47" textAnchor="middle" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      S:{jCounts.south}
                    </text>

                    {/* 3. WEST LIGHT (Left) */}
                    <circle cx="-32" cy="0" r="7" fill={isWestGreen ? '#10b981' : '#ef4444'} className={isWestGreen ? 'animate-pulse' : ''} />
                    <text x="-44" y="3" textAnchor="end" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      W:{jCounts.west}
                    </text>

                    {/* 4. EAST LIGHT (Right) */}
                    <circle cx="32" cy="0" r="7" fill={isEastGreen ? '#10b981' : '#ef4444'} className={isEastGreen ? 'animate-pulse' : ''} />
                    <text x="44" y="3" textAnchor="start" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      E:{jCounts.east}
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

        {/* 16-SIGNAL CONTROLLER (4 APPROACHES FOR SELECTED JUNCTION) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* DIRECTIONAL VEHICLE MANAGEMENT (SLIDERS) */}
          <section className="md:col-span-2 rounded-2xl bg-[#0b1329] border border-slate-800 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Control Approaches for: <span className="text-cyan-400 font-mono">{selectedJunction}</span> ({JUNCTIONS[selectedJunction].label})
                </h3>
                <span className="text-xs text-slate-400">Total Cars at {selectedJunction}: {selectedTotal} vehicles</span>
              </div>
              
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
                  onClick={() => applyPreset('RUSH_HOUR')}
                  className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Rush Hour
                </button>
              </div>
            </div>

            {/* Junction Selector Tabs */}
            <div className="grid grid-cols-4 gap-2">
              {Object.values(JUNCTIONS).map((j) => {
                const total = Object.values(networkVehicles[j.id]).reduce((a, b) => a + Number(b), 0);
                const isSelected = selectedJunction === j.id;
                return (
                  <button
                    key={j.id}
                    onClick={() => setSelectedJunction(j.id)}
                    className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all flex flex-col items-center ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400/40'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <span>{j.id}</span>
                    <span className="text-[10px] opacity-70">{total} cars</span>
                  </button>
                );
              })}
            </div>

            {/* 4 Directional Sliders for Selected Junction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {['north', 'south', 'east', 'west'].map((dir) => {
                const count = selectedCounts[dir];
                const tier = getTierDetails(count);
                const isCurrentGreen = isMonitoring && activeSignals[selectedJunction] === dir.toUpperCase() && count > 0;

                return (
                  <div
                    key={dir}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCurrentGreen && isMonitoring
                        ? 'bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-white text-sm uppercase">{dir} Approach</span>
                        {isCurrentGreen && isMonitoring && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 font-bold font-mono">
                            ACTIVE GREEN
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${tier.badge}`}>
                        {tier.name} ({tier.greenTime}s)
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
                        max="100"
                        value={count}
                        onChange={(e) => handleDirectionChange(selectedJunction, dir, e.target.value)}
                        className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* AMBULANCE & CORRIDOR CONTROLS */}
          <section className="rounded-2xl bg-[#0b1329] border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Siren className="w-4 h-4 text-rose-400" />
                Emergency Green Corridor
              </h3>

              <p className="text-xs text-slate-400">
                Spawns an ambulance. The Node.js backend calculates the exact directional green lights along the route to <strong>City Hospital</strong>.
              </p>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Ambulance Status:</span>
                  <span className={`font-bold ${ambulance ? (ambulance.progress >= 100 ? 'text-emerald-400' : 'text-rose-400 animate-pulse') : 'text-slate-500'}`}>
                    {ambulance ? (ambulance.progress >= 100 ? 'ARRIVED AT HOSPITAL' : `AT ${ambulance.currentJunction || ambulance.junction} (${ambulance.progress}%)`) : 'NOT SPAWNED'}
                  </span>
                </div>
                {ambulance && (
                  <div className="text-[11px] font-mono text-emerald-400">
                    Route: {ambulance.path.map((node) => node === (ambulance.currentJunction || ambulance.junction) ? `▶ [${node}]` : node).join(' ➔ ')}
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
                <span>SPAWN AMBULANCE &amp; PREEMPT SIGNALS</span>
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

        {/* SUBMISSION & 16-SIGNAL MONITORING ENGINE */}
        <section className="rounded-2xl bg-[#0b1329] border border-slate-800 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                16-Signal Submission &amp; Real-Time Execution
              </h3>
              <p className="text-xs text-slate-400">
                Submit all 16 approach counts to Node.js backend. Real-time signal cycling will control all 4 junctions.
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
                  <span>SUBMIT &amp; START 16-SIGNAL MONITORING</span>
                </>
              )}
            </button>
          </div>

          {/* Decision Feed */}
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
            <span>Viva Summary: 16-Signal Architecture (4 Approaches x 4 Junctions)</span>
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
        Total Cars in 16 Approaches: {totalNetworkCars} &bull; Backend: Node.js Express (:3000) &bull; Frontend: React Vite (:5173)
      </footer>
    </div>
  );
}
