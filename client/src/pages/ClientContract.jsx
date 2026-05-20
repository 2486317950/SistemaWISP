import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { generateClientContractPDF, downloadClientContractPDF } from '../utils/pdfGenerator';
import { useToast } from '../context/ToastContext';
import './ClientContract.css';

const ClientContract = () => {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Cargar datos guardados del localStorage
  const loadSavedData = () => {
    const savedPaymentMethods = localStorage.getItem('contract_payment_methods');
    const savedBusinessHours = localStorage.getItem('contract_business_hours');
    const savedTerms = localStorage.getItem('contract_terms');
    
    return {
      contractMonths: '',
      startDate: (() => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      })(),
      paymentMethods: savedPaymentMethods ? JSON.parse(savedPaymentMethods) : [],
      businessHours: savedBusinessHours || 'Lunes a Viernes: 9:00 AM - 6:00 PM\nSábados: 9:00 AM - 2:00 PM\nDomingos: Cerrado',
      termsAndConditions: savedTerms || 'El cliente se compromete a realizar los pagos mensuales de manera puntual. El servicio puede ser suspendido en caso de atraso en los pagos. Para cualquier consulta o soporte técnico, puede contactarnos en los horarios de atención indicados.',
      additionalNotes: ''
    };
  };

  const [contractData, setContractData] = useState({
    ...loadSavedData(),
    networkType: '',
    email: ''
  });
  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  useEffect(() => {
    fetchClients();
    fetchNetworks();
  }, []);

  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks?active_only=true');
      setNetworks(response.data);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    }
  };

  const [saveMessage, setSaveMessage] = useState('');

  // Función para guardar configuración de forma explícita
  const handleSaveConfiguration = () => {
    try {
      // Guardar métodos de pago
      if (contractData.paymentMethods.length > 0) {
        localStorage.setItem('contract_payment_methods', JSON.stringify(contractData.paymentMethods));
      }
      
      // Guardar horarios
      if (contractData.businessHours) {
        localStorage.setItem('contract_business_hours', contractData.businessHours);
      }
      
      // Guardar términos
      if (contractData.termsAndConditions) {
        localStorage.setItem('contract_terms', contractData.termsAndConditions);
      }
      
      setSaveMessage('✅ Configuración guardada para futuros contratos');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      setSaveMessage('❌ Error al guardar la configuración');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = async (clientId) => {
    if (!clientId) {
      setSelectedClient(null);
      setContractData({ ...contractData, networkType: '', email: '' });
      return;
    }
    try {
      const response = await api.get(`/clients/${clientId}`);
      setSelectedClient(response.data);
      // Cargar datos del cliente si existen
      setContractData({
        ...contractData,
        networkType: response.data.network_type || '',
        email: response.data.email || ''
      });
    } catch (error) {
      console.error('Error al cargar cliente:', error);
      toast.error('Error al cargar la información del cliente');
    }
  };

  const generateRandomEmail = () => {
    const randomString = Math.random().toString(36).substring(2, 10);
    const randomNumber = Math.floor(Math.random() * 10000);
    const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com'];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    const generatedEmail = `cliente${randomString}${randomNumber}@${randomDomain}`;
    setContractData({ ...contractData, email: generatedEmail });
  };

  const handleAddPaymentMethod = () => {
    if (newPaymentMethod.trim() && !contractData.paymentMethods.includes(newPaymentMethod.trim())) {
      setContractData({
        ...contractData,
        paymentMethods: [...contractData.paymentMethods, newPaymentMethod.trim()]
      });
      setNewPaymentMethod('');
    }
  };

  const handleRemovePaymentMethod = (method) => {
    setContractData({
      ...contractData,
      paymentMethods: contractData.paymentMethods.filter(m => m !== method)
    });
  };

  const handleSaveContract = async () => {
    if (!selectedClient || !contractData.contractMonths || !contractData.startDate) {
      throw new Error('Por favor completa todos los campos requeridos');
    }

    try {
      // Actualizar cliente con red y correo si se proporcionaron
      if (contractData.networkType || contractData.email) {
        const updateData = {};
        if (contractData.networkType) {
          updateData.network_type = contractData.networkType;
        }
        if (contractData.email) {
          updateData.email = contractData.email;
        }
        
        await api.put(`/clients/${selectedClient.id}`, {
          ...selectedClient,
          ...updateData
        });
        
        // Actualizar el cliente seleccionado localmente
        setSelectedClient({
          ...selectedClient,
          ...updateData
        });
      }

      const response = await api.post('/contracts', {
        client_id: selectedClient.id,
        contract_months: contractData.contractMonths,
        start_date: contractData.startDate,
        payment_methods: contractData.paymentMethods,
        business_hours: contractData.businessHours,
        terms_and_conditions: contractData.termsAndConditions,
        additional_notes: contractData.additionalNotes
      });

      return response.data.contract;
    } catch (error) {
      console.error('Error al guardar contrato:', error);
      throw error;
    }
  };

  const handleGeneratePDF = async () => {
    if (!selectedClient) {
      toast.warning('Por favor selecciona un cliente');
      return;
    }
    
    // Guardar el contrato antes de generar el PDF
    if (!contractData.contractMonths || !contractData.startDate) {
      toast.warning('Por favor completa la duración y fecha de inicio del contrato');
      return;
    }

    try {
      // Guardar el contrato primero
      const savedContract = await handleSaveContract();
      toast.success(`Contrato guardado exitosamente. Número: ${savedContract.contract_number}`);
      // Luego generar el PDF con datos actualizados
      const clientWithUpdatedData = {
        ...selectedClient,
        network_type: contractData.networkType || selectedClient.network_type,
        email: contractData.email || selectedClient.email
      };
      generateClientContractPDF(clientWithUpdatedData, contractData);
    } catch (error) {
      console.error('Error al guardar:', error);
      const shouldContinue = window.confirm('No se pudo guardar el contrato. ¿Deseas continuar y generar el PDF de todas formas?');
      if (shouldContinue) {
        const clientWithUpdatedData = {
          ...selectedClient,
          network_type: contractData.networkType || selectedClient.network_type,
          email: contractData.email || selectedClient.email
        };
        generateClientContractPDF(clientWithUpdatedData, contractData);
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedClient) {
      toast.warning('Por favor selecciona un cliente');
      return;
    }
    
    // Guardar el contrato antes de descargar el PDF
    if (!contractData.contractMonths || !contractData.startDate) {
      toast.warning('Por favor completa la duración y fecha de inicio del contrato');
      return;
    }

    try {
      // Guardar el contrato primero
      const savedContract = await handleSaveContract();
      toast.success(`Contrato guardado exitosamente. Número: ${savedContract.contract_number}`);
      // Luego descargar el PDF con datos actualizados
      const clientWithUpdatedData = {
        ...selectedClient,
        network_type: contractData.networkType || selectedClient.network_type,
        email: contractData.email || selectedClient.email
      };
      downloadClientContractPDF(clientWithUpdatedData, contractData);
    } catch (error) {
      console.error('Error al guardar:', error);
      const shouldContinue = window.confirm('No se pudo guardar el contrato. ¿Deseas continuar y descargar el PDF de todas formas?');
      if (shouldContinue) {
        const clientWithUpdatedData = {
          ...selectedClient,
          network_type: contractData.networkType || selectedClient.network_type,
          email: contractData.email || selectedClient.email
        };
        downloadClientContractPDF(clientWithUpdatedData, contractData);
      }
    }
  };

  const handleSendWhatsApp = () => {
    if (!selectedClient || !selectedClient.phone) {
      toast.warning('El cliente no tiene número de teléfono registrado');
      return;
    }
    const cleanPhone = selectedClient.phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Hola ${selectedClient.name}, te enviamos la información de tu contrato de servicio. Por favor revisa el documento adjunto.`);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return <div className="loading">Cargando clientes...</div>;
  }

  return (
    <div className="client-contract-page">
      <div className="page-header">
        <h1>📄 Contrato de Cliente</h1>
        <p>Genera y envía el PDF de contrato/bienvenida a clientes nuevos</p>
      </div>

      <div className="contract-container">
        <div className="contract-form-section">
          <div className="form-card">
            <h2>Seleccionar Cliente</h2>
            <div className="form-group">
              <label>Cliente *</label>
              <select
                value={selectedClient?.id || ''}
                onChange={(e) => handleClientSelect(e.target.value)}
              >
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.client_number && `- #${client.client_number}`}
                  </option>
                ))}
              </select>
            </div>

            {selectedClient && (
              <div className="client-info-card">
                <h3>Información del Cliente</h3>
                <p><strong>Nombre:</strong> {selectedClient.name}</p>
                {selectedClient.client_number && (
                  <p><strong>Número:</strong> {selectedClient.client_number}</p>
                )}
                <p><strong>Dirección:</strong> {selectedClient.address}</p>
                {selectedClient.phone && (
                  <p><strong>Teléfono:</strong> {selectedClient.phone}</p>
                )}
                {selectedClient.package_name && (
                  <p><strong>Paquete:</strong> {selectedClient.package_name} - {selectedClient.speed} - ${selectedClient.package_price}</p>
                )}
                {selectedClient.network_type && (
                  <p><strong>Red:</strong> {selectedClient.network_type}</p>
                )}
                {selectedClient.email && (
                  <p><strong>Correo:</strong> {selectedClient.email}</p>
                )}
              </div>
            )}
          </div>

          <div className="form-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Configuración del Contrato</h2>
              <button
                type="button"
                onClick={handleSaveConfiguration}
                className="btn-save-config"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 'bold'
                }}
              >
                💾 Guardar Configuración
              </button>
            </div>
            
            {saveMessage && (
              <div style={{
                padding: '10px',
                marginBottom: '15px',
                borderRadius: '5px',
                backgroundColor: saveMessage.includes('✅') ? '#d4edda' : '#f8d7da',
                color: saveMessage.includes('✅') ? '#155724' : '#721c24',
                border: `1px solid ${saveMessage.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`
              }}>
                {saveMessage}
              </div>
            )}

            <div className="form-group">
              <label>Duración del Contrato (meses) *</label>
              <select
                value={contractData.contractMonths}
                onChange={(e) => setContractData({ ...contractData, contractMonths: e.target.value })}
              >
                <option value="">Seleccionar duración</option>
                <option value="1">1 mes</option>
                <option value="3">3 meses</option>
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
              </select>
            </div>

            <div className="form-group">
              <label>Fecha de Inicio *</label>
              <input
                type="date"
                value={contractData.startDate}
                onChange={(e) => setContractData({ ...contractData, startDate: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Tipo de Red</label>
              <select
                value={contractData.networkType}
                onChange={(e) => setContractData({ ...contractData, networkType: e.target.value })}
              >
                <option value="">Seleccionar red (opcional)</option>
                {networks.map((network) => (
                  <option key={network.id} value={network.name}>
                    {network.name}
                  </option>
                ))}
              </select>
              <small style={{ color: '#666', fontSize: '0.85em' }}>
                Se vinculará al cliente al guardar el contrato
              </small>
            </div>

            <div className="form-group">
              <label>Correo Electrónico</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="email"
                  value={contractData.email}
                  onChange={(e) => setContractData({ ...contractData, email: e.target.value })}
                  placeholder="ejemplo@correo.com"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={generateRandomEmail}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    whiteSpace: 'nowrap'
                  }}
                  title="Generar correo aleatorio"
                >
                  🎲 Generar
                </button>
              </div>
              <small style={{ color: '#666', fontSize: '0.85em' }}>
                Se vinculará al cliente al guardar el contrato. Puedes generar uno aleatorio si no tienes.
              </small>
            </div>

            <div className="form-group">
              <label>Métodos de Pago Aceptados</label>
              <small style={{ display: 'block', color: '#666', marginBottom: '8px', fontSize: '0.85em' }}>
                Estos métodos se guardarán para futuros contratos
              </small>
              <div className="payment-methods-input">
                <input
                  type="text"
                  placeholder="Ej: Efectivo, Transferencia, Tarjeta"
                  value={newPaymentMethod}
                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPaymentMethod();
                    }
                  }}
                />
                <button type="button" onClick={handleAddPaymentMethod} className="btn-add">
                  + Agregar
                </button>
              </div>
              {contractData.paymentMethods.length > 0 && (
                <div className="payment-methods-list">
                  {contractData.paymentMethods.map((method, index) => (
                    <span key={index} className="payment-method-tag">
                      {method}
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentMethod(method)}
                        className="remove-btn"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Horarios de Atención</label>
              <small style={{ display: 'block', color: '#666', marginBottom: '8px', fontSize: '0.85em' }}>
                Este horario se guardará para futuros contratos. Usa "Guardar Configuración" para asegurar que se guarde.
              </small>
              <textarea
                rows="4"
                value={contractData.businessHours}
                onChange={(e) => setContractData({ ...contractData, businessHours: e.target.value })}
                placeholder="Ej: Lunes a Viernes: 9:00 AM - 6:00 PM&#10;Sábados: 9:00 AM - 2:00 PM&#10;Domingos: Cerrado"
                style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontFamily: 'inherit' }}
              />
            </div>

            <div className="form-group">
              <label>Términos y Condiciones</label>
              <small style={{ display: 'block', color: '#666', marginBottom: '8px', fontSize: '0.85em' }}>
                Estos términos se guardarán para futuros contratos. Usa "Guardar Configuración" para asegurar que se guarden.
              </small>
              <textarea
                rows="6"
                value={contractData.termsAndConditions}
                onChange={(e) => setContractData({ ...contractData, termsAndConditions: e.target.value })}
                placeholder="Ingrese los términos y condiciones del contrato..."
                style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', fontFamily: 'inherit' }}
              />
            </div>

            <div className="form-group">
              <label>Notas Adicionales (opcional)</label>
              <textarea
                rows="4"
                value={contractData.additionalNotes}
                onChange={(e) => setContractData({ ...contractData, additionalNotes: e.target.value })}
                placeholder="Cualquier información adicional que desee incluir..."
              />
            </div>
          </div>
        </div>

        <div className="contract-actions-section">
          <div className="actions-card">
            <h2>Acciones</h2>
            <div className="action-buttons">
              <button
                className="btn-primary"
                onClick={handleGeneratePDF}
                disabled={!selectedClient || !contractData.contractMonths || !contractData.startDate}
              >
                👁️ Previsualizar PDF
              </button>
              <button
                className="btn-secondary"
                onClick={handleDownloadPDF}
                disabled={!selectedClient || !contractData.contractMonths || !contractData.startDate}
              >
                📥 Descargar PDF
              </button>
              {selectedClient?.phone && (
                <button
                  className="btn-whatsapp"
                  onClick={handleSendWhatsApp}
                  disabled={!selectedClient}
                >
                  💬 Enviar por WhatsApp
                </button>
              )}
            </div>
            {!selectedClient?.phone && selectedClient && (
              <p className="warning-text">
                ⚠️ El cliente no tiene número de teléfono registrado para enviar por WhatsApp
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientContract;

