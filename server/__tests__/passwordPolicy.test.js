const { validatePassword, validatePortalPassword, MIN_LENGTH } = require('../lib/passwordPolicy');

describe('passwordPolicy', () => {
  describe('validatePassword', () => {
    it('rechaza contraseña vacía', () => {
      expect(validatePassword('').valid).toBe(false);
      expect(validatePassword(null).valid).toBe(false);
    });
    it('rechaza menos de 8 caracteres', () => {
      const r = validatePassword('Ab1!');
      expect(r.valid).toBe(false);
      expect(r.error).toMatch(/8/);
    });
    it('rechaza sin número', () => {
      const r = validatePassword('Abcdefgh!');
      expect(r.valid).toBe(false);
      expect(r.error).toMatch(/número/);
    });
    it('rechaza sin carácter especial', () => {
      const r = validatePassword('Abcdefgh1');
      expect(r.valid).toBe(false);
      expect(r.error).toMatch(/especial/);
    });
    it('acepta contraseña válida', () => {
      expect(validatePassword('MiClave123!').valid).toBe(true);
      expect(validatePassword('Abcdefg1!').valid).toBe(true);
    });
  });

  describe('validatePortalPassword', () => {
    it('rechaza menos de 6 por defecto', () => {
      const r = validatePortalPassword('12345');
      expect(r.valid).toBe(false);
    });
    it('acepta 6 caracteres para portal', () => {
      expect(validatePortalPassword('123456').valid).toBe(true);
    });
    it('acepta minLength personalizado', () => {
      expect(validatePortalPassword('1234', { minLength: 4 }).valid).toBe(true);
    });
  });
});
