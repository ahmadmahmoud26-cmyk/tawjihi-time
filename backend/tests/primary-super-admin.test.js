const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const pool = require('../src/config/database');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../src/routes/admin'));
  app.use('/api/students', require('../src/routes/students'));
  return app;
}

describe('primary Super Admin authorization', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('normal Admin cannot create another Admin through the API', async () => {
    const token = jwt.sign({ id: 2, email: 'admin@example.com', role: 'admin' }, process.env.JWT_SECRET || 'default_secret');
    pool.query.mockResolvedValueOnce({ rows: [{ id: 2, email: 'admin@example.com', role: 'admin', account_status: 'active' }] });

    await request(createApp())
      .post('/api/admin/create-admin')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Blocked Admin', email: 'blocked@example.com', password: 'StrongPass123' })
      .expect(403);
  });

  test('normal Admin cannot create a student through either creation API', async () => {
    const token = jwt.sign({ id: 2, email: 'admin@example.com', role: 'admin' }, process.env.JWT_SECRET || 'default_secret');
    const app = createApp();

    pool.query.mockResolvedValueOnce({ rows: [{ id: 2, email: 'admin@example.com', role: 'admin', account_status: 'active' }] });
    await request(app)
      .post('/api/admin/create-student')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);

    pool.query.mockResolvedValueOnce({ rows: [{ id: 2, email: 'admin@example.com', role: 'admin', account_status: 'active' }] });
    await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });
});
