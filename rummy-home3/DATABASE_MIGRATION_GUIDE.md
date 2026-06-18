# Database Migration Guide - Update Existing Users to 4-Digit Passcode

## Overview
This guide will help you update all existing users' passwords to "0000" so they can use the new 4-digit passcode system.

## ⚠️ Important Notes
- This will change ALL existing users' passwords to "0000"
- Users will need to be notified about this change
- This is a one-time migration script

## Step 1: Get Your Supabase Service Role Key

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Settings > API**
   - Click on "Settings" in the left sidebar
   - Click on "API"

3. **Copy the Service Role Key**
   - Find the "service_role" key (NOT the anon key)
   - Copy the entire key (it starts with `eyJ...`)

## Step 2: Update the Migration Script

1. **Open the script file**
   - File: `rummy-home3/update-user-passwords.js`

2. **Replace the placeholder**
   - Find: `'YOUR_SERVICE_ROLE_KEY_HERE'`
   - Replace with your actual service role key

## Step 3: Install Dependencies

```bash
cd rummy-home3
npm install @supabase/supabase-js
```

## Step 4: Run the Migration Script

```bash
node update-user-passwords.js
```

## Step 5: Verify the Migration

1. **Check the console output**
   - Should show "✅ Updated password for user: [email]" for each user
   - Should show "Password update process completed!"

2. **Test with existing users**
   - Ask users to login with passcode: `0000`
   - They can then change their passcode in the app settings

## Alternative: Manual Update via Supabase Dashboard

If you prefer to update manually:

1. **Go to Supabase Dashboard > Authentication > Users**
2. **For each user:**
   - Click on the user
   - Click "Edit"
   - Set password to "0000"
   - Save changes

## User Communication

Send this message to your existing users:

```
🔐 Important: App Update - New 4-Digit Passcode System

We've updated the app to use a simpler 4-digit passcode system!

Your temporary passcode is: 0000

Please:
1. Login with your email and passcode: 0000
2. Go to Settings > Account Settings > Change Passcode
3. Set your own 4-digit passcode

This makes logging in much easier! 🎮
```

## Troubleshooting

### If the script fails:
1. **Check your service role key** - Make sure it's correct
2. **Check your Supabase URL** - Verify it matches your project
3. **Check permissions** - Service role key should have admin access

### If users can't login:
1. **Verify the migration ran successfully**
2. **Check if users are using the correct email**
3. **Ensure they're using passcode: 0000**

### If you need to rollback:
Unfortunately, there's no automatic rollback. You would need to:
1. Manually reset each user's password
2. Or ask users to use "Forgot Passcode" feature

## Security Considerations

- The passcode "0000" is temporary
- Users should change it immediately after login
- The new 4-digit system is suitable for casual game apps
- Consider adding rate limiting for login attempts

## Post-Migration Steps

1. **Monitor user feedback**
2. **Check if users are successfully changing their passcodes**
3. **Consider adding a "first login" prompt to change passcode**
4. **Update your app store description** to mention the new passcode system

## Success Indicators

✅ All users can login with passcode: 0000
✅ Users can change their passcodes successfully
✅ No login errors reported
✅ User satisfaction with the simpler system 