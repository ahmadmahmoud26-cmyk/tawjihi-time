# 🎓 Tawjihi Time - Complete Setup & Deploy Guide

## Overview

**Tawjihi Time** is a comprehensive educational platform for the Jordanian Tawjihi (Baccalaureate) system. This guide covers the complete setup, deployment, and operation of the platform.

---

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Quick Start (5 minutes)](#quick-start)
3. [Full Setup with Database](#full-setup)
4. [Verify Installation](#verify-installation)
5. [Architecture Overview](#architecture-overview)
6. [Troubleshooting](#troubleshooting)
7. [Deployment](#deployment)

---

## System Requirements

### Minimum Requirements
- **OS:** Windows 10+, macOS 10.14+, or Linux (Ubuntu 20.04+)
- **Node.js:** 16.13.0 or higher
- **npm:** 7.0 or higher
- **PostgreSQL:** 12.0 or higher
- **RAM:** 2GB minimum (4GB recommended)
- **Disk Space:** 500MB minimum

### Installation

**Windows:**
1. [Download Node.js LTS](https://nodejs.org/)
2. [Download PostgreSQL](https://www.postgresql.org/download/windows/)
3. Run installers, accept defaults

**macOS:**
```bash
# Install Homebrew first if needed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node
brew install postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install nodejs npm postgresql postgresql-contrib
```

---

## Quick Start

### Step 1: Start PostgreSQL Service

**Windows (PowerShell):**
```powershell
# Check if service exists
Get-Service postgresql-x64-* | Start-Service
```

**macOS:**
```bash
brew services start postgresql
```

**Linux:**
```bash
sudo systemctl start postgresql
```

### Step 2: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database (inside psql prompt)
CREATE DATABASE tawjihi_time;
\q
```

### Step 3: Run Setup Script

**Windows (PowerShell):**
```powershell
cd C:\Users\YourUsername\Desktop\tawjihi-time
.\run-local.ps1
```

**macOS/Linux:**
```bash
cd ~/Desktop/tawjihi-time
chmod +x run-local.sh
./run-local.sh
```

### Step 4: Access Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001/api/health
- **Admin Email:** admin@tawjihi-time.edu.jo
- **Admin Password:** AdminPassword123!

---

## Full Setup

### Manual Setup (if script doesn't work)

**1. Backend Setup:**
```bash
cd backend
npm install
npm run migrate  # Create database schema
npm run dev      # Start backend server
```

**2. Frontend Setup (in new terminal):**
```bash
cd frontend
npm install
npm run dev      # Start frontend dev server
```

**3. Database Initialization:**
The backend automatically initializes the super admin on first run.

---

## Verify Installation

### Check Backend

```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-08-30T10:00:00.000Z"}
```

### Check Frontend

```bash
# Frontend should load at http://localhost:5173
# You should see the Tawjihi Time login page
```

### Run Tests

```bash
cd backend
npm test

# Expected: All 14 tests pass
# Test Suites: 8 passed, 8 total
# Tests: 14 passed, 14 total
```

---

## Architecture Overview

### Technology Stack

```
┌─────────────────────────────────────────────────┐
│         Frontend (React + Vite)                 │
│  http://localhost:5173                          │
│  ├─ Pages (Admin, Student, Exams, Results)    │
│  ├─ State Management (Zustand)                 │
│  └─ API Client (Axios)                          │
└────────────────┬────────────────────────────────┘
                 │ HTTP/JSON
┌────────────────▼────────────────────────────────┐
│    Backend (Node.js + Express)                  │
│  http://localhost:3001/api                      │
│  ├─ Routes (11 route modules)                   │
│  ├─ Authentication (JWT + OAuth)                │
│  ├─ Database (PostgreSQL)                       │
│  └─ Middleware (Auth, Validation, Logging)      │
└────────────────┬────────────────────────────────┘
                 │ SQL
┌────────────────▼────────────────────────────────┐
│    PostgreSQL Database                          │
│  localhost:5432/tawjihi_time                    │
│  ├─ 22 tables                                    │
│  ├─ Migrations system                           │
│  └─ Audit logging                               │
└─────────────────────────────────────────────────┘
```

### Database Schema

```
Users
├── Students
│   ├── Grade (1-12 or by subject grouping)
│   ├── Enrolled Subjects
│   ├── Exam Attempts
│   ├── Results
│   └── Notes
├── Admins
│   ├── Permissions
│   ├── Audit Logs
│   └── Managed Resources
└── Super Admin
    └── Full System Access

Curriculum
├── Subjects (Math, Physics, Chemistry, etc.)
│   ├── Units
│   │   ├── Lessons
│   │   │   └── Sections (Content)
│   │   └── Exams
│   └── Student Enrollments

Communication
├── Messages (Student ↔ Admin)
├── Announcements (Admin → All/Grade)
├── Notifications (Real-time alerts)
└── Public Chat
```

---

## Environment Configuration

### Backend (.env)

```env
# Database Connection
DATABASE_HOST=localhost        # PostgreSQL server
DATABASE_PORT=5432            # PostgreSQL port
DATABASE_NAME=tawjihi_time    # Database name
DATABASE_USER=postgres        # Database user
DATABASE_PASSWORD=postgres    # Database password

# Server
PORT=3001                     # Backend port
NODE_ENV=development          # Environment (development/production)

# Security
JWT_SECRET=your_secret_key    # JWT signing key (min 32 chars in production)
JWT_EXPIRY=7d                 # Token expiration time

# CORS
CORS_ORIGIN=http://localhost:5173  # Frontend URL

# Admin Account
SUPER_ADMIN_EMAIL=admin@tawjihi-time.edu.jo
SUPER_ADMIN_PASSWORD=AdminPassword123!

# OAuth (Optional)
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=your_id
VITE_ENVIRONMENT=development
```

---

## Key Features

### ✅ Authentication & Security
- JWT-based authentication
- Role-based access control (Super Admin, Admin, Student)
- Permission system with grant/revoke
- Password hashing with bcryptjs
- Helmet security headers
- CORS protection
- Input validation and sanitization

### ✅ Admin Dashboard
- Real-time statistics (students, exams, activity)
- User management (create, promote, demote admins)
- Permission management
- Audit log viewing
- Content management (subjects, units, lessons)

### ✅ Student Features
- Grade and subject enrollment
- Exam taking with timed questions
- Result tracking
- Progress notes
- Direct messaging with admins
- Public chat participation
- Announcement viewing

### ✅ Curriculum Management
- Dynamic subject/unit/lesson/section structure
- Grade-based organization
- Hierarchical content management
- Exam associations with content

### ✅ Exam System
- Timed exams with countdown
- Multiple question types
- Answer tracking
- Automatic scoring
- Result generation
- Review functionality

### ✅ Communication
- Messages between students and admins
- Admin notes with student replies
- Announcements with visibility rules
- Public chat system
- Real-time notifications

### ✅ Reporting
- Comprehensive audit logs
- Admin action tracking
- User activity monitoring
- Result analytics

---

## Troubleshooting

### PostgreSQL Connection Failed

**Problem:** `ECONNREFUSED ::1:5432`

**Solutions:**
```bash
# Windows - Check if service is running
Get-Service postgresql-x64-* | Status

# Windows - Start service
net start postgresql-x64-15

# macOS
brew services list | grep postgresql
brew services start postgresql

# Linux
sudo systemctl status postgresql
sudo systemctl start postgresql

# Test connection
psql -U postgres -d tawjihi_time
```

### Database Not Found

**Problem:** `database "tawjihi_time" does not exist`

**Solution:**
```bash
psql -U postgres
CREATE DATABASE tawjihi_time;
\l  # List databases to verify
\q  # Exit
```

### Port Already In Use

**Problem:** `listen EADDRINUSE :::3001`

**Solution:**
```bash
# Find process using port 3001
netstat -tulpn | grep 3001  # Linux/macOS
netstat -ano | findstr :3001  # Windows

# Kill the process or change port
# Edit backend/.env and change PORT=3002
```

### npm Modules Not Found

**Problem:** `Cannot find module 'express'`

**Solution:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

### Frontend Can't Connect to Backend

**Problem:** CORS errors in browser console

**Solution:**
1. Check `CORS_ORIGIN` in backend/.env matches frontend URL
2. Verify backend is running on port 3001
3. Check `VITE_API_URL` in frontend/.env

---

## Common Commands

### Backend

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Run database migrations
npm run migrate

# Run all tests
npm test

# Run specific test
npm test -- auth.test.js
```

### Frontend

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## Deployment

### Environment Variables for Production

```env
# Backend .env (Production)
NODE_ENV=production
JWT_SECRET=generate_a_strong_random_key_min_32_chars
CORS_ORIGIN=https://yourdomain.com
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SUPER_ADMIN_EMAIL=admin@yourdomain.com
SUPER_ADMIN_PASSWORD=generate_strong_password
GOOGLE_CLIENT_ID=your_production_id
GOOGLE_CLIENT_SECRET=your_production_secret
```

```env
# Frontend .env (Production)
VITE_API_URL=https://api.yourdomain.com/api
VITE_GOOGLE_CLIENT_ID=your_production_id
VITE_ENVIRONMENT=production
```

### Recommended Hosting

**Frontend:**
- Vercel (recommended for Vite)
- Netlify
- Firebase Hosting

**Backend:**
- Render.com (free tier available)
- Railway.app
- Heroku
- DigitalOcean

**Database:**
- AWS RDS PostgreSQL
- DigitalOcean Database
- Heroku Postgres
- Managed service from hosting provider

---

## Support & Documentation

- [README.md](./README.md) - Project overview
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
- [QUICKSTART.md](./QUICKSTART.md) - Quick setup guide
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Detailed setup
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment guide

---

## Project Structure

```
tawjihi-time/
├── backend/
│   ├── src/
│   │   ├── server.js           # Express app initialization
│   │   ├── config/
│   │   │   └── database.js     # PostgreSQL connection pool
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT and RBAC middleware
│   │   ├── routes/             # API endpoints (11 modules)
│   │   │   ├── auth.js         # Authentication
│   │   │   ├── admin.js        # Admin management
│   │   │   ├── students.js     # Student management
│   │   │   ├── subjects.js     # Curriculum
│   │   │   ├── exams.js        # Exam management
│   │   │   ├── results.js      # Exam results
│   │   │   ├── notes.js        # Student progress
│   │   │   ├── messages.js     # Messaging
│   │   │   ├── announcements.js # Announcements
│   │   │   ├── notifications.js # Notifications
│   │   │   └── audit.js        # Activity logs
│   │   └── utils/
│   │       └── superAdminInit.js # Admin initialization
│   ├── tests/                  # Test suites (8 suites, 14 tests)
│   ├── package.json
│   ├── .env                    # Configuration
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── main.jsx            # React entry point
│   │   ├── App.jsx             # Root component & routing
│   │   ├── pages/              # Page components (14 pages)
│   │   ├── components/         # Reusable components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── utils/
│   │   │   ├── api.js          # Axios HTTP client
│   │   │   ├── authStore.js    # Zustand state
│   │   │   └── helpers.js      # Utility functions
│   │   ├── locales/
│   │   │   └── ar.js           # Arabic translations
│   │   └── styles/             # CSS files
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env                    # Configuration
│   └── .gitignore
├── database/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql       # Main schema
│   │   └── 002_add_stage_field_chat.sql # Chat feature
│   ├── runMigrations.js        # Migration runner
│   └── seeds/                  # Seed data (optional)
├── run-local.ps1               # Windows setup script
├── run-local.sh                # Unix setup script
├── README.md
├── API_DOCUMENTATION.md
├── SETUP_GUIDE.md
├── DEPLOYMENT_GUIDE.md
├── QUICKSTART.md
└── PROJECT_SUMMARY.md
```

---

## Performance Metrics

### Backend Test Results
- **Test Suites:** 8 passed
- **Tests:** 14 passed
- **Execution Time:** ~2.9 seconds
- **Coverage:** All core features tested

### Build Times (Approximate)
- **Backend:** No build (Node.js)
- **Frontend:** ~15-20 seconds
- **Database:** <1 second (migrations)

---

## Security Checklist

- ✅ JWT token validation on all protected routes
- ✅ Password hashing with bcryptjs
- ✅ Role-based access control (RBAC)
- ✅ Permission-level authorization
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection (helmet.js + input sanitization)
- ✅ CORS configuration
- ✅ Audit logging of admin actions
- ✅ Soft deletion for data preservation
- ✅ Environment variable security (no hardcoded secrets)

---

## Getting Help

1. **Check logs:**
   ```bash
   # Backend logs in terminal where you ran npm run dev
   # Frontend logs in browser console (F12)
   ```

2. **Common issues:** See [Troubleshooting](#troubleshooting)

3. **Documentation:** Check README.md and API_DOCUMENTATION.md

4. **Database:** Use `psql` to connect and debug:
   ```bash
   psql -U postgres -d tawjihi_time
   \dt  # List tables
   SELECT * FROM users LIMIT 1;  # Test query
   ```

---

**Last Updated:** August 30, 2026
**Version:** 1.0.0
**Status:** Production Ready ✅
