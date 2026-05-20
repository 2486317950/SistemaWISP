/**
 * Validación de entrada para rutas API (sin dependencias externas).
 */

function trimString(val) {
  return typeof val === 'string' ? val.trim() : '';
}

/**
 * Paquete solo para este cliente. Si no hay precio (vacío/null), se usa el paquete catálogo (package_id).
 */
function parseCustomPackageFields(body) {
  const rawPrice = body?.custom_package_price;
  if (rawPrice === undefined || rawPrice === null || rawPrice === '') {
    return { ok: true, custom_package_name: null, custom_package_price: null };
  }
  const price = typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice);
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: 'Precio del paquete personalizado debe ser un número mayor o igual a 0', custom_package_name: null, custom_package_price: null };
  }
  const name = trimString(body?.custom_package_name);
  if (name.length > 200) {
    return { ok: false, error: 'Nombre del paquete personalizado demasiado largo (máx. 200 caracteres)', custom_package_name: null, custom_package_price: null };
  }
  return { ok: true, custom_package_name: name || null, custom_package_price: price };
}

function validateLogin(body) {
  const username = trimString(body?.username);
  const password = body?.password;
  const errors = [];
  if (!username) errors.push('Usuario requerido');
  else if (username.length > 100) errors.push('Usuario demasiado largo');
  if (password === undefined || password === null) errors.push('Contraseña requerida');
  else if (typeof password !== 'string') errors.push('Contraseña debe ser texto');
  else if (password.length > 500) errors.push('Contraseña demasiado larga');
  return { ok: errors.length === 0, errors, username, password: typeof password === 'string' ? password : '' };
}

function validateClientCreate(body) {
  const name = trimString(body?.name);
  const address = trimString(body?.address);
  const errors = [];
  if (!name) errors.push('Nombre requerido');
  else if (name.length > 200) errors.push('Nombre demasiado largo');
  if (!address) errors.push('Domicilio requerido');
  else if (address.length > 500) errors.push('Domicilio demasiado largo');
  const phone = trimString(body?.phone);
  const email = trimString(body?.email);
  if (phone && phone.length > 50) errors.push('Teléfono demasiado largo');
  if (email && email.length > 200) errors.push('Email demasiado largo');
  const custom = parseCustomPackageFields(body);
  if (!custom.ok) errors.push(custom.error);
  return {
    ok: errors.length === 0,
    errors,
    data: {
      client_number: trimString(body?.client_number) || null,
      name: name || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      network_type: trimString(body?.network_type) || null,
      package_id: body?.package_id,
      notes: trimString(body?.notes) || null,
      ip_address: trimString(body?.ip_address) || null,
      custom_package_name: custom.ok ? custom.custom_package_name : null,
      custom_package_price: custom.ok ? custom.custom_package_price : null,
    }
  };
}

function validateClientUpdate(body) {
  const errors = [];
  const name = trimString(body?.name);
  const address = trimString(body?.address);
  if (name !== undefined && name !== null) {
    if (name.length > 200) errors.push('Nombre demasiado largo');
  }
  if (address !== undefined && address !== null) {
    if (address.length > 500) errors.push('Domicilio demasiado largo');
  }
  const phone = trimString(body?.phone);
  const email = trimString(body?.email);
  if (phone !== undefined && phone !== null && phone.length > 50) errors.push('Teléfono demasiado largo');
  if (email !== undefined && email !== null && email.length > 200) errors.push('Email demasiado largo');
  const notes = trimString(body?.notes);
  if (notes !== undefined && notes !== null && notes.length > 2000) errors.push('Notas demasiado largas');
  return { ok: errors.length === 0, errors };
}

/** Domiciliación tarjeta: día 1–28 (evita meses cortos sin día 29–31). */
function parseCardRecurringFromBody(body) {
  const has = Object.prototype.hasOwnProperty.call(body, 'card_recurring_debit');
  if (!has) return { ok: true, skip: true };
  const en =
    body.card_recurring_debit === true ||
    body.card_recurring_debit === 1 ||
    body.card_recurring_debit === '1';
  if (!en) return { ok: true, skip: false, enabled: 0, chargeDay: null };
  const raw = body.card_charge_day;
  const d =
    raw === undefined || raw === null || raw === ''
      ? NaN
      : typeof raw === 'number'
        ? raw
        : parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(d) || d < 1 || d > 28) {
    return {
      ok: false,
      error: 'Si domicilia el cobro en tarjeta, el día debe ser un número entre 1 y 28',
    };
  }
  return { ok: true, skip: false, enabled: 1, chargeDay: d };
}

function validatePayment(body) {
  const errors = [];
  const amount = body?.amount != null ? Number(body.amount) : NaN;
  if (isNaN(amount) || amount < 0) errors.push('Monto inválido');
  const payment_date = trimString(body?.payment_date);
  if (body?.payment_date !== undefined && !payment_date) errors.push('Fecha de pago inválida');
  if (payment_date && payment_date.length > 20) errors.push('Fecha demasiado larga');
  const payment_method = trimString(body?.payment_method);
  if (payment_method && payment_method.length > 100) errors.push('Método de pago demasiado largo');
  const notes = trimString(body?.notes);
  if (notes && notes.length > 1000) errors.push('Notas demasiado largas');
  const custom_name = trimString(body?.custom_name);
  if (custom_name && custom_name.length > 200) errors.push('Nombre personalizado demasiado largo');
  const custom_address = trimString(body?.custom_address);
  if (custom_address && custom_address.length > 500) errors.push('Domicilio personalizado demasiado largo');
  return { ok: errors.length === 0, errors };
}

module.exports = {
  validateLogin,
  validateClientCreate,
  validateClientUpdate,
  validatePayment,
  trimString,
  parseCustomPackageFields,
  parseCardRecurringFromBody,
};
