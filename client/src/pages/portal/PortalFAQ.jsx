import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import './PortalFAQ.css';

const PortalFAQ = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    portalApi.get('/client-portal/faq')
      .then((res) => setFaqs(res.data || []))
      .catch(() => setFaqs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="portal-loading">Cargando...</div>;
  }

  return (
    <div className="portal-faq">
      <h2>Preguntas frecuentes</h2>
      <p className="portal-faq-desc">Encuentra respuestas a las dudas más comunes.</p>
      {faqs.length === 0 ? (
        <div className="portal-empty">No hay preguntas frecuentes configuradas.</div>
      ) : (
        <div className="faq-list">
          {faqs.map((faq, idx) => (
            <div
              key={faq.id || idx}
              className={`faq-item ${openId === (faq.id ?? idx) ? 'open' : ''}`}
              onClick={() => setOpenId(openId === (faq.id ?? idx) ? null : (faq.id ?? idx))}
            >
              <div className="faq-question">
                <span>{faq.question}</span>
                <span className="faq-toggle">{openId === (faq.id ?? idx) ? '−' : '+'}</span>
              </div>
              {openId === (faq.id ?? idx) && (
                <div className="faq-answer">{faq.answer}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalFAQ;
