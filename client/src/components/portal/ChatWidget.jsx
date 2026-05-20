import React, { useState, useRef, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import './ChatWidget.css';

const MAX_ATTACHMENTS = 5;
const ACCEPT_FILES = 'image/*,application/pdf';
const POLL_INTERVAL_MS = 5000;

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [status, setStatus] = useState('active');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingFirstChoice, setPendingFirstChoice] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const lastMessageIdRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Al abrir el panel, cargar chat actual (persistente)
  useEffect(() => {
    if (!open) return;
    portalApi.get('/client-portal/chats/current').then((res) => {
      const { chatId: id, status: st, messages: msgs } = res.data || {};
      setChatId(id);
      setStatus(st || 'active');
      let list = (msgs || []).map((m) => ({ role: m.role, content: m.content, id: m.id }));
      if (st === 'closed' && list.length > 0) {
        const hasFinalized = list.some((m) => m.role === 'system' && m.content === '__CHAT_FINALIZADO__');
        if (!hasFinalized) list = [...list, { role: 'system', content: '__CHAT_FINALIZADO__', id: 'finalized' }];
      }
      setMessages(list);
      const maxId = Math.max(0, ...(msgs || []).map((m) => m.id || 0));
      lastMessageIdRef.current = maxId;
    }).catch(() => {});
  }, [open]);

  const fetchNewMessages = useRef(() => {
    portalApi.get(`/client-portal/chats/current/messages?since=${lastMessageIdRef.current}`).then((res) => {
      const list = res.data?.messages || [];
      const chatStatus = res.data?.status;
      if (chatStatus === 'closed') {
        setStatus('closed');
        setMessages((prev) => {
          const hasFinalizedMsg = prev.some((m) => m.role === 'system' && m.content === '__CHAT_FINALIZADO__');
          if (hasFinalizedMsg) return prev;
          return [...prev, { role: 'system', content: '__CHAT_FINALIZADO__', id: 'finalized' }];
        });
      }
      if (list.length > 0) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id).filter((id) => id != null));
          const newOnes = list.filter((m) => m.id && !seen.has(m.id));
          if (newOnes.length === 0) return prev;
          newOnes.forEach((m) => { lastMessageIdRef.current = Math.max(lastMessageIdRef.current, m.id); });
          // Quitar mensajes locales sin id que sean el mismo que uno entrante (evita duplicar respuestas de la IA)
          const incomingKeys = new Set(newOnes.map((m) => `${m.role}\0${m.content}`));
          const withoutDuplicates = prev.filter(
            (m) => m.id != null || !incomingKeys.has(`${m.role}\0${m.content}`)
          );
          return [...withoutDuplicates, ...newOnes.map((m) => ({ role: m.role, content: m.content, id: m.id }))];
        });
      }
    }).catch(() => {});
  }).current;

  // Polling cuando el chat está transferido a personal (recibir respuestas del asesor)
  useEffect(() => {
    if (!open || status !== 'transferred') return;
    fetchNewMessages();
    pollRef.current = setInterval(fetchNewMessages, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [open, status]);

  const doSendMessage = async (text, files, transferToStaff = false) => {
    const hasAttachments = files && files.length > 0;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setLoading(true);
    setError('');

    try {
      let res;
      if (hasAttachments) {
        const formData = new FormData();
        formData.append('message', text || 'Adjunto comprobante(s) de pago para revisión.');
        formData.append('history', JSON.stringify(history));
        if (chatId) formData.append('chatId', String(chatId));
        if (transferToStaff) formData.append('transferToStaff', 'true');
        files.forEach((file) => formData.append('attachments', file));
        res = await portalApi.post('/client-portal/chat', formData);
      } else {
        res = await portalApi.post('/client-portal/chat', {
          message: text,
          history,
          chatId: chatId || undefined,
          transferToStaff: transferToStaff || undefined
        });
      }
      if (res.data?.transferred) {
        setStatus('transferred');
        // No añadir el mensaje aquí: el polling lo traerá y evita duplicados
        setTimeout(() => fetchNewMessages(), 300);
      } else {
        if (res.data?.reopened) setStatus('active');
        const reply = res.data?.reply || 'No pude generar una respuesta.';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      }
    } catch (err) {
      if (typeof window !== 'undefined') {
        console.error('[Chat] Error:', err?.response?.status, err?.response?.data, err?.message);
      }
      const msg = err.response?.data?.error || 'Error al enviar. Intenta de nuevo.';
      setError(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    const hasAttachments = attachments.length > 0;
    if ((!text && !hasAttachments) || loading) return;

    const displayText = text || `Comprobante(s) adjunto(s): ${attachments.map((f) => f.name).join(', ')}`;
    setInput('');
    setAttachments([]);

    if (messages.length === 0 || status === 'closed') {
      setPendingFirstChoice({ text: text || '', attachments: [...attachments] });
      if (messages.length === 0) setMessages((prev) => [...prev, { role: 'user', content: displayText }]);
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: displayText }]);
    await doSendMessage(text, attachments, false);
  };

  const chooseChannel = async (transferToStaff) => {
    if (!pendingFirstChoice) return;
    const { text, attachments: files } = pendingFirstChoice;
    setPendingFirstChoice(null);
    const displayText = text || (files?.length ? `Comprobante(s) adjunto(s): ${files.map((f) => f.name).join(', ')}` : '');
    if (displayText) setMessages((prev) => [...prev, { role: 'user', content: displayText }]);
    await doSendMessage(text, files, transferToStaff);
  };

  const onFileChange = (e) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    const valid = list.filter((f) => f.size <= 5 * 1024 * 1024); // 5MB
    setAttachments((prev) => {
      const next = [...prev, ...valid].slice(0, MAX_ATTACHMENTS);
      return next;
    });
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        type="button"
        className="chat-widget-fab"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Cerrar chat' : 'Abrir asistente'}
        title="Asistente IA"
      >
        {open ? '✕' : '💬'}
      </button>
      {open && (
        <div className="chat-widget-panel">
          <div className="chat-widget-header">
            <span>Asistente IA</span>
            <button type="button" className="chat-widget-close" onClick={() => setOpen(false)} aria-label="Cerrar">
              ✕
            </button>
          </div>
          <div className="chat-widget-messages">
            {status === 'transferred' && (
              <div className="chat-widget-transferred-banner">
                Un asesor te atenderá en breve. Puedes seguir escribiendo.
              </div>
            )}
            {status === 'closed' && (
              <div className="chat-widget-transferred-banner chat-widget-closed-banner">
                Este chat fue finalizado. Escribe un mensaje para iniciar una nueva conversación.
              </div>
            )}
            {messages.length === 0 && status !== 'transferred' && (
              <div className="chat-widget-welcome">
                <p>Hola, soy tu asistente virtual.</p>
                <p>Pregúntame sobre pagos, paquetes, métodos de pago o cómo usar el portal.</p>
              </div>
            )}
            {messages.map((m, i) => (
              m.role === 'system' && m.content === '__CHAT_FINALIZADO__' ? (
                <div key={m.id || i} className="chat-widget-msg chat-widget-msg-finalized">
                  — El asesor finalizó esta conversación. Puedes escribir para iniciar una nueva. —
                </div>
              ) : (
                <div key={m.id || i} className={`chat-widget-msg ${m.role === 'staff' ? 'staff' : m.role}`}>
                  {m.role === 'staff' && <span className="chat-widget-role-label">Asesor</span>}
                  {m.content}
                </div>
              )
            ))}
            {pendingFirstChoice && (
              <div className="chat-widget-choice-card">
                <p className="chat-widget-choice-question">¿Prefieres chatear con la IA o con un asesor?</p>
                <div className="chat-widget-choice-buttons">
                  <button type="button" className="chat-widget-choice-btn ia" onClick={() => chooseChannel(false)} disabled={loading}>
                    🤖 Con la IA
                  </button>
                  <button type="button" className="chat-widget-choice-btn person" onClick={() => chooseChannel(true)} disabled={loading}>
                    👤 Con una persona
                  </button>
                </div>
              </div>
            )}
            {loading && (
              <div className="chat-widget-msg assistant">
                <span className="chat-widget-typing">...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <form className="chat-widget-form" onSubmit={sendMessage}>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_FILES}
              multiple
              className="chat-widget-file-input"
              onChange={onFileChange}
              aria-label="Adjuntar comprobante"
            />
            {attachments.length > 0 && (
              <div className="chat-widget-attachments">
                {attachments.map((f, i) => (
                  <span key={i} className="chat-widget-attachment-tag">
                    {f.name}
                    <button type="button" onClick={() => removeAttachment(i)} aria-label="Quitar">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="chat-widget-form-row">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe o adjunta un comprobante..."
                rows={2}
                disabled={loading}
                maxLength={2000}
              />
              <div className="chat-widget-form-actions">
                <button
                  type="button"
                  className="chat-widget-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || attachments.length >= MAX_ATTACHMENTS}
                  title="Adjuntar imagen o PDF (comprobante)"
                  aria-label="Adjuntar"
                >
                  📎
                </button>
                <button type="submit" disabled={loading || (!input.trim() && attachments.length === 0)}>
                  Enviar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
