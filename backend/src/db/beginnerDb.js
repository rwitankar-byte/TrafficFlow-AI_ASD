/**
 * beginnerDb.js - Zero-Setup Beginner-Friendly In-Memory & Local JSON Database
 * 
 * Provides an easy-to-use, zero-configuration database for TrafficFlow-AI.
 * Works out-of-the-box without requiring PostgreSQL or Prisma setup,
 * while allowing historical traffic checks by date, time, and rush hour analysis.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'traffic_db.json');

const JUNCTIONS = [
  { id: 'j1', code: 'J1', name: 'Junction 1', label: 'North-West (Grand Ave)', mapX: 180, mapY: 130 },
  { id: 'j2', code: 'J2', name: 'Junction 2', label: 'North-East (Metro Blvd)', mapX: 440, mapY: 130 },
  { id: 'j3', code: 'J3', name: 'Junction 3', label: 'South-West (Outer Ring)', mapX: 180, mapY: 310 },
  { id: 'j4', code: 'J4', name: 'Junction 4', label: 'South-East (Expressway)', mapX: 440, mapY: 310 }
];

const DIRECTIONS = ['NORTH', 'SOUTH', 'EAST', 'WEST'];

function computeTier(count) {
  if (count <= 10) return 'LOW';
  if (count <= 25) return 'MEDIUM';
  if (count <= 50) return 'HIGH';
  return 'VERY_HIGH';
}

/**
 * Generate 7 days of realistic pre-seeded historical traffic records
 */
function generateHistoricalSeed() {
  const records = [];
  const days = [
    { date: '2026-11-16', day: 'Monday', factor: 1.15, isRushDay: false },
    { date: '2026-11-17', day: 'Tuesday', factor: 1.10, isRushDay: false },
    { date: '2026-11-18', day: 'Wednesday', factor: 1.25, isRushDay: false },
    { date: '2026-11-19', day: 'Thursday', factor: 1.30, isRushDay: false },
    { date: '2026-11-20', day: 'Friday', factor: 1.85, isRushDay: true }, // PEAK RUSH DAY
    { date: '2026-11-21', day: 'Saturday', factor: 0.85, isRushDay: false },
    { date: '2026-11-22', day: 'Sunday', factor: 0.65, isRushDay: false }
  ];

  const sampleHours = [
    { hour: 8, minute: 30, rushHour: true, label: 'Morning Peak (08:30)', mult: 1.7 },
    { hour: 12, minute: 0, rushHour: false, label: 'Midday Lunch (12:00)', mult: 0.9 },
    { hour: 17, minute: 45, rushHour: true, label: 'Evening Peak (17:45)', mult: 1.9 },
    { hour: 21, minute: 30, rushHour: false, label: 'Night Off-Peak (21:30)', mult: 0.4 }
  ];

  let idCounter = 1;

  for (const d of days) {
    for (const h of sampleHours) {
      const isRush = h.rushHour || (d.isRushDay && (h.hour === 8 || h.hour === 17));
      const totalMult = d.factor * h.mult;

      for (const j of JUNCTIONS) {
        // Base vehicle distribution by junction
        const base = j.code === 'J4' ? 35 : j.code === 'J1' ? 28 : j.code === 'J2' ? 22 : 14;

        for (const dir of DIRECTIONS) {
          const dirMult = (dir === 'NORTH' || dir === 'SOUTH') ? 1.1 : 0.9;
          const count = Math.max(2, Math.round(base * totalMult * dirMult));

          const timeStr = `${String(h.hour).padStart(2, '0')}:${String(h.minute).padStart(2, '0')}`;
          const capturedAt = new Date(`${d.date}T${timeStr}:00.000Z`).toISOString();

          records.push({
            id: `rec_${idCounter++}`,
            junctionId: j.id,
            junctionCode: j.code,
            junctionName: j.name,
            direction: dir,
            vehicleCount: count,
            trafficTier: computeTier(count),
            capturedAt,
            date: d.date,
            dayOfWeek: d.day,
            hour: h.hour,
            time: timeStr,
            timeLabel: h.label,
            isRushHour: isRush,
            source: 'historical_seed'
          });
        }
      }
    }
  }

  return records;
}

