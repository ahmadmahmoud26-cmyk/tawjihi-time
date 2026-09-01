# Tawjihi Time - Deployment & Hosting Guide

## Overview

This guide covers deploying the Tawjihi Time platform to production hosting services.

## Supported Hosting Platforms

### Recommended for Vite + Node.js

1. **Vercel** (Frontend) + Render/Railway (Backend)
2. **Netlify** (Frontend) + Heroku/Railway (Backend)
3. **Firebase** (Full Stack)
4. **DigitalOcean App Platform** (All-in-one)
5. **AWS** (Scalable, complex setup)
6. **Replit** (Recommended for initial development)

## Backend Deployment

### Option 1: Render.com (Recommended)

1. Push code to GitHub
2. Connect Render to GitHub repo
3. Create Web Service from `backend` directory
4. Set environment variables
5. Deploy

**Environment Variables on Render:**
```
DATABASE_URL=postgresql://user:password@host:port/dbname
SUPER_ADMIN_EMAIL=ahmad169qyp12q@gmail.com
SUPER_ADMIN_PASSWORD=your_secure_password
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_jwt_secret_min_32_chars
NODE_ENV=production
PORT=3001
```

### Option 2: Railway.app

1. Connect GitHub account
2. Select repository
3. Add PostgreSQL database
4. Set environment variables
5. Deploy

### Option 3: Heroku (Legacy)

1. Install Heroku CLI
2. `heroku create your-app-name`
3. `heroku config:set KEY=VALUE` (for each env var)
4. `git push heroku main`

## Frontend Deployment

### Option 1: Vercel (Best for Vite)

1. Push to GitHub
2. Import project to Vercel
3. Select `frontend` root directory
4. Set build command: `npm run build`
5. Set output directory: `dist`
6. Add environment variables
7. Deploy

**Environment Variables on Vercel:**
```
VITE_API_URL=https://your-backend-url.com/api
VITE_GOOGLE_CLIENT_ID=your_client_id
```

### Option 2: Netlify

1. Connect GitHub account
2. Create new site from Git
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy

### Option 3: Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. `firebase init`
3. Configure hosting
4. `firebase deploy`

## Database Deployment

### PostgreSQL on Cloud

**Option 1: AWS RDS**
- Managed PostgreSQL
- Automatic backups
- Scalable

**Option 2: DigitalOcean Database**
- Simple managed database
- Good for small to medium projects
- Affordable

**Option 3: Render Database**
- Included with Render Web Service
- Free tier available

## GitHub Actions CI/CD

