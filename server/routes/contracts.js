const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');
const { getBusinessYear, getBusinessMonth } = require('../utils/businessTime');
const { effMonthly, effPkgName } = require('../utils/clientPackageSql');

const CTR_M = effMonthly('cl', 'p');
const CTR_PN = effPkgName('cl', 'p');

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a contratos
router.use(blockTechnicians);

// Obtener todos los contratos
router.get('/', checkPermission('read'), (req, res) => {
  const database = db.getDb();
  
  database.all(`
    SELECT 
      c.*,
      cl.name as client_name,
      cl.client_number,
      cl.address as client_address,
      cl.phone as client_phone,
      cl.email as client_email,
      ${CTR_PN} as package_name,
      COALESCE(p.speed, '-') as package_speed,
      ${CTR_M} as package_price
    FROM client_contracts c
    LEFT JOIN clients cl ON c.client_id = cl.id
    LEFT JOIN packages p ON cl.package_id = p.id
    ORDER BY c.created_at DESC
  `, [], (err, contracts) => {
    if (err) {
      console.error('Error al obtener contratos:', err);
      return res.status(500).json({ error: 'Error al obtener contratos' });
    }
    
    // Parsear payment_methods si es un string JSON
    const parsedContracts = contracts.map(contract => ({
      ...contract,
      payment_methods: contract.payment_methods ? JSON.parse(contract.payment_methods) : []
    }));
    
    res.json(parsedContracts);
  });
});

// Obtener un contrato por ID
router.get('/:id', checkPermission('read'), (req, res) => {
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
      ${CTR_PN} as package_name,
      COALESCE(p.speed, '-') as package_speed,
      ${CTR_M} as package_price
    FROM client_contracts c
    LEFT JOIN clients cl ON c.client_id = cl.id
    LEFT JOIN packages p ON cl.package_id = p.id
    WHERE c.id = ?
  `, [contractId], (err, contract) => {
    if (err) {
      console.error('Error al obtener contrato:', err);
      return res.status(500).json({ error: 'Error al obtener contrato' });
    }
    
    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    // Parsear payment_methods si es un string JSON
    contract.payment_methods = contract.payment_methods ? JSON.parse(contract.payment_methods) : [];
    
    res.json(contract);
  });
});

// Crear un nuevo contrato
router.post('/', checkPermission('create'), (req, res) => {
  const {
    client_id,
    contract_months,
    start_date,
    payment_methods,
    business_hours,
    terms_and_conditions,
    additional_notes
  } = req.body;
  
  if (!client_id || !contract_months || !start_date) {
    return res.status(400).json({ error: 'client_id, contract_months y start_date son requeridos' });
  }
  
  const database = db.getDb();
  
  // Generar número de contrato (mes civil UTC−6)
  const year = getBusinessYear();
  const month = String(getBusinessMonth()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const contractNumber = `CT-${year}${month}-${random}`;
  
  // Verificar que el número de contrato sea único
  database.get('SELECT * FROM client_contracts WHERE contract_number = ?', [contractNumber], (err, existing) => {
    if (err) {
      console.error('Error al verificar número de contrato:', err);
      return res.status(500).json({ error: 'Error al verificar número de contrato' });
    }
    
    if (existing) {
      // Si existe, generar uno nuevo
      const newRandom = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const finalContractNumber = `CT-${year}${month}-${newRandom}`;
      insertContract(finalContractNumber);
    } else {
      insertContract(contractNumber);
    }
  });
  
  function insertContract(contractNumber) {
    const paymentMethodsJson = payment_methods && Array.isArray(payment_methods) 
      ? JSON.stringify(payment_methods) 
      : null;
    
    database.run(
      `INSERT INTO client_contracts (
        client_id, contract_number, contract_months, start_date,
        payment_methods, business_hours, terms_and_conditions, additional_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id,
        contractNumber,
        contract_months,
        start_date,
        paymentMethodsJson,
        business_hours || null,
        terms_and_conditions || null,
        additional_notes || null
      ],
      function(err) {
        if (err) {
          console.error('Error al crear contrato:', err);
          return res.status(500).json({ error: 'Error al crear contrato: ' + err.message });
        }
        
        // Obtener el contrato creado
        database.get(`
          SELECT 
            c.*,
            cl.name as client_name,
            cl.client_number,
            cl.address as client_address,
            cl.phone as client_phone,
            cl.email as client_email,
            ${CTR_PN} as package_name,
            COALESCE(p.speed, '-') as package_speed,
            ${CTR_M} as package_price
          FROM client_contracts c
          LEFT JOIN clients cl ON c.client_id = cl.id
          LEFT JOIN packages p ON cl.package_id = p.id
          WHERE c.id = ?
        `, [this.lastID], (err, contract) => {
          if (err) {
            console.error('Error al obtener contrato creado:', err);
            return res.status(500).json({ error: 'Error al obtener contrato creado' });
          }
          
          contract.payment_methods = contract.payment_methods ? JSON.parse(contract.payment_methods) : [];
          
          res.status(201).json({
            message: 'Contrato creado exitosamente',
            contract: contract
          });
        });
      }
    );
  }
});

// Actualizar un contrato
router.put('/:id', checkPermission('update'), (req, res) => {
  const contractId = req.params.id;
  const {
    contract_months,
    start_date,
    payment_methods,
    business_hours,
    terms_and_conditions,
    additional_notes
  } = req.body;
  
  const database = db.getDb();
  
  const paymentMethodsJson = payment_methods && Array.isArray(payment_methods) 
    ? JSON.stringify(payment_methods) 
    : null;
  
  database.run(
    `UPDATE client_contracts SET
      contract_months = ?,
      start_date = ?,
      payment_methods = ?,
      business_hours = ?,
      terms_and_conditions = ?,
      additional_notes = ?
    WHERE id = ?`,
    [
      contract_months,
      start_date,
      paymentMethodsJson,
      business_hours || null,
      terms_and_conditions || null,
      additional_notes || null,
      contractId
    ],
    function(err) {
      if (err) {
        console.error('Error al actualizar contrato:', err);
        return res.status(500).json({ error: 'Error al actualizar contrato: ' + err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }
      
      res.json({ message: 'Contrato actualizado exitosamente' });
    }
  );
});

// Eliminar un contrato
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const contractId = req.params.id;
  const database = db.getDb();
  
  database.run('DELETE FROM client_contracts WHERE id = ?', [contractId], function(err) {
    if (err) {
      console.error('Error al eliminar contrato:', err);
      return res.status(500).json({ error: 'Error al eliminar contrato: ' + err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    
    res.json({ message: 'Contrato eliminado exitosamente' });
  });
});

module.exports = router;

