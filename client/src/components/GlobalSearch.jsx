import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './GlobalSearch.css';

const GlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length >= 2) {
      performSearch();
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const [clientsRes, paymentsRes, installationsRes, foliosRes] = await Promise.all([
        api.get(`/clients?search=${encodeURIComponent(query)}&status=all`).catch(() => ({ data: [] })),
        api.get(`/payments?search=${encodeURIComponent(query)}`).catch(() => ({ data: [] })),
        api.get(`/installations?search=${encodeURIComponent(query)}`).catch(() => ({ data: [] })),
        api.get(`/folios?search=${encodeURIComponent(query)}`).catch(() => ({ data: [] }))
      ]);

      const allResults = [
        ...(clientsRes.data || []).map(item => ({ ...item, type: 'client', label: 'Cliente' })),
        ...(paymentsRes.data || []).map(item => ({ ...item, type: 'payment', label: 'Pago' })),
        ...(installationsRes.data || []).map(item => ({ ...item, type: 'installation', label: 'Instalación' })),
        ...(foliosRes.data || []).map(item => ({ ...item, type: 'folio', label: 'Folio' }))
      ].filter(item => {
        const searchLower = query.toLowerCase();
        const name = (item.name || item.client_name || item.custom_name || item.folio_number || '').toLowerCase();
        const address = (item.address || '').toLowerCase();
        const phone = (item.phone || '').toLowerCase();
        const clientNumber = (item.client_number || '').toLowerCase();
        return name.includes(searchLower) || address.includes(searchLower) || 
               phone.includes(searchLower) || clientNumber.includes(searchLower);
      }).slice(0, 10); // Limitar a 10 resultados

      setResults(allResults);
      setShowResults(allResults.length > 0);
    } catch (error) {
      console.error('Error en búsqueda global:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result) => {
    setShowResults(false);
    setQuery('');
    
    switch (result.type) {
      case 'client':
        navigate(`/sistema/clients/${result.id}`);
        break;
      case 'payment':
        navigate('/payments');
        break;
      case 'installation':
        navigate('/sistema/installations');
        break;
      case 'folio':
        navigate('/folios');
        break;
      default:
        break;
    }
  };

  const getResultTitle = (result) => {
    switch (result.type) {
      case 'client':
        return result.name || 'Sin nombre';
      case 'payment':
        return `Pago - ${result.client_name || 'Sin cliente'}`;
      case 'installation':
        return `Instalación - ${result.custom_name || result.client_name || 'Sin nombre'}`;
      case 'folio':
        return `Folio ${result.folio_number || result.id}`;
      default:
        return 'Sin título';
    }
  };

  return (
    <div className="global-search" ref={searchRef}>
      <div className="search-input-container">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Buscar en todo el sistema (Ctrl+K)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && results.length > 0 && setShowResults(true)}
        />
        {loading && <span className="search-loading">⏳</span>}
      </div>
      
      {showResults && results.length > 0 && (
        <div className="search-results">
          {results.map((result, index) => (
            <div
              key={`${result.type}-${result.id}-${index}`}
              className="search-result-item"
              onClick={() => handleResultClick(result)}
            >
              <span className="result-type">{result.label}</span>
              <span className="result-title">{getResultTitle(result)}</span>
              {result.address && (
                <span className="result-subtitle">{result.address}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;











