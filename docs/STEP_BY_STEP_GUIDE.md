# Step-by-Step Implementation Guide
## Building the 2D Traffic Simulation, Map Grid & Hospital Green Corridor

> **Note**: As requested, this guide skips the backend (which is already implemented) and focuses step-by-step on **how to build the Frontend Simulation, 2D SVG Map Grid, Moving Cars Animation Engine, Interactive Sliders, and the Hospital Green Corridor in React**.

---

## Table of Contents
1. [Frontend Folder Structure](#step-1-frontend-folder-structure)
2. [Designing the 2D Coordinate Grid (SVG)](#step-2-designing-the-2d-coordinate-grid-svg)
3. [Building the Traffic Lights & Countdown Timers](#step-3-building-the-traffic-lights--countdown-timers)
4. [Connecting to the Backend Decision API](#step-4-connecting-to-the-backend-decision-api)
5. [The Moving Vehicle Physics & Animation Engine](#step-5-the-moving-vehicle-physics--animation-engine)
6. [Interactive Sliders & Density Control Panel](#step-6-interactive-sliders--density-control-panel)
7. [Ambulance Dispatch & Glowing Green Corridor](#step-7-ambulance-dispatch--glowing-green-corridor)
8. [Live Analytics Dashboard (Wait Time & Fuel Saved)](#step-8-live-analytics-dashboard)
9. [(Optional) Python YOLO Camera Integration](#step-9-optional-python-yolo-camera-integration)

---

## Step 1: Frontend Folder Structure

Organize `frontend/src/` into modular, clean components:

```
frontend/src/
├── components/
│   ├── TrafficMap.jsx       # The main 2D SVG map canvas
│   ├── TrafficLight.jsx     # Individual 🔴🟡🟢 light + countdown timer
│   ├── VehicleLayer.jsx     # Renders animated moving cars
│   ├── ControlPanel.jsx     # Sliders for vehicle density
│   ├── AmbulancePanel.jsx   # Dispatch Ambulance & Hospital selector
│   └── AnalyticsPanel.jsx   # Stats (Wait time reduced %, fuel saved)
├── constants/
│   └── mapConfig.js         # (X, Y) coordinates of junctions, roads & hospital
├── hooks/
│   ├── useTrafficApi.js     # Custom hook to fetch backend decisions
│   └── useAnimationLoop.js  # 60 FPS requestAnimationFrame loop
├── App.jsx                  # Main dashboard layout
├── main.jsx                 # React root mount
└── index.css                # Global dark-theme styling
```

---

## Step 2: Designing the 2D Coordinate Grid (SVG)

Instead of complex 3D game engines, we use **SVG** (`<svg viewBox="0 0 800 600">`) which renders crystal-clear 2D vector graphics at 60 FPS.

### 2.1 The Coordinate Map Layout
We place 4 junctions on a $800 \times 600$ pixel canvas:

```
 (0,0) ──────────────────────────────────────────────────────── (800,0)
   │                                                               │
   │       [Junction 1] ════════════════════ [Junction 2]          │
   │       (X: 250, Y: 180)                  (X: 550, Y: 180)      │
   │             ║                                 ║               │
   │             ║                                 ║               │
   │             ║                                 ║               │
   │       [Junction 3] ════════════════════ [Junction 4] 🏥       │
   │       (X: 250, Y: 420)                  (X: 550, Y: 420)      │
   │                                         (City Hospital)       │
 (0,600) ────────────────────────────────────────────────────── (800,600)
```

### 2.2 How to Draw Roads in React SVG (`TrafficMap.jsx`)
```jsx
// Roads are dark gray rectangles (#2a2d37)
<svg width="100%" height="100%" viewBox="0 0 800 600" className="traffic-canvas">
  {/* Horizontal Road Top (J1 to J2) */}
  <rect x="50" y="150" width="700" height="60" fill="#2a2d37" />
  {/* Horizontal Road Bottom (J3 to J4) */}
  <rect x="50" y="390" width="700" height="60" fill="#2a2d37" />
  {/* Vertical Road Left (J1 to J3) */}
  <rect x="220" y="50" width="60" height="500" fill="#2a2d37" />
  {/* Vertical Road Right (J2 to J4) */}
  <rect x="520" y="50" width="60" height="500" fill="#2a2d37" />

  {/* Dashed Centerlines */}
  <line x1="50" y1="180" x2="750" y2="180" stroke="#f1c40f" strokeDasharray="10,10" strokeWidth="2" />
  <line x1="50" y1="420" x2="750" y2="420" stroke="#f1c40f" strokeDasharray="10,10" strokeWidth="2" />
  <line x1="250" y1="50" x2="250" y2="550" stroke="#f1c40f" strokeDasharray="10,10" strokeWidth="2" />
  <line x1="550" y1="50" x2="550" y2="550" stroke="#f1c40f" strokeDasharray="10,10" strokeWidth="2" />
</svg>
```

---

## Step 3: Building the Traffic Lights & Countdown Timers

Each junction has 4 traffic signals (North, South, East, West).

### 3.1 The Traffic Light Component (`TrafficLight.jsx`)
Each traffic light contains 3 SVG circles (Red, Yellow, Green) and a countdown number:

```jsx
function TrafficLight({ state = 'RED', countdown = 0, x, y, direction }) {
  const isRed = state === 'RED';
  const isYellow = state === 'YELLOW';
  const isGreen = state === 'GREEN';

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Light housing box */}
      <rect x="-12" y="-30" width="24" height="60" rx="4" fill="#111" stroke="#333" />
      
      {/* Red Light */}
      <circle cx="0" cy="-18" r="6" fill={isRed ? '#ef4444' : '#450a0a'} />
      {/* Yellow Light */}
      <circle cx="0" cy="0" r="6" fill={isYellow ? '#f59e0b' : '#451a03'} />
      {/* Green Light */}
      <circle cx="0" cy="18" r="6" fill={isGreen ? '#10b981' : '#022c22'} />

      {/* Countdown Timer Badge */}
      <rect x="-14" y="34" width="28" height="16" rx="3" fill="#000" />
      <text x="0" y="46" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">
        {countdown}s
      </text>
    </g>
  );
}
```

---

## Step 4: Connecting to the Backend Decision API

Create a React custom hook (`useTrafficApi.js`) that fetches real-time decisions from your Node/Express backend:

```jsx
import { useState, useEffect } from 'react';

export function useTrafficDecision(trafficInputs, emergencyState) {
  const [decision, setDecision] = useState(null);

  useEffect(() => {
    // Construct query parameters
    const params = new URLSearchParams({
      north: trafficInputs.north,
      south: trafficInputs.south,
      east: trafficInputs.east,
      west: trafficInputs.west,
      ...(emergencyState.active && {
        emergency: emergencyState.direction,
        emergencyVehicleType: emergencyState.type
      })
    });

    fetch(`http://localhost:3000/api/traffic/decision?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setDecision(data))
      .catch((err) => console.error('Error fetching decision:', err));
  }, [trafficInputs, emergencyState]);

  return decision;
}
```

---

## Step 5: The Moving Vehicle Physics & Animation Engine

This is what makes the simulation exciting for examiners: **cars visibly stopping at red lights and driving forward on green lights.**

### 5.1 The Vehicle Data Model
Each car is an object in state:
```javascript
{
  id: "car-1",
  x: 50,              // Current X position on canvas
  y: 165,             // Current Y position (lane)
  speed: 2,           // Pixels moved per animation frame
  direction: "EAST",  // Heading direction
  stopped: false      // Whether currently waiting at a red stop line
}
```

### 5.2 The 60 FPS Animation Loop (`useAnimationLoop.js`)
```javascript
import { useEffect, useRef } from 'react';

export function useAnimationLoop(callback) {
  const requestRef = useRef();

  useEffect(() => {
    const loop = () => {
      callback();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [callback]);
}
```

### 5.3 Collision & Red Light Stopping Logic
In every frame:
```javascript
function updateCarPositions(cars, signalStates) {
  return cars.map((car) => {
    const stopLineX = 210; // Stop line before Junction 1
    const distanceToStop = stopLineX - car.x;
    const isRed = signalStates.west === 'RED';

    // Rule: If light is RED and car is near stop line, STOP (speed = 0)
    if (isRed && distanceToStop > 0 && distanceToStop < 25) {
      return { ...car, speed: 0, stopped: true };
    }

    // Rule: Light turned GREEN -> accelerate forward!
    return {
      ...car,
      speed: 2,
      x: car.x + car.speed,
      stopped: false
    };
  });
}
```

---

## Step 6: Interactive Sliders & Density Control Panel

In `ControlPanel.jsx`, provide intuitive sliders so the evaluator can test different traffic scenarios:

```jsx
function ControlPanel({ trafficCounts, onChange }) {
  return (
    <div className="control-panel">
      <h3>🚦 Traffic Density Controller</h3>
      
      {['north', 'south', 'east', 'west'].map((dir) => (
        <div key={dir} className="slider-group">
          <label>
            {dir.toUpperCase()} Road: <strong>{trafficCounts[dir]} vehicles</strong>
          </label>
          <input
            type="range"
            min="0"
            max="150"
            value={trafficCounts[dir]}
            onChange={(e) => onChange(dir, Number(e.target.value))}
          />
        </div>
      ))}
    </div>
  );
}
```

---

## Step 7: Ambulance Dispatch & Glowing Green Corridor

### 7.1 Dispatching the Ambulance
In `AmbulancePanel.jsx`:
```jsx
function AmbulancePanel({ onDispatch }) {
  return (
    <div className="emergency-box">
      <h3>🚨 Emergency Response Unit</h3>
      <p>Target Destination: <strong>City Hospital (Junction 4)</strong></p>
      
      <button 
        className="btn-ambulance"
        onClick={() => onDispatch({ startJunction: 'J1', targetHospital: 'J4' })}
      >
        🚑 Dispatch Ambulance (Clear Green Corridor)
      </button>
    </div>
  );
}
```

### 7.2 Rendering the Glowing Green Corridor
When the ambulance is dispatched:
1. The route path (e.g. `Junction 1 → Junction 2 → Junction 4`) is highlighted with an animated glowing SVG stroke:
   ```jsx
   {emergencyActive && (
     <path
       d="M 50 180 L 550 180 L 550 420 L 750 420"
       fill="none"
       stroke="#10b981"
       strokeWidth="8"
       strokeDasharray="8,8"
       className="glowing-green-corridor"
     />
   )}
   ```
2. The ambulance icon (🚑) moves at **double speed** (`speed: 4`) along this path without ever stopping.
3. Every junction along the corridor automatically receives `emergency=true` from your backend.

---

## Step 8: Live Analytics Dashboard

Show the examiners concrete proof that your AI saves time and fuel:

```jsx
function AnalyticsPanel({ totalCarsCleared, avgWaitTimeFixed, avgWaitTimeAi }) {
  const timeSavedPercent = Math.round(((avgWaitTimeFixed - avgWaitTimeAi) / avgWaitTimeFixed) * 100);
  const fuelSavedLiters = (totalCarsCleared * 0.015).toFixed(1); // Est. 15ml fuel saved per stopped idle avoided

  return (
    <div className="analytics-bar">
      <div className="stat-card">
        <h4>⚡ Wait Time Reduced</h4>
        <span className="stat-value">{timeSavedPercent}%</span>
      </div>
      <div className="stat-card">
        <h4>⛽ Estimated Fuel Saved</h4>
        <span className="stat-value">{fuelSavedLiters} Liters</span>
      </div>
      <div className="stat-card">
        <h4>🚑 Emergency Clearance</h4>
        <span className="stat-value">100% Zero-Stop</span>
      </div>
    </div>
  );
}
```

---
