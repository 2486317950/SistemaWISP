import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatLocalDate } from '../utils/dateUtils';
import { exportToExcel } from '../utils/excelExport';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import './BankReconciliation.css';

const BankReconciliation = () => {
  const { toast } = useToast();
  const [movements, setMovements] = useState([]);
  const [payments, setPayments] = useState([]);
  const [unreconciled, setUnreconciled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchUnreconciled();
    fetchPayments();
  }, []);

  const fetchUnreconciled = async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const response = await api.get('/bank-reconciliation/unreconciled');
      setUnreconciled(response.data || []);
    } catch (error) {
      setLoadError(error.response?.data?.error || 'Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await api.get('/payments');
      const data = response.data;
      setPayments(Array.isArray(data) ? data : (data?.payments || []));
    } catch (error) {
      setPayments([]);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.warning('Por favor selecciona un archivo');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await api.post('/bank-reconciliation/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Importación completada: ${response.data.inserted} movimientos importados`);
      setShowImport(false);
      setSelectedFile(null);
      fetchUnreconciled();
    } catch (error) {
      console.error('Error al importar:', error);
      toast.error('Error al importar movimientos');
    }
  };

  const handleReconcile = async (movementId, paymentId) => {
    try {
      await api.post('/bank-reconciliation/reconcile', {
        movement_id: movementId,
        payment_id: paymentId
      });
      toast.success('Movimiento conciliado exitosamente');
      fetchUnreconciled();
    } catch (error) {
      console.error('Error al conciliar:', error);
      toast.error('Error al conciliar movimiento');
    }
  };

  const handleExport = () => {
    const data = unreconciled.map(m => ({
      Fecha: formatLocalDate(m.movement_date),
      Descripción: m.description,
      Monto: parseFloat(m.amount || 0),
      Referencia: m.reference || ''
    }));
    exportToExcel(data, 'movimientos_no_conciliados', 'Datos', toast);
  };

  if (loading) {
    return <LoadingSpinner message="Cargando conciliación..." fullScreen />;
  }
  if (loadError) {
    return (
      <div className="bank-reconciliation-page">
        <div className="page-header"><h1>🏦 Conciliación Bancaria</h1></div>
        <div style={{ padding: '1rem', color: '#c0392b' }}>
          {loadError}
          <button type="button" className="btn-secondary" onClick={fetchUnreconciled} style={{ marginLeft: '0.5rem' }}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bank-reconciliation-page">
      <div className="page-header">
        <h1>🏦 Conciliación Bancaria</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExport}>
            📥 Exportar Excel
          </button>
          <button className="btn-primary" onClick={() => setShowImport(true)}>
            📤 Importar CSV
          </button>
        </div>
      </div>

      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Importar Movimientos Bancarios</h2>
            <form onSubmit={handleImport}>
              <div className="form-group">
                <label>Archivo CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  required
                />
                <small>El CSV debe tener columnas: fecha, descripción, monto, referencia</small>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowImport(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Importar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="reconciliation-container">
        <div className="unreconciled-movements">
          <h2>Movimientos No Conciliados ({unreconciled.length})</h2>
          {unreconciled.length === 0 ? (
            <p className="no-data">No hay movimientos sin conciliar</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th>Referencia</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {unreconciled.map(movement => (
                  <tr key={movement.id}>
                    <td>{formatLocalDate(movement.movement_date)}</td>
                    <td>{movement.description || '-'}</td>
                    <td className="amount">${parseFloat(movement.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td>{movement.reference || '-'}</td>
                    <td>
                      <select
                        aria-label="Conciliar con pago"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleReconcile(movement.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">Conciliar con...</option>
                        {payments
                          .filter(p => Math.abs(parseFloat(p.amount) - parseFloat(movement.amount)) < 0.01)
                          .map(payment => (
                            <option key={payment.id} value={payment.id}>
                              Pago #{payment.id} - ${parseFloat(payment.amount).toLocaleString('es-MX')} - {payment.client_name || 'Sin cliente'}
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default BankReconciliation;











