# 🔧 Fix: xhr poll error

## 🚨 Error
```
[EngageService] ❌ Connection error to /play-along: xhr poll error
TransportError: xhr poll error
```

## 🔍 Root Cause

**Multiple server instances on port 3002** are causing connection routing issues.

The "xhr poll error" means:
- Socket.IO client tries to connect via HTTP polling (XHR)
- The polling request fails (could be going to wrong server, CORS, or server error)
- Connection cannot be established

---

## ✅ Fix Steps

### **Step 1: Kill All Server Instances**

```powershell
# Run the fix script
.\FIX_TIMEOUT_NOW.ps1

# OR manually:
Stop-Process -Id 24068 -Force
Stop-Process -Id 32988 -Force

# Verify port is free
netstat -ano | findstr :3002
# Must return NOTHING
```

### **Step 2: Start ONE Server Instance**

```powershell
cd backend
npm run start:engage
```

**Wait for:**
```
🚀 ENGAGE Socket.IO Server Running
Port: 3002
```

### **Step 3: Verify Only ONE Process**

```powershell
netstat -ano | findstr :3002
# Should show ONLY ONE process
```

### **Step 4: Test Health Endpoint**

Open in browser: `http://localhost:3002/health`

**Should return:**
```json
{
  "status": "ok",
  "namespaces": ["/watch-along", "/play-along", "/sing-along"],
  "redis": "connected"
}
```

### **Step 5: Test Connection in App**

1. Refresh your app
2. Go to Chess
3. Click "Create New Game"
4. Should work now! ✅

---

## 🔍 Why "xhr poll error" Happens

1. **Multiple Servers:** Two servers on same port cause routing confusion
2. **Polling Request Fails:** HTTP request to `/socket.io/?EIO=4&transport=polling&...` fails
3. **CORS Issues:** Server might reject the polling request
4. **Server Not Responding:** Server might not be handling Socket.IO polling endpoint

---

## ✅ After Fix

**Expected:**
- ✅ Only ONE server process on port 3002
- ✅ Health endpoint works
- ✅ Connection succeeds via polling
- ✅ Upgrades to WebSocket automatically
- ✅ Chess portal opens
- ✅ NO "xhr poll error"

---

## 🐛 If Still Getting Error

### **Check 1: Server Logs**
Look in server window for:
- Incoming connection attempts
- Any error messages
- CORS errors

### **Check 2: Browser Network Tab**
1. Open DevTools → Network tab
2. Filter: `socket.io` or `polling`
3. Click "Create New Game"
4. Look for failed requests
5. Check status code and error message

### **Check 3: CORS**
Check browser console for CORS errors. Should not appear with current CORS config (`origin: '*'`).

### **Check 4: Server Response**
The polling request should return Socket.IO handshake data. If it returns 404 or error, the server isn't handling it correctly.

---

**The fix is to kill all server instances and start only ONE!** 🎯

