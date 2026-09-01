const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

const pool = require('../src/config/database');

function createAppWithResults() {
  const app = express();
  app.use(express.json());
  app.use('/api/results', require('../src/routes/results'));
  return app;
}

describe('student results flow', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('student can fetch their own results through the authenticated results endpoint', async () => {
    const token = jwt.sign({ id: 3, email: 'student@example.com', role: 'student' }, process.env.JWT_SECRET || 'default_secret');

    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 12,
          exam_id: 5,
          student_id: 3,
          score: 81,
          total_marks: 100,
          percentage: 81,
          passed: true,
          created_at: '2024-01-01T00:00:00.000Z',
          exam_title: 'Mathematics',
          subject_name: 'Math'
        }]
      })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });

    const app = createAppWithResults();
    const response = await request(app)
      .get('/api/results')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.results[0].exam_title).toBe('Mathematics');
  });
});
