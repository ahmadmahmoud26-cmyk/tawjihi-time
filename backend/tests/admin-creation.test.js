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

describe('admin creation flow', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('super admin can create a new admin account', async () => {
    const token = jwt.sign({ id: 1, email: 'ahmad169qyp12q@gmail.com', role: 'super_admin' }, process.env.JWT_SECRET || 'default_secret');

    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'ahmad169qyp12q@gmail.com', role: 'super_admin', account_status: 'active' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'New Admin', email: 'newadmin@example.com', role: 'admin', account_status: 'active' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const response = await request(app)
      .post('/api/admin/create-admin')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Admin',
        email: 'newadmin@example.com',
        password: 'StrongPass123',
        permissions: ['manage_students', 'view_results']
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.admin.email).toBe('newadmin@example.com');
  });
});
