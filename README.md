# Tawjihi Time - الوقت الدراسي

A complete, production-ready educational platform built specifically for Jordanian Tawjihi students.

**Website:** [Your Production URL] (To be configured)

## Features

✨ **Student Platform:**
- 🔐 Secure authentication (Google OAuth + Email/Password)
- 📚 Complete curriculum management with subjects, units, lessons, and sections
- ✏️ Student notes with admin replies
- 💬 Public chat system for students (with admin moderation)
- 📝 Exams and quizzes system
- 📊 Results tracking and performance predictions
- 📅 Weekly schedule management
- 📢 Announcements system
- 🔔 Real-time notifications
- 📱 Fully responsive design (mobile, tablet, desktop)

🛡️ **Admin Platform:**
- 👥 Complete student management
- 📋 Role-based access control (RBAC) with granular permissions
- 🎓 Academic stages and fields management
- 📚 Educational content creation and management
- ✅ Exam creation and student performance tracking
- 💬 Student communication and chat moderation
- 📊 Results and statistics
- 📝 Audit logs for all administrative actions
- 🔑 Super Admin panel for administrator management

🚀 **Technical Highlights:**
- Built with React + Vite for optimal performance
- Express.js backend with SQLite database
- Secure session management and password hashing
- Production-ready deployment guides
- GitHub Actions CI/CD integration
- RTL (Right-to-Left) support for Arabic
- Modern, professional UI design

## Quick Start

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/tawjihi-time.git
   cd tawjihi-time
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Set up environment variables** (edit `.env`):
   ```
   PORT=3001
   SESSION_SECRET=your-random-secret-here
   SUPER_ADMIN_EMAIL=admin@example.com
   SUPER_ADMIN_PASSWORD=replace-with-a-unique-strong-password
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   - **Student Dashboard:** http://localhost:5173
   - **Admin Login:** http://localhost:5173/admin/login
   - **API Server:** http://localhost:3001

### Super Admin Login

The initial Super Admin is created from `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in your private environment configuration. Never commit real credentials or `.env` to Git.

## Project Structure

```
tawjihi-time/
├── src/                    # Frontend React application
│   ├── App.jsx            # Main application component
│   ├── main.jsx           # React DOM entry point
│   └── index.css           # Global styles
├── server/                 # Backend Express server
│   ├── index.js           # Main server file
│   ├── db.js              # Database initialization
│   └── init.js            # Database schema and initialization
├── public/                 # Static assets
├── data/                   # SQLite database (created on first run)
├── .github/workflows/      # GitHub Actions CI/CD
├── vite.config.js         # Vite configuration
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variables template
└── DEPLOYMENT.md          # Production deployment guide
```

## Technology Stack

- **Frontend:**
  - React 18.3
  - React Router 6.28
  - Vite 5.4 (build tool)

- **Backend:**
  - Express.js 4.21
  - Node.js 18+

- **Database:**
  - SQLite 3 (default)
  - Can be configured for PostgreSQL

- **Authentication:**
  - Passport.js with Google OAuth
  - bcryptjs for password hashing
  - express-session for session management

- **Security:**
  - Helmet.js for HTTP headers
  - CORS for cross-origin requests
  - Password hashing with bcryptjs
  - Parameterized queries for SQL injection prevention

## Available Scripts

### Development
```bash
npm run dev              # Start dev server (frontend + backend)
npm run dev:server      # Start backend only
npm run dev:client      # Start frontend only
```

### Production
```bash
npm run build           # Build React frontend
npm run start:prod      # Start production server
```

### Testing
```bash
npm test                # Run tests (if configured)
npm run lint            # Run linter (if configured)
```

## Database

### SQLite (Default)
The application uses SQLite by default with file-based storage at `./data/tawjihi.sqlite`.

**Pros:**
- No external database needed
- Easy to set up and deploy
- Good for small to medium deployments

**Cons:**
- Limited concurrent access
- Not ideal for very large datasets

### PostgreSQL (Optional)
To use PostgreSQL:
1. Install PostgreSQL client: `npm install pg`
2. Update `server/db.js` to use `pg` instead of `better-sqlite3`
3. Set `DATABASE_URL` environment variable

## User Roles

### 1. Student
- View curriculum and educational content
- Take exams and view results
- Write and receive notes with admins
- Participate in public chat (if not muted)
- View announcements and schedules

### 2. Admin
- Manage students and their progress
- Create and manage educational content
- Create exams and view results
- Reply to student notes
- Manage announcements
- Moderate public chat (mute/unmute students)
- **Limited permissions** - can only access features granted by Super Admin

### 3. Super Admin
- Full access to all features
- Create and manage Admins
- Grant/revoke Admin permissions
- All capabilities of regular Admins
- **Only one Super Admin** per instance

## Environment Variables

