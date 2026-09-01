const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

const pool = require('../src/config/database');
const studentsRouter = require('../src/routes/students');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/students', studentsRouter);
  return app;
}

describe('student schedules access control', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('student dashboard returns the stage selected by the admin', async () => {
    const token = jwt.sign({ id: 7, email: 'student@example.com', role: 'student' }, process.env.JWT_SECRET || 'default_secret');
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 7, name: 'Student', grade_id: 1, stage_name: '2009 نظامي', field_name: 'صحي' }] })
      .mockResolvedValueOnce({ rows: [{ total: 3 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ unread: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app)
      .get('/api/students/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.dashboard.student.stage_name).toBe('2009 نظامي');
    expect(response.body.dashboard.student.field_name).toBe('صحي');
  });

  test('student can only access their own schedule', async () => {
    const token = jwt.sign({ id: 7, email: 'student@example.com', role: 'student' }, process.env.JWT_SECRET || 'default_secret');

    pool.query.mockResolvedValueOnce({ rows: [{ id: 7, role: 'student' }] });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 7, student_id: 7, image_url: 'https://example.com/a.png', file_name: 'a.png' }] });
    const app = createApp();

    const response = await request(app)
      .get('/api/students/8/schedules')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body.error.message).toMatch(/لا يمكنك|private|other|جداول طالب آخر/i);
  });

  test('admin can upload schedule for a chosen student', async () => {
    const token = jwt.sign({ id: 1, email: 'admin@example.com', role: 'admin' }, process.env.JWT_SECRET || 'default_secret');

    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, role: 'admin', account_status: 'active' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 77 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5, role: 'student' }] })
      .mockResolvedValueOnce({ rows: [{ id: 99, student_id: 5, image_url: 'https://example.com/xyz.png', file_name: 'xyz.png' }] })
      .mockResolvedValueOnce({ rows: [{ id: 99, student_id: 5, image_url: 'https://example.com/xyz.png', file_name: 'xyz.png' }] });

    const app = createApp();

    const response = await request(app)
      .post('/api/students/5/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageUrl: 'https://example.com/xyz.png',
        fileName: 'xyz.png'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.schedule.image_url).toBe('https://example.com/xyz.png');
  });
});
