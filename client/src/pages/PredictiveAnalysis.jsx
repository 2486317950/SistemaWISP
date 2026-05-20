import React, { useState, useEffect } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import './PredictiveAnalysis.css';

const PredictiveAnalysis = () => {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      // Análisis de morosidad
      const [paymentsRes, clientsRes] = await Promise.all([
        api.get('/payments'),
        api.get('/clients')
      ]);

      const payments = paymentsRes.data || [];
      const clients = clientsRes.data || [];

      // Calcular riesgo de morosidad
      const now = new Date();
      const riskAnalysis = clients.map(client => {
        const clientPayments = payments.filter(p => p.client_id === client.id);
        const lastPayment = clientPayments.length > 0 
          ? new Date(Math.max(...clientPayments.map(p => new Date(p.payment_date))))
          : null;
        
        const daysSinceLastPayment = lastPayment 
          ? Math.floor((now - lastPayment) / (1000 * 60 * 60 * 24))
          : null;

        let riskScore = 0;
        if (!lastPayment) riskScore += 50;
        if (daysSinceLastPayment > 30) riskScore += 30;
        if (daysSinceLastPayment > 60) riskScore += 20;
        if (client.status === 'suspendido') riskScore += 40;

        return {
          client_id: client.id,
          client_name: client.name,
          risk_score: Math.min(100, riskScore),
          days_since_payment: daysSinceLastPayment,
          status: riskScore > 70 ? 'Alto' : riskScore > 40 ? 'Medio' : 'Bajo'
        };
      });

      // Análisis de tendencias
      const monthlyData = {};
      payments.forEach(payment => {
        const month = new Date(payment.payment_date).toISOString().substring(0, 7);
        if (!monthlyData[month]) {
          monthlyData[month] = { month, total: 0, count: 0 };
        }
        monthlyData[month].total += parseFloat(payment.amount || 0);
        monthlyData[month].count += 1;
      });

      const trendData = Object.values(monthlyData)
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      setAnalysis({
        risk_analysis: riskAnalysis.sort((a, b) => b.risk_score - a.risk_score),
        trend_data: trendData,
        high_risk_count: riskAnalysis.filter(r => r.risk_score > 70).length,
        medium_risk_count: riskAnalysis.filter(r => r.risk_score > 40 && r.risk_score <= 70).length,
        low_risk_count: riskAnalysis.filter(r => r.risk_score <= 40).length
      });
    } catch (error) {
      console.error('Error al cargar análisis:', error);
      toast.error('Error al cargar análisis predictivo');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Analizando datos..." fullScreen />;
  }

  const riskChartData = [
    { name: 'Alto Riesgo', value: analysis?.high_risk_count || 0 },
    { name: 'Riesgo Medio', value: analysis?.medium_risk_count || 0 },
    { name: 'Bajo Riesgo', value: analysis?.low_risk_count || 0 }
  ];

  return (
    <div className="predictive-analysis-page">
      <div className="page-header">
        <h1>🔮 Análisis Predictivo</h1>
      </div>

      <div className="analysis-sections">
        <div className="analysis-section">
          <h2>Análisis de Riesgo de Morosidad</h2>
          <div className="risk-stats">
            <div className="risk-card high">
              <h3>Alto Riesgo</h3>
              <p>{analysis?.high_risk_count || 0}</p>
            </div>
            <div className="risk-card medium">
              <h3>Riesgo Medio</h3>
              <p>{analysis?.medium_risk_count || 0}</p>
            </div>
            <div className="risk-card low">
              <h3>Bajo Riesgo</h3>
              <p>{analysis?.low_risk_count || 0}</p>
            </div>
          </div>
          <div className="chart-container">
            <p style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>
              Gráfico temporalmente deshabilitado
            </p>
          </div>
        </div>

        <div className="analysis-section">
          <h2>Tendencias de Pagos</h2>
          <div className="chart-container">
            <p style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>
              Gráfico temporalmente deshabilitado
            </p>
          </div>
        </div>

        <div className="analysis-section">
          <h2>Clientes en Alto Riesgo</h2>
          <div className="risk-list">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Puntuación</th>
                  <th>Días sin Pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {analysis?.risk_analysis?.slice(0, 20).map(item => (
                  <tr key={item.client_id}>
                    <td>{item.client_name}</td>
                    <td>
                      <span className={`risk-badge ${item.status.toLowerCase().replace(' ', '-')}`}>
                        {item.risk_score}
                      </span>
                    </td>
                    <td>{item.days_since_payment !== null ? item.days_since_payment : 'N/A'}</td>
                    <td>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictiveAnalysis;

