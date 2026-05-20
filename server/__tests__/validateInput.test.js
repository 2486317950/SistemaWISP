const { validateLogin, validateClientCreate, validateClientUpdate, validatePayment } = require('../lib/validateInput');

describe('validateInput', () => {
  describe('validateLogin', () => {
    it('rechaza sin usuario', () => {
      const r = validateLogin({ password: 'x' });
      expect(r.ok).toBe(false);
      expect(r.errors).toContain('Usuario requerido');
    });
    it('rechaza sin contraseña', () => {
      const r = validateLogin({ username: 'admin' });
      expect(r.ok).toBe(false);
      expect(r.errors.some((e) => e.includes('Contraseña'))).toBe(true);
    });
    it('acepta usuario y contraseña válidos', () => {
      const r = validateLogin({ username: 'admin', password: 'secret' });
      expect(r.ok).toBe(true);
      expect(r.username).toBe('admin');
    });
  });

  describe('validatePayment', () => {
    it('rechaza monto inválido', () => {
      expect(validatePayment({ amount: -1 }).ok).toBe(false);
      expect(validatePayment({ amount: 'abc' }).ok).toBe(false);
    });
    it('acepta monto y fecha válidos', () => {
      const r = validatePayment({ amount: 100, payment_date: '2025-01-01' });
      expect(r.ok).toBe(true);
    });
  });

  describe('validateClientCreate', () => {
    it('rechaza sin nombre', () => {
      const r = validateClientCreate({ address: 'Calle 1' });
      expect(r.ok).toBe(false);
      expect(r.errors.some((e) => e.includes('Nombre'))).toBe(true);
    });
    it('rechaza sin domicilio', () => {
      const r = validateClientCreate({ name: 'Juan' });
      expect(r.ok).toBe(false);
      expect(r.errors.some((e) => e.includes('Domicilio'))).toBe(true);
    });
    it('acepta nombre y domicilio', () => {
      const r = validateClientCreate({ name: 'Juan', address: 'Calle 1' });
      expect(r.ok).toBe(true);
      expect(r.data.name).toBe('Juan');
    });
  });

  describe('validateClientUpdate', () => {
    it('acepta body vacío (solo validación de longitudes)', () => {
      const r = validateClientUpdate({});
      expect(r.ok).toBe(true);
    });
    it('rechaza nombre demasiado largo', () => {
      const r = validateClientUpdate({ name: 'a'.repeat(201) });
      expect(r.ok).toBe(false);
    });
  });
});
