# QUICK START - Deploy Tawjihi Time to Production

## Step 1: Choose Your Hosting Platform

### Recommended: Railway
This project needs one persistent Node.js service for Express, SQLite, and the built frontend. Vercel static hosting is not suitable for this setup.

---

## ✅ BEFORE YOU DEPLOY - Prerequisites

1. **GitHub Repository:**
   - Push your code to GitHub
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/tawjihi-time.git
   git push -u origin main
   ```

2. **Security - Generate Session Secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # Copy the output - you'll need it soon
   ```

3. **Google OAuth (Optional but recommended):**
   - Go to https://console.cloud.google.com
   - Create OAuth 2.0 credentials
   - Copy Client ID and Secret

---

## 🚂 RAILWAY DEPLOYMENT

### Step 1: Create Railway Account
- Go to https://railway.app
- Sign in with GitHub

### Step 2: New Project
- Click "New Project"
- Select "Deploy from GitHub repo"
- Select your repository
- Select root directory (default)

### Step 3: Configure the service
- Use the repository root as the service root.
- Build command: `npm run build`
- Start command: `npm start`
- Add a Railway Volume and mount it at `/data` before the first production start.

### Step 4: Add private environment variables
In Railway → Service → Variables, set:

```
NODE_ENV=production
DB_PATH=/data/tawjihi.sqlite
SESSION_SECRET=[a long random secret]
SUPER_ADMIN_EMAIL=[your admin email]
SUPER_ADMIN_PASSWORD=[a unique strong password]
FRONTEND_URL=[the HTTPS Railway domain for this same service]
```

Railway supplies `PORT` automatically. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` only if Google login is configured.

### Step 5: Deploy and create the public domain
- Deploy the service and wait for the build and start logs to succeed.
- In Railway → Settings → Networking, create a public domain.
- Set `FRONTEND_URL` to that exact HTTPS domain and redeploy if required.
- Open the domain, then test student login, admin login, announcements, schedules, and both chat flows.

---

## 📝 REPLIT DEPLOYMENT

### Step 1: Import Project
- Go to https://replit.com
- Click "Create" → "Import from GitHub"
- Paste your repository URL

### Step 2: Add Secrets
In Replit Tools → Secrets (🔒):

```
NODE_ENV = production
FRONTEND_URL = [your-replit-url]
SESSION_SECRET = [generated secret]
SUPER_ADMIN_EMAIL = admin@example.com
SUPER_ADMIN_PASSWORD = [set a unique strong password in your host's private variables]
GOOGLE_CLIENT_ID = [optional]
GOOGLE_CLIENT_SECRET = [optional]
GOOGLE_CALLBACK_URL = [your-replit-url]/api/auth/google/callback
```

### Step 3: Run
- Click "Run"
- Replit provides automatic HTTPS URL
- Your site is live! 🎉

---

## ⚠️ AFTER DEPLOYMENT - CRITICAL STEPS

### 1. Protect the Super Admin account
- Set a unique `SUPER_ADMIN_EMAIL` and strong `SUPER_ADMIN_PASSWORD` before the first production start.
- Keep these values only in the hosting provider's private environment variables.

### 2. Test Google OAuth
- Try signing in as a student with Google
- Verify it works correctly

### 3. Test Public Chat
- Create a test student account
- Send a message in public chat
- Verify it appears for other students

### 4. Test Admin Functions
- Create a new admin user
- Test assigning permissions
- Test muting a student in chat

### 5: Set Up Initial Content
- Create academic stages (if needed)
- Create academic fields
- Create subjects
- Create units and lessons
- Create initial exams

---

## 🔍 TROUBLESHOOTING AFTER DEPLOYMENT

### Issue: "Cannot GET /"
**Solution:** Build failed. Check:
- Build output is in `dist/` folder
- All dependencies installed
- No build errors in logs

### Issue: API calls return 404
**Solution:** Backend not running. Check:
- `FRONTEND_URL` environment variable is correct
- CORS is configured properly
- Server is running on correct port

### Issue: "Session expired" on every page
**Solution:** Session secret issue. Check:
- `SESSION_SECRET` is set in environment
- `SESSION_SECRET` is not empty
- Cookie permissions are enabled

### Issue: Super Admin login fails
**Solution:** Database initialization issue. Check:
- Database initialized properly
- Super Admin email/password in environment
- Check server logs for errors

### Issue: Google OAuth not working
**Solution:** OAuth configuration issue. Check:
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- `GOOGLE_CALLBACK_URL` matches your domain
- Domain is whitelisted in Google Console

---

## 📊 MONITORING YOUR DEPLOYMENT

### Vercel
- Dashboard: https://vercel.com
- View logs: Settings → Function Logs
- Monitor: Insights tab

### Railway
- Dashboard: https://railway.app
- View logs: Your project → Logs tab
- Monitor: Metrics tab

### Replit
- View logs: Console tab (bottom)
- Monitor: Stats tab

---

## 🔒 SECURITY AFTER DEPLOYMENT

- [ ] Changed Super Admin password
- [ ] Set random SESSION_SECRET
- [ ] Enabled HTTPS (auto on Vercel/Railway/Replit)
- [ ] Configured Google OAuth (if using)
- [ ] Updated FRONTEND_URL for your domain
- [ ] Tested CORS with actual domain
- [ ] Created backup of database
- [ ] Set up monitoring/alerts
- [ ] Reviewed security settings
- [ ] Tested user authentication flows

---

## 📱 SHARE WITH STUDENTS

Once deployed, share this with your students:

```
Welcome to Tawjihi Time! 🎓

Website: https://your-domain.vercel.app

Login Instructions:
1. Visit the website
2. Click "Student Login"
3. Use Google Sign-in OR Email/Password
4. Complete your profile
5. Start learning!

For help, contact your administrator.
```

---

## 🎯 NEXT STEPS

1. ✅ Deploy to chosen platform
2. ✅ Test all features
3. ✅ Enroll your students
4. ✅ Upload course content
5. ✅ Create first assignments/exams
6. ✅ Launch to students!

---

## 🆘 NEED HELP?

- Check DEPLOYMENT.md for detailed guide
- Check README.md for API documentation
- Review error logs from your hosting platform
- Check GitHub Issues
- Verify all environment variables are set correctly

---

**You're just 5 minutes away from going live! 🚀**

Choose your platform above and follow the steps. Good luck!
