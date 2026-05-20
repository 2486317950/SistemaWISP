const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { effMonthly, effPkgName } = require('../utils/clientPackageSql');

const VW_M = effMonthly('cl', 'p');
const VW_PN = effPkgName('cl', 'p');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Función auxiliar para formatear fecha
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// Función auxiliar para formatear moneda
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount || 0);
};

// Visualizar contrato
router.get('/contract/:id', (req, res) => {
  const database = db.getDb();
  const contractId = req.params.id;
  
  database.get(`
    SELECT 
      c.*,
      cl.name as client_name,
      cl.client_number,
      cl.address as client_address,
      cl.phone as client_phone,
      cl.email as client_email,
      ${VW_PN} as package_name,
      COALESCE(p.speed, '-') as package_speed,
      ${VW_M} as package_price
    FROM client_contracts c
    LEFT JOIN clients cl ON c.client_id = cl.id
    LEFT JOIN packages p ON cl.package_id = p.id
    WHERE c.id = ?
  `, [contractId], (err, contract) => {
    if (err) {
      return res.status(500).send('<html><body><h1>Error al cargar contrato</h1></body></html>');
    }
    
    if (!contract) {
      return res.status(404).send('<html><body><h1>Contrato no encontrado</h1></body></html>');
    }
    
    // Parsear payment_methods si es un string JSON
    const paymentMethods = contract.payment_methods ? JSON.parse(contract.payment_methods) : [];
    
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrato ${contract.contract_number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background: #f5f5f5;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-radius: 8px;
        }
        h1 {
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            color: #1e40af;
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 15px;
            border-left: 4px solid #2563eb;
            padding-left: 10px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .info-label {
            font-weight: 600;
            color: #4b5563;
        }
        .info-value {
            color: #111827;
            text-align: right;
        }
        .payment-methods {
            list-style: none;
            padding: 10px;
            background: #eff6ff;
            border-radius: 5px;
        }
        .payment-methods li {
            padding: 5px 0;
        }
        .notes {
            background: #fef3c7;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #f59e0b;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Contrato ${contract.contract_number}</h1>
        
        <div class="section">
            <div class="section-title">Información del Cliente</div>
            <div class="info-row">
                <span class="info-label">Nombre:</span>
                <span class="info-value">${contract.client_name || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Número de Cliente:</span>
                <span class="info-value">${contract.client_number || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Dirección:</span>
                <span class="info-value">${contract.client_address || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Teléfono:</span>
                <span class="info-value">${contract.client_phone || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${contract.client_email || '-'}</span>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Información del Paquete</div>
            <div class="info-row">
                <span class="info-label">Paquete:</span>
                <span class="info-value">${contract.package_name || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Velocidad:</span>
                <span class="info-value">${contract.package_speed || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Precio:</span>
                <span class="info-value">${formatCurrency(contract.package_price)}</span>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Detalles del Contrato</div>
            <div class="info-row">
                <span class="info-label">Fecha de Inicio:</span>
                <span class="info-value">${formatDate(contract.start_date)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Duración:</span>
                <span class="info-value">${contract.contract_months} meses</span>
            </div>
            ${contract.end_date ? `
            <div class="info-row">
                <span class="info-label">Fecha de Fin:</span>
                <span class="info-value">${formatDate(contract.end_date)}</span>
            </div>
            ` : ''}
            ${paymentMethods.length > 0 ? `
            <div class="info-row">
                <span class="info-label">Métodos de Pago:</span>
                <span class="info-value">
                    <ul class="payment-methods">
                        ${paymentMethods.map(method => `<li>${method}</li>`).join('')}
                    </ul>
                </span>
            </div>
            ` : ''}
        </div>
        
        ${contract.business_hours ? `
        <div class="section">
            <div class="section-title">Horarios de Atención</div>
            <div class="info-value">${contract.business_hours}</div>
        </div>
        ` : ''}
        
        ${contract.terms_and_conditions ? `
        <div class="section">
            <div class="section-title">Términos y Condiciones</div>
            <div class="info-value">${contract.terms_and_conditions}</div>
        </div>
        ` : ''}
        
        ${contract.additional_notes ? `
        <div class="section">
            <div class="section-title">Notas Adicionales</div>
            <div class="notes">${contract.additional_notes}</div>
        </div>
        ` : ''}
        
        <div class="section">
            <div class="info-row">
                <span class="info-label">Fecha de Creación:</span>
                <span class="info-value">${formatDate(contract.created_at)}</span>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    res.send(html);
  });
});

// Visualizar recibo
router.get('/receipt/:id', (req, res) => {
  const database = db.getDb();
  const receiptId = req.params.id;
  
  database.get(`
    SELECT r.*, c.name as client_name, c.client_number, c.address as client_address, c.phone as client_phone, c.email as client_email
    FROM receipts r
    LEFT JOIN clients c ON r.client_id = c.id
    WHERE r.id = ?
  `, [receiptId], (err, receipt) => {
    if (err) {
      return res.status(500).send('<html><body><h1>Error al cargar recibo</h1></body></html>');
    }
    
    if (!receipt) {
      return res.status(404).send('<html><body><h1>Recibo no encontrado</h1></body></html>');
    }
    
    const displayName = receipt.client_name || receipt.custom_name || 'Cliente';
    const displayAddress = receipt.client_address || receipt.custom_address || '-';
    
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recibo ${receipt.receipt_number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background: #f5f5f5;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-radius: 8px;
            border-top: 5px solid #10b981;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #10b981;
            padding-bottom: 20px;
        }
        .receipt-number {
            font-size: 1.5em;
            color: #10b981;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .receipt-type {
            color: #6b7280;
            text-transform: uppercase;
            font-size: 0.9em;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            color: #1e40af;
            font-size: 1.1em;
            font-weight: bold;
            margin-bottom: 15px;
            border-left: 4px solid #10b981;
            padding-left: 10px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .info-label {
            font-weight: 600;
            color: #4b5563;
        }
        .info-value {
            color: #111827;
            text-align: right;
        }
        .amount {
            text-align: center;
            padding: 20px;
            background: #ecfdf5;
            border-radius: 8px;
            margin: 20px 0;
        }
        .amount-label {
            color: #6b7280;
            font-size: 0.9em;
            margin-bottom: 5px;
        }
        .amount-value {
            font-size: 2em;
            color: #10b981;
            font-weight: bold;
        }
        .notes {
            background: #fef3c7;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #f59e0b;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="receipt-number">${receipt.receipt_number}</div>
            <div class="receipt-type">Recibo de ${receipt.receipt_type === 'mensualidad' ? 'Mensualidad' : 'Instalación'}</div>
        </div>
        
        <div class="section">
            <div class="section-title">Información del Cliente</div>
            <div class="info-row">
                <span class="info-label">Nombre:</span>
                <span class="info-value">${displayName}</span>
            </div>
            ${receipt.client_number ? `
            <div class="info-row">
                <span class="info-label">Número de Cliente:</span>
                <span class="info-value">${receipt.client_number}</span>
            </div>
            ` : ''}
            <div class="info-row">
                <span class="info-label">Dirección:</span>
                <span class="info-value">${displayAddress}</span>
            </div>
            ${receipt.client_phone ? `
            <div class="info-row">
                <span class="info-label">Teléfono:</span>
                <span class="info-value">${receipt.client_phone}</span>
            </div>
            ` : ''}
        </div>
        
        <div class="amount">
            <div class="amount-label">Monto Pagado</div>
            <div class="amount-value">${formatCurrency(receipt.amount)}</div>
        </div>
        
        <div class="section">
            <div class="section-title">Detalles del Pago</div>
            <div class="info-row">
                <span class="info-label">Fecha:</span>
                <span class="info-value">${formatDate(receipt.receipt_date)}</span>
            </div>
            ${receipt.payment_method ? `
            <div class="info-row">
                <span class="info-label">Método de Pago:</span>
                <span class="info-value">${receipt.payment_method}</span>
            </div>
            ` : ''}
            ${receipt.concept ? `
            <div class="info-row">
                <span class="info-label">Concepto:</span>
                <span class="info-value">${receipt.concept}</span>
            </div>
            ` : ''}
        </div>
        
        ${receipt.notes ? `
        <div class="section">
            <div class="section-title">Notas</div>
            <div class="notes">${receipt.notes}</div>
        </div>
        ` : ''}
        
        <div class="section">
            <div class="info-row">
                <span class="info-label">Fecha de Emisión:</span>
                <span class="info-value">${formatDate(receipt.created_at)}</span>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    res.send(html);
  });
});

// Visualizar pago
router.get('/payment/:id', (req, res) => {
  const database = db.getDb();
  const paymentId = req.params.id;
  
  database.get(`
    SELECT p.*, c.name as client_name, c.client_number, c.address as client_address, c.phone as client_phone, c.email as client_email
    FROM payments p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ?
  `, [paymentId], (err, payment) => {
    if (err) {
      return res.status(500).send('<html><body><h1>Error al cargar pago</h1></body></html>');
    }
    
    if (!payment) {
      return res.status(404).send('<html><body><h1>Pago no encontrado</h1></body></html>');
    }
    
    const displayName = payment.client_name || payment.custom_name || 'Cliente';
    const displayAddress = payment.client_address || payment.custom_address || '-';
    
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pago ${payment.id}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background: #f5f5f5;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-radius: 8px;
            border-top: 5px solid #3b82f6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
        }
        .payment-id {
            font-size: 1.5em;
            color: #3b82f6;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .payment-type {
            color: #6b7280;
            text-transform: uppercase;
            font-size: 0.9em;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            color: #1e40af;
            font-size: 1.1em;
            font-weight: bold;
            margin-bottom: 15px;
            border-left: 4px solid #3b82f6;
            padding-left: 10px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .info-label {
            font-weight: 600;
            color: #4b5563;
        }
        .info-value {
            color: #111827;
            text-align: right;
        }
        .amount {
            text-align: center;
            padding: 20px;
            background: #eff6ff;
            border-radius: 8px;
            margin: 20px 0;
        }
        .amount-label {
            color: #6b7280;
            font-size: 0.9em;
            margin-bottom: 5px;
        }
        .amount-value {
            font-size: 2em;
            color: #3b82f6;
            font-weight: bold;
        }
        .badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .badge-free {
            background: #fef3c7;
            color: #92400e;
        }
        .notes {
            background: #fef3c7;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #f59e0b;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="payment-id">Pago #${payment.id}</div>
            <div class="payment-type">${payment.payment_type || 'Mensualidad'}</div>
        </div>
        
        <div class="section">
            <div class="section-title">Información del Cliente</div>
            <div class="info-row">
                <span class="info-label">Nombre:</span>
                <span class="info-value">${displayName}</span>
            </div>
            ${payment.client_number ? `
            <div class="info-row">
                <span class="info-label">Número de Cliente:</span>
                <span class="info-value">${payment.client_number}</span>
            </div>
            ` : ''}
            <div class="info-row">
                <span class="info-label">Dirección:</span>
                <span class="info-value">${displayAddress}</span>
            </div>
        </div>
        
        <div class="amount">
            <div class="amount-label">Monto Pagado</div>
            <div class="amount-value">${formatCurrency(payment.amount)}</div>
            ${(payment.is_free_month === 1 || payment.is_free_month === true) ? '<div style="margin-top: 10px;"><span class="badge badge-free">Mes Gratis</span></div>' : ''}
        </div>
        
        <div class="section">
            <div class="section-title">Detalles del Pago</div>
            <div class="info-row">
                <span class="info-label">Fecha:</span>
                <span class="info-value">${formatDate(payment.payment_date)}</span>
            </div>
            ${payment.payment_method ? `
            <div class="info-row">
                <span class="info-label">Método de Pago:</span>
                <span class="info-value">${payment.payment_method}</span>
            </div>
            ` : ''}
            ${payment.payment_type ? `
            <div class="info-row">
                <span class="info-label">Tipo de Pago:</span>
                <span class="info-value">${payment.payment_type}</span>
            </div>
            ` : ''}
            ${payment.receipt_number ? `
            <div class="info-row">
                <span class="info-label">Número de Recibo:</span>
                <span class="info-value">${payment.receipt_number}</span>
            </div>
            ` : ''}
        </div>
        
        ${payment.notes ? `
        <div class="section">
            <div class="section-title">Notas</div>
            <div class="notes">${payment.notes}</div>
        </div>
        ` : ''}
        
        <div class="section">
            <div class="info-row">
                <span class="info-label">Fecha de Registro:</span>
                <span class="info-value">${formatDate(payment.created_at)}</span>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    res.send(html);
  });
});

module.exports = router;

