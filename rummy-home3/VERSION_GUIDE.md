# Version System Guide

## 🎯 **How the Version System Works**

### **Current Version: v1.0.0 (Build 15)**

The app now displays version information on all screens so you can easily see when the latest changes have loaded.

### **Version Display Locations:**
- ✅ **Login Screen** - Shows version at the top
- ✅ **Registration Screen** - Shows version at the top  
- ✅ **Home Screen** - Shows version prominently for both admin and player views
- ✅ **Forgot Password Screen** - Shows version at the top

### **Version Information Shown:**
- 🎮 **App Name**: Rummy Home
- 📱 **Version**: v1.0.0 (Build 15)
- 📅 **Last Updated**: 2024-12-19
- 📝 **Latest Change**: Updated to 6-digit passcodes for Supabase compatibility

## 🔄 **How to Update Version**

### **When to Update:**
- After making any code changes
- After fixing bugs
- After adding new features
- After updating documentation

### **How to Update:**
```bash
# Option 1: Simple increment
node update-version.js

# Option 2: With change description
node update-version.js "Fixed registration validation"
```

### **What Gets Updated:**
- ✅ `version.js` - Build number and date
- ✅ `package.json` - Build number
- ✅ All screens will show the new version

## 📱 **How to Verify Changes**

### **1. Check Version Display:**
- Open the app
- Look for the version number at the top of any screen
- If you see **Build 15**, you have the latest changes
- If you see an older build number, the changes haven't loaded

### **2. Force App Reload:**
```bash
# Clear cache and restart
npx expo start --clear
```

### **3. Check Multiple Screens:**
- Login screen should show the same version
- Home screen should show the same version
- All screens should be consistent

## 🎮 **Current Version Details**

### **Build 15 - v1.0.0**
- **Date**: 2024-12-19
- **Changes**: Updated to 6-digit passcodes for Supabase compatibility
- **Files Updated**: All authentication screens, reset password page

### **Previous Builds:**
- **Build 14**: Removed dev test accounts and functionality
- **Build 13**: Fixed reset password page with number keyboard
- **Build 12**: Added forgot password functionality
- **Build 11**: Removed SMS/phone authentication
- **Build 10**: Simplified to email-only authentication

## 🔧 **Version Files**

### **version.js**
```javascript
const APP_VERSION = {
  version: "1.0.0",
  build: 15, // This number increments with each change
  lastUpdated: "2024-12-19",
  changes: [
    "v1.0.0 (Build 15) - Updated to 6-digit passcodes for Supabase compatibility",
    // ... more changes
  ]
};
```

### **package.json**
```json
{
  "name": "rummy-home3",
  "version": "1.0.0",
  "build": 15,
  // ... rest of package.json
}
```

## 🚀 **Quick Commands**

### **Update Version:**
```bash
node update-version.js "Description of changes"
```

### **Check Current Version:**
```bash
# Look at the app screens
# Or check the files:
cat version.js | grep "build:"
cat package.json | grep '"build"'
```

### **Force Reload:**
```bash
npx expo start --clear
```

## 🎯 **Benefits**

### **For Development:**
- ✅ **Easy tracking** of changes
- ✅ **Quick verification** that updates loaded
- ✅ **Clear communication** about what changed
- ✅ **Simple version management**

### **For Testing:**
- ✅ **Immediate feedback** on app updates
- ✅ **No confusion** about which version is running
- ✅ **Easy debugging** of version-specific issues

### **For Users:**
- ✅ **Transparency** about app updates
- ✅ **Clear indication** of latest features
- ✅ **Professional appearance** with version info

## 📋 **Version Checklist**

### **Before Making Changes:**
- [ ] Note current build number
- [ ] Make your changes
- [ ] Test the changes work

### **After Making Changes:**
- [ ] Run `node update-version.js "Description"`
- [ ] Run `npx expo start --clear`
- [ ] Verify version number increased
- [ ] Test that changes are visible

### **For Each Screen:**
- [ ] Login screen shows new version
- [ ] Registration screen shows new version
- [ ] Home screen shows new version
- [ ] Forgot password shows new version

The version system makes it super easy to track changes and ensure you're always running the latest version! 🎮✨ 