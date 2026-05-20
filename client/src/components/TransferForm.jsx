import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

// Función auxiliar para obtener la fecha local en formato YYYY-MM-DD
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TransferForm = ({ transfer, accounts, employees, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    transfer_type: 'account',
    amount: '',
    transfer_date: getLocalDateString(),
    account_id: '',
    employee_id: '',
    employee_name: '',
    description: '',
    notes: '',
    is_expense: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (transfer) {
      setFormData({
        transfer_type: transfer.transfer_type || 'account',
        amount: transfer.amount || '',
        transfer_date: transfer.transfer_date || getLocalDateString(),
        account_id: transfer.account_id || '',
        employee_id: transfer.employee_id || '',
        employee_name: transfer.employee_name || '',
        description: transfer.description || '',
        notes: transfer.notes || '',
        is_expense: transfer.is_expense === 1 || transfer.is_expense === true
      });
    }
  }, [transfer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validación: si es pago a empleado, debe tener employee_id o employee_name
    if (formData.transfer_type === 'employee' && !formData.employee_id && !formData.employee_name) {
      setError('Debes seleccionar un empleado o ingresar el nombre manualmente');
      return;
    }
    
    setLoading(true);

    try {
      if (transfer) {
        await api.put(`/transfers/${transfer.id}`, formData);
      } else {
        await api.post('/transfers', formData);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar la transferencia');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const activeAccounts = accounts ? accounts.filter(acc => acc.is_active === 1 || acc.is_active === true) : [];
  const activeEmployees = employees ? employees.filter(emp => emp.is_active === 1 || emp.is_active === true) : [];
  
  // Obtener el empleado seleccionado para mostrar su cuenta nómina
  const selectedEmployee = activeEmployees.find(emp => emp.id === parseInt(formData.employee_id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{transfer ? 'Editar Transferencia' : 'Registrar Transferencia'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Tipo de Transferencia *</label>
            <select
              name="transfer_type"
              value={formData.transfer_type}
              onChange={handleChange}
              required
            >
              <option value="account">Transferencia a Cuenta</option>
              <option value="employee">Pago a Empleado</option>
            </select>
            <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
              {formData.transfer_type === 'employee' 
                ? 'El pago a empleado se registrará automáticamente como gasto'
                : 'Transferencia de ganancias a una cuenta bancaria'}
            </small>
          </div>
          {formData.transfer_type === 'account' && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  name="is_expense"
                  checked={formData.is_expense}
                  onChange={handleChange}
                />
                <span>Marcar como gasto</span>
              </label>
              <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
                Si está marcado, esta transferencia también se registrará como gasto
              </small>
            </div>
          )}
          {formData.transfer_type === 'account' && (
            <div className="form-group">
              <label>Cuenta *</label>
              <select
                name="account_id"
                value={formData.account_id}
                onChange={handleChange}
                required
              >
                <option value="">Seleccionar cuenta</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_name} {account.bank_name ? `- ${account.bank_name}` : ''} {account.account_number ? `(${account.account_number})` : ''}
                  </option>
                ))}
              </select>
              {activeAccounts.length === 0 && (
                <small style={{ color: '#e74c3c', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
                  No hay cuentas activas. Por favor, agrega una cuenta primero.
                </small>
              )}
            </div>
          )}
          {formData.transfer_type === 'employee' && (
            <>
              <div className="form-group">
                <label>Empleado *</label>
                <select
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selected = activeEmployees.find(emp => emp.id === parseInt(selectedId));
                    setFormData({
                      ...formData,
                      employee_id: selectedId,
                      employee_name: selected ? selected.name : formData.employee_name
                    });
                  }}
                >
                  <option value="">Seleccionar empleado</option>
                  {activeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} {employee.payroll_account ? `(${employee.payroll_account})` : ''}
                    </option>
                  ))}
                </select>
                {activeEmployees.length === 0 && (
                  <small style={{ color: '#e74c3c', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
                    No hay empleados activos. Por favor, agrega un empleado primero.
                  </small>
                )}
              </div>
              {selectedEmployee && selectedEmployee.payroll_account && (
                <div className="form-group">
                  <label style={{ color: '#667eea', fontWeight: 'bold' }}>Cuenta Nómina:</label>
                  <div style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#f0f0f0', 
                    borderRadius: '4px',
                    fontSize: '1em',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    {selectedEmployee.payroll_account}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Nombre del Empleado (Manual)</label>
                <input
                  type="text"
                  name="employee_name"
                  value={formData.employee_name}
                  onChange={handleChange}
                  placeholder="O ingresa el nombre manualmente si no está en la lista"
                />
                <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
                  Si seleccionas un empleado de la lista, el nombre se llenará automáticamente. También puedes ingresarlo manualmente.
                </small>
              </div>
            </>
          )}
          <div className="form-group">
            <label>Monto *</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label>Fecha *</label>
            <input
              type="date"
              name="transfer_date"
              value={formData.transfer_date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Descripción de la transferencia (opcional)"
            />
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="4"
              placeholder="Notas adicionales (opcional)"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferForm;

