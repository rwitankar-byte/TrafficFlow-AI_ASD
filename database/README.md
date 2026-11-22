# 🗄️ TrafficFlow-AI Database Hub

All database configurations, schemas, sample records, and query operations for the **TrafficFlow-AI** project are consolidated here.

---

## 📁 Files in this Directory

| File | Description |
| :--- | :--- |
| **`schema.prisma`** | The complete PostgreSQL relational database schema with all models (`Junction`, `Signal`, `TrafficData`, `SignalLog`, `Hospital`, `EmergencyDispatch`). |
| **`trafficDatabase.js`** | Standalone runnable script containing the **Data Schema**, **Sample Data Record**, **ACID Transaction**, and **Top 2 Frequent Queries**. Run with `node database/trafficDatabase.js`. |
| **`traffic_history.json`** | Pre-seeded historical traffic database spanning 7 days (morning rush, evening peak, normal flow, and weekend off-peak). |
| **`seed.js`** | Seeding script to populate physical junctions (J1..J4), initial 16 signal heads, and City Hospital. |

---

## 🎯 Viva & Technical Reference

### 1. Database Choice & Type
- **Name:** PostgreSQL (Relational Database / RDBMS) with Prisma ORM.
- **Why Relational?** Traffic network data is **strictly structured and relational**:
  - `Junction` (1) &rarr; `Signal` (Many)
  - `Junction` (1) &rarr; `TrafficData` (Many)
  - `Signal` (1) &rarr; `SignalLog` (Many)
  - Foreign keys ensure integrity across physical intersections.

### 2. ACID Transactions & Consistency
- **Strong Consistency Required:** When an ambulance requests priority, conflicting green signals must change to RED atomically and the clearance log must be recorded together.
- Implemented via `prismaClient.$transaction(...)` to guarantee that no conflicting signal state can ever be partially committed.

### 3. Frequent Queries
1. **Date & Time Traffic Query:** Filter vehicle volume by specific date and hour (`queryTrafficByDateAndTime`).
2. **Rush Traffic Date Ranking:** Aggregate vehicle counts by date to automatically identify which date had rush hour traffic (`findRushTrafficDates`).

---

## ⚡ Quick Test
Run the standalone database script:
```bash
node database/trafficDatabase.js
```
