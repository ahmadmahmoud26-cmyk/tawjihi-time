# 🚀 Tawjihi Time - Quick Start Guide

## Prerequisites

Before you start, make sure you have:

- **Node.js** 16+ ([Download](https://nodejs.org/))
- **PostgreSQL** 12+ ([Download](https://www.postgresql.org/download/))
- **Git** (optional, for version control)

## ⚡ Quick Setup (5 minutes)

### Step 1: Start PostgreSQL

**Windows:**
```powershell
# If installed as a Windows service
net start postgresql-x64-15
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

Open PostgreSQL CLI (psql) and run:

```sql
CREATE DATABASE tawjihi_time;
```

### Step 3: Run Setup Script

Navigate to the project root and run:

**Windows (PowerShell):**
```powershell
.\run-local.ps1
```

**macOS/Linux:**
```bash
chmod +x run-local.sh
./run-local.sh
```

This script will:
✅ Check prerequisites (Node.js, npm, PostgreSQL)
✅ Install dependencies (frontend & backend)
✅ Run database migrations
✅ Start both servers automatically

### Step 4: Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001/api/health

## 🔑 Default Admin Login

Email: `admin@tawjihi-time.edu.jo`
Password: `AdminPassword123!`

> ⚠️ **Security:** Change these credentials immediately in production!

## 📁 Project Structure

```
tawjihi-time/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── server.js       # Main Express server
│   │   ├── config/         # Database connection
│   │   ├── middleware/     # Auth & request middleware
│   │   ├── routes/         # API endpoints
│   │   └── utils/          # Helper utilities
│   ├── tests/              # Backend tests
│   ├── package.json
│   └── .env               # Environment variables
│
├── frontend/               # React/Vite SPA
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── utils/         # Utilities (API, auth)
│   │   └── styles/        # CSS styles
│   ├── package.json
│   ├── vite.config.js
│   └── .env              # Environment variables
│
├── database/               # Database management
│   ├── migrations/         # SQL migration files
│   └── runMigrations.js    # Migration runner
│
└── docs/                   # Documentation
    ├── README.md
    ├── API_DOCUMENTATION.md
    ├── SETUP_GUIDE.md
    ├── DEPLOYMENT_GUIDE.md
    └── QUICKSTART.md
```

## 🔧 Available Commands

### Backend

```bash
cd backend

# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start

# Run tests
npm test

# Run database migrations
npm run migrate

# Seed database with sample data
npm run seed
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📊 Database

The database includes:

- **Users** - Students, Admins, Super Admins
- **Subjects** - Educational subjects with hierarchy
- **Units** - Subject subdivisions
- **Lessons** - Lesson content
- **Sections** - Content sections within lessons
- **Exams** - Exam definitions
- **Exam Results** - Student exam scores
- **Student Notes** - Progress tracking
- **Messages** - Student-admin communication
- **Announcements** - Broadcast announcements
- **Notifications** - Real-time notifications
- **Audit Logs** - Activity tracking
- **Admin Permissions** - Role-based access control

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/student/login` - Student login
- `POST /api/auth/google/callback` - Google OAuth callback
- `POST /api/auth/complete-profile` - Complete student profile

### Admin Dashboard
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/users/list` - List admins
- `POST /api/admin/create-admin` - Create new admin

### Students
- `GET /api/students/list` - List students
- `GET /api/students/dashboard` - Student dashboard
- `GET /api/students/search` - Search students

### Subjects & Curriculum
- `GET /api/subjects` - List subjects
- `GET /api/subjects/:id` - Subject details
- `POST /api/subjects` - Create subject (admin)
- `GET /api/subjects/:id/units` - Subject units
- `GET /api/subjects/:id/units/:unitId/lessons` - Unit lessons

### Exams
- `GET /api/exams` - List exams
- `GET /api/exams/:id` - Exam details
- `POST /api/exams/:id/start` - Start exam attempt
- `POST /api/exams/:id/answer` - Submit answer
- `POST /api/exams/:id/finish` - Complete exam

### Results
- `GET /api/results` - Student results
- `GET /api/results/:id` - Result details

### Notes
- `GET /api/notes` - Student notes
- `POST /api/notes` - Create note
- `POST /api/notes/:id/reply` - Admin reply to note

### Messages
- `GET /api/messages` - Get messages
- `POST /api/messages` - Send message
- `GET /api/messages/public` - Public chat

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `POST /api/admin/promote-student` - Promote student to admin
- `POST /api/admin/demote-admin` - Demote admin

### Audit
- `GET /api/audit` - Activity logs

## ⚙️ Environment Variables

### Backend (.env)

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=tawjihi_time
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRY=7d

# Admin
SUPER_ADMIN_EMAIL=admin@tawjihi-time.edu.jo
SUPER_ADMIN_PASSWORD=AdminPassword123!

# CORS
CORS_ORIGIN=http://localhost:5173

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## 🧪 Testing

### Run All Tests
```bash
cd backend
npm test
```

### Run Specific Test Suite
```bash
npm test -- admin-permissions.test.js
```

## 📝 Features Implemented

### Authentication & Authorization ✅
- JWT-based authentication
- Role-based access control (Super Admin, Admin, Student)
- Permission system for admins
- Google OAuth integration (framework)
- Password hashing with bcryptjs

### Admin Features ✅
- Admin dashboard with live statistics
- Admin management and permissions
- Student management
- Subject/curriculum management
- Exam management
- Notes and replies
- Announcements
- Audit logging

### Student Features ✅
- Profile completion (grade & subject selection)
- Exam taking
- Result viewing
- Progress notes
- Messages and announcements
- Public chat

### Backend Features ✅
- Proper database schema (22 tables)
- Migration system
- Input validation
- Error handling
- Security middleware (helmet, CORS)
- Audit logging
- Soft deletion support

### Frontend Features ✅
- Role-based routing
- Login page (Admin/Student)
- Admin dashboard
- Student dashboard
- Exam interface
- Results page
- Profile completion
- Navigation with Arabic support

## 🐛 Troubleshooting

### PostgreSQL not running?
```bash
# Windows
net start postgresql-x64-15

# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### "Database does not exist" error?
```sql
-- Connect to PostgreSQL as admin and run:
CREATE DATABASE tawjihi_time;
```

### Port already in use?
```bash
# Change PORT in backend/.env or frontend/vite.config.js
# Then restart the servers
```

### npm dependencies issues?
```bash
# Clear cache and reinstall
cd backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

## 📚 Additional Resources

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Setup Guide](./SETUP_GUIDE.md) - Detailed setup instructions
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Production deployment
- [README](./README.md) - Project overview

## 💬 Support

For issues or questions:
1. Check the documentation
2. Review test files for usage examples
3. Check backend logs for errors
4. Check browser console for frontend errors

---

**Happy coding!** 🎓