### Required
- `PORT` - Server port (default: 3001)
- `SESSION_SECRET` - Random secret for sessions
- `SUPER_ADMIN_EMAIL` - Super Admin email
- `SUPER_ADMIN_PASSWORD` - Super Admin password
- `NODE_ENV` - Environment (development/production)

### Optional
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret
- `GOOGLE_CALLBACK_URL` - Google OAuth callback URL
- `FRONTEND_URL` - Production frontend URL
- `DB_PATH` - Custom database path

## API Endpoints

### Authentication
- `POST /api/auth/login` - Student login
- `POST /api/admin/login` - Admin login
- `GET /api/auth/session` - Get current session
- `POST /api/auth/logout` - Logout
- `GET /api/auth/google` - Google OAuth

### Student Resources
- `GET /api/student/curriculum` - Get assigned subjects
- `GET /api/student/exams` - Get available exams
- `GET /api/student/results` - Get exam results
- `GET /api/student/notes` - Get student notes
- `POST /api/student/notes` - Create note
- `GET /api/student/progress` - Get progress data
- `GET /api/notifications` - Get notifications
- `GET /api/public-chat/messages` - Get public chat
- `POST /api/public-chat/message` - Send chat message

### Admin Resources
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/students` - List students
- `GET /api/admin/subjects` - List subjects
- `GET /api/admin/exams` - List exams
- `GET /api/admin/results` - Get all results
- And many more...

See the source code for complete API documentation.

## Production Deployment

The application is production-ready and can be deployed to:
- **Vercel** (Recommended for frontend)
- **Railway** (Good for full-stack)
- **Replit** (Easy setup)
- **Self-hosted servers**

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.

### Quick Deploy Checklist

- [ ] Configure environment variables
- [ ] Generate secure SESSION_SECRET
- [ ] Set Super Admin credentials
- [ ] Configure Google OAuth (optional)
- [ ] Set FRONTEND_URL for production domain
- [ ] Run `npm run build`
- [ ] Test production build locally
- [ ] Deploy to hosting platform
- [ ] Verify HTTPS is enabled
- [ ] Test all major user flows
- [ ] Set up automated backups
- [ ] Monitor application logs

## Security

### Best Practices Implemented

✅ **Authentication:**
- Google OAuth 2.0 support
- Secure password hashing with bcryptjs
- Session-based authentication
- Secure cookies (httpOnly, sameSite)

✅ **Authorization:**
- Role-Based Access Control (RBAC)
- Permission-based feature access
- Backend validation of all permissions
- Super Admin protection

✅ **Data Protection:**
- SQL injection prevention (parameterized queries)
- XSS protection (Helmet.js)
- CORS configuration
- Secure headers
- Input validation

✅ **Secrets Management:**
- No secrets in source code
- Environment variables for configuration
- Password hashing before storage
- OAuth secrets never exposed

### Security Checklist for Production

- [ ] Change default Super Admin credentials
- [ ] Generate random SESSION_SECRET
- [ ] Enable HTTPS/TLS
- [ ] Configure secure cookies
- [ ] Set up database backups
- [ ] Enable rate limiting
- [ ] Monitor access logs
- [ ] Regular security updates
- [ ] Secure Google OAuth keys
- [ ] Validate all user inputs

## Performance

The application is optimized for performance:
- **Frontend:** Vite's fast build system, code splitting, lazy loading
- **Backend:** Efficient database queries, pagination, caching
- **Database:** Indexed queries, soft deletes for archival
- **Deployment:** CDN-ready, gzip compression, browser caching

## Troubleshooting

### Database Lock Error
If you see SQLite database lock error:
```bash
# This is normal for SQLite under high concurrent access
# Consider switching to PostgreSQL for production
```

### CORS Errors
- Check `FRONTEND_URL` environment variable
- Ensure it matches your actual domain
- Verify backend CORS configuration

### Slow Performance
- Check database queries with explain
- Enable query result caching
- Paginate large result sets
- Use CDN for static assets

### Login Issues
- Verify session secret is set
- Check browser cookies are enabled
- Clear cookies and try again
- Check application logs

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and proprietary. All rights reserved.

## Support

For issues, questions, or suggestions:
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment help
- Review the source code comments
- Check GitHub issues
- Create a new issue for bugs

## Roadmap

Future enhancements:
- [ ] Mobile app (React Native)
- [ ] Video lesson support
- [ ] Assignment submission system
- [ ] Gamification (badges, leaderboards)
- [ ] Parent portal
- [ ] Teacher accounts
- [ ] Advanced analytics
- [ ] Multi-language support
- [ ] Dark mode UI
- [ ] Voice/video chat

## Credits

Built with ❤️ for Jordanian Tawjihi students.

---

**Ready to deploy?** See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment instructions.

**Ready to develop?** Run `npm run dev` to start coding!

**Questions?** Check the source code or create an issue.

Tawjihi Time - Empowering Jordanian Students 🎓
