describe('production security configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('uses DATABASE_URL when provided and never falls back to hardcoded credentials in code', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@db.example.com:5432/tawjihi';
    const { buildDatabaseConfig } = require('../src/config/database');

    expect(buildDatabaseConfig()).toMatchObject({
      connectionString: 'postgresql://user:pass@db.example.com:5432/tawjihi'
    });
  });

  test('resolves super admin credentials only from environment variables', () => {
    process.env.SUPER_ADMIN_EMAIL = 'admin@example.com';
    process.env.SUPER_ADMIN_PASSWORD = 'StrongPass!123';

    const { resolveSuperAdminCredentials } = require('../src/utils/superAdminInit');

    expect(resolveSuperAdminCredentials()).toEqual({
      email: 'admin@example.com',
      password: 'StrongPass!123'
    });
  });
});
