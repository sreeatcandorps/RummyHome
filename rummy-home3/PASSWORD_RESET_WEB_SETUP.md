# Password Reset Web Page Setup

## Quick Solution for Password Reset

Since the localhost redirect isn't working, we need to host a simple web page that can handle password resets.

## Option 1: Host on GitHub Pages (Free & Easy)

### 1. Create a GitHub Repository
1. Go to [GitHub](https://github.com) and create a new repository
2. Name it something like `rummy-password-reset`

### 2. Upload the HTML File
1. Upload the `public/reset-password.html` file to your repository
2. Rename it to `index.html` (so it becomes the main page)

### 3. Enable GitHub Pages
1. Go to your repository settings
2. Scroll down to "Pages" section
3. Select "Deploy from a branch"
4. Choose "main" branch and "/ (root)" folder
5. Click "Save"

### 4. Get Your URL
Your password reset page will be available at:
```
https://your-username.github.io/rummy-password-reset
```

## Option 2: Host on Netlify (Free & Easy)

### 1. Create Netlify Account
1. Go to [Netlify](https://netlify.com) and sign up
2. Click "New site from Git"

### 2. Connect Your Repository
1. Connect your GitHub account
2. Select your repository
3. Deploy the site

### 3. Get Your URL
Your password reset page will be available at:
```
https://your-site-name.netlify.app
```

## Option 3: Host on Vercel (Free & Easy)

### 1. Create Vercel Account
1. Go to [Vercel](https://vercel.com) and sign up
2. Click "New Project"

### 2. Import Your Repository
1. Import your GitHub repository
2. Deploy the project

### 3. Get Your URL
Your password reset page will be available at:
```
https://your-project-name.vercel.app
```

## Update the HTML File

Before hosting, you need to update the Supabase credentials in the HTML file:

### 1. Find Your Supabase Credentials
1. Go to your Supabase dashboard
2. Go to Settings → API
3. Copy your "Project URL" and "anon public" key

### 2. Update the HTML File
Replace these lines in the HTML file:
```javascript
const supabaseUrl = 'https://your-project.supabase.co'
const supabaseKey = 'your-anon-key'
```

With your actual credentials:
```javascript
const supabaseUrl = 'https://your-actual-project-id.supabase.co'
const supabaseKey = 'your-actual-anon-key'
```

## Update Supabase Configuration

### 1. Go to Supabase Dashboard
1. Authentication → URL Configuration

### 2. Update Redirect URLs
Add your hosted URL:
```
https://your-username.github.io/rummy-password-reset
```
or
```
https://your-site-name.netlify.app
```
or
```
https://your-project-name.vercel.app
```

### 3. Update Site URL
Set the Site URL to your hosted URL as well.

## Update the App Code

Once you have your hosted URL, update the forgot password code:

```javascript
const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
  redirectTo: 'https://your-hosted-url.com',
});
```

## Test the Flow

1. **Try forgot password** in your app
2. **Click the reset link** in your email
3. **Should open your hosted page** for password reset
4. **Reset password** and return to app

## Security Notes

- ✅ **HTTPS required** for production
- ✅ **Valid Supabase session** required
- ✅ **Password validation** included
- ✅ **Error handling** implemented

## Quick Start (Recommended)

1. **Use GitHub Pages** - it's the easiest
2. **Upload the HTML file** to a new repository
3. **Enable GitHub Pages** in settings
4. **Update Supabase** with your GitHub Pages URL
5. **Test the flow**

This will give you a working password reset system that users can access from their email links! 