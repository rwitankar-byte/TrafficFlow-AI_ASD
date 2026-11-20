# TrafficFlow-AI (ASD) 🚦

> **Safe Adaptive Traffic Signal Management System with Emergency Vehicle Preemption**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-trafficflow--ai--asd.vercel.app-emerald?style=for-the-badge&logo=vercel)](https://trafficflow-ai-asd.vercel.app/)

🌐 **Live Deployment:** [https://trafficflow-ai-asd.vercel.app/](https://trafficflow-ai-asd.vercel.app/)

---

## 🌟 Overview

**TrafficFlow-AI** is a smart, beginner-friendly traffic signal management and simulation system. It dynamically optimizes 16 directional traffic signals across a 4-junction urban grid using real-time vehicle density and waiting times while guaranteeing 100% collision-free phase transitions and emergency corridor preemption.

---

## 🚀 Key Features

- **🌐 Live Web Deployment**: Fully hosted on Vercel at [https://trafficflow-ai-asd.vercel.app/](https://trafficflow-ai-asd.vercel.app/) with serverless API integration.
- **🛡️ Strictly Safe Signal Phases**: Conflicting directional flows (North/South vs. East/West) never turn green simultaneously.
- **🛑 Zero-Vehicle All-Red Hold**: When no vehicles are present across all four junctions, all signals hold continuously in safe RED (`#ef4444`).
- **⏱️ 2-Second Calculation Buffer**: When vehicles arrive from an empty network, signals hold for 2 seconds in clearance ALL_RED while evaluating priority logic before safely activating the winning green phase.
- **🚑 Emergency Ambulance Preemption**: Dynamic corridor clearance for emergency vehicles with safe yellow clearance &rarr; all-red clearance transitions, clearing paths to City Hospital.
- **⏳ Anti-Starvation Protection**: Automatically overrides and serves directions that have waited past the maximum wait threshold (60s).
- **📊 Adaptive Green Durations**: Dynamically clamps green time between 15s (light traffic) and 60s (heavy traffic).
- **🗺️ Interactive 16-Signal SVG Grid**: Visual simulation with live vehicle counters, manual traffic adjustments, preset scenarios, and animated vehicle routing.
- **🗄️ Optional PostgreSQL Persistence**: Prisma ORM stores junctions, signals, traffic snapshots, signal history, emergency dispatches, and analytics when `DATABASE_URL` is configured; the simulation still works with in-memory defaults when it is absent.

---

## 🏗️ Project Architecture

```
TrafficFlow-AI_ASD/
├── api/                  # Vercel Serverless Function entry point
│   └── index.js
├── backend/              # Node.js & Express Traffic Decision Engine
│   ├── src/
│   │   ├── algorithms/   # Core traffic decision & safety algorithms
│   │   ├── controllers/  # API controllers
│   │   ├── routes/       # Express route handlers
│   │   └── server.js     # Standalone local Express server
│   └── tests/            # Comprehensive automated test suite (9 test cases)
├── frontend/             # React + Vite + Tailwind CSS User Interface
│   ├── src/
│   │   ├── App.jsx       # Real-time traffic simulation & SVG map
│   │   └── main.jsx
│   └── vite.config.js    # Vite configuration with API proxy
├── package.json          # Monorepo build and test scripts
└── vercel.json           # Vercel deployment configuration
```

---

## 🧪 Testing & Verification

Run the automated test suite covering all 9 safety rules, timing clamping, zero-vehicle holds, and ambulance preemption:

```bash
npm test --prefix backend
```

## 🗄️ Database Setup

The backend supports PostgreSQL through Prisma ORM 7.10.0. Copy the template and set a local or hosted PostgreSQL connection string without committing credentials:

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
```

The database contains junctions, sixteen current signals, traffic snapshots, signal transition logs, City Hospital, and emergency dispatch records. Database-backed reads are available at `/api/junctions`, `/api/traffic/history`, `/api/signals/current`, `/api/signals/history`, `/api/emergency/history`, and `/api/analytics`.

If `DATABASE_URL` is not configured, the traffic decision API continues to serve the in-memory simulation and skips persistence.

---

## 💻 Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/rwitankar-byte/TrafficFlow-AI_ASD.git
cd TrafficFlow-AI_ASD
```

### 2. Start Backend API
```bash
cd backend
npm install
npm start
```
*Backend runs on `http://localhost:3000`.*

### 3. Start Frontend UI
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173` with automatic API proxying.*

---

## 📜 License

MIT License. Designed and developed for Safe Adaptive Traffic Signal Management.
