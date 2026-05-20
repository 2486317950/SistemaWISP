import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import { generateClientContractPDF } from '../../utils/pdfGenerator';
import './PortalContract.css';

const PortalContract = () => {
  const [contract, setContract] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      portalApi.get('/client-portal/contract'),
      portalApi.get('/client-portal/me')
    ]).then(([contractRes, clientRes]) => {
      setContract(contractRes.data);
      setClient(clientRes.data);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') : s.split('-').reverse().join('/');
  };

  const handleDownloadPDF = () => {
    if (!client || !contract) return;
    const paymentMethods = contract.payment_methods
      ? (typeof contract.payment_methods === 'string' ? contract.payment_methods.split(',').map(s => s.trim()) : contract.payment_methods)
      : [];
    const contractData = {
      contractMonths: contract.contract_months,
      startDate: contract.start_date,
      paymentMethods,
      businessHours: contract.business_hours,
      termsAndConditions: contract.terms_and_conditions,
      additionalNotes: contract.additional_notes
    };
    generateClientContractPDF(client, contractData);
  };

  if (loading) {
    return <div className="portal-loading">Cargando contrato...</div>;
  }

  if (!contract) {
    return (
      <div className="portal-contract">
        <h2>Mi contrato</h2>
        <div className="portal-empty">No hay contrato registrado para tu cuenta.</div>
      </div>
    );
  }

  return (
    <div className="portal-contract">
      <h2>Mi contrato</h2>
      <div className="contract-card">
        <div className="contract-header">
          <h3>Contrato #{contract.contract_number || contract.id}</h3>
          <button type="button" className="download-contract-btn" onClick={handleDownloadPDF}>
            📄 Descargar PDF
          </button>
        </div>
        <div className="contract-details">
          <div className="contract-row">
            <span className="label">Duración:</span>
            <span>{contract.contract_months} meses</span>
          </div>
          <div className="contract-row">
            <span className="label">Fecha de inicio:</span>
            <span>{formatDate(contract.start_date)}</span>
          </div>
          {contract.payment_methods && (
            <div className="contract-row">
              <span className="label">Métodos de pago:</span>
              <span>{typeof contract.payment_methods === 'string' ? contract.payment_methods : (contract.payment_methods || []).join(', ')}</span>
            </div>
          )}
        </div>
        {contract.terms_and_conditions && (
          <div className="contract-terms">
            <h4>Términos y condiciones</h4>
            <div className="terms-content">{contract.terms_and_conditions}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalContract;
