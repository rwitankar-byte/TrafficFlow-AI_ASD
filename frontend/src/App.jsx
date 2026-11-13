import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Compass,
  ShieldCheck,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Clock3,
  Database,
  Siren as SirenIcon
} from 'lucide-react';
import { ANALYTICS_DIRECTIONS, buildAnalyticsModel, buildHistorySeries } from './analytics.js';

/**
 * ==============================================================================
 * SAFE ADAPTIVE TRAFFIC SIGNAL SYSTEM (16 SIGNALS - 4 JUNCTIONS x 4 DIRECTIONS)
 * ==============================================================================
 * Features:
 * 1. Safe Signal Phases:
 *    - Phase 1: NORTH_SOUTH (North & South Green, East & West Red)
 *    - Phase 2: EAST_WEST (East & West Green, North & South Red)
 *    - Conflicting directions are NEVER green simultaneously.
 *    - All 4 directions are NEVER green simultaneously.
 * 2. Deterministic Transitions:
 *    - CURRENT GREEN -> YELLOW (3s) -> ALL RED (2s) -> NEXT SAFE GREEN
 * 3. Priority Scoring:
 *    - Priority = (vehicleCount * 1.0) + (waitingTime * 0.5) + (congestionLevel * 2.0)
 * 4. Starvation Prevention:
 *    - If waitingTime >= 60s, that direction's phase receives immediate emergency priority.
 * 5. Dynamic Clamped Green Time:
 *    - 15s <= greenTime <= 60s
 * 6. Ambulance Emergency Preemption:
 *    - Transitions safely to required corridor phase; returns to adaptive mode once cleared.
 * ==============================================================================
 */

const API_BASE_URL = 'http://localhost:3000/api/traffic';
const API_ROOT_URL = 'http://localhost:3000/api';

// Map Coordinates & Junction Configuration
const JUNCTIONS = {
  J1: { id: 'J1', name: 'Junction 1', label: 'North-West (Grand Ave)', x: 180, y: 130 },
  J2: { id: 'J2', name: 'Junction 2', label: 'North-East (Metro Blvd)', x: 440, y: 130 },
  J3: { id: 'J3', name: 'Junction 3', label: 'South-West (Outer Ring)', x: 180, y: 310 },
  J4: { id: 'J4', name: 'Junction 4', label: 'South-East (Expressway)', x: 440, y: 310 },
};

// Fixed Hospital Location (connected to Junction 4 East exit)
const HOSPITAL = {
  id: 'HOSPITAL',
  name: 'City Hospital',
  x: 600,
  y: 310,
};

// Default initial vehicle counts for all 16 directional approaches
const DEFAULT_NETWORK_VEHICLES = {
  J1: { north: 25, south: 20, east: 15, west: 20 },
  J2: { north: 15, south: 10, east: 15, west: 10 },
  J3: { north: 5,  south: 4,  east: 3,  west: 3  },
  J4: { north: 30, south: 25, east: 15, west: 30 }
};

const DEFAULT_WAITING_TIMES = {
  J1: { north: 5, south: 5, east: 25, west: 20 },
  J2: { north: 20, south: 15, east: 5, west: 5 },
  J3: { north: 5, south: 5, east: 10, west: 10 },
  J4: { north: 35, south: 30, east: 10, west: 10 }
};

// Safe Phase Definitions
const SAFE_PHASES = {
  NORTH_SOUTH: {
    id: 'NORTH_SOUTH',
    label: 'Phase 1: NORTH / SOUTH',
    greenDirections: ['north', 'south'],
    conflictingDirections: ['east', 'west']
  },
  EAST_WEST: {
    id: 'EAST_WEST',
    label: 'Phase 2: EAST / WEST',
    greenDirections: ['east', 'west'],
    conflictingDirections: ['north', 'south']
  }
};

const SIGNAL_CONFIG = {
  minGreenTime: 15,
  maxGreenTime: 60,
  yellowTime: 3,
  allRedTime: 2,
  maxWaitTime: 60
};

