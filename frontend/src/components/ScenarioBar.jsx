import React, { useState } from 'react';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  Zap,
  Info
} from 'lucide-react';
import { ARRIVAL_PRESETS } from '../sim/config.js';
import { ScenarioManager } from './ScenarioManager.jsx';

export function ScenarioBar({
  isRunning,
  speed,
  seed,
  simState,
  simStateFixed,
  arrivalConfig,
  signalMode,
  isRushHour = false,
  onToggleRushHour,
  onSwitchSignalMode,
  onTogglePlay,
  onStep,
  onReset,
  onSetSpeed,
  onSetArrivalRate,
  onApplyArrivalPreset,
  onLoadScenario
}) {
  const [isScenarioManagerOpen, setIsScenarioManagerOpen] = useState(false);
  const globalRate = arrivalConfig?.globalRate ?? 8;
  const isRushHourActive = arrivalConfig?.isRushHour ?? isRushHour;

  return (
    <section 
      className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 space-y-4"
      aria-label="Simulation Execution and Scenario Controls"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            Safe Adaptive Signal Execution Engine
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic state machine with stochastic arrivals and yellow/all-red clearance.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Playback controls">
          {/* Speed Selector */}
          <div className="flex rounded-xl bg-slate-950 border border-slate-800 p-1 gap-1" title="Simulation Speed">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSetSpeed(s)}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                  speed === s
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
                aria-label={`Set speed to ${s}x`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Signal Mode Selector (Part 1 #3) */}
          <div className="flex rounded-xl bg-slate-950 border border-slate-800 p-1 gap-1" role="group" aria-label="Signal Mode">
            <button
              type="button"
              onClick={() => onSwitchSignalMode && onSwitchSignalMode('PAIR')}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                (signalMode === 'PAIR' || signalMode === '2_PHASE' || !signalMode)
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-pressed={signalMode === 'PAIR' || signalMode === '2_PHASE' || !signalMode}
              title="2 Signals at a Single Time (Opposing pairs: North+South or East+West together)"
            >
              2 Signals at Single Time (PAIR)
            </button>
            <button
              type="button"
              onClick={() => onSwitchSignalMode && onSwitchSignalMode('SINGLE')}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                (signalMode === 'SINGLE' || signalMode === '4_PHASE')
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-pressed={signalMode === 'SINGLE' || signalMode === '4_PHASE'}
              title="1 approach at a time (Dedicated Single Green: N -> E -> S -> W)"
            >
              1 Signal at a Time (SINGLE)
            </button>
          </div>

          {/* Step Button */}
          <button
            type="button"
            onClick={onStep}
            disabled={isRunning}
            aria-label="Advance simulation by exactly 1 second while paused"
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-mono text-slate-300 hover:text-white border border-slate-800 transition-colors flex items-center gap-1.5"
            title="Step 1 Second (Paused only)"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Step 1s</span>
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset simulation to initial state"
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
            title="Reset Simulation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isRunning ? 'Pause live simulation' : 'Start safe simulation'}
            className={`py-2.5 px-5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 tracking-wider transition-all shadow-xl ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/40'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>PAUSE LIVE SIMULATION</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>START SAFE SIMULATION</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Stochastic Arrival Rate (Slider 0-40, Rush hour ~2.5x) & Presets (Part 2 #1) */}
      <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* Arrival Slider & Rush Hour Button */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Global Arrival Rate:
            </span>
            <span className="text-white font-bold">
              {globalRate} cars/min per approach
              {isRushHourActive && (
                <span className="text-amber-400 ml-1.5 font-bold">
                  ({(globalRate * 2.5).toFixed(0)} cars/min with Rush Hour)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="global-arrival-slider"
              type="range"
              min="0"
              max="40"
              step="1"
              value={globalRate}
              aria-label="Global arrival rate slider (0 to 40 cars per minute per approach)"
              onChange={(e) => onSetArrivalRate(e.target.value)}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />

            {/* Rush Hour Toggle Button (~2.5x) */}
            <button
              type="button"
              onClick={onToggleRushHour}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                isRushHourActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              aria-pressed={isRushHourActive}
              title="Toggle Rush Hour demand multiplier (~2.5x arrival flow)"
            >
              <Zap className={`w-3.5 h-3.5 ${isRushHourActive ? 'text-amber-400 fill-amber-400' : ''}`} />
              <span>Rush Hour (~2.5x)</span>
            </button>
          </div>
        </div>

        {/* Arrival Presets (Preserved) */}
        <div className="flex items-center justify-start md:justify-end gap-2 text-xs font-mono flex-wrap">
          <span className="text-slate-500 text-[11px]">Arrival Presets:</span>
          {Object.entries(ARRIVAL_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => onApplyArrivalPreset(key)}
              className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-[11px]"
            >
              {preset.label} ({preset.globalRate}/min)
            </button>
          ))}
        </div>
      </div>

      {/* Turning Phasing Informational Note (Part 2 #3) */}
      <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
          {signalMode === 'PAIR' || signalMode === '2_PHASE' ? (
            <span>
              <strong className="text-amber-400">PAIR Mode:</strong> Opposing corridors green together (Phase 1: N/S • Phase 2: E/W).
            </span>
          ) : (
            <span>
              <strong className="text-emerald-400">SINGLE Mode:</strong> Dedicated single green per approach (N ➔ E ➔ S ➔ W) with conflict-free clearance.
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500 hidden sm:inline">
          Cap: 100/approach
        </div>
      </div>

      {/* Scenario Save/Load & JSON Import/Export (#7) */}
      <ScenarioManager
        simState={simState}
        simStateFixed={simStateFixed}
        seed={seed}
        onLoadScenario={onLoadScenario}
        isOpen={isScenarioManagerOpen}
        onToggleOpen={() => setIsScenarioManagerOpen((prev) => !prev)}
      />
    </section>
  );
}

export default ScenarioBar;
