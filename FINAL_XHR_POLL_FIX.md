# ✅ Final Fix: xhr poll error

## 🚨 Error
```
[EngageService] ❌ Connection error to /play-along: xhr poll error
TransportError: xhr poll error
```

## 🔍 Root Cause

**Multiple server instances on port 3002** cause Socket.IO polling requests to fail.

The "xhr poll error" specifically means:
- Socket.IO client tries HTTP polling (XHR) to connect
- The polling request to `/socket.io/?EIO=4&transport=polling&...` fails
- This happens when multiple servers are competing for the same port

---

## ✅ Complete Fix

### **Step 1: Kill ALL Processes on Port 3002**

```powershell
# Method 1: Use the script
.\KILL_ALL_SERVERS.ps1

# Method 2: Manual PowerShell command
Get-NetTCPConnection -LocalPort 3002 | ForEach-Object { 
    Stop-Process -Id $_.OwningProcess -Force 
}

# Method 3: Find and kill manually
netstat -ano | findstr :3002
# Note the PID, then:
Stop-Process -Id <PID> -Force
```

### **Step 2: Verify Port is Free**

```powershell
netstat -ano | findstr :3002
# Should return NOTHING
```

### **Step 3: Start ONE Server Instance**

```powershell
cd backend
npm run start:engage
```

**Wait for:**
```
🚀 ENGAGE Socket.IO Server Running
Port: 3002
```

### **Step 4: Verify Only ONE Process**

```powershell
netstat -ano | findstr :3002
# Should show ONLY ONE process
```

### **Step 5: Test Health Endpoint**

Open in browser: `http://localhost:3002/health`

**Should return:**
```json
{
  "status": "ok",
  "namespaces": ["/watch-along", "/play-along", "/sing-along"],
  "redis": "connected"
}
```

### **Step 6: Test Connection in App**

1. **Refresh your app** (hard refresh: Ctrl+Shift+R)
2. **Go to Chess**
3. **Click "Create New Game"**
4. **Should work!** ✅

---

## 🔍 Why This Happens

1. **Multiple Servers:** Two+ Node.js processes listening on port 3002
2. **Request Routing:** Polling requests get routed to wrong server
3. **Connection Failure:** Server can't establish proper Socket.IO connection
4. **Error Cascade:** Client retries, fails again, reports "xhr poll error"

---

## ✅ Success Indicators

After fix, you should see:

**In Browser Console:**
```
[EngageService] Connecting to /play-along at http://localhost:3002/play-along...
[EngageService] ✅ Server ready for /play-along: {...}
[EngageService] ✅ Connected to /play-along
```

**In Server Window:**
```
[PLAY-ALONG] ✅ User <userId> connected (socket: <socketId>, transport: polling)
```

**In App:**
- ✅ Chess portal opens immediately
- ✅ Room code appears
- ✅ NO "xhr poll error"

---

## 🐛 If Still Getting Error

### **Check 1: Only ONE Server Running**
```powershell
netstat -ano | findstr :3002
# Must show ONLY ONE process
```

### **Check 2: Server Logs**
Look in server window for:
- `[PLAY-ALONG] ✅ User connected` → Server is working
- No logs → Server not receiving connections

### **Check 3: Browser Network Tab**
1. DevTools → Network tab
2. Filter: `socket.io` or `polling`
3. Click "Create New Game"
4. Look for requests to `localhost:3002/socket.io/...`
5. Check status: Should be `200 OK` or `101 Switching Protocols`

### **Check 4: CORS**
Check browser console for CORS errors. Should not appear.

---

## 📝 Summary

**Problem:** Multiple server instances → Polling requests fail → "xhr poll error"

**Solution:** Kill all instances → Start only ONE → Connection works

**Result:** ✅ Connection succeeds, chess portal opens, no errors

---

**The key is ensuring only ONE server instance is running on port 3002!** 🎯

