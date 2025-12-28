# Apple Sign-In Troubleshooting Guide

## Still Getting `auth/operation-not-allowed` Error?

If you've enabled Apple sign-in but still see the error, follow these steps **in order**:

### Step 1: Double-Check Firebase Console

1. **Go to Firebase Console**: https://console.firebase.google.com/project/gingr-13c0c/authentication/providers
2. **Verify Apple is Enabled**:
   - Click **Authentication** → **Sign-in method** tab
   - Find **Apple** in the list
   - Click on **Apple** (opens a popup/modal)
   - **CRITICAL**: The toggle should be **ON (blue/green)**
   - **CRITICAL**: Scroll to the bottom and click **Save** button
   - Wait for confirmation that it's saved

3. **Verify Authorized Domains**:
   - Go to **Authentication** → **Settings** tab (NOT Sign-in method)
   - Scroll to **Authorized domains** section
   - Make sure `localhost` is in the list
   - If not, click **Add domain** → type `localhost` → **Add**

### Step 2: Wait for Propagation

**Firebase changes can take 5-10 minutes to propagate globally.** This is the most common issue!

- After enabling and saving, wait **at least 5-10 minutes**
- Firebase updates are not instant - they need to sync across all servers
- Don't test immediately after enabling

### Step 3: Clear All Caches

1. **Browser Cache**:
   - Mac: `Cmd + Shift + Delete` → Clear all cached files
   - Windows: `Ctrl + Shift + Delete` → Clear all cached files
   - Or use Incognito/Private mode

2. **Metro/Expo Cache** (if using Expo):
   ```bash
   # Stop your dev server
   # Then run:
   npx expo start -c
   # Or:
   rm -rf node_modules/.cache
   ```

3. **Hard Refresh**:
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`

### Step 4: Verify Project ID Matches

1. Check your Firebase Console URL: Should be `.../project/gingr-13c0c/...`
2. Check your app config in `frontend/services/firebase.ts`:
   - Should have: `projectId: 'gingr-13c0c'`
3. They must match exactly!

### Step 5: Test in Incognito Mode

Sometimes browser extensions or cached data interfere:
1. Open an **Incognito/Private window**
2. Navigate to your app
3. Try Apple sign-in
4. If it works in incognito, it's a cache issue

### Step 6: Check Browser Console

Open browser DevTools (F12) and look for:
- Any other Firebase errors
- Network errors
- CORS errors
- Check the console logs for Firebase project ID

### Step 7: Verify Firebase Config is Loading

In your browser console, you should see:
```
✅ Firebase config loaded: { projectId: 'gingr-13c0c', ... }
✅ Firebase initialized successfully
```

If you don't see these, Firebase might not be initializing correctly.

## Common Mistakes

### ❌ Mistake 1: Only Toggling, Not Saving
- **Wrong**: Toggle Enable ON, then close the popup
- **Right**: Toggle Enable ON, scroll down, click **Save** button

### ❌ Mistake 2: Testing Too Quickly
- **Wrong**: Enable, wait 30 seconds, test
- **Right**: Enable, wait 5-10 minutes, then test

### ❌ Mistake 3: Not Clearing Cache
- **Wrong**: Just refresh the page
- **Right**: Clear browser cache completely or use incognito

### ❌ Mistake 4: Wrong Project
- **Wrong**: Enabled in a different Firebase project
- **Right**: Make sure you're in project `gingr-13c0c`

## Still Not Working?

If you've done all the above and it's still not working:

1. **Check Firebase Console → Authentication → Users**:
   - Try signing in with Google first (to verify Firebase auth works)
   - If Google works but Apple doesn't, it's specifically an Apple config issue

2. **Check Firebase Console → Authentication → Sign-in method**:
   - Take a screenshot of the Apple provider settings
   - Verify the toggle is ON and shows "Enabled"

3. **Try a Different Browser**:
   - Sometimes browser-specific issues occur
   - Try Chrome, Firefox, or Safari

4. **Check Network Tab**:
   - Open DevTools → Network tab
   - Try Apple sign-in
   - Look for failed requests to Firebase
   - Check the error response

## Quick Verification Checklist

- [ ] Apple provider toggle is ON in Firebase Console
- [ ] Clicked **Save** button after enabling
- [ ] Waited 5-10 minutes after saving
- [ ] `localhost` is in Authorized domains
- [ ] Cleared browser cache completely
- [ ] Restarted dev server
- [ ] Tried in incognito mode
- [ ] Project ID matches: `gingr-13c0c`
- [ ] Firebase config logs show correct project ID

If all checked and still not working, the issue might be:
- Firebase propagation delay (wait longer)
- Browser-specific issue (try different browser)
- Network/firewall blocking Firebase requests

---

**Last Resort**: If nothing works, try disabling and re-enabling Apple sign-in in Firebase Console, then wait 10 minutes and test again.

