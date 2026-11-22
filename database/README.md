# 🗄️ TrafficFlow-AI Database

All database files, schema definitions, sample data, and analytical queries are kept in this folder.

## Files
- **`trafficDatabase.js`**: Runnable script demonstrating the sample data, ACID transaction, and top 2 queries. Run with `node database/trafficDatabase.js`.
- **`schema.prisma`**: PostgreSQL relational schema (`Junction`, `Signal`, `TrafficData`, `SignalLog`, `Hospital`, `EmergencyDispatch`).
- **`traffic_history.json`**: Pre-seeded dataset with 7 days of traffic logs across 4 junctions.
- **`seed.js`**: Script to seed the 4 physical junctions and signal heads into PostgreSQL.

## Viva Quick Summary
1. **Database Type:** Relational (PostgreSQL with Prisma ORM).
2. **Why Relational:** Highly structured network data (`Junction` 1-to-many `Signal`, `Junction` 1-to-many `TrafficData`).
3. **Consistency:** Strong consistency (ACID transactions) ensures conflicting signals safely switch to RED when an emergency vehicle is dispatched.
4. **Main Queries:**
   - Query 1: Filter vehicle counts by specific date and hour (`queryTrafficByDateAndTime`).
   - Query 2: Identify and rank dates with rush traffic (`findRushTrafficDates`).
