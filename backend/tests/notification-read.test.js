const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const pool = require('../src/config/database');
const notificationsRouter = require('../src/routes/notifications');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationsRouter);
  return app;
}

describe('related notification reads', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('marks only the signed-in user notification records for viewed content', async () => {
    const token = jwt.sign({ id: 7, email: 'student@example.com', role: 'student' }, process.env.JWT_SECRET || 'default_secret');
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 2 });

    const response = await request(createApp())
      .patch('/api/notifications/read-related')
      .set('Authorization', `Bearer ${token}`)
      .send({ relatedEntityTypes: ['student_schedule'], relatedIds: [31, 32] })
      .expect(200);

    expect(response.body).toMatchObject({ success: true, markedRead: 2 });
    expect(pool.query.mock.calls[0][1]).toEqual([7, 'student_schedule', 31, 32]);
  });
});
