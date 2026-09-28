import React, { useState, useRef, useEffect } from 'react';
import { engineering } from '../../api/engineering.api';
import StatusBadge from '../common/StatusBadge';

const QUICK_PROMPTS = [
  { label: 'Requisitos sin casos de uso', query: '¿Qué requisitos aprobados no tienen casos de uso asignados?' },
  { label: 'Impacto de arquitectura', query: '¿Cuál es el impacto en la arquitectura y diagramas del sistema?' },
  { label: 'Resumen de requerimientos', query: 'Resume los requerimientos funcionales aprobados y sus fuentes' },
  { label: 'Verificar trazabilidad', query: 'Verificar la trazabilidad entre entrevistas y requisitos' }
];

export default function ProjectChatView({ project, onProjectUpdated }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `¡Hola! Soy tu asistente de ingeniería para **${project.name}**. Puedo responder preguntas sobre los requerimientos, analizar la cobertura con diagramas y casos de uso, o ayudarte a registrar propuestas de cambio basadas en nueva evidencia.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      context: [],
      candidates: []
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('local'); // 'local', 'ollama', 'openai'
  const [proposeChange, setProposeChange] = useState(false);

  // Manual source drawer state
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [sourceSaved, setSourceSaved] = useState(false);
  const [savingSource, setSavingSource] = useState(false);

  // Context accordion in responses
  const [expandedContexts, setExpandedContexts] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, busy]);

  const toggleContext = (msgId) => {
    setExpandedContexts(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || busy) return;

    const userMsg = {
      id: 'usr_' + Date.now(),
      role: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      proposeChange
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setBusy(true);
    setError('');

    try {
      const response = await engineering(project.id, '/chat', {
        message: text,
        proposeChange,
        provider
      });

      const aiMsg = {
        id: 'ai_' + Date.now(),
        role: 'assistant',
        text: response.answer || 'Sin respuesta del asistente.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        context: response.context || [],
        candidates: response.candidates || [],
        proposeChange
      };

      setMessages(prev => [...prev, aiMsg]);

      if (response.candidates?.length > 0 || proposeChange) {
        onProjectUpdated?.();
      }
    } catch (err) {
      setError(err.message || 'Error al comunicarse con el asistente.');
      const errorMsg = {
        id: 'err_' + Date.now(),
        role: 'assistant',
        text: `⚠️ Hubo un error al procesar la solicitud: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setBusy(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveManualSource = async () => {
    if (!sourceText.trim() || savingSource) return;
    try {
      setSavingSource(true);
      await engineering(project.id, '/sources/text', { text: sourceText, type: 'MANUAL' });
      setSourceSaved(true);
      setSourceText('');
      onProjectUpdated?.();
      setTimeout(() => {
        setSourceSaved(false);
        setShowSourceDrawer(false);
      }, 2000);
    } catch (err) {
      alert(`Error al guardar fuente: ${err.message}`);
    } finally {
      setSavingSource(false);
    }
  };

  return (
    <div className="chat-view-layout">
      {/* ── Main Chat Area ── */}
      <div className="chat-main-column">
        {/* Header Bar */}
        <div className="chat-top-bar">
          <div className="chat-top-title-group">
            <div className="chat-ai-badge-icon">
              <span className="ms ms-sm">auto_awesome</span>
            </div>
            <div>
              <h2 className="chat-title">Chat Asistente & Copilot</h2>
              <p className="chat-subtitle">Consulta trazabilidad e impacto técnico sobre los requisitos oficiales</p>
            </div>
          </div>

          <div className="chat-top-actions">
            {/* Provider Selector */}
            <div className="chat-provider-selector">
              <span className="chat-provider-label">Motor:</span>
              <div className="chat-provider-buttons">
                <button
                  type="button"
                  className={`chat-provider-btn ${provider === 'local' ? 'active' : ''}`}
                  onClick={() => setProvider('local')}
                  title="Búsqueda semántica en base de datos local sin llamar APIs externas"
                >
                  <span className="ms ms-xs">search</span> Local
                </button>
                <button
                  type="button"
                  className={`chat-provider-btn ${provider === 'ollama' ? 'active' : ''}`}
                  onClick={() => setProvider('ollama')}
                  title="Modelo de lenguaje ejecutado localmente con Ollama"
                >
                  <span className="ms ms-xs">memory</span> Ollama
                </button>
                <button
                  type="button"
                  className={`chat-provider-btn ${provider === 'openai' ? 'active' : ''}`}
                  onClick={() => setProvider('openai')}
                  title="Modelo OpenAI GPT"
                >
                  <span className="ms ms-xs">cloud</span> GPT
                </button>
              </div>
            </div>

            {/* Manual Source Button */}
            <button
              type="button"
              className={`btn btn-sm ${showSourceDrawer ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowSourceDrawer(!showSourceDrawer)}
              title="Añadir notas o fuentes textuales al proyecto"
            >
              <span className="ms ms-xs">note_add</span>
              <span>Añadir Fuente</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Pill / Banner */}
        <div className={`chat-mode-banner ${proposeChange ? 'mode-proposal' : 'mode-query'}`}>
          <div className="chat-mode-info">
            <span className="ms ms-sm">{proposeChange ? 'edit_note' : 'verified'}</span>
            <div>
              <strong>{proposeChange ? 'Modo: Propuesta de Cambio Controlado' : 'Modo: Consulta de Requisitos (RAG)'}</strong>
              <span className="chat-mode-desc">
                {proposeChange
                  ? 'Tu mensaje generará un candidato para revisión formal sin alterar datos oficiales.'
                  : 'Respuestas fundamentadas estrictamente en la evidencia y requisitos aprobados.'}
              </span>
            </div>
          </div>
          <label className="chat-mode-toggle">
            <input
              type="checkbox"
              checked={proposeChange}
              onChange={(e) => setProposeChange(e.target.checked)}
            />
            <span className="chat-toggle-slider" />
            <span className="chat-toggle-text">Proponer cambio</span>
          </label>
        </div>

        {/* Message Thread */}
        <div className="chat-messages-container">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message-row ${msg.role === 'user' ? 'row-user' : 'row-assistant'}`}
            >
              {msg.role === 'assistant' && (
                <div className={`chat-avatar ai-avatar ${msg.isError ? 'avatar-error' : ''}`}>
                  <span className="ms ms-sm">{msg.isError ? 'error_outline' : 'smart_toy'}</span>
                </div>
              )}

              <div className="chat-bubble-container">
                <div className={`chat-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-assistant'}`}>
                  {/* Proposal Tag if sent in proposal mode */}
                  {msg.role === 'user' && msg.proposeChange && (
                    <div className="chat-bubble-tag proposal">
                      <span className="ms ms-xs">edit_note</span> Solicitud de cambio
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="chat-bubble-text">{msg.text}</div>

                  {/* Registered Candidates Card (if proposal was generated) */}
                  {msg.candidates && msg.candidates.length > 0 && (
                    <div className="chat-candidates-box">
                      <div className="chat-candidates-header">
                        <span className="ms ms-xs">checklist</span>
                        <strong>Candidato(s) de Requisito Registrado(s)</strong>
                      </div>
                      <div className="chat-candidates-list">
                        {msg.candidates.map((cand, idx) => (
                          <div key={cand.id || idx} className="chat-candidate-item">
                            <div className="candidate-badge-row">
                              <span className="badge badge-warning">{cand.temporaryCode || 'CANDIDATO'}</span>
                              <span className="candidate-type">{cand.type || 'FUNCTIONAL'}</span>
                            </div>
                            <div className="candidate-statement">{cand.statement || cand.title}</div>
                            {cand.evidence?.relationship?.target && (
                              <div className="candidate-relation">
                                Relacionado con: <strong>{cand.evidence.relationship.target}</strong> ({cand.evidence.relationship.relation})
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="chat-candidate-note">
                        Visita la pestaña <strong>Revisión ISO 29148 / Requisitos</strong> para aprobar o editar.
                      </p>
                    </div>
                  )}

                  {/* Context & Traceability Card */}
                  {msg.context && msg.context.length > 0 && (
                    <div className="chat-context-accordion">
                      <button
                        type="button"
                        className="chat-context-toggle"
                        onClick={() => toggleContext(msg.id)}
                      >
                        <span className="ms ms-xs">
                          {expandedContexts[msg.id] ? 'expand_less' : 'expand_more'}
                        </span>
                        <span>Evidencia y Requisitos relacionados ({msg.context.length})</span>
                      </button>

                      {expandedContexts[msg.id] && (
                        <div className="chat-context-content">
                          {msg.context.map((ctxItem, cIdx) => (
                            <div key={ctxItem.id || cIdx} className="chat-context-item">
                              <div className="context-item-head">
                                <span className="code-tag code-tag-primary">{ctxItem.code}</span>
                                {ctxItem.source && (
                                  <span className="context-source-tag">
                                    <span className="ms ms-xs">mic</span> {ctxItem.source}
                                  </span>
                                )}
                              </div>
                              <p className="context-item-desc">{ctxItem.description}</p>
                              {ctxItem.impact && (
                                <div className="context-impact-badge">
                                  Impacto: {ctxItem.impact.level || 'Bajo'} ({ctxItem.impact.affectedCount || 0} elementos)
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="chat-bubble-time">{msg.timestamp}</div>
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="chat-avatar user-avatar">
                  <span className="ms ms-sm">person</span>
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {busy && (
            <div className="chat-message-row row-assistant">
              <div className="chat-avatar ai-avatar">
                <span className="ms ms-sm spin">auto_awesome</span>
              </div>
              <div className="chat-bubble bubble-assistant typing-bubble">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="typing-text">
                  {proposeChange ? 'Registrando propuesta y analizando impacto...' : 'Consultando evidencia del proyecto...'}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="chat-quick-chips">
          <span className="quick-chips-label">Sugerencias:</span>
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="quick-chip-btn"
              disabled={busy}
              onClick={() => handleSendMessage(p.query)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="chat-input-dock">
          <div className="chat-input-wrapper">
            <textarea
              ref={textareaRef}
              rows={2}
              className="chat-textarea"
              placeholder={
                proposeChange
                  ? 'Describe el requerimiento o cambio propuesto para registrar como candidato...'
                  : 'Pregunta sobre los requerimientos, actores, casos de uso o impacto...'
              }
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
            />
            <div className="chat-input-bottom-row">
              <span className="chat-input-hint">
                Presiona <kbd>Enter</kbd> para enviar · <kbd>Shift + Enter</kbd> para salto de línea
              </span>
              <button
                type="button"
                className="btn btn-primary chat-send-btn"
                disabled={busy || !inputMessage.trim()}
                onClick={() => handleSendMessage()}
              >
                <span className="ms ms-xs">send</span>
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide-over / Side Drawer for Manual Text Source ── */}
      {showSourceDrawer && (
        <div className="chat-source-drawer">
          <div className="source-drawer-header">
            <div className="source-drawer-title">
              <span className="ms ms-sm">edit_document</span>
              <h3>Nueva Fuente Manual</h3>
            </div>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setShowSourceDrawer(false)}
            >
              <span className="ms ms-xs">close</span>
            </button>
          </div>

          <div className="source-drawer-body">
            <p className="source-drawer-desc">
              Pega transcripciones manuales, notas de reunión, correos o especificaciones para alimentar el análisis y trazabilidad del proyecto.
            </p>

            {sourceSaved && (
              <div className="alert alert-success" style={{ marginBottom: 12 }}>
                ✓ Fuente de texto guardada correctamente. Ya está disponible para análisis.
              </div>
            )}

            <label className="form-label">Contenido de la Fuente</label>
            <textarea
              className="form-control"
              rows={9}
              placeholder="Ejemplo: 'En la reunión con el cliente del 28 de Septiembre se acordó que el usuario debe poder iniciar sesión usando su correo institucional...'"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              disabled={savingSource}
            />

            <div className="source-drawer-actions">
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={savingSource || !sourceText.trim()}
                onClick={handleSaveManualSource}
              >
                {savingSource ? (
                  <>
                    <span className="ms ms-xs spin">autorenew</span> Guardando...
                  </>
                ) : (
                  <>
                    <span className="ms ms-xs">save</span> Guardar Fuente para Análisis
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
