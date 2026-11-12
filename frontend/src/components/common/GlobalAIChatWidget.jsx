import React, { useState, useEffect, useRef } from 'react';
import { engineering } from '../../api/engineering.api';

export default function GlobalAIChatWidget({ project, onProjectUpdated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Puedo consultar el contexto del proyecto y registrar propuestas para revisión. Las propuestas no modifican directamente el código ni aprueban etapas.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposeChange, setProposeChange] = useState(false);
  const [provider, setProvider] = useState('hybrid');
  const messagesEndRef = useRef(null);
  const activeRef = useRef(true);
  useEffect(() => { activeRef.current = true; return () => { activeRef.current = false; }; }, []);

  useEffect(() => {
    function handleExternalOpen(e) {
      setIsOpen(true);
      if (e?.detail?.initialPrompt) {
        setInput(e.detail.initialPrompt);
      }
    }
    window.addEventListener('icase:open-ai-chat', handleExternalOpen);
    return () => window.removeEventListener('icase:open-ai-chat', handleExternalOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  async function handleSend(e) {
    e?.preventDefault();
    const promptText = input.trim();
    if (!promptText || loading || !project?.id) return;

    const userMsg = { sender: 'user', text: promptText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await engineering(project.id, '/chat', {
        message: promptText,
        question: promptText,
        proposeChange,
        provider
      });
      if (!activeRef.current) return;

      const aiText = res?.answer || res?.data?.answer || 'Solicitud procesada con éxito.';
      const proposal = res?.proposal || (res?.candidates?.length ? { sourceId: res.sourceId, candidateIds: res.candidates.map(candidate => candidate.id) } : null);
      const context = res?.context || res?.data?.context || null;

      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: aiText,
          proposal,
          context, providerStatus: res?.providerStatus, calls: res?.calls || []
        }
      ]);

      if (proposal || proposeChange) {
        onProjectUpdated?.();
      }
    } catch (err) {
      if (!activeRef.current) return;
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Error al procesar la solicitud: ${err.message || 'Error de conexión con el motor de IA.'}`,
          isError: true
        }
      ]);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }

  if (!project?.id) return null;

  return (
    <>
      {/* ── BOTÓN FLOTANTE (ESQUINA INFERIOR DERECHA) ────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsButtonHovered(true)}
        onMouseLeave={() => setIsButtonHovered(false)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9990,
          background: isOpen
            ? '#F1F5F9'
            : isButtonHovered
              ? '#4338CA'
              : '#4F46E5',
          color: isOpen ? '#334155' : '#FFFFFF',
          border: isOpen ? '1px solid #CBD5E1' : '1px solid #4338CA',
          borderRadius: '9999px',
          padding: '10px 18px',
          boxShadow: isOpen
            ? '0 2px 8px rgba(15, 23, 42, 0.08)'
            : isButtonHovered
              ? '0 6px 20px rgba(79, 70, 229, 0.40)'
              : '0 4px 14px rgba(79, 70, 229, 0.28)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isOpen ? 'scale(0.96)' : isButtonHovered ? 'scale(1.02)' : 'scale(1)'
        }}
        title="Abrir Asistente de Arquitectura IA"
      >
        <span className="ms ms-sm" style={{ color: isOpen ? '#4F46E5' : '#EEF2FF' }}>auto_awesome</span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '-0.01em', color: isOpen ? '#334155' : '#FFFFFF' }}>
          {isOpen ? 'Cerrar Chat' : 'Chat IA'}
        </span>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#10B981',
          border: isOpen ? '1.5px solid #CBD5E1' : '1.5px solid #FFFFFF',
          display: 'inline-block'
        }} />
      </button>

      {/* ── VENTANA POP-UP FLOTANTE (MODAL / DRAWER) ─────────────────── */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '24px',
          width: '420px',
          maxWidth: 'calc(100vw - 48px)',
          height: '560px',
          maxHeight: 'calc(100vh - 110px)',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(15, 23, 42, 0.16)',
          zIndex: 9991,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInUp 0.18s ease-out'
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: '#4F46E5',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span className="ms ms-xs">auto_awesome</span>
              </div>
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#0F172A', display: 'block' }}>
                  Asistente iCASE
                </strong>
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                  {provider === 'hybrid' ? 'OpenAI prepara · Anthropic revisa' : provider === 'local' ? 'Consulta local sin llamadas IA' : 'Proveedor seleccionado: ' + provider}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value)}
                style={{
                  fontSize: '0.6875rem',
                  padding: '3px 6px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="hybrid">Híbrido (dos proveedores)</option>
                <option value="anthropic">Anthropic configurado</option>
                <option value="openai">OpenAI configurado</option>
                <option value="local">Local (sin IA)</option>
              </select>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Cerrar ventana"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#FFFFFF'
          }}>
            {messages.map((m, idx) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    background: isUser ? '#4F46E5' : m.isError ? '#FEF2F2' : '#F8FAFC',
                    color: isUser ? '#FFFFFF' : m.isError ? '#991B1B' : '#0F172A',
                    padding: '10px 14px',
                    borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    border: isUser ? 'none' : m.isError ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                    boxShadow: isUser ? '0 1px 3px rgba(79, 70, 229, 0.20)' : '0 1px 2px rgba(15, 23, 42, 0.04)'
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.text}
                  </div>

                  {['FAILED', 'PARTIAL'].includes(m.providerStatus) && <p role="alert" style={{ color: '#92400E' }}>La consulta de IA quedó {m.providerStatus === 'PARTIAL' ? 'sin completar su revisión' : 'sin respuesta del proveedor'}. {(m.calls || []).filter(call => call.error).map(call => call.error).join('; ')}</p>}
                  {!!m.calls?.length && <details><summary>Proveedores y consumo</summary>{m.calls.map((call, i) => <div key={i}>{call.provider} · {call.model || 'modelo no informado'} · {call.status} · {call.usage ? JSON.stringify(call.usage) : 'Consumo no informado'}</div>)}</details>}
                  {m.proposal && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      color: '#065F46'
                    }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs">check_circle</span>
                        <span>Propuesta de cambio registrada</span>
                      </div>
                      <p style={{ margin: '2px 0 0 0', color: '#047857' }}>
                        Revisa los candidatos antes de incorporarlos al proyecto.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div style={{
                alignSelf: 'flex-start',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                padding: '8px 14px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                color: '#64748B',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span className="ms ms-xs spin">autorenew</span>
                <span>Analizando impacto y procesando respuesta...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '12px 14px',
              borderTop: '1px solid #E2E8F0',
              background: '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={proposeChange}
                  onChange={e => setProposeChange(e.target.checked)}
                />
                <span>Registrar propuesta para revisión</span>
              </label>
              <span>Shift+Enter para salto de línea</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Escribe tu instrucción (ej: Agrega IVA a ventas)..."
                rows={2}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  resize: 'none',
                  outline: 'none',
                  color: '#0F172A',
                  background: '#FFFFFF',
                  fontFamily: 'inherit'
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                style={{
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !input.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(79, 70, 229, 0.25)'
                }}
                title="Enviar mensaje"
              >
                <span className="ms ms-xs">send</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

