import React, { useState } from 'react';
import { Activity, Hospital as HospitalIcon, Siren } from 'lucide-react';
import { JUNCTIONS, HOSPITAL, HOSPITALS, DIRECTIONS } from '../sim/config.js';
import { getAmbulanceCoordinates, getActiveSegmentPath } from '../sim/engine.js';
import { getAmbulanceCoordinates as getGraphCoords, getRouteSvgPath, getActiveSegmentSvgPath } from '../sim/routing.js';
import { getTrafficTier, getTrafficTierColor, getTierBgTint, TIER_COLORS } from '../sim/tiers.js';
import { greenDirections, getDirectionalSignalStates } from '../sim/phases.js';
import { ApproachTrafficDots } from './ApproachTrafficDots.jsx';

export function JunctionMap({
  simState,
  selectedJunction,
  onSelectJunction,
  isRunning,
  compact = false,
  title = null,
  animateTraffic: propAnimateTraffic,
  onToggleAnimation
}) {
  const [localAnimate, setLocalAnimate] = useState(true);
  const animateTraffic = propAnimateTraffic !== undefined ? propAnimateTraffic : localAnimate;
  const handleToggleAnimation = () => {
    if (onToggleAnimation) {
      onToggleAnimation();
    } else {
      setLocalAnimate((prev) => !prev);
    }
  };

  const {
    vehicles,
    activePhases,
    signalStates,
    countdowns,
    ambulance,
    ambulances: rawAmbulances,
    incidents
  } = simState;

  const ambulances = Array.isArray(rawAmbulances) && rawAmbulances.length > 0 
    ? rawAmbulances 
    : (ambulance ? [ambulance] : []);

  const ambCoords = getAmbulanceCoordinates(ambulance);
  const activeSegmentPath = getActiveSegmentPath(ambulance);

  return (
    <section 
      className={`rounded-2xl bg-[#0b1329] border border-slate-800 ${
        compact ? 'p-3 shadow-xl' : 'p-4 sm:p-5 shadow-2xl'
      } relative overflow-hidden`}
      aria-label={title || "Live 4-Way Intersection Grid"}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/80 gap-2">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            {title || 'Live 4-Way Intersection Grid (Safe Predefined Phases)'}
          </h2>
          {!compact && (
            <p className="text-xs text-slate-400 mt-0.5">
              {simState.phasingMode === 'SINGLE'
                ? 'One Approach At A Time • Dedicated Single Green (N ➔ E ➔ S ➔ W) • Yellow (3s) & All-Red (2s) Clearance'
                : '2 Signals at Single Time • Phase 1 = North/South Green • Phase 2 = East/West Green • Yellow (3s) & All-Red (2s) Clearance'}
            </p>
          )}
        </div>

        {/* Legend for Signals and Heat Tiers */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
          {!compact && (
            <div className="flex items-center gap-3 border-r border-slate-800 pr-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none"></span>
                Flowing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse motion-reduce:animate-none"></span>
                Clearance (3s)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                Stopped
              </span>
            </div>
          )}

          {/* Heat Tiers Legend */}
          <div className="flex items-center gap-2 text-[11px]" title="Junction Density Heat Tiers (Approach Max)">
            <span className="text-slate-500">Tiers:</span>
            <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS.LOW }} />Low</span>
            <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS.MEDIUM }} />Med</span>
            <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS.HIGH }} />High</span>
            <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS.VERY_HIGH }} />V.High</span>
          </div>

          {/* Animation On/Off Toggle (#5) */}
          <button
            type="button"
            onClick={handleToggleAnimation}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
              animateTraffic
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            aria-pressed={animateTraffic}
            title="Toggle Traffic-Flow Vehicle Animation On/Off"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${animateTraffic ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>Animation: {animateTraffic ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* SVG Map Canvas */}
      <div className="w-full bg-[#070b14] rounded-xl border border-slate-800/80 flex items-center justify-center p-2 sm:p-4 overflow-x-auto">
        <svg
          viewBox="0 0 700 440"
          className="w-full max-w-3xl h-auto select-none min-w-[500px]"
          style={{ maxHeight: '440px' }}
          role="img"
          aria-label="Interactive Traffic Grid Map with 4 Junctions and Dual Hospitals"
        >
          {/* 60fps CSS Animation Styles for Traffic Flow Dots & Reduced Motion Override (#5) */}
          <style>
            {`
              @keyframes carFlowSouth {
                0% { transform: translateY(0); opacity: 1; }
                75% { opacity: 0.95; }
                100% { transform: translateY(65px); opacity: 0; }
              }
              @keyframes carFlowNorth {
                0% { transform: translateY(0); opacity: 1; }
                75% { opacity: 0.95; }
                100% { transform: translateY(-65px); opacity: 0; }
              }
              @keyframes carFlowEast {
                0% { transform: translateX(0); opacity: 1; }
                75% { opacity: 0.95; }
                100% { transform: translateX(65px); opacity: 0; }
              }
              @keyframes carFlowWest {
                0% { transform: translateX(0); opacity: 1; }
                75% { opacity: 0.95; }
                100% { transform: translateX(-65px); opacity: 0; }
              }
              @keyframes carFadeIn {
                0% { opacity: 0; transform: scale(0.5); }
                100% { opacity: 1; transform: scale(1); }
              }
              .car-dot-flow-south {
                animation: carFlowSouth 1.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
              }
              .car-dot-flow-north {
                animation: carFlowNorth 1.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
              }
              .car-dot-flow-east {
                animation: carFlowEast 1.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
              }
              .car-dot-flow-west {
                animation: carFlowWest 1.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
              }
              .car-dot-fade-in {
                animation: carFadeIn 0.4s ease-out forwards;
              }
              @media (prefers-reduced-motion: reduce) {
                .car-dot-flow-south,
                .car-dot-flow-north,
                .car-dot-flow-east,
                .car-dot-flow-west,
                .car-dot-fade-in {
                  animation: none !important;
                  transform: none !important;
                  opacity: 1 !important;
                }
              }
            `}
          </style>

          {/* City Background */}
          <rect x="0" y="0" width="700" height="440" fill="#070b14" rx="12" />

          {/* Asphalt Roads */}
          <rect x="50" y="105" width="600" height="50" fill="#1e293b" rx="4" />
          <rect x="50" y="285" width="600" height="50" fill="#1e293b" rx="4" />
          <rect x="155" y="30" width="50" height="380" fill="#1e293b" rx="4" />
          <rect x="415" y="30" width="50" height="380" fill="#1e293b" rx="4" />

          {/* Dashed Centerlines */}
          <line x1="50" y1="130" x2="640" y2="130" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />
          <line x1="50" y1="310" x2="640" y2="310" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />
          <line x1="180" y1="30" x2="180" y2="410" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />
          <line x1="440" y1="30" x2="440" y2="410" stroke="#f1c40f" strokeWidth="2" strokeDasharray="8 8" opacity="0.6" />

          {/* 16 Approach Traffic Flow Dots (#5) */}
          {Object.values(JUNCTIONS).map((j) => {
            const phase = activePhases[j.id];
            const state = signalStates[j.id];
            const activeGreenDirs = state === 'GREEN' ? greenDirections(phase) : [];

            return DIRECTIONS.map((dir) => {
              const queue = vehicles[j.id]?.[dir] || 0;
              const incident = incidents?.[j.id]?.[dir];
              const isBlocked = incident === 'ROAD_BLOCK';

              const isGreen = activeGreenDirs.includes(dir);

              return (
                <ApproachTrafficDots
                  key={`approach-dots-${j.id}-${dir}`}
                  junction={j}
                  direction={dir}
                  queue={queue}
                  isGreen={isGreen}
                  isBlocked={isBlocked}
                  animate={animateTraffic && isRunning}
                />
              );
            });
          })}

          {/* Ambulance Dijkstra Route Guides & Active Preempted Segments */}
          {ambulances.map((amb, idx) => {
            if (amb.progress >= 100) return null;
            const dRoute = amb.path ? getRouteSvgPath(amb.path) : (
              amb.junction === 'J1' ? 'M 180 130 L 440 130 L 440 310 L 600 310' :
              amb.junction === 'J2' ? 'M 440 130 L 440 310 L 600 310' :
              'M 180 310 L 440 310 L 600 310'
            );
            const dActive = getActiveSegmentSvgPath(amb) || (amb === ambulance ? activeSegmentPath : null);

            return (
              <g key={`amb-route-guide-${amb.id || idx}`}>
                <path
                  d={dRoute}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="6 6"
                  opacity="0.5"
                />
                {dActive && (
                  <path
                    d={dActive}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="10 6"
                    className="animate-pulse motion-reduce:animate-none"
                    opacity="0.95"
                  />
                )}
              </g>
            );
          })}

          {/* CITY HOSPITAL 1 (H1) */}
          <g transform={`translate(${HOSPITALS.HOSPITAL.x}, ${HOSPITALS.HOSPITAL.y})`}>
            <rect x="-42" y="-35" width="84" height="70" rx="10" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2.5" />
            <HospitalIcon x="-14" y="-24" width="28" height="28" className="text-rose-400" color="#f43f5e" />
            <text x="0" y="18" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="monospace">
              HOSPITAL 1
            </text>
            <text x="0" y="30" textAnchor="middle" fill="#a5b4fc" fontSize="8" fontFamily="monospace">
              City Medical
            </text>
          </g>

          {/* METRO TRAUMA CENTER 2 (H2) */}
          <g transform={`translate(${HOSPITALS.H2.x}, ${HOSPITALS.H2.y})`}>
            <rect x="-42" y="-35" width="84" height="70" rx="10" fill="#082f49" stroke="#06b6d4" strokeWidth="2.5" />
            <HospitalIcon x="-14" y="-24" width="28" height="28" className="text-cyan-400" color="#06b6d4" />
            <text x="0" y="18" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="monospace">
              HOSPITAL 2
            </text>
            <text x="0" y="30" textAnchor="middle" fill="#7dd3fc" fontSize="8" fontFamily="monospace">
              Metro Trauma
            </text>
          </g>

          {/* THE FOUR JUNCTIONS WITH HEAT COLORING & PREDEFINED SAFE PHASES */}
          {Object.values(JUNCTIONS).map((j) => {
            const isSelected = selectedJunction === j.id;
            const phase = activePhases[j.id];
            const state = signalStates[j.id];
            const jCountdown = countdowns[j.id];
            const jCounts = vehicles[j.id];
            const jTotal = Object.values(jCounts).reduce((a, b) => a + Number(b), 0);

            // Heat tint based on approach max (#6)
            const approachMax = Math.max(...DIRECTIONS.map((d) => jCounts[d] || 0));
            const jTier = getTrafficTier(approachMax);
            const tierBg = getTierBgTint(jTier);
            const tierColor = getTrafficTierColor(jTier);

            // Emergency status for this junction
            const isEmergencyAtJunction = ambulances.some(
              (a) => a.progress < 100 && (a.currentJunction || a.junction) === j.id
            );

            const signals = getDirectionalSignalStates(phase, state);
            const getSignalColor = (dir) => {
              const s = signals[dir];
              if (s === 'YELLOW') return '#eab308';
              if (s === 'GREEN') return '#10b981';
              return '#ef4444';
            };

            const northColor = getSignalColor('north');
            const southColor = getSignalColor('south');
            const eastColor  = getSignalColor('east');
            const westColor  = getSignalColor('west');

            return (
              <g
                key={j.id}
                transform={`translate(${j.x}, ${j.y})`}
                className="cursor-pointer focus:outline-none"
                tabIndex={0}
                role="button"
                aria-label={`Select ${j.name} (${j.id}), heat tier ${jTier}, currently in ${phase} phase with ${jTotal} cars`}
                onClick={() => onSelectJunction(j.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectJunction(j.id);
                  }
                }}
              >
                {/* Intersection Box with Heat Tint Fill (#6) */}
                <rect
                  x="-42"
                  y="-42"
                  width="84"
                  height="84"
                  rx="8"
                  fill={tierBg}
                  stroke={isSelected ? '#06b6d4' : (state === 'YELLOW' ? '#eab308' : state === 'ALL_RED' ? '#ef4444' : '#334155')}
                  strokeWidth={isSelected ? '3' : '1.5'}
                />

                {/* Tier Badge inside Box (#6) */}
                <g transform="translate(0, -26)">
                  <rect
                    x="-18"
                    y="-5"
                    width="36"
                    height="10"
                    rx="3"
                    fill={`${tierColor}25`}
                    stroke={tierColor}
                    strokeWidth="0.7"
                  />
                  <text
                    x="0"
                    y="2.5"
                    textAnchor="middle"
                    fill={tierColor}
                    fontSize="6.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {jTier.replace('_', ' ')}
                  </text>
                </g>

                {/* Junction Label & Total Cars */}
                <text x="0" y="-8" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="monospace">
                  {j.id}
                </text>
                <text x="0" y="5" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                  {jTotal} cars
                </text>

                {/* Active Phase Badge / Timer */}
                {isRunning && (
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
                      : `${phase}:${jCountdown}s`}
                  </text>
                )}

                {/* 4 DIRECTIONAL TRAFFIC LIGHTS (NEVER CONFLICTING) */}
                {/* NORTH LIGHT */}
                <circle cx="0" cy="-32" r="7" fill={northColor} className={northColor !== '#ef4444' ? 'animate-pulse motion-reduce:animate-none' : ''} />
                <text x="0" y="-43" textAnchor="middle" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                  N:{jCounts.north}
                </text>

                {/* SOUTH LIGHT */}
                <circle cx="0" cy="32" r="7" fill={southColor} className={southColor !== '#ef4444' ? 'animate-pulse motion-reduce:animate-none' : ''} />
                <text x="0" y="47" textAnchor="middle" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                  S:{jCounts.south}
                </text>

                {/* WEST LIGHT */}
                <circle cx="-32" cy="0" r="7" fill={westColor} className={westColor !== '#ef4444' ? 'animate-pulse motion-reduce:animate-none' : ''} />
                <text x="-44" y="3" textAnchor="end" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                  W:{jCounts.west}
                </text>

                {/* EAST LIGHT */}
                <circle cx="32" cy="0" r="7" fill={eastColor} className={eastColor !== '#ef4444' ? 'animate-pulse motion-reduce:animate-none' : ''} />
                <text x="44" y="3" textAnchor="start" fill="#cbd5e1" fontSize="8" fontWeight="bold" fontFamily="monospace">
                  E:{jCounts.east}
                </text>

                {/* DIRECTIONAL HAZARD / INCIDENT BADGES ON MAP */}
                {DIRECTIONS.map((dir) => {
                  const inc = incidents?.[j.id]?.[dir];
                  if (!inc || inc === 'NORMAL') return null;

                  const isBlocked = inc === 'ROAD_BLOCK';
                  const coords = {
                    north: { x: 0, y: -55 },
                    south: { x: 0, y: 58 },
                    west: { x: -62, y: 15 },
                    east: { x: 62, y: 15 }
                  }[dir];

                  const badgeBg = isBlocked ? '#dc2626' : '#d97706';
                  const badgeText = isBlocked ? '⛔ BLK' : '⚠️ INC';

                  return (
                    <g key={`inc-${j.id}-${dir}`} transform={`translate(${coords.x}, ${coords.y})`}>
                      <rect
                        x="-20"
                        y="-7"
                        width="40"
                        height="14"
                        rx="4"
                        fill={badgeBg}
                        stroke="#ffffff"
                        strokeWidth="0.8"
                        className="animate-pulse motion-reduce:animate-none"
                      />
                      <text
                        x="0"
                        y="3.5"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="7"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {badgeText}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Moving Ambulances Animation (Multiple, up to 3) */}
          {ambulances.map((amb, idx) => {
            const coords = getGraphCoords(amb) || getAmbulanceCoordinates(amb);
            if (!coords) return null;
            const isWaiting = Boolean(amb.isWaitingAtRed);
            const isArrived = amb.progress >= 100;
            const badgeColor = isArrived ? '#10b981' : isWaiting ? '#f59e0b' : '#dc2626';

            return (
              <g key={`amb-sprite-${amb.id || idx}`} transform={`translate(${coords.x}, ${coords.y})`}>
                {!isArrived && (
                  <circle cx="0" cy="0" r="16" fill={badgeColor} className="animate-ping motion-reduce:animate-none" opacity="0.4" />
                )}
                <rect x="-14" y="-14" width="28" height="28" rx="6" fill="#ffffff" stroke={badgeColor} strokeWidth="2.5" />
                <Siren x="-9" y="-9" width="18" height="18" color={badgeColor} />
                <text x="0" y="-18" textAnchor="middle" fill="#f87171" fontSize="9" fontWeight="bold" fontFamily="monospace">
                  #{idx + 1} ({amb.progress}%)
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

export default JunctionMap;
