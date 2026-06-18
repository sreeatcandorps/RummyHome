# Troubleshooting Guide - Fixing Current Issues

## 🚨 **Current Issues & Solutions**

### **Issue 1: Registration Password Validation Error**
**Problem**: Registration shows "password should be at least 6 characters" error
**Cause**: Supabase has a default password policy requiring minimum 6 characters
**Solution**: We need to either:
1. **Change Supabase password policy** (recommended)
2. **Use 6-digit passcodes** instead of 4-digit

### **Issue 2: No Back Button in Registration**
**Problem**: Can't navigate back from registration screen
**Solution**: ✅ **FIXED** - Added back button and "Sign In Instead" link

## 🔧 **Step-by-Step Fixes**

### **Step 1: Fix Supabase Password Policy**

#### **Option A: Change Supabase Settings (Recommended)**
1. **Go to Supabase Dashboard**
2. **Navigate to Authentication** → **Settings**
3. **Find "Password Policy" section**
4. **Change minimum length from 6 to 4**
5. **Save changes**

#### **Option B: Use 6-Digit Passcodes (Alternative)**
If you can't change the Supabase policy, we can update the app to use 6-digit passcodes:
- Update validation to require 6 digits
- Update all passcode fields to accept 6 digits

### **Step 2: Test Registration**

#### **Manual Testing:**
1. **Go to the app registration screen**
2. **Try registering with different password lengths**
3. **Note any error messages**
4. **Verify the registration process works**

## 📋 **Quick Fix Checklist**

### **For Registration Issues:**
- [ ] **Check Supabase password policy** (min 6 → min 4)
- [ ] **Test registration** with 4-digit passcode
- [ ] **Verify back button** works in registration
- [ ] **Test "Sign In Instead"** link

### **For Reset Password Issues:**
- [ ] **Upload reset-password.html** to GitHub Pages
- [ ] **Update Supabase redirect URLs**
- [ ] **Test forgot password** flow
- [ ] **Verify number keyboard** appears

## 🔍 **Debugging Steps**

### **1. Check Supabase Logs:**
- Go to **Supabase Dashboard** → **Logs**
- Look for authentication errors
- Check password policy violations

### **2. Test Registration Manually:**
- Try registering with different password lengths
- Note exact error messages
- Check if 4-digit passwords work

### **3. Verify Authentication:**
- Check if accounts exist in Supabase
- Verify email confirmation status
- Test login with registered accounts

## 🎯 **Expected Results**

### **After Fixing Password Policy:**
- ✅ **4-digit passcodes** accepted during registration
- ✅ **No "6 character" errors**
- ✅ **Registration works** smoothly

### **After UI Updates:**
- ✅ **Back button** works in registration
- ✅ **Navigation** flows properly
- ✅ **User experience** improved

## 🚀 **Quick Start Commands**

### **1. Test Current State:**
```bash
# Start the app
npx expo start --clear

# Test registration and login
```

### **2. Fix Password Policy:**
```bash
# Option A: Change Supabase settings manually
# Option B: Update app to use 6-digit passcodes
```

### **3. Test Everything:**
```bash
# Start the app
npx expo start --clear

# Test registration and navigation
```

## 📞 **If Issues Persist**

### **Common Problems:**
1. **Supabase policy not changed** - Check Authentication settings
2. **App cache issues** - Use `--clear` flag with expo start
3. **Network issues** - Check internet connection

### **Next Steps:**
1. **Check Supabase logs** for error details
2. **Update app code** if needed
3. **Test thoroughly** before proceeding

The app should now work smoothly without any dev test account dependencies! 🔧 