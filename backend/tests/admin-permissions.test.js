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

describe('admin permission schema', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('admin permission grant uses the current permission_name schema', async () => {
    const token = jwt.sign({ id: 1, email: 'ahmad169qyp12q@gmail.com', role: 'super_admin' }, process.env.JWT_SECRET || 'default_secret');

    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'ahmad169qyp12q@gmail.com', role: 'super_admin', account_status: 'active' }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app)
      .post('/api/admin/users/2/permissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ permission: 'manage_students' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(pool.query.mock.calls.some(([sql]) => String(sql).includes('permission_name'))).toBe(true);
    expect(pool.query.mock.calls.some(([sql]) => String(sql).includes('is_granted'))).toBe(true);
  });
});