class BeginnerDb {
  constructor() {
    this.junctions = JUNCTIONS;
    this.trafficData = [];
    this.signalLogs = [];
    this.emergencyDispatches = [];
    this.isLoaded = false;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.trafficData = Array.isArray(parsed.trafficData) ? parsed.trafficData : [];
        this.signalLogs = Array.isArray(parsed.signalLogs) ? parsed.signalLogs : [];
        this.emergencyDispatches = Array.isArray(parsed.emergencyDispatches) ? parsed.emergencyDispatches : [];
      }
    } catch (err) {
      console.warn('beginnerDb: error reading local cache file, initializing clean database:', err.message);
    }

    if (this.trafficData.length === 0) {
      this.trafficData = generateHistoricalSeed();
      this.save();
    }
    this.isLoaded = true;
  }

  save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const dataToSave = {
        updatedAt: new Date().toISOString(),
        trafficData: this.trafficData.slice(-5000), // keep latest 5000 records
        signalLogs: this.signalLogs.slice(-500),
        emergencyDispatches: this.emergencyDispatches.slice(-100)
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (err) {
      console.warn('beginnerDb: could not save local JSON database file (read-only environment):', err.message);
    }
  }

  // --- QUERY METHODS ---

  getJunctions() {
    return this.junctions;
  }

  getTrafficHistory({ limit = 100, junctionCode = null, date = null, hour = null } = {}) {
    let results = this.trafficData;

    if (junctionCode) {
      results = results.filter((r) => r.junctionCode === junctionCode.toUpperCase());
    }
    if (date) {
      results = results.filter((r) => r.date === date);
    }
    if (hour !== null && hour !== undefined && hour !== '') {
      results = results.filter((r) => Number(r.hour) === Number(hour));
    }

    return results.slice(-limit).reverse();
  }

  /**
   * Check traffic for a specific date and optional hour across all 4 junctions
   */
  getTrafficByDateTime({ date, hour = null, junctionCode = null }) {
    if (!date) {
      // Default to the latest recorded date
      const dates = this.getAvailableDates();
      date = dates[dates.length - 1] || '2026-11-20';
    }

    let records = this.trafficData.filter((r) => r.date === date);

    if (hour !== null && hour !== undefined && hour !== '') {
      records = records.filter((r) => Number(r.hour) === Number(hour));
    }

    if (junctionCode) {
      records = records.filter((r) => r.junctionCode === junctionCode.toUpperCase());
    }

    // Group by junction for beginner-friendly overview
    const byJunction = {};
    for (const j of this.junctions) {
      byJunction[j.code] = {
        code: j.code,
        name: j.name,
        label: j.label,
        totalVehicles: 0,
        directions: { NORTH: 0, SOUTH: 0, EAST: 0, WEST: 0 },
        trafficTier: 'LOW'
      };
    }

    let totalNetworkCars = 0;
    for (const r of records) {
      if (byJunction[r.junctionCode]) {
        byJunction[r.junctionCode].directions[r.direction] = r.vehicleCount;
        byJunction[r.junctionCode].totalVehicles += r.vehicleCount;
        totalNetworkCars += r.vehicleCount;
        byJunction[r.junctionCode].trafficTier = computeTier(byJunction[r.junctionCode].totalVehicles / 4);
      }
    }

    const dayRecord = records[0];
    const isRush = records.some((r) => r.isRushHour) || (totalNetworkCars > 250);

    return {
      date,
      dayOfWeek: dayRecord?.dayOfWeek || '',
      hour: hour !== null ? Number(hour) : 'ALL',
      totalRecords: records.length,
      totalNetworkVehicles: totalNetworkCars,
      rushTrafficStatus: isRush ? '🚨 RUSH TRAFFIC' : '🟢 NORMAL FLOW',
      isRushHour: isRush,
      byJunction,
      rawRecords: records.slice(0, 64)
    };
  }

  /**
   * Analyze which date has rush traffic and rank all dates by congestion
   */
  getRushTrafficReport() {
    const datesMap = new Map();

    for (const r of this.trafficData) {
      if (!datesMap.has(r.date)) {
        datesMap.set(r.date, {
          date: r.date,
          dayOfWeek: r.dayOfWeek || '',
          totalVehicles: 0,
          recordCount: 0,
          peakHour: 0,
          peakHourCount: 0,
          hourlyTotals: {},
          junctionTotals: { J1: 0, J2: 0, J3: 0, J4: 0 }
        });
      }

      const item = datesMap.get(r.date);
      item.totalVehicles += r.vehicleCount;
      item.recordCount++;

      item.hourlyTotals[r.hour] = (item.hourlyTotals[r.hour] || 0) + r.vehicleCount;
      if (item.junctionTotals[r.junctionCode] !== undefined) {
        item.junctionTotals[r.junctionCode] += r.vehicleCount;
      }
    }

    const rankedDates = Array.from(datesMap.values()).map((d) => {
      // Find peak hour on this date
      let peakHour = 8;
      let peakCount = 0;
      for (const [hr, count] of Object.entries(d.hourlyTotals)) {
        if (count > peakCount) {
          peakCount = count;
          peakHour = Number(hr);
        }
      }

      // Find most congested junction on this date
      let peakJunction = 'J4';
      let maxJuncCount = 0;
      for (const [jCode, count] of Object.entries(d.junctionTotals)) {
        if (count > maxJuncCount) {
          maxJuncCount = count;
          peakJunction = jCode;
        }
      }

      const avgCarsPerScan = Math.round(d.totalVehicles / Math.max(1, d.recordCount / 16));
      let rushLevel = '🟢 NORMAL';
      let rushBadge = 'Normal Flow';
      if (d.totalVehicles >= 2500) {
        rushLevel = '🚨 SEVERE RUSH';
        rushBadge = 'Peak Rush Day';
      } else if (d.totalVehicles >= 1500) {
        rushLevel = '⚠️ HIGH RUSH';
        rushBadge = 'High Traffic';
      }

      return {
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        totalVehicles: d.totalVehicles,
        avgCarsPerScan,
        peakHour: `${String(peakHour).padStart(2, '0')}:00`,
        peakHourVehicles: peakCount,
        peakJunction,
        rushLevel,
        rushBadge,
        isPeakRushDate: d.totalVehicles >= 2500
      };
    });

    // Sort descending by totalVehicles so the #1 Rush Traffic Date is at the top
    rankedDates.sort((a, b) => b.totalVehicles - a.totalVehicles);

    const peakRushDate = rankedDates[0] || null;

    return {
      status: 'success',
      description: 'Rush Traffic Date Analysis & Peak Hour Detection',
      totalDatesTracked: rankedDates.length,
      peakRushDate: peakRushDate ? {
        date: peakRushDate.date,
        dayOfWeek: peakRushDate.dayOfWeek,
        totalVehicles: peakRushDate.totalVehicles,
        peakHour: peakRushDate.peakHour,
        peakJunction: peakRushDate.peakJunction,
        message: `Highest rush traffic occurred on ${peakRushDate.dayOfWeek}, ${peakRushDate.date} with ${peakRushDate.totalVehicles} total vehicles logged.`
      } : null,
      rankedDates
    };
  }

  getAvailableDates() {
    const dates = new Set();
    for (const r of this.trafficData) {
      if (r.date) dates.add(r.date);
    }
    return Array.from(dates).sort();
  }

  // --- RECORD METHODS FOR SIMULATION ---

  recordTrafficSnapshot(networkVehicles, source = 'simulation') {
    if (!networkVehicles) return;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = now.getHours();
    const time = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const j of this.junctions) {
      const counts = networkVehicles[j.code] || {};
      for (const dir of DIRECTIONS) {
        const count = Number(counts[dir.toLowerCase()] ?? 0);
        this.trafficData.push({
          id: `live_${Date.now()}_${j.code}_${dir}`,
          junctionId: j.id,
          junctionCode: j.code,
          junctionName: j.name,
          direction: dir,
          vehicleCount: count,
          trafficTier: computeTier(count),
          capturedAt: now.toISOString(),
          date,
          dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
          hour,
          time,
          isRushHour: hour >= 8 && hour <= 10 || hour >= 17 && hour <= 19,
          source
        });
      }
    }
    // Periodic disk save
    if (this.trafficData.length % 32 === 0) {
      this.save();
    }
  }

  recordSignalState(jCode, phase, state, duration) {
    this.signalLogs.push({
      id: `sig_${Date.now()}_${jCode}`,
      junctionCode: jCode,
      phase,
      state,
      duration,
      occurredAt: new Date().toISOString()
    });
  }

  recordEmergencyDispatch(ambulance) {
    if (!ambulance) return;
    this.emergencyDispatches.push({
      id: `amb_${Date.now()}`,
      startJunction: ambulance.junction,
      currentJunction: ambulance.currentJunction || ambulance.junction,
      progress: ambulance.progress || 0,
      timestamp: new Date().toISOString()
    });
  }
}

// Global Singleton Instance
const beginnerDb = new BeginnerDb();

module.exports = { beginnerDb, BeginnerDb };
