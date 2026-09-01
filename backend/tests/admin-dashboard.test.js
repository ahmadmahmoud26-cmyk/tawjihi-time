const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

const pool = require('../src/config/database');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../src/routes/admin'));
  return app;
}

describe('admin dashboard statistics', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('returns real dashboard statistics for admin users', async () => {
    const token = jwt.sign({ id: 1, email: 'super@admin.com', role: 'super_admin' }, process.env.JWT_SECRET || 'default_secret');

    pool.query
      .mockResolvedValueOnce({ rows: [{ role: 'super_admin', account_status: 'active' }] })
      .mockResolvedValueOnce({ rows: [{ total_students: '8' }] })
      .mockResolvedValueOnce({ rows: [{ active_students: '6' }] })
      .mockResolvedValueOnce({ rows: [{ new_students: '2' }] })
      .mockResolvedValueOnce({ rows: [{ total_subjects: '5' }] })
      .mockResolvedValueOnce({ rows: [{ total_units: '12' }] })
      .mockResolvedValueOnce({ rows: [{ total_lessons: '18' }] })
      .mockResolvedValueOnce({ rows: [{ total_exams: '7' }] })
      .mockResolvedValueOnce({ rows: [{ total_attempts: '23' }] })
      .mockResolvedValueOnce({ rows: [{ unread_notes: '4' }] })
      .mockResolvedValueOnce({ rows: [{ unread_messages: '3' }] })
      .mockResolvedValueOnce({ rows: [{ registrations: 2 }] })
      .mockResolvedValueOnce({ rows: [{ activity_count: 5 }] });

    const app = createApp();
    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.stats.totalStudents).toBe(8);
    expect(response.body.stats.totalExams).toBe(7);
    expect(response.body.stats.unreadNotes).toBe(4);
  });
});
