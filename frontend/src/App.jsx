import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Siren, 
  RotateCcw, 
  Server, 
  ShieldCheck,
  GitCompare,
  Activity
} from 'lucide-react';

import { useSimulation } from './sim/useSimulation.js';
import { requestTrafficDecision } from './api/trafficApi.js';

import { JunctionMap } from './components/JunctionMap.jsx';
import { ControlPanel } from './components/ControlPanel.jsx';
import { KpiStrip } from './components/KpiStrip.jsx';
import { Charts } from './components/Charts.jsx';
import { DecisionLog } from './components/DecisionLog.jsx';
import { ComparisonPanel } from './components/ComparisonPanel.jsx';
import { AmbulancePanel } from './components/AmbulancePanel.jsx';
import { ScenarioBar } from './components/ScenarioBar.jsx';
import { SignalConfigPanel } from './components/SignalConfigPanel.jsx';
import { TrafficDatabasePanel } from './components/TrafficDatabasePanel.jsx';
import { CompareView } from './components/CompareView.jsx';

export default function App() {
  const {
    state,
    stateFixed,
    signalMode,
    switchSignalMode,
    isCompareMode,
    toggleCompareMode,
    reseed,
    isRunning,
    speed,
    seed,
    selectedJunction,
    setSelectedJunction,
    setSpeed,
    togglePlay,
    step,
    reset,
    setDirectionCount,
    applyPreset,
    updateSignalConfig,
    resetSignalConfig,
    setGlobalArrivalRate,
    setApproachMultiplier,
    applyArrivalPreset,
    cycleIncident,
    clearLogs,
    spawnAmbulance,
    clearAmbulance,
    loadScenario,
    isRushHour,
    toggleRushHour
  } = useSimulation();

  const [backendStatus, setBackendStatus] = useState('connecting');

  const togglePhasingMode = () => {
    const currentMode = state.phasingMode || signalMode || 'PAIR';
    const nextMode = currentMode === 'PAIR' || currentMode === '2_PHASE' ? 'SINGLE' : 'PAIR';
    switchSignalMode(nextMode);
  };

  const primaryAmb = state.ambulances?.[0] || state.ambulance || null;
  const activeAmbs = state.ambulances?.filter((a) => a.progress < 100) || (primaryAmb && primaryAmb.progress < 100 ? [primaryAmb] : []);
  const isEmergencyActive = activeAmbs.length > 0;

  // Sync with Node.js Backend when in setup mode (not running)
  useEffect(() => {
    if (isRunning) return;

    let isMounted = true;
    async function syncBackend() {
      try {
        const data = await requestTrafficDecision({
          networkVehicles: state.vehicles,
          ambulance: primaryAmb ? {
            junction: primaryAmb.junction,
            currentJunction: primaryAmb.currentJunction || primaryAmb.junction,
            progress: primaryAmb.progress,
            hospital: primaryAmb.hospital || primaryAmb.targetHospital || 'HOSPITAL',
            path: primaryAmb.path
          } : null,
          activeSignals: state.activePhases
        });

        if (isMounted && (data.status === 'success' || data.junctions)) {
          setBackendStatus('connected');
        }
      } catch (error) {
        if (isMounted) {
          console.warn('Backend API unavailable:', error.message);
          setBackendStatus('offline');
        }
      }
    }

    syncBackend();
    return () => { isMounted = false; };
  }, [state.vehicles, primaryAmb?.junction, primaryAmb?.currentJunction, isRunning, state.activePhases]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-[#0b1329] border-b border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center text-slate-950 font-black">
              <Car className="w-5 h-5 fill-current" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Safe Adaptive Traffic System <span className="text-cyan-400 font-mono text-sm">({state.phasingMode === 'SINGLE' ? '1 Signal at a Time' : '2 Signals at Single Time (N/S & E/W)'})</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                {state.phasingMode === 'SINGLE'
                  ? 'Single Signal Mode • One approach active at a time • Safe Clearance'
                  : '2 Signals at a Single Time Active • Opposing Pairs (North+South or East+West) • Deterministic Clearance'}
              </p>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div 
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-colors ${
                backendStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              <Server className="w-3.5 h-3.5" aria-hidden="true" />
              <span className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-emerald-400 animate-pulse motion-reduce:animate-none' : 'bg-rose-400'}`} />
              <span>Backend: {backendStatus === 'connected' ? 'Connected (:3000)' : 'Offline'}</span>
            </div>

            <div 
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
              title="Real-time in-memory simulation engine"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
              <span>In-Memory Sim</span>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 border ${
                isRunning
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping motion-reduce:animate-none' : 'bg-cyan-400'}`} />
              {isRunning ? 'SAFE PHASES ACTIVE' : 'SETUP MODE'}
            </span>

            <button
              type="button"
              onClick={toggleCompareMode}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-all ${
                isCompareMode
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
              aria-pressed={isCompareMode}
            >
              <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Compare: {isCompareMode ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Emergency Active Alert Banner */}
      {isEmergencyActive && (
        <div 
          className="bg-rose-600/90 text-white px-4 py-2 text-xs font-mono font-bold flex items-center justify-between shadow-lg"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Siren className="w-4 h-4 animate-bounce motion-reduce:animate-none" />
              <span>
                EMERGENCY PREEMPTION ACTIVE: Priority corridor cleared for {activeAmbs.length} ambulance{activeAmbs.length > 1 ? 's' : ''} to hospital
              </span>
            </span>
            <button
              type="button"
              onClick={clearAmbulance}
              className="bg-rose-950/80 hover:bg-rose-900 border border-rose-400/50 px-2 py-0.5 rounded text-[11px] transition-colors"
              aria-label="Dismiss emergency vehicle"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* Sticky Key Performance Indicators (#2) */}
        <KpiStrip simState={state} />

        {/* Visual Canvas: Side-by-Side Comparison OR Detailed Map */}
        {isCompareMode ? (
          <CompareView
            simStateAdaptive={state}
            simStateFixed={stateFixed}
            selectedJunction={selectedJunction}
            onSelectJunction={setSelectedJunction}
            isRunning={isRunning}
            seed={seed}
            onReseed={reseed}
          />
        ) : (
          <JunctionMap
            simState={state}
            selectedJunction={selectedJunction}
            onSelectJunction={setSelectedJunction}
            isRunning={isRunning}
          />
        )}

        {/* Controller & Ambulance Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <ControlPanel
              simState={state}
              selectedJunction={selectedJunction}
              onSelectJunction={setSelectedJunction}
              onDirectionChange={setDirectionCount}
              onApplyPreset={applyPreset}
              onCycleIncident={cycleIncident}
              onSetApproachMultiplier={setApproachMultiplier}
              isRunning={isRunning}
            />
          </div>
          <div>
            <AmbulancePanel
              ambulance={primaryAmb}
              ambulances={state.ambulances}
              onSpawnAmbulance={spawnAmbulance}
              onClearAmbulance={clearAmbulance}
              isCompareMode={isCompareMode}
            />
          </div>
        </div>

        {/* Real-time 5-Minute Performance History Charts (#3) */}
        {!isCompareMode && <Charts simState={state} isRunning={isRunning} />}

        {/* Execution, Speed, Step & Arrival Scenario Controls (#7, #10) */}
        <ScenarioBar
          isRunning={isRunning}
          speed={speed}
          seed={seed}
          simState={state}
          simStateFixed={stateFixed}
          arrivalConfig={state.arrivalConfig}
          signalMode={state.phasingMode || signalMode}
          isRushHour={isRushHour}
          onToggleRushHour={toggleRushHour}
          onSwitchSignalMode={switchSignalMode}
          onTogglePlay={togglePlay}
          onStep={step}
          onReset={() => reset()}
          onSetSpeed={setSpeed}
          onSetArrivalRate={setGlobalArrivalRate}
          onApplyArrivalPreset={applyArrivalPreset}
          onLoadScenario={loadScenario}
        />

        {/* Live Signal Configuration Parameters (#8) */}
        <SignalConfigPanel
          signalConfig={state.signalConfig}
          onUpdateSignalConfig={updateSignalConfig}
          onResetSignalConfig={resetSignalConfig}
        />

        {/* Traffic Database & Date/Time Rush Hour Analyzer */}
        <TrafficDatabasePanel />

        {/* Live Decision Feed (#12) */}
        <DecisionLog logs={state.logs} isRunning={isRunning} onClearLogs={clearLogs} />

        {/* Comparison & Viva Architectural Rules */}
        <ComparisonPanel />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-3 text-center text-xs text-slate-500 font-mono">
        Backend: Node.js Express (:3000) &bull; Frontend: React 19 Vite (:5173) &bull; Safe Adaptive Traffic Phasing
      </footer>
    </div>
  );
}
