# AI-Powered Adaptive Traffic Management & Emergency Green Corridor System
## Master Project Specification, Architecture & Implementation Blueprint

> **Notice for Developers & AI Agents**:  
> This document defines the complete functional and technical specification for this project. Any developer, teammate, or AI system reading this file must follow the architecture, conventions, algorithm parameters, and UI design outlined below.

---

## 1. Project Overview & Core Problem Statement

### 1.1 What This Project IS
This project is an **AI-driven, multi-junction adaptive traffic signal control system** with a real-time interactive 2D simulation and an **Emergency Vehicle Green Corridor**.

Instead of traditional traffic lights running on fixed timers (e.g., 30 seconds green regardless of whether 2 cars or 100 cars are waiting), our system:
1. Dynamically detects vehicle density on each road (North, South, East, West).
2. Uses an intelligent decision algorithm to allocate green-light duration proportionally: **More Vehicles $\rightarrow$ Higher Priority $\rightarrow$ More Green Time**.
3. Coordinates between adjacent junctions to create a **"Green Wave"** and prevent downstream traffic jams (spillback/gridlock).
4. Provides an **Emergency Green Corridor**: When an ambulance is dispatched toward a hospital, the system preempts all normal signals along its route, clearing intersections in advance so the ambulance never stops at a red light.
5. Provides an **interactive, real-time 2D visual simulation** in the frontend where examiners can adjust vehicle densities via sliders and see the signals and moving cars react instantly.

### 1.2 What This Project IS NOT
- **It is NOT a navigation app like Google Maps.** We are not building user GPS navigation or general Dijkstra turn-by-turn road driving.
- The focus is strictly **Municipal Intersection Control & Traffic Signal Optimization**.

---

## 2. Technology Stack & Languages

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | **Node.js + Express.js** (JavaScript) | REST API, junction state management, coordination algorithm, route preemption. |
| **Dev Tools** | **Nodemon, dotenv, cors** | Continuous development server, CORS handling for frontend requests. |
| **Frontend** | **React.js (Vite)** | Interactive web dashboard and control panel. |
| **Simulation** | **SVG / HTML5 Canvas (JavaScript)** | 2D top-down smart city road grid, moving vehicle particles, live traffic lights (🔴🟡🟢), and countdown timers. |
| **Vision / AI (Optional)** | **Python (OpenCV + YOLO)** | Script to detect and count vehicles from camera/video feeds and send numbers to the backend API. |
| **Database (Optional)** | **MongoDB / PostgreSQL / SQLite** | Logging historical traffic density, waiting time saved, and emergency trip logs. |

---

## 3. System Architecture & Information Flow

```
┌────────────────────────────────────────────────────────┐
│             INPUT LAYER (Sensors / Sliders)             │
│  • Simulated Traffic Sliders (Frontend Dashboard)     │
│  • (Optional) Python YOLO Camera Vehicle Counter Feeds │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                BACKEND DECISION ENGINE                 │
│  • Density Classification (Low / Med / High / Very High)│
│  • Single Junction Signal Optimization                 │
│  • Multi-Junction Neighbor Coordination (Green Wave)   │
│  • Emergency Vehicle Priority & Hospital Pathfinding   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│            REAL-TIME FRONTEND SIMULATION               │
│  • 2D City Grid (Junctions 1, 2, 3, 4 + Hospital)      │
│  • Live 🔴🟡🟢 Signals with Active Countdown Timers    │
│  • Vehicle Particle Movement & Queueing at Stop Lines  │
│  • Glowing Emergency Green Corridor for Ambulance      │
│  • Live Analytics (Avg Wait Time Reduced %, Fuel Saved)│
└────────────────────────────────────────────────────────┘
```

---

## 4. The Signal Timing & Decision Algorithm

### 4.1 The 4-Tier Density Classification
Every road approach (North, South, East, West) is classified into one of four tiers:

| Tier | Vehicle Count Range | Traffic Level | Allocated Green Time |
| :--- | :--- | :--- | :--- |
| **Tier 1** | $0 \le \text{Vehicles} \le 19$ | **Low** | **15 seconds** |
| **Tier 2** | $20 \le \text{Vehicles} \le 50$ | **Medium** | **25 seconds** |
| **Tier 3** | $51 \le \text{Vehicles} \le 80$ | **High** | **35 seconds** |
| **Tier 4** | $> 80$ Vehicles | **Very High** | **45 seconds** (up to 60s max) |

### 4.2 Priority Queue Ordering
- Directions are sorted by vehicle count descending: e.g., $\text{West (100)} \rightarrow \text{North (80)} \rightarrow \text{South (50)} \rightarrow \text{East (15)}$.
- The busiest road gets green light first with its corresponding tier duration.
- Safety intervals: 3 seconds **Yellow transition** + 2 seconds **All-Red clearance** between phase switches.

### 4.3 Multi-Junction Coordination ("Green Wave" & Anti-Gridlock)
- **Forward Inflow Prediction**: When Junction 1 releases a platoon of cars toward Junction 2, Junction 2 calculates arrival time:
  $$\text{Arrival Time} = \frac{\text{Distance}}{\text{Average Speed}} \approx 15\text{ seconds}$$
  Junction 2 schedules green light for that lane just as the cars arrive, allowing continuous transit without stopping twice.
