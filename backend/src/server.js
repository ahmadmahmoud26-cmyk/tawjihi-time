const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { runMigrations } = require('../../database/runMigrations');
const { initializeSuperAdmin, initializeDefaultGrades } = require('./utils/superAdminInit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

async function bootstrap() {
  await runMigrations();
  await initializeSuperAdmin();
  await initializeDefaultGrades();

  // Middleware
  app.use(helmet());
  app.use(morgan('combined'));
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/students', require('./routes/students'));
  app.use('/api/subjects', require('./routes/subjects'));
  app.use('/api/exams', require('./routes/exams'));
  app.use('/api/results', require('./routes/results'));
  app.use('/api/notes', require('./routes/notes'));
  app.use('/api/messages', require('./routes/messages'));
  app.use('/api/announcements', require('./routes/announcements'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/audit', require('./routes/audit'));

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Error:', err);

    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
      error: {
        status,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: {
        status: 404,
        message: 'Route not found'
      }
    });
  });

  app.listen(PORT, () => {
    console.log(`Tawjihi Time API Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap server:', error);
  process.exit(1);
});

module.exports = app;
