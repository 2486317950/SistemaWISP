const { logAudit } = require('../lib/audit');

jest.mock('../database', () => ({
  getDb: () => ({
    run: jest.fn((sql, params, cb) => (typeof cb === 'function' ? cb(null) : undefined))
  })
}));

describe('audit', () => {
  it('logAudit no lanza con acción y opciones', () => {
    expect(() => {
      logAudit('login_ok', { userId: 1, username: 'test', ipAddress: '127.0.0.1' });
    }).not.toThrow();
  });
  it('logAudit acepta solo acción', () => {
    expect(() => logAudit('login_fail')).not.toThrow();
  });
});
