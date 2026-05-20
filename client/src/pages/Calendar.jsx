import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatLocalDate } from '../utils/dateUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import './Calendar.css';

const Calendar = () => {
  const { toast } = useToast();
  const [installations, setInstallations] = useState([]);
  const [folios, setFolios] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchData();
  }, [currentDate, view]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [installationsRes, foliosRes] = await Promise.all([
        api.get('/installations'),
        api.get('/folios')
      ]);
      setInstallations(installationsRes.data || []);
      setFolios(foliosRes.data || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos del calendario');
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    // Días del mes anterior
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    const events = [];
    
    installations.forEach(inst => {
      const instDate = new Date(inst.installation_date).toISOString().split('T')[0];
      if (instDate === dateStr) {
        events.push({
          type: 'installation',
          id: inst.id,
          title: `Instalación: ${inst.custom_name || inst.client_name || 'Sin nombre'}`,
          date: inst.installation_date,
          data: inst
        });
      }
    });
    
    folios.forEach(folio => {
      const folioDate = new Date(folio.visit_date).toISOString().split('T')[0];
      if (folioDate === dateStr) {
        events.push({
          type: 'folio',
          id: folio.id,
          title: `Folio: ${folio.folio_number || folio.id}`,
          date: folio.visit_date,
          data: folio
        });
      }
    });
    
    return events;
  };

  const navigateMonth = (direction) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const days = getDaysInMonth(currentDate);

  if (loading) {
    return <LoadingSpinner message="Cargando calendario..." fullScreen />;
  }

  return (
    <div className="calendar-page">
      <div className="page-header">
        <h1>📅 Calendario</h1>
        <div className="calendar-controls">
          <button onClick={() => navigateMonth(-1)}>◀ Mes Anterior</button>
          <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button onClick={() => navigateMonth(1)}>Mes Siguiente ▶</button>
          <button onClick={() => setCurrentDate(new Date())}>Hoy</button>
        </div>
      </div>

      <div className="calendar-container">
        <div className="calendar-grid">
          {weekDays.map(day => (
            <div key={day} className="calendar-header">{day}</div>
          ))}
          {days.map((date, index) => {
            const events = getEventsForDate(date);
            return (
              <div
                key={index}
                className={`calendar-day ${date ? '' : 'empty'} ${date && date.toDateString() === new Date().toDateString() ? 'today' : ''}`}
                onClick={() => date && events.length > 0 && setSelectedEvent({ date, events })}
              >
                {date && (
                  <>
                    <div className="day-number">{date.getDate()}</div>
                    <div className="day-events">
                      {events.slice(0, 3).map((event, idx) => (
                        <div
                          key={idx}
                          className={`event-dot ${event.type}`}
                          title={event.title}
                        />
                      ))}
                      {events.length > 3 && (
                        <div className="more-events">+{events.length - 3}</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Eventos del {formatLocalDate(selectedEvent.date)}</h2>
            <div className="events-list">
              {selectedEvent.events.map(event => (
                <div key={event.id} className="event-item">
                  <h3>{event.title}</h3>
                  <p><strong>Tipo:</strong> {event.type === 'installation' ? 'Instalación' : 'Folio'}</p>
                  {event.type === 'installation' && (
                    <>
                      <p><strong>Cliente:</strong> {event.data.custom_name || event.data.client_name || '-'}</p>
                      <p><strong>Estado:</strong> {event.data.status || '-'}</p>
                    </>
                  )}
                  {event.type === 'folio' && (
                    <>
                      <p><strong>Cliente:</strong> {event.data.client_name || '-'}</p>
                      <p><strong>Problema:</strong> {event.data.problem_description || '-'}</p>
                      <p><strong>Estado:</strong> {event.data.status || '-'}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-cancel" onClick={() => setSelectedEvent(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;











