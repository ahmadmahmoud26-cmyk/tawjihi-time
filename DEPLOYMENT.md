# Tawjihi Time - Deployment Guide

> **Important:** This app is a full-stack Express + SQLite application. Do not deploy it as a Vite-only static site. Use a Node host with persistent disk/volume and serve the built frontend through Express; Railway steps are recommended for this repository.

## Quick Start Deployment

### Recommended: Deploy to Railway

1. **Connect your GitHub repository:**
   - Go to https://railway.app
   - Create new project → Import from GitHub
   - Select your repository

2. **Configure the Node service:**
   - Build command: `npm run build`
   - Start command: `npm start`
   - Attach a persistent volume mounted at `/data`.
   - Set `DB_PATH=/data/tawjihi.sqlite`.

3. **Configure private environment variables:**
   - Set `NODE_ENV=production`, `SESSION_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, and `FRONTEND_URL`.
   - Railway supplies `PORT` automatically.
   - Set Google OAuth variables only if Google login is used.

4. **Deploy and create a public domain:**
   - Deploy from the GitHub repository.
   - Create a Railway public domain, set `FRONTEND_URL` to that HTTPS URL, then redeploy.

## Production Configuration

### Before Deploying

1. **Generate Session Secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Set up Google OAuth (if using):**
   - Create OAuth app at https://console.cloud.google.com
   - Add authorized redirect URIs:
     - `https://yourdomain.com/api/auth/google/callback`
   - Copy Client ID and Secret

3. **Update Callback URLs:**
   - Replace all `localhost:3001` references
   - Replace all `localhost:5173` references
   - Use your actual production domain

### Environment Variables

**Critical Variables (Must Set):**
- `FRONTEND_URL`: Your production frontend URL
- `SESSION_SECRET`: Randomly generated secure string
- `SUPER_ADMIN_EMAIL`: Super admin email
- `SUPER_ADMIN_PASSWORD`: Super admin password (hashed on first run)
- `NODE_ENV`: Set to `production`

**Optional Variables:**
- `GOOGLE_CLIENT_ID`: For Google OAuth login
- `GOOGLE_CLIENT_SECRET`: For Google OAuth login
- `GOOGLE_CALLBACK_URL`: OAuth redirect URL

### Database Setup

The application uses SQLite by default with file-based storage at `./data/tawjihi.sqlite`.

For production hosting platforms:
- **Vercel**: Use `/tmp` directory (ephemeral, not persistent)
- **Railway**: Use persistent volume or PostgreSQL
- **Replit**: Data persists automatically

To use PostgreSQL instead of SQLite:
1. Install `pg` package: `npm install pg`
2. Modify `server/db.js` to use PostgreSQL
3. Set `DATABASE_URL` environment variable

## GitHub Actions CI/CD Setup

The `.github/workflows/deploy.yml` file includes automated build checks.

### Enable Deployment Automation

1. **For Vercel:**
   - No additional setup needed - Vercel auto-deploys on main branch

2. **For Railway:**
   - Add `RAILWAY_TOKEN` to GitHub Secrets
   - Uncomment Railway deployment in workflow

3. **For Netlify:**
   - Add `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` to GitHub Secrets
   - Uncomment Netlify deployment in workflow

## Post-Deployment Steps

1. **Verify Deployment:**
   - Visit your public URL
   - Check that assets load (CSS, JS, images)
   - Test login functionality

2. **Initialize Super Admin:**
   - Application auto-creates Super Admin on first run
   - Use credentials from `.env` to login at `/admin/login`

3. **Update Google OAuth:**
   - Add your production domain to Google OAuth approved list
   - Test Google Sign-in on production

4. **Enable HTTPS:**
   - Vercel/Railway/Replit all provide automatic HTTPS
   - All cookies are marked as secure in production
   - Force HTTPS in your domain settings

5. **Set up Backups:**
   - Database is stored in `./data/tawjihi.sqlite`
   - Set up automated backups depending on your platform

## Troubleshooting

### Issue: Assets return 404
**Solution:** Ensure build output is in `dist/` directory and server serves static files correctly.

### Issue: API calls fail with CORS error
**Solution:** Update `FRONTEND_URL` environment variable to match your actual domain.

### Issue: Database not persisting
**Solution:** Platform-specific. Use volumes for persistent storage or switch to cloud database.

### Issue: Super Admin can't login
**Solution:** 
- Check `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in environment
- Database may not have initialized - restart the server

### Issue: Google OAuth fails
**Solution:**
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Ensure `GOOGLE_CALLBACK_URL` matches your domain
- Add domain to Google OAuth authorized list

## Monitoring and Maintenance

1. **Health Check:**
   - Endpoint: `https://yourdomain.com/health`
   - Returns: `{ok: true, message: "Tawjihi Time is running"}`

2. **Logs:**
   - Check platform logs for errors
   - Look for database connection issues
   - Monitor authentication failures

3. **Database Cleanup:**
   - Soft-deleted records use `deletedAt` field
   - Consider archiving old chat messages periodically
   - Monitor database size on file-based systems

## Performance Tips

1. **Enable Caching:**
   - Use browser caching headers
   - Cache static assets for 1 year
   - Cache API responses as needed

2. **Optimize Database:**
   - Add indexes on frequently queried columns
   - Paginate large result sets
   - Use connection pooling for PostgreSQL

3. **Monitor Performance:**
   - Use platform monitoring tools
   - Set up uptime alerts
   - Monitor response times

## Security Checklist

- [ ] Super Admin password is strong and random
- [ ] SESSION_SECRET is random and unique
- [ ] All secrets are in environment variables (NOT in code)
- [ ] HTTPS is enabled (automatic on Vercel/Railway/Replit)
- [ ] CORS origin is set to your actual domain
- [ ] Database backups are configured
- [ ] Google OAuth is optional and properly configured
- [ ] Rate limiting is considered for production
- [ ] Input validation is in place
- [ ] SQL injection protection (using parameterized queries)
- [ ] XSS protection (via Helmet)
- [ ] CSRF protection for state-changing operations

## Next Steps After Deployment

1. Share the public URL with users
2. Test all major user flows
3. Create first admin users via Super Admin panel
4. Set up educational content
5. Enroll students
6. Test student login and course access
7. Configure announcements
8. Set up exams and assignments

For questions or issues, check the GitHub repository or create an issue.
