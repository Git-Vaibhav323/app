# Firebase Realtime Database - Fix Guide

## Issue: No data appearing in Firebase

If messages aren't appearing in Firebase, follow these steps:

### Step 1: Check Security Rules are Published

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **gingr-13c0c**
3. Click **Realtime Database** in left sidebar
4. Click **Rules** tab (next to "Data" tab)
5. Copy and paste these rules:

```json
{
  "rules": {
    "skipOnRooms": {
      "$roomId": {
        ".read": true,
        ".write": true,
        "users": {
          ".read": true,
          ".write": true
        },
        "messages": {
          ".read": true,
          "$messageId": {
            ".write": true,
            ".validate": "newData.hasChildren(['senderId', 'text', 'timestamp']) && newData.child('text').isString() && newData.child('text').val().length > 0 && newData.child('text').val().length <= 500"
          }
        },
        "status": {
          ".read": true,
          ".write": true
        },
        "createdAt": {
          ".read": true,
          ".write": true
        }
      }
    }
  }
}
```

6. Click **Publish** button (top right)
7. Wait for confirmation: "Rules published successfully"

### Step 2: Verify Database URL

1. In Firebase Console → Realtime Database → Data tab
2. Check the Database URL at the top
3. It should be: `https://gingr-13c0c-default-rtdb.asia-southeast1.firebasedatabase.app`
4. Make sure this matches the URL in `frontend/services/firebase.ts` (line 36)

### Step 3: Test in Browser Console

After refreshing your app, check the browser console for:

✅ **Good signs:**
- `✅ SkipOnFirebaseService: Firebase Realtime Database initialized`
- `🔌 SkipOnFirebase: Connection status: CONNECTED`
- `✅ SkipOnFirebase: Room verified in Firebase`
- `✅ SkipOnFirebase: Message verified in Firebase`

❌ **Bad signs:**
- `❌ SkipOnFirebase: Error code: PERMISSION_DENIED`
- `❌ SkipOnFirebase: Connection status: DISCONNECTED`
- `❌ SkipOnFirebase: Room was not created in Firebase!`

### Step 4: Check Browser Console Errors

Open browser DevTools (F12) → Console tab
Look for Firebase errors when sending messages

Common errors:
- **PERMISSION_DENIED**: Security rules not published or incorrect
- **NETWORK_ERROR**: Connection issue
- **DATABASE_NOT_FOUND**: Wrong database URL

### Step 5: Manual Test

Try writing data manually in Firebase Console:
1. Go to Realtime Database → Data tab
2. Click the `+` button
3. Add path: `skipOnRooms/test123`
4. Add data: `{ "status": "active" }`
5. If this works, Firebase is accessible
6. If this fails, check security rules

---

## Quick Fix Checklist

- [ ] Security rules published in Firebase Console
- [ ] Database URL matches in code
- [ ] Browser console shows "CONNECTED" status
- [ ] No PERMISSION_DENIED errors
- [ ] Can manually write to Firebase Console