/**
 * Call Backend Decision API (/api/traffic/decision)
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

const DENSITY_COLORS = { LOW: '#10b981', MEDIUM: '#06b6d4', HIGH: '#f59e0b', VERY_HIGH: '#f43f5e' };
const DIRECTION_COLORS = { NORTH: '#22d3ee', SOUTH: '#34d399', EAST: '#fbbf24', WEST: '#fb7185' };

function formatMetric(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function AnalyticsDashboard({ state, model, history, onRefresh }) {
  const historyMax = Math.max(...history.map((point) => point.vehicles), 1);
  const historyPoints = history.map((point, index) => ({
    ...point,
    x: history.length === 1 ? 400 : 20 + (index / (history.length - 1)) * 760,
    y: 190 - (point.vehicles / historyMax) * 150
  }));

  return (
    <section className="rounded-2xl bg-[#0b1329] border border-slate-800 p-5 space-y-5 shadow-2xl" aria-labelledby="analytics-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 id="analytics-heading" className="text-sm font-bold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-cyan-400" />Traffic Analytics Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">Historical database records from the traffic decision engine.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={state.status === 'loading'} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950/70 text-xs font-mono text-slate-300 hover:text-white hover:border-cyan-500/60 disabled:opacity-50 disabled:cursor-wait">
          <RefreshCw className={`w-3.5 h-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />Refresh analytics
        </button>
      </div>
      {state.status === 'loading' && <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-400">Loading analytics from PostgreSQL…</div>}
      {state.status === 'error' && <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-5 flex items-start gap-3 text-sm text-rose-200" role="alert"><AlertCircle className="w-5 h-5 text-rose-400 shrink-0" /><div><p className="font-bold">Analytics unavailable</p><p className="text-xs text-rose-300/80 mt-1">{state.error}</p></div></div>}
      {state.status === 'success' && model && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              ['Traffic records', model.summary.trafficRecords, Database, 'text-cyan-400', 'border-cyan-500/30'],
              ['Signal decisions', model.summary.signalDecisions, Activity, 'text-emerald-400', 'border-emerald-500/30'],
              ['Emergency dispatches', model.summary.emergencyDispatches, SirenIcon, 'text-rose-400', 'border-rose-500/30'],
              ['Vehicles recorded', model.summary.totalVehicles, Car, 'text-amber-400', 'border-amber-500/30']
            ].map(([label, value, Icon, color, accent]) => <div key={label} className={`rounded-xl border ${accent} bg-slate-950/60 p-4`}><Icon className={`w-4 h-4 ${color} mb-3`} /><div className="text-2xl font-black text-white tracking-tight">{formatMetric(value)}</div><div className="text-[11px] text-slate-400 mt-1">{label}</div></div>)}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-4">
              <div><h3 className="text-sm font-bold text-white">Traffic density distribution</h3><p className="text-[11px] text-slate-500 mt-1">Actual stored traffic snapshot tiers</p></div>
              {model.density.map(({ tier, records, percentage }) => <div key={tier}><div className="flex items-center justify-between text-[11px] font-mono mb-1.5"><span className="text-slate-300">{tier.replace('_', ' ')}</span><span className="text-slate-500">{formatMetric(records)} · {percentage.toFixed(1)}%</span></div><div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: DENSITY_COLORS[tier] }} /></div></div>)}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-4">
              <div><h3 className="text-sm font-bold text-white">Junction traffic volume</h3><p className="text-[11px] text-slate-500 mt-1">Vehicle totals by approach and junction</p></div>
              <div className="grid grid-cols-4 gap-3 items-end min-h-44">{model.junctions.map((junction) => { const maxVolume = Math.max(...model.junctions.flatMap((item) => ANALYTICS_DIRECTIONS.map((direction) => item.directions[direction].volume)), 1); return <div key={junction.code} className="min-w-0"><div className="h-32 flex items-end justify-center gap-1 border-b border-slate-800">{ANALYTICS_DIRECTIONS.map((direction) => { const volume = junction.directions[direction].volume; return <div key={direction} className="flex-1 max-w-4 rounded-t-sm" title={`${junction.code} ${direction}: ${formatMetric(volume)} vehicles`} style={{ height: `${(volume / maxVolume) * 100}%`, minHeight: volume ? '3px' : '0', backgroundColor: DIRECTION_COLORS[direction] }} />; })}</div><div className="text-center mt-2 text-xs font-mono font-bold text-cyan-300">{junction.code}</div><div className="text-center text-[9px] text-slate-500 truncate" title={junction.name}>{junction.name}</div></div>; })}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-mono text-slate-500">{ANALYTICS_DIRECTIONS.map((direction) => <span key={direction} className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm" style={{ backgroundColor: DIRECTION_COLORS[direction] }} />{direction}</span>)}</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-4"><div className="flex items-center gap-2"><Clock3 className="w-4 h-4 text-cyan-400" /><div><h3 className="text-sm font-bold text-white">Traffic history</h3><p className="text-[11px] text-slate-500 mt-1">Network vehicles summed from stored snapshots</p></div></div>{history.length < 2 ? <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-xs text-slate-500">Not enough timestamped traffic records to draw a trend yet.</div> : <div className="overflow-x-auto"><svg viewBox="0 0 800 220" className="w-full min-w-[620px] h-52" role="img" aria-label="Traffic vehicles over time"><line x1="20" y1="190" x2="780" y2="190" stroke="#334155" /><line x1="20" y1="40" x2="20" y2="190" stroke="#334155" /><polyline fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={historyPoints.map(({ x, y }) => `${x},${y}`).join(' ')} />{historyPoints.map(({ timestamp, vehicles, x, y }) => <circle key={timestamp} cx={x} cy={y} r="4" fill="#0b1329" stroke="#22d3ee" strokeWidth="2"><title>{new Date(timestamp).toLocaleString()} · {formatMetric(vehicles)} vehicles</title></circle>)}<text x="20" y="210" fill="#64748b" fontSize="10">{new Date(history[0].timestamp).toLocaleDateString()}</text><text x="780" y="210" textAnchor="end" fill="#64748b" fontSize="10">{new Date(history[history.length - 1].timestamp).toLocaleDateString()}</text><text x="12" y="45" textAnchor="end" fill="#64748b" fontSize="10">{formatMetric(historyMax)}</text></svg></div>}</div>
        </>
      )}
    </section>
  );
}

/**
 * Computes priority score for a direction:
 * Priority = (vehicleCount * 1.0) + (waitingTime * 0.5) + (congestionLevel * 2.0)
 */
function computePriority(count, wait) {
  const congestion = count > 50 ? 3 : count > 20 ? 2 : count > 0 ? 1 : 0;
  return Math.round(((count * 1.0) + (wait * 0.5) + (congestion * 2.0)) * 10) / 10;
}

