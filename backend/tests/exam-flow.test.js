const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

const pool = require('../src/config/database');

function createAppWithExams() {
  const app = express();
  app.use(express.json());
  app.use('/api/exams', require('../src/routes/exams'));
  return app;
}

describe('exam flow', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('student can fetch the available exam list through the standard exam endpoint', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 22, title: 'Math Unit Test', subject_name: 'Math', total_marks: 100, duration_minutes: 45, total_questions: 10, exam_type: 'quiz' }] });

    const app = createAppWithExams();
    const token = jwt.sign({ id: 3, email: 'student@example.com', role: 'student' }, process.env.JWT_SECRET || 'default_secret');

    const response = await request(app)
      .get('/api/exams?perPage=20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.exams[0].title).toBe('Math Unit Test');
  });

  test('student can start a valid exam attempt', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 5, total_marks: 100, max_attempts: 1, allow_multiple_attempts: false }] })
      .mockResolvedValueOnce({ rows: [{ id: 88, started_at: '2024-01-01T00:00:00.000Z' }] })
      .mockResolvedValueOnce({ rows: [{ id: 9, question_text: 'What is 2 + 2?', marks: 5, display_order: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 31, answer_text: '4', display_order: 1 }] });

    const app = createAppWithExams();
    const token = jwt.sign({ id: 3, email: 'student@example.com', role: 'student' }, process.env.JWT_SECRET || 'default_secret');

    const response = await request(app)
      .post('/api/exams/start/5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.attempt_id).toBe(88);
  });
});
