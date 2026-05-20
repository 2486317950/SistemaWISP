import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import LoadingSpinner from '../components/LoadingSpinner';
import './PortalChats.css';

const PortalChats = () => {
  const [chats, setChats] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const messagesEndRef = useRef(null);
  const selectedIdRef = useRef(null);
  const { socket, isConnected } = useSocket();
  selectedIdRef.current = selected?.id;

  const fetchChats = async () => {
    try {
      const res = await api.get('/portal-chats');
      setChats(res.data || []);
    } catch (err) {
      console.error('Error al cargar chats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChat = async (id) => {
    try {
      const res = await api.get(`/portal-chats/${id}`);
      setSelected(res.data);
      setMessages(res.data?.messages || []);
    } catch (err) {
      console.error('Error al cargar chat:', err);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Escuchar nuevos mensajes y transferencias (eventos reales del servidor)
  useEffect(() => {
    if (!socket || !isConnected) return;
    const onNew = () => {
      fetchChats();
      if (selectedIdRef.current) fetchChat(selectedIdRef.current);
    };
    const onStaffMessage = (data) => {
      if (data?.chatId === selectedIdRef.current) {
        setMessages((prev) => [...prev, { role: 'staff', content: data.content, id: data.messageId }]);
      }
    };
    socket.on('portal_chat:new_message', onNew);
    socket.on('portal_chat:transferred', onNew);
    socket.on('portal_chat:staff_message', onStaffMessage);
    socket.on('portal_chat:closed', onNew);
    return () => {
      socket.off('portal_chat:new_message', onNew);
      socket.off('portal_chat:transferred', onNew);
      socket.off('portal_chat:staff_message', onStaffMessage);
      socket.off('portal_chat:closed', onNew);
    };
  }, [socket, isConnected]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!selected?.id || !reply.trim() || sending) return;
    const text = reply.trim();
    setReply('');
    setSending(true);
    try {
      const res = await api.post(`/portal-chats/${selected.id}/messages`, { content: text });
      setMessages((prev) => [...prev, { role: 'staff', content: text, id: res.data?.id }]);
    } catch (err) {
      console.error('Error al enviar:', err);
      setReply(text);
    } finally {
      setSending(false);
    }
  };

  const handleFinalize = async () => {
    if (!selected?.id || selected?.status !== 'transferred' || finalizing) return;
    if (!window.confirm('¿Finalizar este chat? El cliente podrá iniciar una nueva conversación después.')) return;
    setFinalizing(true);
    try {
      await api.post(`/portal-chats/${selected.id}/finalize`);
      setSelected((prev) => (prev ? { ...prev, status: 'closed' } : null));
      setChats((prev) => prev.map((c) => (c.id === selected.id ? { ...c, status: 'closed' } : c)));
    } catch (err) {
      console.error('Error al finalizar:', err);
    } finally {
      setFinalizing(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const same = date.toDateString() === now.toDateString();
    return same ? date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('es-MX');
  };

  return (
    <div className="portal-chats-page">
      <div className="portal-chats-header">
        <h1>💬 Chats del portal</h1>
        <p>Conversaciones con clientes (IA o transferidas a personal)</p>
      </div>

      <div className="portal-chats-layout">
        <aside className={`portal-chats-list ${selected ? 'hide-on-mobile' : 'show-only-on-mobile'}`}>
          {loading ? (
            <LoadingSpinner />
          ) : (
            <ul>
              {chats.length === 0 && <li className="portal-chats-empty">No hay chats aún</li>}
              {chats.map((c) => (
                <li
                  key={c.id}
                  className={`portal-chats-item ${selected?.id === c.id ? 'active' : ''} ${c.status === 'transferred' ? 'transferred' : ''}`}
                  onClick={() => fetchChat(c.id)}
                >
                  <div className="portal-chats-item-name">{c.client_name || c.client_number || `Cliente #${c.client_id}`}</div>
                  <div className="portal-chats-item-preview">{c.last_message ? String(c.last_message).slice(0, 50) + (c.last_message.length > 50 ? '…' : '') : '—'}</div>
                  <div className="portal-chats-item-meta">
                    {c.status === 'transferred' && <span className="portal-chats-badge">Asesor</span>}
                    {c.status === 'closed' && <span className="portal-chats-badge portal-chats-badge-closed">Finalizado</span>}
                    <span>{formatDate(c.last_message_at || c.updated_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className={`portal-chats-detail ${selected ? 'show-only-on-mobile' : 'hide-on-mobile'}`}>
          {!selected ? (
            <div className="portal-chats-detail-empty">
              Selecciona un chat para ver la conversación y responder.
            </div>
          ) : (
            <>
              <div className="portal-chats-detail-header">
                <button
                  type="button"
                  className="portal-chats-back-btn"
                  onClick={() => setSelected(null)}
                  aria-label="Volver a la lista"
                >
                  ← Volver
                </button>
                <div>
                  <h2>{selected.client_name || selected.client_number || `Cliente #${selected.client_id}`}</h2>
                  <p>{selected.client_number && `Nº ${selected.client_number}`} {selected.phone && ` · ${selected.phone}`}</p>
                  {selected.status === 'transferred' && <span className="portal-chats-badge">Con asesor</span>}
                  {selected.status === 'closed' && <span className="portal-chats-badge portal-chats-badge-closed">Finalizado</span>}
                </div>
                {selected.status === 'transferred' && (
                  <button
                    type="button"
                    className="portal-chats-finalize-btn"
                    onClick={handleFinalize}
                    disabled={finalizing}
                  >
                    {finalizing ? 'Finalizando…' : 'Finalizar chat'}
                  </button>
                )}
              </div>
              <div className="portal-chats-messages">
                {messages.map((m) => (
                  <div key={m.id || Math.random()} className={`portal-chats-msg ${m.role}`}>
                    {m.role === 'staff' && <span className="portal-chats-msg-role">Tú</span>}
                    {m.role === 'user' && <span className="portal-chats-msg-role">Cliente</span>}
                    {m.role === 'assistant' && <span className="portal-chats-msg-role">IA</span>}
                    <div className="portal-chats-msg-content">{m.content}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              {selected.status !== 'closed' && (
                <form className="portal-chats-reply-form" onSubmit={handleSend}>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Escribe tu respuesta..."
                    rows={2}
                    disabled={sending}
                  />
                  <button type="submit" disabled={sending || !reply.trim()}>Enviar</button>
                </form>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default PortalChats;
