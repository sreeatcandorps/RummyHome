# Supabase Password Reset Configuration

## Current Issue
The password reset links are going to localhost instead of a proper web interface. This is because Supabase needs to be configured with the correct redirect URLs.

## Solution: Configure Supabase Dashboard

### 1. Go to Supabase Dashboard
1. Visit [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **URL Configuration**

### 2. Configure Site URL
Set the **Site URL** to:
```
http://localhost:8082
```

### 3. Configure Redirect URLs
Add these redirect URLs in the **Redirect URLs** section:

#### For Development (Use these exact URLs):
```
http://localhost:3000
http://localhost:19006
```

#### For Production (when you deploy):
```
https://your-app-domain.com
https://your-app-domain.com/auth/callback
```

### 4. Alternative: Use a Simple Web Page
Since Expo apps can't handle web redirects directly, create a simple web page:

#### Option A: Create a Simple HTML Page
Create a file called `reset-password.html` and host it on a simple web server:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Reset Password</title>
    <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
</head>
<body>
    <h1>Reset Your Password</h1>
    <p>Please enter your new password below:</p>
    <input type="password" id="password" placeholder="New Password">
    <button onclick="resetPassword()">Reset Password</button>
    
    <script>
        const supabaseUrl = 'YOUR_SUPABASE_URL'
        const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
        const supabase = supabase.createClient(supabaseUrl, supabaseKey)
        
        async function resetPassword() {
            const password = document.getElementById('password').value
            const { error } = await supabase.auth.updateUser({ password: password })
            if (error) {
                alert('Error: ' + error.message)
            } else {
                alert('Password updated successfully!')
            }
        }
    </script>
</body>
</html>
```

#### Option B: Use Supabase Auth UI
1. Install: `npm install @supabase/auth-ui-react @supabase/auth-ui-shared`
2. Create a simple React page for password reset
3. Host it on a service like Vercel, Netlify, or GitHub Pages

### 5. Update Redirect URL in Code
Once you have a web page, update the forgot password code:

```javascript
const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
  redirectTo: 'https://your-web-page.com/reset-password.html',
});
```

### 6. Test the Configuration
1. Try the forgot password flow again
2. Check that the reset link goes to your web page
3. Verify the password reset works end-to-end

## Quick Fix for Now

### Temporary Solution:
1. **Use the accepted URLs** in Supabase:
   ```
   http://localhost:3000
   http://localhost:19006
   ```

2. **Test the flow** - the reset link should now work
3. **Users can reset** their password through the web interface

### For Production:
1. **Deploy a simple web page** for password reset
2. **Update the redirect URL** to point to your web page
3. **Test thoroughly** before going live

## Current Workaround

Until you set up a proper web page, users can:

1. **Click the reset link** in their email
2. **Use the web interface** that Supabase provides
3. **Reset their password** through the browser
4. **Return to the app** and login with new password

## Security Note

Supabase sends reset emails even for non-existent emails as a security measure. This prevents attackers from determining which emails are registered in the system.

## Next Steps

1. **Add the accepted URLs** to Supabase (http://localhost:3000 and http://localhost:19006)
2. **Test the current flow** with these URLs
3. **Create a simple web page** for production
4. **Update redirect URL** when ready for production

The current implementation provides a good user experience with clear messaging about what to expect. 