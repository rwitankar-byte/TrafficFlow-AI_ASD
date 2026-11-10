# Smart Traffic Management System &bull; Deployment & Operations Runbook

## 1. System Requirements
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Port Allocation**:
  - Backend API & WebSockets: `3000`
  - Frontend Vite Dev Server: `5173`

---

## 2. Environment Configuration

Create a `.env` file in the `backend/` directory:
```env
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
```

---

## 3. Local Installation & Startup

### 3.1 Backend Service
```bash
cd backend
npm install
npm run dev   # For hot-reload development using nodemon
# OR
npm start     # For production node runtime
```

### 3.2 Frontend Service
```bash
cd frontend
npm install
npm run dev   # Starts Vite server on http://localhost:5173
```

---

## 4. Production Deployment with PM2

To run the backend persistently in a production or demonstration environment:

```bash
# Install PM2 globally (optional)
npm install -g pm2

# Start backend cluster
cd backend
pm2 start src/server.js --name "traffic-backend" --instances 1

# Check process status
pm2 status

# View live application logs
pm2 logs traffic-backend
```

---

## 5. Health Check & Diagnostics Checklist

1. **Verify Backend Status**:
   ```bash
   curl -i http://localhost:3000/
   # Expect HTTP 200 with {"status": "ONLINE"}
   ```

2. **Test 4-Tier Decision Engine**:
   ```bash
   curl "http://localhost:3000/api/traffic/decision?north=80&south=50&east=15&west=100"
   # Expect greenDirection: "WEST" with 45s duration
   ```

3. **Verify WebSocket Server**:
   Connect via any WebSocket client to `ws://localhost:3000` and confirm arrival of `system:init` and `traffic:tick` packets every 1000ms.
