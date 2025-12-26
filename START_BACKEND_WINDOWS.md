# Start Backend Server (Windows PowerShell)

## The Issue

PowerShell doesn't recognize `uvicorn` as a command because it's not in your PATH. Use `python -m uvicorn` instead.

## Solution

### Option 1: Use Python Module (Recommended)

```powershell
cd backend
python -m uvicorn server:socket_app --host 0.0.0.0 --port 3001 --reload
```

### Option 2: Install Dependencies First

If you get "No module named uvicorn", install dependencies:

```powershell
cd backend
python -m pip install -r requirements.txt
```

Then run:

```powershell
python -m uvicorn server:socket_app --host 0.0.0.0 --port 3001 --reload
```

### Option 3: Create a Batch Script

Create `backend/start.bat`:

```batch
@echo off
cd /d %~dp0
python -m uvicorn server:socket_app --host 0.0.0.0 --port 3001 --reload
```

Then just run: `start.bat`

## Verify It's Running

Open browser: http://localhost:3001/api/

Should see: `{"message": "Skip On API", "version": "1.0.0"}`

## Troubleshooting

### "No module named uvicorn"
```powershell
python -m pip install uvicorn fastapi python-socketio
```

### "Port 3001 already in use"
```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### "ModuleNotFoundError: No module named 'server'"
Make sure you're in the `backend` directory:
```powershell
cd backend
python -m uvicorn server:socket_app --host 0.0.0.0 --port 3001 --reload
```

