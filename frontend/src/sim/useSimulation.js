import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createInitialState,
  stepNetwork,
  cloneGridMap,
  validateSignalConfig,
  createStructuredLog,
  estimateNoPreemptionDelay
} from './engine.js';
import {
  JUNCTIONS,
  SIGNAL_CONFIG,
  DEFAULT_SIGNAL_CONFIG,
  SAFE_PHASES,
  PRESETS,
  ARRIVAL_PRESETS,
  AMBULANCE_ROUTES,
  EXIT_DIRECTIONS
} from './config.js';
import { normalizeMode, getPhases, phaseForDirection, greenDirections } from './phases.js';
import { findShortestRoute } from './routing.js';
import { validateScenario } from './scenarios.js';

/**
 * Custom React hook for controlling the traffic simulation
 *
 * Provides:
 * - Deterministic tick loop with configurable speed (1x, 2x, 5x)
 * - Play / Pause / Step / Reset controls
 * - Signal config sliders with live update & reset to defaults
 * - Arrival rate controls & presets (Light, Normal, Rush Hour with J4/J2 skew)
 * - Per-approach Incident states (NORMAL, INCIDENT, ROAD_BLOCK)
 * - Structured decision log entries
 * - Ambulance preemption spawning and clearing
 */
export function useSimulation(initialConfig = {}, initialSeed = 42) {
  const mergedConfig = { phasingMode: 'PAIR', ...initialConfig };
  const [seed, setSeed] = useState(initialSeed);
  const [signalMode, setSignalModeState] = useState(() => normalizeMode(mergedConfig.phasingMode));
  const [simState, setSimState] = useState(() => createInitialState(mergedConfig, initialSeed));
  const [simStateFixed, setSimStateFixed] = useState(() =>
    createInitialState({ ...mergedConfig, controller: 'fixed', fixedGreenTime: 30 }, initialSeed)
  );
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 5x
  const [selectedJunction, setSelectedJunction] = useState('J1');
  const [isRushHour, setIsRushHour] = useState(false);

  // Refs to always access latest states in callbacks
  const stateRef = useRef(simState);
  stateRef.current = simState;
  const stateFixedRef = useRef(simStateFixed);
  stateFixedRef.current = simStateFixed;

  // Toggle Compare Mode
  const toggleCompareMode = useCallback(() => {
    setIsCompareMode((prev) => !prev);
  }, []);

  // Toggle Rush Hour (~2.5x arrival rate)
  const toggleRushHour = useCallback(() => {
    setIsRushHour((prev) => {
      const next = !prev;
      setSimState((s) => ({
        ...s,
        arrivalConfig: {
          ...s.arrivalConfig,
          isRushHour: next
        }
      }));
      setSimStateFixed((s) => ({
        ...s,
        arrivalConfig: {
          ...s.arrivalConfig,
          isRushHour: next
        }
      }));
      return next;
    });
  }, []);

  // Single tick step (advance exactly 1 second in lockstep)
  const step = useCallback((opts = {}) => {
    setSimState((prevState) => {
      const nextState = stepNetwork(prevState, { SIGNAL_CONFIG, SAFE_PHASES, JUNCTIONS, EXIT_DIRECTIONS }, opts);
      stateRef.current = nextState;
      return nextState;
    });
    setSimStateFixed((prevFixed) => {
      const nextFixed = stepNetwork(prevFixed, { SIGNAL_CONFIG, SAFE_PHASES, JUNCTIONS, EXIT_DIRECTIONS }, { ...opts, controller: 'fixed' });
      stateFixedRef.current = nextFixed;
      return nextFixed;
    });
  }, []);

  // Tick interval loop (stepped in lockstep)
  useEffect(() => {
    if (!isRunning) return;

    const intervalMs = Math.max(100, Math.round(1000 / speed));
    const timer = setInterval(() => {
      setSimState((prevState) => {
        const nextState = stepNetwork(prevState, { SIGNAL_CONFIG, SAFE_PHASES, JUNCTIONS, EXIT_DIRECTIONS });
        stateRef.current = nextState;
        return nextState;
      });
      setSimStateFixed((prevFixed) => {
        const nextFixed = stepNetwork(prevFixed, { SIGNAL_CONFIG, SAFE_PHASES, JUNCTIONS, EXIT_DIRECTIONS }, { controller: 'fixed' });
        stateFixedRef.current = nextFixed;
        return nextFixed;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isRunning, speed]);

  // Toggle Play / Pause
  const togglePlay = useCallback(() => {
    setIsRunning((prev) => {
      const next = !prev;
      if (next) {
        setSimState((s) => ({
          ...s,
          logs: [
            createStructuredLog(s.tick, null, 'system', `⚡ Safe Adaptive Traffic Simulation Started across J1-J4.`),
            ...s.logs.slice(0, 199)
          ]
        }));
      }
      return next;
    });
  }, []);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);

  // Reset to initial state
  const reset = useCallback((newSeed) => {
    const s = newSeed !== undefined ? newSeed : seed;
    if (newSeed !== undefined) setSeed(s);
    setIsRunning(false);
    const freshAdaptive = createInitialState(initialConfig, s);
    const freshFixed = createInitialState({ ...initialConfig, controller: 'fixed', fixedGreenTime: 30 }, s);
    setSimState(freshAdaptive);
    setSimStateFixed(freshFixed);
    stateRef.current = freshAdaptive;
    stateFixedRef.current = freshFixed;
    setSelectedJunction('J1');
  }, [initialConfig, seed]);

  // Reseed with a new random seed
  const reseed = useCallback(() => {
    const nextSeed = Math.floor(Math.random() * 900000) + 100000;
    reset(nextSeed);
  }, [reset]);

  // Load a complete scenario into the simulation (#7)
  const loadScenario = useCallback((scenarioInput) => {
    const { valid, sanitizedScenario, errors } = validateScenario(scenarioInput);
    if (!valid || !sanitizedScenario) {
      console.warn('Cannot load invalid scenario:', errors);
      return false;
    }

    const sc = sanitizedScenario;
    setIsRunning(false);
    setSeed(sc.seed);

    const adaptiveConfig = {
      initialVehicles: sc.vehicles,
      signalConfig: sc.signalConfig,
      arrivalConfig: sc.arrivalConfig,
      incidents: sc.incidents,
      fixedGreenTime: sc.fixedTimerCycle,
      controller: 'adaptive'
    };

    const fixedConfig = {
      initialVehicles: sc.vehicles,
      signalConfig: sc.signalConfig,
      arrivalConfig: sc.arrivalConfig,
      incidents: sc.incidents,
      fixedGreenTime: sc.fixedTimerCycle,
      controller: 'fixed'
    };

    const freshAdaptive = createInitialState(adaptiveConfig, sc.seed);
    const freshFixed = createInitialState(fixedConfig, sc.seed);

    freshAdaptive.logs = [
      createStructuredLog(0, null, 'system', `📂 Loaded scenario "${sc.name}" (Seed: ${sc.seed}, Fixed Cycle: ${sc.fixedTimerCycle}s).`)
    ];

    setSimState(freshAdaptive);
    setSimStateFixed(freshFixed);
    stateRef.current = freshAdaptive;
    stateFixedRef.current = freshFixed;
    setSelectedJunction('J1');
    return true;
  }, []);

  // Update vehicle count for a direction (synced across both engines)
  const setDirectionCount = useCallback((junctionId, direction, count) => {
    const val = Math.max(0, Math.min(100, Number(count) || 0));
    setSimState((prev) => {
      const nextVehicles = cloneGridMap(prev.vehicles);
      nextVehicles[junctionId][direction] = val;
      return {
        ...prev,
        vehicles: nextVehicles
      };
    });
    setSimStateFixed((prev) => {
      const nextVehicles = cloneGridMap(prev.vehicles);
      nextVehicles[junctionId][direction] = val;
      return {
        ...prev,
        vehicles: nextVehicles
      };
    });
  }, []);

  // Apply predefined vehicle presets (Proposal, Balanced, Rush Hour)
  const applyPreset = useCallback((presetName) => {
    const preset = PRESETS[presetName] || PRESETS.DEFAULT;
    setSimState((prev) => ({
      ...prev,
      vehicles: cloneGridMap(preset)
    }));
    setSimStateFixed((prev) => ({
      ...prev,
      vehicles: cloneGridMap(preset)
    }));
  }, []);

  // --- Signal Config Live Sliders ---
  const updateSignalConfig = useCallback((partialConfig) => {
    setSimState((prev) => {
      const merged = { ...prev.signalConfig, ...partialConfig };
      const validated = validateSignalConfig(merged);
      return {
        ...prev,
        signalConfig: validated
      };
    });
    setSimStateFixed((prev) => {
      const merged = { ...prev.signalConfig, ...partialConfig };
      const validated = validateSignalConfig(merged);
      return {
        ...prev,
        signalConfig: validated
      };
    });
  }, []);

  const resetSignalConfig = useCallback(() => {
    const def = validateSignalConfig(DEFAULT_SIGNAL_CONFIG);
    setSimState((prev) => ({
      ...prev,
      signalConfig: def,
      logs: [
        createStructuredLog(prev.tick, null, 'system', `🔄 Signal configuration reset to system defaults.`),
        ...prev.logs.slice(0, 199)
      ]
    }));
    setSimStateFixed((prev) => ({
      ...prev,
      signalConfig: def
    }));
  }, []);

  // --- Arrival Rate & Presets ---
  const setGlobalArrivalRate = useCallback((rate) => {
    const num = Math.max(0, Math.min(60, Number(rate) || 0));
    setSimState((prev) => ({
      ...prev,
      arrivalConfig: {
        ...prev.arrivalConfig,
        globalRate: num
      }
    }));
    setSimStateFixed((prev) => ({
      ...prev,
      arrivalConfig: {
        ...prev.arrivalConfig,
        globalRate: num
      }
    }));
  }, []);

  const setApproachMultiplier = useCallback((junctionId, direction, mult) => {
    const val = Math.max(0, Math.min(5, Number(mult) || 1.0));
    const updater = (prev) => {
      const nextMultipliers = cloneGridMap(prev.arrivalConfig?.multipliers || {});
      if (!nextMultipliers[junctionId]) nextMultipliers[junctionId] = {};
      nextMultipliers[junctionId][direction] = val;
      return {
        ...prev,
        arrivalConfig: {
          ...prev.arrivalConfig,
          multipliers: nextMultipliers
        }
      };
    };
    setSimState(updater);
    setSimStateFixed(updater);
  }, []);

  const applyArrivalPreset = useCallback((presetKey) => {
    const preset = ARRIVAL_PRESETS[presetKey];
    if (!preset) return;

    const updater = (prev) => {
      let nextMultipliers;
      if (preset.multipliers) {
        nextMultipliers = cloneGridMap(preset.multipliers);
      } else {
        // Reset all to 1.0
        nextMultipliers = {};
        for (const jId of Object.keys(JUNCTIONS)) {
          nextMultipliers[jId] = { north: 1.0, south: 1.0, east: 1.0, west: 1.0 };
        }
      }

      return {
        ...prev,
        arrivalConfig: {
          globalRate: preset.globalRate,
          multipliers: nextMultipliers
        },
        logs: [
          createStructuredLog(prev.tick, null, 'system', `🚦 Arrival preset applied: ${preset.label} (${preset.globalRate} cars/min per approach)`),
          ...prev.logs.slice(0, 199)
        ]
      };
    };

    setSimState(updater);
    setSimStateFixed((prev) => {
      let nextMultipliers;
      if (preset.multipliers) {
        nextMultipliers = cloneGridMap(preset.multipliers);
      } else {
        nextMultipliers = {};
        for (const jId of Object.keys(JUNCTIONS)) {
          nextMultipliers[jId] = { north: 1.0, south: 1.0, east: 1.0, west: 1.0 };
        }
      }
      return {
        ...prev,
        arrivalConfig: {
          globalRate: preset.globalRate,
          multipliers: nextMultipliers
        }
      };
    });
  }, []);

  // --- Incident Management ---
  const setIncident = useCallback((junctionId, direction, incidentState) => {
    const updateIncidents = (prev, isAdaptive = true) => {
      const nextIncidents = cloneGridMap(prev.incidents);
      nextIncidents[junctionId][direction] = incidentState;

      let logMsg = '';
      if (incidentState === 'INCIDENT') {
        logMsg = `⚠️ INCIDENT reported on ${junctionId} ${direction.toUpperCase()} approach (50% discharge capacity).`;
      } else if (incidentState === 'ROAD_BLOCK') {
        logMsg = `⛔ ROAD BLOCK on ${junctionId} ${direction.toUpperCase()} approach (Queue diverted, starvation excluded).`;
      } else {
        logMsg = `✅ Cleared incident on ${junctionId} ${direction.toUpperCase()} approach (Normal capacity restored).`;
      }

      return {
        ...prev,
        incidents: nextIncidents,
        logs: isAdaptive ? [
          createStructuredLog(prev.tick, junctionId, 'incident', logMsg),
          ...prev.logs.slice(0, 199)
        ] : prev.logs
      };
    };

    setSimState((p) => updateIncidents(p, true));
    setSimStateFixed((p) => updateIncidents(p, false));
  }, []);

  const cycleIncident = useCallback((junctionId, direction) => {
    const order = ['NORMAL', 'INCIDENT', 'ROAD_BLOCK'];
    
    setSimState((prev) => {
      const current = prev.incidents?.[junctionId]?.[direction] || 'NORMAL';
      const nextIndex = (order.indexOf(current) + 1) % order.length;
      const nextState = order[nextIndex];

      const nextIncidents = cloneGridMap(prev.incidents);
      nextIncidents[junctionId][direction] = nextState;

      let logMsg = '';
      if (nextState === 'INCIDENT') {
        logMsg = `⚠️ INCIDENT reported on ${junctionId} ${direction.toUpperCase()} approach (50% discharge capacity).`;
      } else if (nextState === 'ROAD_BLOCK') {
        logMsg = `⛔ ROAD BLOCK on ${junctionId} ${direction.toUpperCase()} approach (Queue diverted, starvation excluded).`;
      } else {
        logMsg = `✅ Cleared incident on ${junctionId} ${direction.toUpperCase()} approach (Normal capacity restored).`;
      }

      // Also sync to Fixed engine
      setSimStateFixed((prevFixed) => {
        const fixedIncidents = cloneGridMap(prevFixed.incidents);
        fixedIncidents[junctionId][direction] = nextState;
        return {
          ...prevFixed,
          incidents: fixedIncidents
        };
      });

      return {
        ...prev,
        incidents: nextIncidents,
        logs: [
          createStructuredLog(prev.tick, junctionId, 'incident', logMsg),
          ...prev.logs.slice(0, 199)
        ]
      };
    });
  }, []);

  // Clear Decision Logs
  const clearLogs = useCallback(() => {
    setSimState((prev) => ({
      ...prev,
      logs: []
    }));
    setSimStateFixed((prev) => ({
      ...prev,
      logs: []
    }));
  }, []);

  // Spawn Ambulance (Dijkstra-routed, max 3 ambulances, dual hospitals)
  const spawnAmbulance = useCallback((targetStartJunction, targetHospitalChoice) => {
    setSimState((prev) => {
      const currentAmbs = prev.ambulances || (prev.ambulance ? [prev.ambulance] : []);
      if (currentAmbs.length >= 3) {
        return prev; // Maximum 3 ambulances
      }

      const candidates = ['J1', 'J2', 'J3', 'J4'];
      const chosenJunction = targetStartJunction || candidates[Math.floor(Math.random() * candidates.length)];
      const chosenHospital = targetHospitalChoice || (Math.random() < 0.5 ? 'HOSPITAL' : 'H2');

      const routeResult = findShortestRoute(chosenJunction, chosenHospital);
      const corridorPath = routeResult.path;
      const totalDistance = routeResult.totalDistance;

      const estDelay = estimateNoPreemptionDelay(
        corridorPath,
        prev.signalStates,
        prev.activePhases,
        prev.countdowns,
        prev.signalConfig
      );

      const hospitalName = chosenHospital === 'H2' ? 'Metro Trauma Center (H2)' : 'City Hospital (H1)';

      const newAmb = {
        id: `amb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: prev.tick,
        junction: chosenJunction,
        startJunction: chosenJunction,
        currentJunction: chosenJunction,
        targetHospital: chosenHospital,
        hospital: chosenHospital,
        hospitalName,
        path: corridorPath,
        totalDistance,
        progress: 0,
        speed: 12,
        eta: Math.ceil(totalDistance / 12),
        estimatedNoPreemptionDelay: estDelay,
        actualDelay: 0,
        timeSaved: estDelay,
        isWaitingAtRed: false,
        redWaitTicks: 0,
        arrived: false
      };

      const nextAmbulances = [...currentAmbs, newAmb];

      // Also sync to Fixed engine
      setSimStateFixed((prevFixed) => {
        const fixedAmbs = prevFixed.ambulances || (prevFixed.ambulance ? [prevFixed.ambulance] : []);
        if (fixedAmbs.length >= 3) return prevFixed;
        const nextFixedAmbs = [...fixedAmbs, { ...newAmb, isWaitingAtRed: false, redWaitTicks: 0 }];
        return {
          ...prevFixed,
          ambulances: nextFixedAmbs,
          ambulance: nextFixedAmbs[0] || null
        };
      });

      const logEntry = createStructuredLog(
        prev.tick,
        chosenJunction,
        'emergency',
        `🚨 EMERGENCY DISPATCH: Ambulance from ${chosenJunction} to ${hospitalName} via Dijkstra route [${corridorPath.join(' ➔ ')}]`
      );

      return {
        ...prev,
        ambulances: nextAmbulances,
        ambulance: nextAmbulances[0] || null,
        logs: [logEntry, ...prev.logs.slice(0, 199)]
      };
    });
  }, []);

  // Clear Ambulance (by ID, or all if no ID provided)
  const clearAmbulance = useCallback((id) => {
    const filterAmbs = (prev) => {
      const current = prev.ambulances || (prev.ambulance ? [prev.ambulance] : []);
      if (!id) return [];
      return current.filter((a) => a.id !== id);
    };

    setSimState((prev) => {
      const remaining = filterAmbs(prev);
      return {
        ...prev,
        ambulances: remaining,
        ambulance: remaining[0] || null,
        logs: [
          createStructuredLog(prev.tick, null, 'emergency', id ? `Cleared ambulance ${String(id).slice(-4)}` : `Emergency Cleared: All ambulances removed.`),
          ...prev.logs.slice(0, 199)
        ]
      };
    });

    setSimStateFixed((prev) => {
      const remaining = filterAmbs(prev);
      return {
        ...prev,
        ambulances: remaining,
        ambulance: remaining[0] || null
      };
    });
  }, []);

  // Switch Signal Mode: resets all junctions safely to ALL_RED then restarts (#1 Part 1)
  const switchSignalMode = useCallback((newMode) => {
    const norm = normalizeMode(newMode);
    setSignalModeState(norm);

    const updater = (prev) => {
      const allRedTime = prev.signalConfig?.allRedTime || 2;
      const defaultMaxWait = norm === 'SINGLE' ? 90 : 60;

      const nextActivePhases = norm === 'SINGLE' ? {
        J1: 'NORTH',
        J2: 'EAST',
        J3: 'SOUTH',
        J4: 'WEST'
      } : {
        J1: 'NORTH_SOUTH',
        J2: 'EAST_WEST',
        J3: 'NORTH_SOUTH',
        J4: 'NORTH_SOUTH'
      };

      return {
        ...prev,
        phasingMode: norm,
        activePhases: nextActivePhases,
        signalStates: { J1: 'ALL_RED', J2: 'ALL_RED', J3: 'ALL_RED', J4: 'ALL_RED' },
        pendingPhases: { ...nextActivePhases },
        countdowns: { J1: allRedTime, J2: allRedTime, J3: allRedTime, J4: allRedTime },
        signalConfig: {
          ...prev.signalConfig,
          maxWaitTime: defaultMaxWait
        },
        logs: [
          createStructuredLog(
            prev.tick,
            null,
            'clearance',
            `🛑 Signal mode changed to ${norm === 'SINGLE' ? 'One approach at a time (SINGLE)' : 'Opposing pair (2-phase)'}. All junctions safely reset to ALL_RED clearance (${allRedTime}s) before restart.`
          ),
          ...prev.logs.slice(0, 199)
        ]
      };
    };

    setSimState(updater);
    setSimStateFixed(updater);
    setIsRunning(true);
  }, []);

  return {
    state: simState,
    stateFixed: simStateFixed,
    signalMode,
    switchSignalMode,
    setSignalMode: switchSignalMode,
    isCompareMode,
    setIsCompareMode,
    toggleCompareMode,
    reseed,
    isRunning,
    speed,
    seed,
    selectedJunction,
    setSelectedJunction,
    setSpeed,
    setSeed,
    togglePlay,
    start,
    pause,
    step,
    reset,
    setDirectionCount,
    applyPreset,
    updateSignalConfig,
    resetSignalConfig,
    setGlobalArrivalRate,
    setApproachMultiplier,
    applyArrivalPreset,
    setIncident,
    cycleIncident,
    clearLogs,
    spawnAmbulance,
    clearAmbulance,
    loadScenario,
    isRushHour,
    setIsRushHour,
    toggleRushHour
  };
}