export default function App() {
  // 1. Vehicles count state for all 16 approaches
  const [networkVehicles, setNetworkVehicles] = useState(DEFAULT_NETWORK_VEHICLES);

  // 2. Waiting times for all 16 approaches (seconds)
  const [waitingTimes, setWaitingTimes] = useState(DEFAULT_WAITING_TIMES);

  // 3. Currently selected junction for detailed controls
  const [selectedJunction, setSelectedJunction] = useState('J1');

  // 4. Ambulance State
  const [ambulance, setAmbulance] = useState(null);

  // 5. Live Monitoring simulation state
  const [isMonitoring, setIsMonitoring] = useState(false);

  // 6. Safe Phase state for each junction: 'NORTH_SOUTH' or 'EAST_WEST'
  const [activePhases, setActivePhases] = useState({
    J1: 'NORTH_SOUTH',
    J2: 'EAST_WEST',
    J3: 'NORTH_SOUTH',
    J4: 'NORTH_SOUTH'
  });

  // 7. Signal Transition State for each junction: 'GREEN' | 'YELLOW' | 'ALL_RED'
  const [signalStates, setSignalStates] = useState({
    J1: 'GREEN',
    J2: 'GREEN',
    J3: 'GREEN',
    J4: 'GREEN'
  });

  // 8. Pending next phase if currently in transition (YELLOW or ALL_RED)
  const [pendingPhases, setPendingPhases] = useState({
    J1: null,
    J2: null,
    J3: null,
    J4: null
  });

  // 9. Countdown timers for each junction
  const [countdowns, setCountdowns] = useState({
    J1: 25,
    J2: 20,
    J3: 15,
    J4: 30
  });

  const [logs, setLogs] = useState([]);
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [backendData, setBackendData] = useState(null);
  const [junctionMetadata, setJunctionMetadata] = useState([]);
  const [analyticsState, setAnalyticsState] = useState({ status: 'loading', analytics: null, history: [], error: null });
  const [analyticsRefresh, setAnalyticsRefresh] = useState(0);

  // Refs for real-time simulation interval to avoid stale closures
  const networkVehiclesRef = useRef(networkVehicles);
  networkVehiclesRef.current = networkVehicles;

  const waitingTimesRef = useRef(waitingTimes);
  waitingTimesRef.current = waitingTimes;

  const activePhasesRef = useRef(activePhases);
  activePhasesRef.current = activePhases;

  const signalStatesRef = useRef(signalStates);
  signalStatesRef.current = signalStates;

  const pendingPhasesRef = useRef(pendingPhases);
  pendingPhasesRef.current = pendingPhases;

  const countdownsRef = useRef(countdowns);
  countdownsRef.current = countdowns;

  const ambulanceRef = useRef(ambulance);
  ambulanceRef.current = ambulance;

  useEffect(() => {
    let isMounted = true;
    async function loadJunctionMetadata() {
      try {
        const response = await fetch(`${API_ROOT_URL}/junctions`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (isMounted) setJunctionMetadata(Array.isArray(payload.junctions) ? payload.junctions : []);
      } catch (error) {
        console.warn('Junction metadata unavailable:', error.message);
      }
    }
    loadJunctionMetadata();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadAnalytics() {
      setAnalyticsState((current) => ({ ...current, status: 'loading', error: null }));
      try {
        const [analyticsResponse, historyResponse] = await Promise.all([
          fetch(`${API_ROOT_URL}/analytics`),
          fetch(`${API_ROOT_URL}/traffic/history?limit=500`)
        ]);
        if (!analyticsResponse.ok) throw new Error(`Analytics request failed (HTTP ${analyticsResponse.status})`);
        if (!historyResponse.ok) throw new Error(`Traffic history request failed (HTTP ${historyResponse.status})`);
        const [analyticsPayload, historyPayload] = await Promise.all([analyticsResponse.json(), historyResponse.json()]);
        if (!analyticsPayload?.analytics || !Array.isArray(historyPayload?.records)) throw new Error('Backend returned an unexpected analytics response');
        if (isMounted) setAnalyticsState({ status: 'success', analytics: analyticsPayload.analytics, history: historyPayload.records, error: null });
      } catch (error) {
        if (isMounted) setAnalyticsState({ status: 'error', analytics: null, history: [], error: error.message });
      }
    }
    loadAnalytics();
    return () => { isMounted = false; };
  }, [analyticsRefresh]);

  const analyticsModel = useMemo(
    () => analyticsState.analytics ? buildAnalyticsModel(analyticsState.analytics, junctionMetadata) : null,
    [analyticsState.analytics, junctionMetadata]
  );
  const analyticsHistory = useMemo(() => buildHistorySeries(analyticsState.history), [analyticsState.history]);

  // ============================================================================
  // SYNC WITH NODE.JS BACKEND (SETUP MODE)
  // ============================================================================
  useEffect(() => {
    if (isMonitoring) return;

    let isMounted = true;

    async function syncBackend() {
      const data = await callBackendDecision({
        networkVehicles,
        ambulance: ambulance ? {
          junction: ambulance.junction,
          currentJunction: ambulance.currentJunction || ambulance.junction,
          progress: ambulance.progress
        } : null,
        activeSignals: activePhases
      });

      if (isMounted) {
        if (data && (data.status === 'success' || data.junctions)) {
          setBackendStatus('connected');
          setBackendData(data);
        } else {
          setBackendStatus('offline');
        }
      }
    }

    syncBackend();
    return () => { isMounted = false; };
  }, [networkVehicles, ambulance?.junction, ambulance?.currentJunction, isMonitoring]);

  // ============================================================================
  // USER ACTION HANDLERS
  // ============================================================================
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

  // Spawn Ambulance
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

    // Trigger immediate safe transition to required corridor phase at that junction
    const exitDirections = { J1: 'EAST', J2: 'SOUTH', J3: 'EAST', J4: 'EAST' };
    const requiredDir = exitDirections[randomJunction];
    const requiredPhase = (requiredDir === 'NORTH' || requiredDir === 'SOUTH') ? 'NORTH_SOUTH' : 'EAST_WEST';

    setLogs((prev) => [
      `🚨 EMERGENCY PREEMPTION: Ambulance at ${randomJunction}. Transitioning to safe phase ${requiredPhase} for clearance!`,
      ...prev.slice(0, 9)
    ]);
  };

  const handleClearAmbulance = async () => {
    setAmbulance(null);
    ambulanceRef.current = null;
    setLogs((prev) => [
      `Emergency Cleared: All junctions returned to NORMAL ADAPTIVE MODE.`,
      ...prev.slice(0, 9)
    ]);
  };

  // Toggle Live Monitoring
  const handleToggleMonitoring = () => {
    setIsMonitoring((prev) => !prev);
    if (!isMonitoring) {
      setLogs((prev) => [`⚡ Safe Adaptive Traffic Simulation Started across J1-J4.`, ...prev]);
    }
  };

  const handleReset = () => {
    setIsMonitoring(false);
    setNetworkVehicles(DEFAULT_NETWORK_VEHICLES);
    networkVehiclesRef.current = DEFAULT_NETWORK_VEHICLES;
    setWaitingTimes(DEFAULT_WAITING_TIMES);
    waitingTimesRef.current = DEFAULT_WAITING_TIMES;
    setAmbulance(null);
    ambulanceRef.current = null;
    setSelectedJunction('J1');
    setSignalStates({ J1: 'GREEN', J2: 'GREEN', J3: 'GREEN', J4: 'GREEN' });
    setPendingPhases({ J1: null, J2: null, J3: null, J4: null });
    setLogs([]);
  };

  // ============================================================================
  // REAL-TIME 1-SECOND SIMULATION LOOP WITH DETERMINISTIC TRANSITIONS
  // ============================================================================
  useEffect(() => {
    if (!isMonitoring) return;

    const timer = setInterval(() => {
      const currentAmb = ambulanceRef.current;
      const currentVehicles = { ...networkVehiclesRef.current };
      const currentWaits = { ...waitingTimesRef.current };
      const currentPhases = { ...activePhasesRef.current };
      const currentStates = { ...signalStatesRef.current };
      const currentPending = { ...pendingPhasesRef.current };
      const currentCounts = { ...countdownsRef.current };

      // 1. Advance ambulance progress along corridor
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

        if (nextJunction !== prevJunction) {
          if (nextJunction === 'HOSPITAL') {
            setLogs((prev) => [
              `🏥 Ambulance arrived safely at City Hospital! System returned to NORMAL ADAPTIVE MODE.`,
              ...prev.slice(0, 9)
            ]);
          } else {
            setLogs((prev) => [
              `🚨 Ambulance reached ${nextJunction}! Emergency preemption requested; ${prevJunction} returned to adaptive mode.`,
              ...prev.slice(0, 9)
            ]);
          }
        }
      }

      // 2. Realistic Vehicle Flow on active GREEN phases
      // Conflicting red directions accumulate waiting time (+1s)
      // Active green directions discharge cars and reset waiting time to 0
      let hasVehicleChanges = false;

      for (const jId of Object.keys(JUNCTIONS)) {
        const phase = currentPhases[jId];
        const state = currentStates[jId];
        const greenDirs = state === 'GREEN' ? SAFE_PHASES[phase].greenDirections : [];

        for (const dir of ['north', 'south', 'east', 'west']) {
          if (greenDirs.includes(dir)) {
            // Flowing on Green: discharge cars & reset wait time
            currentWaits[jId][dir] = 0;
            const count = currentVehicles[jId][dir];
            if (count > 0) {
              const discharge = Math.random() < 0.75 ? (Math.random() < 0.35 ? 2 : 1) : 0;
              if (discharge > 0) {
                hasVehicleChanges = true;
                currentVehicles[jId][dir] = Math.max(0, count - discharge);
              }
            }
          } else {
            // Stopped on Red or Yellow/All-Red: accumulate waiting time
            if (currentVehicles[jId][dir] > 0) {
              currentWaits[jId][dir] = (currentWaits[jId][dir] || 0) + 1;
            }
          }
        }
      }

      if (hasVehicleChanges) {
        networkVehiclesRef.current = currentVehicles;
        setNetworkVehicles({ ...currentVehicles });
      }
      waitingTimesRef.current = currentWaits;
      setWaitingTimes({ ...currentWaits });

      // 3. Process Deterministic Clearance Transitions & Dynamic Phase Selection
      for (const jId of Object.keys(JUNCTIONS)) {
        const currentState = currentStates[jId];
        const currentPhase = currentPhases[jId];

        // Decrement timer
        currentCounts[jId] = Math.max(0, currentCounts[jId] - 1);

        // Check if countdown expired OR active green queue emptied
        const greenDirs = SAFE_PHASES[currentPhase].greenDirections;
        const greenCarsSum = greenDirs.reduce((sum, d) => sum + currentVehicles[jId][d], 0);
        const isQueueEmpty = currentState === 'GREEN' && greenCarsSum === 0;
        const isTimerExpired = currentCounts[jId] <= 0;

        // Emergency check for this specific junction
        const isEmergencyAtThisJunction = ambulanceRef.current && 
          (ambulanceRef.current.currentJunction || ambulanceRef.current.junction) === jId &&
          ambulanceRef.current.progress < 100;

        const exitDirections = { J1: 'EAST', J2: 'SOUTH', J3: 'EAST', J4: 'EAST' };
        const emergencyExitDir = exitDirections[jId];
        const emergencyRequiredPhase = (emergencyExitDir === 'NORTH' || emergencyExitDir === 'SOUTH') ? 'NORTH_SOUTH' : 'EAST_WEST';

        // State Machine Transition Logic
        if (currentState === 'YELLOW') {
          if (isTimerExpired) {
            // Step 2: YELLOW -> ALL RED clearance (2s)
            currentStates[jId] = 'ALL_RED';
            currentCounts[jId] = SIGNAL_CONFIG.allRedTime;
            setLogs((prev) => [`🛑 ${jId}: All-Red clearance interval active (2s). Intersection cleared.`, ...prev.slice(0, 9)]);
          }
        } else if (currentState === 'ALL_RED') {
          if (isTimerExpired) {
            // Step 3: ALL RED -> NEXT SAFE GREEN PHASE
            const nextPhase = currentPending[jId] || (currentPhase === 'NORTH_SOUTH' ? 'EAST_WEST' : 'NORTH_SOUTH');
            currentPhases[jId] = nextPhase;
            currentStates[jId] = 'GREEN';
            currentPending[jId] = null;

            // Compute dynamic green duration for the new phase
            const phaseGreenDirs = SAFE_PHASES[nextPhase].greenDirections;
            const phasePriority = phaseGreenDirs.reduce((sum, d) => {
              return sum + computePriority(currentVehicles[jId][d], currentWaits[jId][d]);
            }, 0);
            const dynamicTime = Math.min(
              SIGNAL_CONFIG.maxGreenTime, 
              Math.max(SIGNAL_CONFIG.minGreenTime, Math.round(SIGNAL_CONFIG.minGreenTime + (phasePriority * 0.5)))
            );

            currentCounts[jId] = isEmergencyAtThisJunction ? 45 : dynamicTime;
            setLogs((prev) => [
              `🟢 ${jId}: Transition complete! Safe Phase ${nextPhase} is now GREEN (${currentCounts[jId]}s).`,
              ...prev.slice(0, 9)
            ]);
          }
        } else if (currentState === 'GREEN') {
          // If emergency active and conflicting phase is currently green, trigger yellow clearance immediately!
          if (isEmergencyAtThisJunction && currentPhase !== emergencyRequiredPhase) {
            currentStates[jId] = 'YELLOW';
            currentPending[jId] = emergencyRequiredPhase;
            currentCounts[jId] = SIGNAL_CONFIG.yellowTime;
            setLogs((prev) => [
              `🚑 ${jId}: Emergency Preemption! Switching to YELLOW (3s) before granting ${emergencyRequiredPhase} GREEN.`,
              ...prev.slice(0, 9)
            ]);
            continue;
          }

          if (isQueueEmpty || isTimerExpired) {
            // Decide the best next phase:
            let targetPhase = currentPhase;
            let reason = '';

            if (isEmergencyAtThisJunction) {
              targetPhase = emergencyRequiredPhase;
              reason = 'Emergency Corridor Preemption';
            } else {
              // Starvation Prevention Check: has any direction waited >= 60s?
              let starvedDir = null;
              for (const dir of ['north', 'south', 'east', 'west']) {
                if (currentWaits[jId][dir] >= SIGNAL_CONFIG.maxWaitTime && currentVehicles[jId][dir] > 0) {
                  starvedDir = dir;
                  break;
                }
              }

              if (starvedDir) {
                targetPhase = (starvedDir === 'north' || starvedDir === 'south') ? 'NORTH_SOUTH' : 'EAST_WEST';
                reason = `Starvation Prevention (${starvedDir.toUpperCase()} waited ${currentWaits[jId][starvedDir]}s)`;
              } else {
                // Priority Score Comparison
                const nsPriority = computePriority(currentVehicles[jId].north, currentWaits[jId].north) +
                                   computePriority(currentVehicles[jId].south, currentWaits[jId].south);
                const ewPriority = computePriority(currentVehicles[jId].east, currentWaits[jId].east) +
                                   computePriority(currentVehicles[jId].west, currentWaits[jId].west);

                targetPhase = nsPriority >= ewPriority ? 'NORTH_SOUTH' : 'EAST_WEST';
                reason = `Adaptive Priority (NS: ${nsPriority} vs EW: ${ewPriority})`;
              }
            }

            if (targetPhase !== currentPhase) {
              // Step 1: CURRENT GREEN -> YELLOW clearance (3s)
              currentStates[jId] = 'YELLOW';
              currentPending[jId] = targetPhase;
              currentCounts[jId] = SIGNAL_CONFIG.yellowTime;
              setLogs((prev) => [
                `⚠️ ${jId} [${reason}]: Initiating safe transition to ${targetPhase}. Yellow clearance (3s).`,
                ...prev.slice(0, 9)
              ]);
            } else {
              // Same phase maintained: recalculate dynamic green duration
              const phasePriority = SAFE_PHASES[targetPhase].greenDirections.reduce((sum, d) => {
                return sum + computePriority(currentVehicles[jId][d], currentWaits[jId][d]);
              }, 0);
              const dynamicTime = Math.min(
                SIGNAL_CONFIG.maxGreenTime, 
                Math.max(SIGNAL_CONFIG.minGreenTime, Math.round(SIGNAL_CONFIG.minGreenTime + (phasePriority * 0.5)))
              );
              currentCounts[jId] = isEmergencyAtThisJunction ? 45 : dynamicTime;
              setLogs((prev) => [
                `🔄 ${jId} [${reason}]: Extended Phase ${targetPhase} GREEN (${currentCounts[jId]}s).`,
                ...prev.slice(0, 9)
              ]);
            }
          }
        }
      }

      signalStatesRef.current = currentStates;
      setSignalStates({ ...currentStates });

      activePhasesRef.current = currentPhases;
      setActivePhases({ ...currentPhases });

      pendingPhasesRef.current = currentPending;
      setPendingPhases({ ...currentPending });

      countdownsRef.current = currentCounts;
      setCountdowns({ ...currentCounts });

    }, 1000);

    return () => clearInterval(timer);
  }, [isMonitoring]);

  // Compute total network cars
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

  const selectedCounts = networkVehicles[selectedJunction] || { north: 0, south: 0, east: 0, west: 0 };
  const selectedWaits = waitingTimes[selectedJunction] || { north: 0, south: 0, east: 0, west: 0 };
  const selectedTotal = Object.values(selectedCounts).reduce((a, b) => a + Number(b), 0);
  const selectedPhase = activePhases[selectedJunction];
  const selectedState = signalStates[selectedJunction];
  const selectedTimer = countdowns[selectedJunction];

  const nsScore = computePriority(selectedCounts.north, selectedWaits.north) +
                  computePriority(selectedCounts.south, selectedWaits.south);
  const ewScore = computePriority(selectedCounts.east, selectedWaits.east) +
                  computePriority(selectedCounts.west, selectedWaits.west);

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
                Safe Adaptive Traffic System <span className="text-cyan-400 font-mono text-sm">(Safe Opposing Phases)</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Phase 1 (North/South) &bull; Phase 2 (East/West) &bull; Deterministic Yellow/All-Red Clearance
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
              {isMonitoring ? 'SAFE PHASES ACTIVE' : 'SETUP MODE'}
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
      <main className="max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-5 flex-1">
        
        {/* Prominent Mode Banner: NORMAL ADAPTIVE MODE vs EMERGENCY PREEMPTION MODE */}
        {ambulance && ambulance.progress < 100 ? (
          <div className="bg-rose-950/40 border-2 border-rose-500/60 text-rose-200 px-4 py-3 rounded-2xl flex items-center justify-between font-mono text-xs shadow-xl animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center">
                <Siren className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <span className="font-black text-sm tracking-wider text-rose-400 block">
                  🚑 EMERGENCY PREEMPTION MODE ACTIVE
                </span>
                <span className="text-[11px] text-slate-300">
                  Ambulance detected at {ambulance.currentJunction || ambulance.junction}. Safe exit corridor phase preempted via deterministic clearance.
                </span>
              </div>
            </div>
            <span className="bg-rose-500/30 text-rose-300 px-3 py-1 rounded-lg border border-rose-500/50 font-bold">
              PREEMPTION ENGAGED
            </span>
          </div>
        ) : (
          <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-2xl flex items-center justify-between font-mono text-xs shadow-md">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-bold tracking-wider text-white">NORMAL ADAPTIVE MODE</span>
              <span className="text-slate-400 text-[11px]">&bull; Priority Formula Active &bull; Starvation Prevention &bull; No Conflicting Greens</span>
            </div>
            <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-500/30 font-bold text-[10px]">
              SAFE PHASES (1 &amp; 2)
            </span>
          </div>
        )}

        {/* INTERACTIVE 2D SVG MAP SHOWING PREDEFINED SAFE PHASES */}
        <section className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-800/80 gap-2">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Live 4-Way Intersection Grid (Safe Predefined Phases)
              </h2>
              <p className="text-xs text-slate-400">
                Phase 1 = North/South Green (East/West Red) &bull; Phase 2 = East/West Green (North/South Red) &bull; Yellow (3s) &bull; All-Red (2s)
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Green = Flowing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse"></span> Yellow = Clearance (3s)
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

              {/* Ambulance Route Guide & Active Preempted Segment */}
              {ambulance && (
                <>
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

              {/* CITY HOSPITAL */}
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

              {/* THE FOUR JUNCTIONS WITH PREDEFINED SAFE PHASES */}
              {Object.values(JUNCTIONS).map((j) => {
                const isSelected = selectedJunction === j.id;
                const phase = activePhases[j.id];
                const state = signalStates[j.id];
                const jCountdown = countdowns[j.id];
                const jCounts = networkVehicles[j.id];
                const jTotal = Object.values(jCounts).reduce((a, b) => a + Number(b), 0);

                // Emergency status for this junction
                const isEmergencyAtJunction = ambulance && 
                  (ambulance.currentJunction || ambulance.junction) === j.id && 
                  ambulance.progress < 100;

                // Determine signal colors strictly from predefined safe phases
                const isNSActive = phase === 'NORTH_SOUTH';
                const isEWActive = phase === 'EAST_WEST';

                const northColor = state === 'ALL_RED' ? '#ef4444' : (isNSActive ? (state === 'YELLOW' ? '#eab308' : '#10b981') : '#ef4444');
                const southColor = state === 'ALL_RED' ? '#ef4444' : (isNSActive ? (state === 'YELLOW' ? '#eab308' : '#10b981') : '#ef4444');
                const eastColor  = state === 'ALL_RED' ? '#ef4444' : (isEWActive ? (state === 'YELLOW' ? '#eab308' : '#10b981') : '#ef4444');
                const westColor  = state === 'ALL_RED' ? '#ef4444' : (isEWActive ? (state === 'YELLOW' ? '#eab308' : '#10b981') : '#ef4444');

                return (
                  <g
                    key={j.id}
                    transform={`translate(${j.x}, ${j.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelectedJunction(j.id)}
                  >
                    {/* Intersection Box */}
                    <rect
                      x="-42"
                      y="-42"
                      width="84"
                      height="84"
                      rx="8"
                      fill="#111c33"
                      stroke={isSelected ? '#06b6d4' : (state === 'YELLOW' ? '#eab308' : state === 'ALL_RED' ? '#ef4444' : '#334155')}
                      strokeWidth={isSelected ? '3' : '1.5'}
                    />

                    {/* Junction Label & Total Cars */}
                    <text x="0" y="-10" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="monospace">
                      {j.id}
                    </text>
                    <text x="0" y="4" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                      {jTotal} cars
                    </text>

                    {/* Active Phase Badge / Timer */}
                    {isMonitoring && (
                      <text 
                        x="0" 
                        y="18" 
                        textAnchor="middle" 
                        fill={isEmergencyAtJunction ? '#f43f5e' : (state === 'YELLOW' ? '#eab308' : state === 'ALL_RED' ? '#ef4444' : '#38bdf8')} 
                        fontSize="8" 
                        fontWeight="bold" 
                        fontFamily="monospace"
                      >
                        {state === 'ALL_RED' 
                          ? `ALL-RED:${jCountdown}s` 
                          : state === 'YELLOW' 
                          ? `YEL:${jCountdown}s` 
                          : `${phase === 'NORTH_SOUTH' ? 'P1(NS)' : 'P2(EW)'}:${jCountdown}s`}
                      </text>
                    )}

                    {/* 4 DIRECTIONAL TRAFFIC LIGHTS (NEVER CONFLICTING) */}
                    
                    {/* 1. NORTH LIGHT (Top) */}
                    <circle cx="0" cy="-32" r="7" fill={northColor} className={northColor !== '#ef4444' ? 'animate-pulse' : ''} />
                    <text x="0" y="-43" textAnchor="middle" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      N:{jCounts.north}
                    </text>

                    {/* 2. SOUTH LIGHT (Bottom) */}
                    <circle cx="0" cy="32" r="7" fill={southColor} className={southColor !== '#ef4444' ? 'animate-pulse' : ''} />
                    <text x="0" y="47" textAnchor="middle" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      S:{jCounts.south}
                    </text>

                    {/* 3. WEST LIGHT (Left) */}
                    <circle cx="-32" cy="0" r="7" fill={westColor} className={westColor !== '#ef4444' ? 'animate-pulse' : ''} />
                    <text x="-44" y="3" textAnchor="end" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      W:{jCounts.west}
                    </text>

                    {/* 4. EAST LIGHT (Right) */}
                    <circle cx="32" cy="0" r="7" fill={eastColor} className={eastColor !== '#ef4444' ? 'animate-pulse' : ''} />
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

        {/* CONTROLLER SECTION: PHASE MONITOR & APPROACH SLIDERS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* DIRECTIONAL VEHICLE MANAGEMENT (SLIDERS & PRIORITY SCORES) */}
          <section className="md:col-span-2 rounded-2xl bg-[#0b1329] border border-slate-800 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Control Approaches for: <span className="text-cyan-400 font-mono">{selectedJunction}</span> ({JUNCTIONS[selectedJunction].label})
                </h3>
                <span className="text-xs text-slate-400">Total Waiting at {selectedJunction}: {selectedTotal} vehicles</span>
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
                const ph = activePhases[j.id];
                const st = signalStates[j.id];
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
                    <span className="text-[10px] opacity-70">{total} cars &bull; {ph === 'NORTH_SOUTH' ? 'P1' : 'P2'}</span>
                  </button>
                );
              })}
            </div>

            {/* Safe Phase Comparison Box */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
              <div className={`p-2.5 rounded-lg border transition-all ${
                selectedPhase === 'NORTH_SOUTH' && selectedState === 'GREEN'
                  ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Phase 1: NORTH / SOUTH</span>
                  {selectedPhase === 'NORTH_SOUTH' && selectedState === 'GREEN' && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">ACTIVE GREEN</span>
                  )}
                </div>
                <div className="text-[11px] mt-1 text-slate-300">
                  Priority Score: <strong className="text-white">{nsScore}</strong> (N:{computePriority(selectedCounts.north, selectedWaits.north)} + S:{computePriority(selectedCounts.south, selectedWaits.south)})
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border transition-all ${
                selectedPhase === 'EAST_WEST' && selectedState === 'GREEN'
                  ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Phase 2: EAST / WEST</span>
                  {selectedPhase === 'EAST_WEST' && selectedState === 'GREEN' && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">ACTIVE GREEN</span>
                  )}
                </div>
                <div className="text-[11px] mt-1 text-slate-300">
                  Priority Score: <strong className="text-white">{ewScore}</strong> (E:{computePriority(selectedCounts.east, selectedWaits.east)} + W:{computePriority(selectedCounts.west, selectedWaits.west)})
                </div>
              </div>
            </div>

            {/* 4 Directional Sliders for Selected Junction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {['north', 'south', 'east', 'west'].map((dir) => {
                const count = selectedCounts[dir];
                const wait = selectedWaits[dir];
                const priority = computePriority(count, wait);
                const congestion = count > 50 ? 'Severe' : count > 20 ? 'Moderate' : 'Light';
                const isDirGreen = isMonitoring && 
                  selectedState === 'GREEN' && 
                  SAFE_PHASES[selectedPhase].greenDirections.includes(dir);
                const isDirYellow = isMonitoring && 
                  selectedState === 'YELLOW' && 
                  SAFE_PHASES[selectedPhase].greenDirections.includes(dir);

                return (
                  <div
                    key={dir}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isDirGreen
                        ? 'bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
                        : isDirYellow
                        ? 'bg-yellow-950/20 border-yellow-500/50 ring-1 ring-yellow-500/30'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-white text-sm uppercase">{dir} Approach</span>
                      </div>
                      
                      {isDirGreen ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-bold font-mono">
                          GREEN ({selectedTimer}s)
                        </span>
                      ) : isDirYellow ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/30 text-yellow-300 font-bold font-mono">
                          YELLOW ({selectedTimer}s)
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold font-mono">
                          RED (STOPPED)
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between">
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

                      <div className="flex justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                        <span className="text-slate-400">Wait Time:</span>
                        <span className={wait >= 60 ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-300'}>
                          {wait}s {wait >= 60 && '(STARVED!)'}
                        </span>
                      </div>

                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Priority Score:</span>
                        <span className="text-cyan-300 font-bold">{priority} (Congestion: {congestion})</span>
                      </div>
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
                Emergency Preemption Mode
              </h3>

              <p className="text-xs text-slate-400">
                Spawns an ambulance. The safe controller immediately requests the required phase, transitions safely through <strong>Yellow &amp; All-Red clearance</strong>, and clears the route to City Hospital.
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

        {/* SUBMISSION & REAL-TIME EXECUTION */}
        <section className="rounded-2xl bg-[#0b1329] border border-slate-800 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Safe Adaptive Signal Execution Engine
              </h3>
              <p className="text-xs text-slate-400">
                Runs the real-time simulation enforcing opposing safe phases, starvation overrides, and deterministic clearance transitions.
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
                  <span>PAUSE LIVE SIMULATION</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>START SAFE SIMULATION</span>
                </>
              )}
            </button>
          </div>

          {/* Decision Feed */}
          {isMonitoring && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Safe Phase Decision &amp; Clearance Log:
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-xs">
                {logs.map((log, index) => (
                  <div key={index} className="p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <AnalyticsDashboard
          state={analyticsState}
          model={analyticsModel}
          history={analyticsHistory}
          onRefresh={() => setAnalyticsRefresh((value) => value + 1)}
        />

        {/* Viva Reference Summary: Safe Phases & Clearance Rules */}
        <section className="rounded-xl bg-[#091122]/70 border border-slate-800 p-4 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-bold text-white mb-2">
            <Award className="w-4 h-4 text-cyan-400" />
            <span>Viva Summary: Safe Adaptive Traffic Signal Rules</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
            <div className="bg-slate-950/80 p-2.5 rounded border border-emerald-900/40 text-emerald-300">
              <strong>1. Safe Phases Only</strong>
              <div>Phase 1: North/South Green (EW Red)</div>
              <div>Phase 2: East/West Green (NS Red)</div>
              <div>❌ Never Conflicting Greens</div>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded border border-yellow-900/40 text-yellow-300">
              <strong>2. Deterministic Clearance</strong>
              <div>GREEN ➔ YELLOW (3s)</div>
              <div>➔ ALL RED (2s) ➔ NEW GREEN</div>
              <div>🛡️ Zero Instant Collisions</div>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded border border-cyan-900/40 text-cyan-300">
              <strong>3. Starvation &amp; Priority</strong>
              <div>Score = (Cars×1) + (Wait×0.5) + (Cong×2)</div>
              <div>Wait &ge; 60s ➔ Immediate Priority</div>
              <div>15s &le; Green Duration &le; 60s</div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-3 text-center text-xs text-slate-500 font-mono">
        Total Cars in Grid: {totalNetworkCars} &bull; Backend: Node.js Express (:3000) &bull; Frontend: React Vite (:5173)
      </footer>
    </div>
  );
}
