import React, { useState, useEffect } from 'react';
import api from '../services/api';
import EmployeeForm from '../components/EmployeeForm';
import { useToast } from '../context/ToastContext';
import './Payments.css';

const Employees = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error al cargar empleados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este empleado?')) return;
    try {
      await api.delete(`/employees/${id}`);
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar el empleado');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingEmployee(null);
    fetchEmployees();
  };

  if (loading) {
    return <div className="loading">Cargando empleados...</div>;
  }

  return (
    <div className="payments-page">
      <div className="page-header">
        <h1>Empleados</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Agregar Empleado
          </button>
        </div>
      </div>

      {showForm && (
        <EmployeeForm
          employee={editingEmployee}
          onClose={() => {
            setShowForm(false);
            setEditingEmployee(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {employees.length === 0 ? (
        <div className="empty-state">
          <p>No hay empleados registrados</p>
        </div>
      ) : (
        <div className="payments-table-container">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cuenta Nómina</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Notas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td style={{ fontWeight: 'bold' }}>{employee.name}</td>
                  <td>{employee.payroll_account || '-'}</td>
                  <td>{employee.phone || '-'}</td>
                  <td>{employee.email || '-'}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.85em',
                      fontWeight: 'bold',
                      backgroundColor: (employee.is_active === 1 || employee.is_active === true) ? '#e8f5e9' : '#ffebee',
                      color: (employee.is_active === 1 || employee.is_active === true) ? '#2e7d32' : '#c62828'
                    }}>
                      {(employee.is_active === 1 || employee.is_active === true) ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>{employee.notes || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-icon"
                        onClick={() => {
                          setEditingEmployee(employee);
                          setShowForm(true);
                        }}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(employee.id)}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Employees;

