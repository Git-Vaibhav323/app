# Quick Fix for Expo Go Not Working on Android

## 🔧 Quick Fix (Try This First)

Use **Tunnel Mode** - This works even if your phone and computer are on different networks:

```bash
cd frontend
npm run start:tunnel
```

Wait for the tunnel to establish (10-30 seconds), then scan the QR code with **Expo Go app** (not your camera app).

---

## 📱 Step-by-Step for Android

### Step 1: Install/Update Expo Go
- Go to Google Play Store
- Search "Expo Go"
- Install or update to latest version

### Step 2: Start with Tunnel Mode
```bash
cd frontend
npm run start:tunnel
```

### Step 3: Scan QR Code
- **Important**: Open Expo Go app first
- Tap "Scan QR code" button in Expo Go
- Scan the QR code from terminal
- **OR** manually enter the URL shown in terminal (starts with `exp://`)

---

## ❌ Common Mistakes

1. ❌ Using camera app to scan (Android) - Use Expo Go app instead
2. ❌ Phone and computer on different networks - Use tunnel mode
3. ❌ Old Expo Go version - Update from Play Store
4. ❌ Firewall blocking connection - Use tunnel mode

---

## ✅ What Should Happen

1. You run `npm run start:tunnel`
2. Terminal shows: "Tunnel ready" and a QR code
3. You scan QR code with Expo Go app
4. App loads in Expo Go

---

## 🆘 Still Not Working?

1. **Try manual URL entry:**
   - Look at terminal for URL like: `exp://abc-123.anonymous.exp.direct:80`
   - Open Expo Go app
   - Tap "Enter URL manually"
   - Type that URL

2. **Check your network:**
   - Make sure phone has internet
   - Try switching Wi-Fi networks

3. **Restart everything:**
   - Close Expo Go app
   - Stop the development server (Ctrl+C)
   - Run `npm run start:tunnel` again
   - Try scanning again

---

The tunnel mode (`npm run start:tunnel`) should fix most connection issues! 🚀

