const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

const pool = require('../src/config/database');

function createAppWithAuth() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/students', require('../src/routes/students'));
  return app;
}

describe('manual student authentication', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('student can login with manually assigned email and password', async () => {
    const passwordHash = await bcrypt.hash('StrongPass123', 10);
    pool.query.mockResolvedValue({
      rows: [{
        id: 7,
        email: 'student@example.com',
        password_hash: passwordHash,
        role: 'student',
        account_status: 'active',
        name: 'Student User',
        grade_id: 1
      }]
    });

    const app = createAppWithAuth();
    const response = await request(app)
      .post('/api/auth/student/login')
      .send({ email: 'student@example.com', password: 'StrongPass123' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user.role).toBe('student');
    expect(response.body.firstTime).toBe(false);
  });

  test('first-time student login sends onboarding flag when profile is incomplete', async () => {
    const passwordHash = await bcrypt.hash('StrongPass123', 10);
    pool.query.mockResolvedValue({
      rows: [{
        id: 9,
        email: 'newstudent@example.com',
        password_hash: passwordHash,
        role: 'student',
        account_status: 'active',
        name: 'New Student',
        grade_id: null
      }]
    });

    const app = createAppWithAuth();
    const response = await request(app)
      .post('/api/auth/student/login')
      .send({ email: 'newstudent@example.com', password: 'StrongPass123' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.firstTime).toBe(true);
    expect(response.body.user.grade_id).toBeNull();
  });

  test('student can login with Google account and is created on first login', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 15,
          name: 'Google Student',
          email: 'google.student@example.com',
          role: 'student',
          account_status: 'active',
          profile_picture: 'https://example.com/avatar.png'
        }]
      });

    const app = createAppWithAuth();
    const response = await request(app)
      .post('/api/auth/google/callback')
      .send({
        tokenId: 'google-token-123',
        googleData: {
          id: 'google-user-789',
          name: 'Google Student',
          email: 'google.student@example.com',
          picture: 'https://example.com/avatar.png'
        }
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.firstTime).toBe(true);
    expect(response.body.user.email).toBe('google.student@example.com');
  });

  test('admin can create a student with a manually set email and password', async () => {
    const adminToken = jwt.sign({ id: 1, email: 'ahmad169qyp12q@gmail.com', role: 'super_admin' }, process.env.JWT_SECRET || 'default_secret');

    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'ahmad169qyp12q@gmail.com', role: 'super_admin', account_status: 'active' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 8, name: 'Manual Student', email: 'manualstudent@example.com', role: 'student' }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createAppWithAuth();
    const response = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Manual Student',
        email: 'manualstudent@example.com',
        password: 'StudentPass123',
        gradeId: 1
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.student.email).toBe('manualstudent@example.com');
  });
});
