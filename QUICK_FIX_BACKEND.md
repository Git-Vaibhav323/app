# Quick Fix: Backend Connection Issues

## Problem
- App trying to connect to `http://localhost:8001` but should use `http://localhost:3001`
- CORS errors
- "Backend not available" errors

## Solution

### 1. Start Backend Server (Port 3001)

Open a new terminal and run:

```bash
cd backend
uvicorn server:socket_app --host 0.0.0.0 --port 3001 --reload
```

**Important:** Use port **3001** (not 8001)

### 2. Verify Backend is Running

Open browser: http://localhost:3001/api/

Should see: `{"message": "Skip On API", "version": "1.0.0"}`

### 3. Clear Metro Cache (if still using wrong port)

```bash
cd frontend
npm run start:clear
```

Or manually:
```bash
cd frontend
rm -rf node_modules/.cache .expo .metro
npm start -- --clear
```

### 4. Test Skip On

1. Open app in browser
2. Go to Skip On / Chat On screen
3. Click "Start Chat"
4. Should connect to backend on port 3001

## What Was Fixed

1. ✅ Frontend now forces port 3001 if it detects 8001
2. ✅ Better error messages when backend is unavailable
3. ✅ Backend comment updated to use port 3001
4. ✅ Null response handling improved

## Still Not Working?

1. **Check backend is running:**
   ```bash
   curl http://localhost:3001/api/
   ```

2. **Check CORS:**
   - Backend CORS is configured to allow all origins (`allow_origins=["*"]`)
   - If still getting CORS errors, restart backend

3. **Check port:**
   - Backend must be on port 3001
   - Frontend expects port 3001 (configured in `app.json`)

4. **Disable demo mode temporarily:**
   - Edit `frontend/config/demo.ts`
   - Set `ENABLE_DEMO_MODE = false`
   - This will show real errors instead of mock data

