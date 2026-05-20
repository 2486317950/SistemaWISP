import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { generateClientContractPDF, downloadClientContractPDF } from '../utils/pdfGenerator';
import ContractForm from '../components/ContractForm';
import { useToast } from '../context/ToastContext';
import './Contracts.css';

const Contracts = () => {
  const { toast } = useToast();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const response = await api.get('/contracts');
      setContracts(response.data);
    } catch (error) {
      console.error('Error al cargar contratos:', error);
      toast.error('Error al cargar los contratos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este contrato guardado?')) return;
    try {
      await api.delete(`/contracts/${id}`);
      fetchContracts();
      toast.success('Contrato eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar contrato:', error);
      toast.error('Error al eliminar el contrato');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingContract(null);
    fetchContracts();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const filteredContracts = contracts.filter(contract => {
    const searchTerm = filter.toLowerCase();
    return (
      contract.contract_number?.toLowerCase().includes(searchTerm) ||
      contract.client_name?.toLowerCase().includes(searchTerm) ||
      contract.client_number?.toLowerCase().includes(searchTerm)
    );
  });

  if (loading) {
    return <div className="loading">Cargando contratos...</div>;
  }

  return (
    <div className="contracts-page">
      <div className="page-header">
        <h1>📋 Contratos Guardados</h1>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Buscar por número, cliente..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {showForm && (
        <ContractForm
          contract={editingContract}
          onClose={() => {
            setShowForm(false);
            setEditingContract(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {filteredContracts.length === 0 ? (
        <div className="empty-state">
          <p>No hay contratos guardados</p>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Los contratos se guardan automáticamente cuando generas un PDF desde "Contrato Cliente"
          </p>
        </div>
      ) : (
        <div className="contracts-table-container">
          <table className="contracts-table">
            <thead>
              <tr>
                <th>Número de Contrato</th>
                <th>Cliente</th>
                <th>N° Cliente</th>
                <th>Duración</th>
                <th>Fecha de Inicio</th>
                <th>Fecha de Creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#667eea' }}>
                      {contract.contract_number}
                    </span>
                  </td>
                  <td>{contract.client_name || '-'}</td>
                  <td>{contract.client_number || '-'}</td>
                  <td>
                    {contract.contract_months} {contract.contract_months === 1 ? 'mes' : 'meses'}
                  </td>
                  <td>{formatDate(contract.start_date)}</td>
                  <td>{formatDate(contract.created_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-icon"
                        onClick={() => {
                          // Preparar datos del cliente para el PDF
                          const clientData = {
                            id: contract.client_id,
                            name: contract.client_name,
                            client_number: contract.client_number,
                            address: contract.client_address,
                            phone: contract.client_phone,
                            email: contract.client_email,
                            package_name: contract.package_name,
                            speed: contract.package_speed,
                            package_price: contract.package_price
                          };
                          
                          const contractData = {
                            contractMonths: contract.contract_months.toString(),
                            startDate: contract.start_date,
                            paymentMethods: contract.payment_methods || [],
                            businessHours: contract.business_hours || '',
                            termsAndConditions: contract.terms_and_conditions || '',
                            additionalNotes: contract.additional_notes || ''
                          };
                          
                          generateClientContractPDF(clientData, contractData);
                        }}
                        title="Previsualizar PDF"
                      >
                        👁️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => {
                          // Preparar datos del cliente para el PDF
                          const clientData = {
                            id: contract.client_id,
                            name: contract.client_name,
                            client_number: contract.client_number,
                            address: contract.client_address,
                            phone: contract.client_phone,
                            email: contract.client_email,
                            package_name: contract.package_name,
                            speed: contract.package_speed,
                            package_price: contract.package_price
                          };
                          
                          const contractData = {
                            contractMonths: contract.contract_months.toString(),
                            startDate: contract.start_date,
                            paymentMethods: contract.payment_methods || [],
                            businessHours: contract.business_hours || '',
                            termsAndConditions: contract.terms_and_conditions || '',
                            additionalNotes: contract.additional_notes || ''
                          };
                          
                          downloadClientContractPDF(clientData, contractData);
                        }}
                        title="Descargar PDF"
                      >
                        📥
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => {
                          setEditingContract(contract);
                          setShowForm(true);
                        }}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(contract.id)}
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

export default Contracts;