- **Spillback / Anti-Gridlock Prevention**: If the road between Junction 1 and Junction 2 is already $>85\%$ full, Junction 1 suppresses green time toward Junction 2 to prevent cars blocking the intersection box.

### 4.4 Emergency Vehicle Preemption & Green Corridor
- When an ambulance is spawned at **Junction $X$** with destination **Hospital at Junction $Y$**:
  1. The shortest path of junctions connecting $X$ to $Y$ is determined.
  2. The signals at Junction $X$ immediately transition to **RED** for all cross-traffic and **GREEN** for the ambulance lane (`EMERGENCY_OVERRIDE = 45s`).
  3. The next junction along the route prepares clearance in advance so the road is empty when the ambulance arrives.
  4. Once the ambulance clears the intersection, the signals return to the normal adaptive cycle.

---

## 5. Frontend Visual Simulation Specifications (Option 2: 2D Schematic Grid)

### 5.1 Map Layout
- Rendered using **SVG inside React** for crisp 60 FPS rendering without external map dependencies.
- A 4-junction grid (2x2 layout):
  - **Junction 1** (Top-Left) $\longleftrightarrow$ **Junction 2** (Top-Right)
  - **Junction 3** (Bottom-Left) $\longleftrightarrow$ **Junction 4** (Bottom-Right)
  - **City Hospital** located adjacent to Junction 4.
- Connected by bidirectional gray asphalt roads with dashed white centerlines.

### 5.2 Visual Elements
1. **Traffic Light Units**: 4 sets of 🔴🟡🟢 lights per junction with numerical countdown displays (e.g. `24s... 23s...`).
2. **Vehicle Particles**: Small colored rectangles or icons representing cars that:
   - Move along lane paths.
   - Decelerate and stop behind the stop line if the light is **RED**.
   - Accelerate and cross the junction when the light turns **GREEN**.
3. **Interactive Control Panel**:
   - Dropdown to select junction (`J1`, `J2`, `J3`, `J4`).
   - Sliders for North, South, East, West vehicle counts ($0$ to $150$).
   - Dragging a slider immediately triggers a recalculation and reflects live on the signals.
4. **Emergency Controls**:
   - Button: `[🚨 Dispatch Ambulance]`.
   - Selector for starting junction and target hospital.
   - Glowing animated green route line highlighting the path of the ambulance.
5. **Analytics Footer**:
   - Average waiting time saved (%) compared to a fixed 30-second timer.
   - Estimated fuel/idle emissions saved.

---

## 6. Current Implementation Status

### 6.1 Already Built & Verified
- [x] Repository folder structure (`backend/`, `frontend/`, `database/`, `docs/`).
- [x] Git repository configured with `.gitignore` excluding `node_modules`, `.env`, and `.DS_Store`.
- [x] Express backend initialized with CORS, environment configuration, and `nodemon` continuous dev runner.
- [x] **`backend/src/algorithms/trafficDecision.js`**: Fully implements the 4-tier timing table (`Low`, `Medium`, `High`, `Very High`), cycle ordering, and emergency override logic.
- [x] **`backend/src/controllers/trafficController.js`**: Exposes `/api/traffic/current` and `/api/traffic/decision` supporting query parameters, POST body, and safe fallbacks.
- [x] **`frontend/`**: Vite + React initialized, stripped of all template junk and boilerplate, verified with zero build errors.

### 6.2 Next Tasks to Complete (Roadmap for Teammates)
1. **Backend Multi-Junction Extension**:
   - Create `backend/src/algorithms/networkModel.js` defining the 4-junction graph (`J1`, `J2`, `J3`, `J4`), road edge lengths, and hospital node.
   - Implement neighbor inflow prediction and ambulance path routing.
2. **Frontend 2D Map & Signal Component**:
   - Create `frontend/src/components/TrafficMap.jsx` rendering the SVG grid, road lines, and traffic light circles.
   - Create `frontend/src/components/ControlPanel.jsx` with vehicle count sliders.
3. **Vehicle Particle Animation**:
   - Implement `requestAnimationFrame` loop in React to move vehicle objects along coordinates and halt at red stop lines.
4. **Emergency Ambulance Animation**:
   - Implement the ambulance dispatch trigger, path highlight, and hospital arrival animation.
5. **Analytics Dashboard Component**:
   - Calculate and display comparative metrics (Fixed Timer vs. Adaptive AI).

---

## 7. How to Run the Project Locally

### Backend Setup:
```bash
cd backend
npm install
npm run dev
# Server will run at http://localhost:3000
```
- Test current traffic: `http://localhost:3000/api/traffic/current`
- Test signal decision: `http://localhost:3000/api/traffic/decision`
- Test emergency preemption: `http://localhost:3000/api/traffic/decision?emergency=south`

### Frontend Setup:
```bash
cd frontend
npm install
npm run dev
# Vite will launch the development app at http://localhost:5173
```

---

## 8. Summary for Viva & Project Evaluations

> *"Our system addresses urban congestion by replacing rigid fixed-time traffic lights with an AI-driven adaptive controller. Operating across a multi-junction network, our system continuously monitors directional traffic density, classifies it into four standardized operational tiers, and synchronizes adjacent intersections to create green waves while preventing spillback gridlocks. Crucially, the system features a dedicated Emergency Green Corridor that pre-clears intersections along an ambulance's path to a hospital, eliminating red-light delays for lifesaving transit."*

