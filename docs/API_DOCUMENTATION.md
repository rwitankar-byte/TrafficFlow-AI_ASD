# Smart Traffic Management System &bull; REST API Reference

## Base URL
- **Local Development**: `http://localhost:3000`
- **Prefix**: `/api/traffic`

All request payloads and responses use standard JSON (`application/json`).

---

## 1. System Health & Metadata

### `GET /`
Returns backend health status, API version, and route directory.

#### Response `200 OK`
```json
{
  "status": "ONLINE",
  "service": "Smart Traffic Management AI Decision Engine",
  "version": "2.4.0",
  "mode": "Simulation Sandbox",
  "endpoints": {
    "currentTraffic": "/api/traffic/current",
    "decision": "/api/traffic/decision",
    "junctions": "/api/traffic/junctions",
    "emergency": "/api/traffic/emergency/history"
  },
  "websocket": "Socket.IO enabled on same port"
}
```

---

## 2. Traffic Density & Signal Timing Endpoints

### `GET /api/traffic/current`
Fetches current baseline traffic density across North, South, East, and West approaches.

#### Response `200 OK`
```json
{
  "north": 80,
  "south": 50,
  "east": 15,
  "west": 100
}
```

---

### `GET /api/traffic/decision`
### `POST /api/traffic/decision`
Calculates dynamic 4-tier signal timing allocation for the given traffic density.

#### Parameters (Query or Request Body)
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `north` | Number | No | 80 | Queued vehicle count on North road |
| `south` | Number | No | 50 | Queued vehicle count on South road |
| `east` | Number | No | 15 | Queued vehicle count on East road |
| `west` | Number | No | 100 | Queued vehicle count on West road |
| `emergencyDirection` | String | No | null | `NORTH`, `SOUTH`, `EAST`, `WEST` |
| `emergencyVehicleType` | String | No | AMBULANCE | `AMBULANCE`, `FIRE_ENGINE` |

#### Response `200 OK`
```json
{
  "greenDirection": "WEST",
  "duration": 45,
  "emergency": {
    "active": false,
    "direction": null,
    "vehicleType": null,
    "overrideDuration": 0
  },
  "directions": {
    "north": { "vehicleCount": 80, "trafficLevel": "HIGH", "label": "High", "greenTime": 35 },
    "south": { "vehicleCount": 50, "trafficLevel": "MEDIUM", "label": "Medium", "greenTime": 25 },
    "east": { "vehicleCount": 15, "trafficLevel": "LOW", "label": "Low", "greenTime": 15 },
    "west": { "vehicleCount": 100, "trafficLevel": "VERY_HIGH", "label": "Very high", "greenTime": 45 }
  },
  "cycleOrder": ["WEST", "NORTH", "SOUTH", "EAST"],
  "totalCycleDuration": 120
}
```

---

## 3. Multi-Junction Coordination Endpoints

### `GET /api/traffic/junctions`
Retrieves real-time status, active signals, and Green Wave progression offsets for all 4 intersections (J1, J2, J3, J4).

#### Response `200 OK`
```json
{
  "timestamp": "2026-11-10T12:00:00.000Z",
  "networkStatus": "SYNCHRONIZED",
  "totalJunctions": 4,
  "totalNetworkVehicles": 890,
  "hospitalAdjacentJunction": "J4",
  "junctions": {
    "J1": {
      "junctionId": "J1",
      "name": "Grand Ave & North Pkwy",
      "activeSignal": "WEST",
      "allocatedDuration": 45,
      "greenWaveOffsets": {
        "EAST": { "targetJunction": "J2", "distanceM": 400, "greenWaveOffsetSec": 32 },
        "SOUTH": { "targetJunction": "J3", "distanceM": 350, "greenWaveOffsetSec": 31 }
      }
    }
  }
}
```

---

### `POST /api/traffic/junctions/:id`
Updates vehicle arrival counts for a specific junction (`J1`, `J2`, `J3`, `J4`).

#### Request Body
```json
{
  "north": 90,
  "south": 65,
  "east": 40,
  "west": 110
}
```

#### Response `200 OK`
```json
{
  "message": "Junction J1 traffic updated successfully",
  "data": {
    "junctionId": "J1",
    "updatedTraffic": { "north": 90, "south": 65, "east": 40, "west": 110 }
  }
}
```

---

## 4. Emergency Green Corridor Endpoints

### `POST /api/traffic/emergency/trigger`
Dispatches an emergency vehicle and locks a 45-second green corridor toward City Hospital.

#### Request Body
```json
{
  "direction": "EAST",
  "vehicleType": "AMBULANCE",
  "originJunction": "J1"
}
```

#### Response `200 OK`
```json
{
  "message": "Emergency Green Corridor dispatched",
  "data": {
    "id": "EMS-742",
    "vehicleType": "AMBULANCE",
    "direction": "EAST",
    "originJunction": "J1",
    "targetHospital": "City Hospital (J4)",
    "route": ["J1", "J2", "J4", "CITY_HOSPITAL"],
    "durationSec": 45,
    "status": "PREEMPTION_ACTIVE"
  }
}
```

---

### `POST /api/traffic/emergency/clear`
Clears the active corridor once the vehicle arrives safely.

#### Response `200 OK`
```json
{
  "message": "Emergency Corridor [EMS-742] successfully cleared",
  "clearedTrip": {
    "id": "EMS-742",
    "vehicleType": "AMBULANCE",
    "transitTimeSec": 34,
    "timeSavedSec": 58,
    "status": "CLEARED"
  }
}
```

---

### `GET /api/traffic/emergency/history`
Returns active preemption state and past emergency dispatch logs.

#### Response `200 OK`
```json
{
  "activeEmergency": null,
  "history": [
    {
      "id": "EMS-901",
      "vehicleType": "AMBULANCE",
      "originJunction": "J1",
      "targetHospital": "City Hospital (J4)",
      "route": ["J1", "J2", "J4", "HOSPITAL"],
      "timeSavedSec": 54,
      "status": "CLEARED"
    }
  ]
}
```
