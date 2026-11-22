import React, { useState, useEffect } from 'react';
import { Database, Calendar, Clock, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, CheckCircle, RefreshCw } from 'lucide-react';

export function TrafficDatabasePanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedDate, setSelectedDate] = useState('2026-11-20');
  const [selectedHour, setSelectedHour] = useState('all');
  const [dateSnapshot, setDateSnapshot] = useState(null);
  const [rushReport, setRushReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);

  // Fetch Rush Dates Ranking Report on mount
  useEffect(() => {
    async function fetchRushReport() {
      try {
        const [rushRes, statusRes] = await Promise.all([
          fetch('/api/traffic/rush-dates').catch(() => null),
          fetch('/api/database/status').catch(() => null)
        ]);

        if (rushRes && rushRes.ok) {
          const data = await rushRes.json();
          setRushReport(data);
        }
        if (statusRes && statusRes.ok) {
          const sData = await statusRes.json();
          setDbStatus(sData);
        }
      } catch (err) {
        console.warn('Failed to load database rush report:', err.message);
      }
    }
    fetchRushReport();
  }, []);

  // Fetch Traffic by Selected Date and Hour
  useEffect(() => {
    let isMounted = true;
    async function fetchDateTraffic() {
      setIsLoading(true);
      try {
        const hourParam = selectedHour !== 'all' ? `&hour=${selectedHour}` : '';
        const res = await fetch(`/api/traffic/by-date?date=${selectedDate}${hourParam}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setDateSnapshot(data);
        }
      } catch (err) {
        console.warn('Failed to load date traffic:', err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchDateTraffic();
    return () => { isMounted = false; };
  }, [selectedDate, selectedHour]);

  const datesList = rushReport?.rankedDates || [
    { date: '2026-11-20', dayOfWeek: 'Friday', totalVehicles: 3850, peakHour: '17:45', peakJunction: 'J4', rushLevel: '🚨 SEVERE RUSH', rushBadge: 'Peak Rush Day' },
    { date: '2026-11-19', dayOfWeek: 'Thursday', totalVehicles: 2840, peakHour: '17:45', peakJunction: 'J4', rushLevel: '⚠️ HIGH RUSH', rushBadge: 'High Traffic' },
    { date: '2026-11-18', dayOfWeek: 'Wednesday', totalVehicles: 2720, peakHour: '08:30', peakJunction: 'J1', rushLevel: '⚠️ HIGH RUSH', rushBadge: 'High Traffic' },
    { date: '2026-11-17', dayOfWeek: 'Tuesday', totalVehicles: 2410, peakHour: '08:30', peakJunction: 'J2', rushLevel: '⚠️ HIGH RUSH', rushBadge: 'High Traffic' },
    { date: '2026-11-16', dayOfWeek: 'Monday', totalVehicles: 2510, peakHour: '08:30', peakJunction: 'J1', rushLevel: '⚠️ HIGH RUSH', rushBadge: 'High Traffic' },
    { date: '2026-11-21', dayOfWeek: 'Saturday', totalVehicles: 1850, peakHour: '12:00', peakJunction: 'J2', rushLevel: '🟢 NORMAL', rushBadge: 'Normal Flow' },
    { date: '2026-11-22', dayOfWeek: 'Sunday', totalVehicles: 1420, peakHour: '12:00', peakJunction: 'J3', rushLevel: '🟢 NORMAL', rushBadge: 'Normal Flow' }
  ];

  const peakRush = rushReport?.peakRushDate || datesList[0];

  return (
    <section 
      className="rounded-2xl bg-[#0b1329] border border-slate-800 p-4 sm:p-5 space-y-4 shadow-xl"
      aria-label="Database Historical Traffic and Rush Hour Analytics"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 font-bold text-white text-sm hover:text-cyan-400 transition-colors focus:outline-none cursor-pointer"
          aria-expanded={isOpen}
        >
          <Database className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <span>Traffic Database &amp; Date/Time Rush Hour Analyzer</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            Database: {dbStatus?.databaseMode ? 'Active (Beginner-Friendly)' : 'Connected'}
          </span>
          <span className="text-slate-400">7 Days Tracked</span>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-4 pt-1">
          {/* Top Rush Hour Highlight Banner */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-rose-950/40 via-amber-950/20 to-slate-950/60 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🚨</span>
              <div>
                <span className="text-rose-400 font-bold uppercase tracking-wider block">
                  Which Date Has Rush Traffic?
                </span>
                <p className="text-slate-300 mt-0.5">
                  Peak Rush Date: <strong className="text-white">{peakRush?.dayOfWeek}, {peakRush?.date}</strong> with <strong className="text-amber-300">{peakRush?.totalVehicles?.toLocaleString()} cars</strong> logged across J1–J4.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                Peak Hour: {peakRush?.peakHour}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Peak Junction: {peakRush?.peakJunction}
              </span>
            </div>
          </div>

          {/* Controls: Date Picker & Time of Day */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono">
            {/* Date Select */}
            <div className="space-y-1">
              <label htmlFor="db-date-picker" className="text-slate-400 flex items-center gap-1.5 font-bold">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Select Date for Traffic Check:
              </label>
              <select
                id="db-date-picker"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {datesList.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.date} ({d.dayOfWeek}) - {d.rushBadge}
                  </option>
                ))}
              </select>
            </div>

            {/* Hour Select */}
            <div className="space-y-1">
              <label htmlFor="db-hour-picker" className="text-slate-400 flex items-center gap-1.5 font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Select Time of Day:
              </label>
              <select
                id="db-hour-picker"
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="all">All Hours Combined (Full Day Average)</option>
                <option value="8">08:00 - 09:00 AM (Morning Rush Peak)</option>
                <option value="12">12:00 - 01:00 PM (Midday Lunch)</option>
                <option value="17">05:00 - 06:00 PM (Evening Rush Peak)</option>
                <option value="21">09:00 - 10:00 PM (Night Off-Peak)</option>
              </select>
            </div>

            {/* Quick Status Info */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <span className="text-slate-400 block font-bold">Traffic Condition:</span>
              <div className="flex items-center gap-2 pt-0.5">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                  dateSnapshot?.isRushHour
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {dateSnapshot?.rushTrafficStatus || (selectedDate === '2026-11-20' ? '🚨 RUSH TRAFFIC' : '🟢 NORMAL FLOW')}
                </span>
                <span className="text-slate-400">
                  {dateSnapshot?.totalNetworkVehicles ? `${dateSnapshot.totalNetworkVehicles} vehicles` : 'Scanning...'}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Junctions Traffic Snapshot at Selected Date & Time */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span>📍</span> Traffic Across 4 Junctions on {selectedDate} ({selectedHour === 'all' ? 'All Hours' : `${selectedHour}:00`}):
              </span>
              {isLoading && <span className="text-cyan-400 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Loading...</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
              {['J1', 'J2', 'J3', 'J4'].map((code) => {
                const jData = dateSnapshot?.byJunction?.[code] || {
                  name: code === 'J1' ? 'Junction 1' : code === 'J2' ? 'Junction 2' : code === 'J3' ? 'Junction 3' : 'Junction 4',
                  label: code === 'J1' ? 'North-West (Grand Ave)' : code === 'J2' ? 'North-East (Metro Blvd)' : code === 'J3' ? 'South-West (Outer Ring)' : 'South-East (Expressway)',
                  totalVehicles: code === 'J4' ? (selectedDate === '2026-11-20' ? 95 : 45) : code === 'J1' ? (selectedDate === '2026-11-20' ? 70 : 35) : code === 'J2' ? 30 : 18,
                  directions: {
                    NORTH: code === 'J4' ? 30 : 20,
                    SOUTH: code === 'J4' ? 28 : 18,
                    EAST: code === 'J4' ? 20 : 15,
                    WEST: code === 'J4' ? 17 : 12
                  },
                  trafficTier: code === 'J4' || (selectedDate === '2026-11-20' && code === 'J1') ? 'HIGH' : 'MEDIUM'
                };

                const tierColor = jData.trafficTier === 'VERY_HIGH' ? 'text-rose-400 border-rose-500/40 bg-rose-950/30'
                                : jData.trafficTier === 'HIGH' ? 'text-amber-400 border-amber-500/40 bg-amber-950/30'
                                : jData.trafficTier === 'MEDIUM' ? 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30'
                                : 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30';

                return (
                  <div key={code} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-white">{code}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${tierColor}`}>
                        {jData.trafficTier}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate" title={jData.label}>{jData.label}</div>
                    
                    <div className="text-lg font-bold text-white font-mono">
                      {jData.totalVehicles} <span className="text-xs font-normal text-slate-400">vehicles</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                      <div>N: <strong className="text-slate-200">{jData.directions?.NORTH || 0}</strong></div>
                      <div>S: <strong className="text-slate-200">{jData.directions?.SOUTH || 0}</strong></div>
                      <div>E: <strong className="text-slate-200">{jData.directions?.EAST || 0}</strong></div>
                      <div>W: <strong className="text-slate-200">{jData.directions?.WEST || 0}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rush Traffic Dates Ranking Table */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                Date-Wise Rush Traffic Ranking (High to Low):
              </span>
              <span className="text-[11px] text-slate-400">Click any date to inspect details</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 font-mono text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] bg-slate-900/50">
                    <th className="p-2.5">Rank</th>
                    <th className="p-2.5">Date &amp; Day</th>
                    <th className="p-2.5">Total Vehicles</th>
                    <th className="p-2.5">Peak Rush Hour</th>
                    <th className="p-2.5">Peak Junction</th>
                    <th className="p-2.5">Rush Level</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {datesList.map((d, index) => {
                    const isSelected = d.date === selectedDate;
                    return (
                      <tr 
                        key={d.date} 
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-cyan-950/40 text-cyan-200' : 'hover:bg-slate-900/50 text-slate-300'
                        }`}
                        onClick={() => setSelectedDate(d.date)}
                      >
                        <td className="p-2.5 font-bold">
                          {index === 0 ? <span className="text-rose-400">🥇 #1</span> : `#${index + 1}`}
                        </td>
                        <td className="p-2.5">
                          <strong className="text-white">{d.date}</strong> <span className="text-slate-400 text-[11px]">({d.dayOfWeek})</span>
                        </td>
                        <td className="p-2.5 font-bold text-amber-300">
                          {d.totalVehicles?.toLocaleString()} cars
                        </td>
                        <td className="p-2.5 text-cyan-400">
                          {d.peakHour}
                        </td>
                        <td className="p-2.5">
                          {d.peakJunction}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            d.rushBadge === 'Peak Rush Day'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : d.rushBadge === 'High Traffic'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}>
                            {d.rushBadge}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedDate(d.date); }}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                              isSelected
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            }`}
                          >
                            {isSelected ? 'Viewing' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Beginner-Friendly Architecture Explanation */}
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5 font-mono">
            <span className="text-slate-300 font-bold block">💡 How the Beginner Database Works:</span>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Zero Installation:</strong> Works out of the box with an in-memory &amp; local JSON store. No PostgreSQL setup required.</li>
              <li><strong>Date &amp; Time Tracking:</strong> Every traffic count is stamped with its Date (YYYY-MM-DD), Hour (0–23), and Junction.</li>
              <li><strong>Rush Traffic Calculation:</strong> The algorithm aggregates vehicle counts across 24 hours to automatically pinpoint the date and hour with maximum congestion.</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

export default TrafficDatabasePanel;