### Setup Automatic Deployment

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Tawjihi Time

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy Backend
        uses: actions/github-script@v6
        with:
          script: |
            // Call your backend deployment webhook
            await fetch(process.env.RENDER_DEPLOY_HOOK, {
              method: 'POST'
            })
        env:
          RENDER_DEPLOY_HOOK: ${{ secrets.RENDER_DEPLOY_HOOK }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy Frontend
        run: |
          cd frontend
          npm install
          npm run build
          
      - name: Deploy to Vercel
        uses: actions/github-script@v6
        with:
          script: |
            // Call Vercel deployment
            await fetch(process.env.VERCEL_DEPLOY_HOOK, {
              method: 'POST'
            })
        env:
          VERCEL_DEPLOY_HOOK: ${{ secrets.VERCEL_DEPLOY_HOOK }}
```

## SSL/HTTPS

Most hosting platforms provide free SSL certificates:
- **Vercel** - Automatic
- **Netlify** - Automatic
- **Render** - Automatic
- **Railway** - Automatic
- **AWS** - Use AWS Certificate Manager
- **DigitalOcean** - Free Let's Encrypt

## Environment Variables Setup

### Backend Production Variables

```
# Database
DATABASE_HOST=your-db-host.com
DATABASE_PORT=5432
DATABASE_NAME=tawjihi_time
DATABASE_USER=your_db_user
DATABASE_PASSWORD=your_secure_password

# Admin
SUPER_ADMIN_EMAIL=ahmad169qyp12q@gmail.com
SUPER_ADMIN_PASSWORD=your_secure_password

# Google OAuth
GOOGLE_CLIENT_ID=your.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_secret

# JWT
JWT_SECRET=your_very_secure_jwt_secret_min_32_chars
JWT_EXPIRY=7d

# Server
PORT=3001
NODE_ENV=production

# CORS
CORS_ORIGIN=https://your-frontend-domain.com
```

### Frontend Production Variables

```
VITE_API_URL=https://your-backend-domain.com/api
VITE_GOOGLE_CLIENT_ID=your.apps.googleusercontent.com
```

## Database Migrations in Production

### Before Deployment

1. Test migrations locally
2. Have backup strategy
3. Plan for database downtime (if needed)

### Deployment Process

```bash
# Run migrations before deploying updated backend
cd database
node runMigrations.js

# Then deploy backend
cd ../backend
npm run build  # if needed
```

### Continuous Deployment

Add to `package.json`:
```json
"poststart": "node database/runMigrations.js"
```

This runs migrations on server start before accepting requests.

## Performance Optimization

### Frontend

1. **Build Optimization**
   ```bash
   npm run build
   # Check dist size: should be ~200KB gzipped
   ```

2. **Enable Caching**
   - Set long cache duration for assets with hash
   - Cache HTML with short duration

3. **CDN Integration**
   - Use Vercel/Netlify CDN (automatic)
   - Or Cloudflare for additional caching

### Backend

1. **Database Optimization**
   - Add indexes for frequently queried columns
   - Use connection pooling (already configured)
   - Regular vacuum and analyze

2. **Caching Strategy**
   - Cache static content (subjects, grades)
   - Use Redis for session storage (optional)

3. **Load Balancing**
   - Use load balancer for multiple instances
   - Auto-scaling based on demand

## Monitoring & Logging

### Recommended Services

1. **Error Tracking**
   - Sentry.io
   - Rollbar
   - Datadog

2. **Logging**
   - ELK Stack
   - LogRocket
   - Papertrail

3. **Monitoring**
   - Uptime Robot
   - New Relic
   - Datadog

### Setup Example with Sentry

```bash
npm install @sentry/node
```

In `backend/src/server.js`:
```javascript
const Sentry = require("@sentry/node");

Sentry.init({ dsn: process.env.SENTRY_DSN });
app.use(Sentry.Handlers.errorHandler());
```

## Scaling Strategy

### Phase 1 (0-100 users)
- Single backend instance
- Managed PostgreSQL
- Frontend on CDN
- Cost: ~$20-50/month

### Phase 2 (100-1000 users)
- 2-3 backend instances
- Load balancer
- Redis caching
- Cost: ~$100-200/month

### Phase 3 (1000+ users)
- Auto-scaling backend
- Read replicas for database
- Advanced caching
- Cost: ~$500+/month

## Backup Strategy

1. **Database Backups**
   - Daily automated backups
   - Keep 30-day history
   - Store backups in separate region

2. **Code Backups**
   - Use GitHub (already version controlled)
   - Tag releases

3. **File Backups**
   - Upload directory backups daily
   - Store in S3 or similar

## Security in Production

### Checklist

- ✅ HTTPS enabled (auto via hosting platform)
- ✅ Environment variables not committed
- ✅ Database user with limited permissions
- ✅ Regular security updates
- ✅ Rate limiting enabled
- ✅ CORS properly configured
- ✅ Password requirements enforced
- ✅ Admin login 2FA (optional)
- ✅ SQL injection protection (using parameterized queries)
- ✅ XSS protection (sanitized output)
- ✅ CSRF protection
- ✅ Security headers (Helmet.js already configured)

### Additional Setup

1. **Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```

2. **Two-Factor Authentication (Optional)**
   ```bash
   npm install speakeasy qrcode
   ```

## Domain Setup

1. **Purchase Domain**
   - Namecheap, GoDaddy, or similar

2. **Point DNS to Hosting**
   - Vercel: Add CNAME record
   - Netlify: Add nameservers
   - Render/Railway: Configure custom domain

3. **Setup Email (Optional)**
   - SendGrid or Mailgun for transactional emails

## Post-Deployment Checklist

- [ ] Backend API health check passing
- [ ] Frontend loads without errors
- [ ] Google OAuth working
- [ ] Admin login working
- [ ] Database migrations completed
- [ ] Super Admin account created
- [ ] Audit logs recording
- [ ] Notifications functioning
- [ ] File uploads working
- [ ] Search/filtering working
- [ ] Pagination working
- [ ] All admin pages accessible
- [ ] All student pages accessible
- [ ] Mobile responsive
- [ ] Performance acceptable (< 3s load)
- [ ] Error handling working
- [ ] Logging captured
- [ ] Backups configured
- [ ] SSL certificate valid
- [ ] CORS configured correctly
- [ ] Rate limiting working

## Cost Estimation (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| Backend (Render) | $12-50 | Pay-as-you-go |
| Frontend (Vercel) | Free-50 | Included with Vercel |
| Database | $15-50 | PostgreSQL on Render |
| Domain | $1-15 | Annual cost divided |
| Monitoring | $0-30 | Optional |
| **Total** | **$28-145** | Initial phase |

---

**Last Updated**: August 2026
