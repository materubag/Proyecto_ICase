import React, { useState } from 'react';
import {
  Mic,
  Clock,
  User,
  Copy,
  Check,
  Search,
  RotateCcw,
  Volume2,
  FileAudio,
  Hash,
  AlertTriangle,
  Info
} from 'lucide-react';

function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export default function AudioTranscriptionViewer({
  source,
  currentVersion,
  onRetry,
  onSelectVersion
}) {
  const [activeTab, setActiveTab] = useState('segments'); // 'segments' | 'full' | 'meta'
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [retryFile, setRetryFile] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);

  const version = currentVersion || source.currentVersion;
  const segments = version?.segments || [];
  const extractedText = version?.extractedText || '';
  const metadata = version?.metadata || {};
  const duration = metadata?.duration;

  // Filtrado de segmentos
  const filteredSegments = searchQuery.trim()
    ? segments.filter(
        (seg) =>
          seg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (seg.speaker && seg.speaker.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : segments;

  const handleCopyText = async (textToCopy) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  const handleRetrySubmit = async (e) => {
    e.preventDefault();
    if (!retryFile || !onRetry) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await onRetry(source.id, retryFile);
      setRetryFile(null);
    } catch (err) {
      setRetryError(err.message || 'Error al reintentar transcripción');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--surface-container-lowest, #ffffff)',
        border: '1px solid var(--outline-variant, #e0e0e0)',
        borderRadius: '8px',
        padding: '18px',
        marginTop: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}
    >
      {/* Header con información de audio */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--outline-variant, #e0e0e0)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(103, 80, 164, 0.1)',
              color: 'var(--primary, #6750A4)',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            <FileAudio size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
              Transcripción: {source.name}
            </h4>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                fontSize: '0.78rem',
                color: 'var(--on-surface-variant, #666)',
                marginTop: '3px'
              }}
            >
              <span>Versión v{version?.version || 1}</span>
              {duration ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={13} /> {formatTime(duration)}
                </span>
              ) : null}
              <span>{segments.length} segmentos</span>
            </div>
          </div>
        </div>

        {/* Selector de versiones si tiene más de una */}
        {source.versions && source.versions.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>Versión:</span>
            <select
              className="form-control"
              style={{ fontSize: '0.8rem', padding: '4px 8px', width: 'auto' }}
              value={version?.version || 1}
              onChange={(e) => onSelectVersion && onSelectVersion(source.id, e.target.value)}
            >
              {source.versions.map((v) => (
                <option key={v.id || v.version} value={v.version}>
                  v{v.version} {v.id === source.currentVersionId ? '(actual)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Alerta de Error y botón de reintento si falló */}
      {source.status === 'TRANSCRIPTION_ERROR' && (
        <div
          style={{
            margin: '14px 0',
            padding: '12px 16px',
            background: 'rgba(180, 35, 24, 0.08)',
            border: '1px solid rgba(180, 35, 24, 0.3)',
            borderRadius: '6px',
            color: '#b42318'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.88rem' }}>
            <AlertTriangle size={18} />
            <span>Ocurrió un error al procesar la transcripción con n8n</span>
          </div>
          <p style={{ margin: '6px 0 10px 0', fontSize: '0.82rem', color: 'var(--on-surface)' }}>
            La fuente fue conservada. Puedes adjuntar el archivo de audio nuevamente para reintentar la transcripción.
          </p>

          <form onSubmit={handleRetrySubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.mp4"
              onChange={(e) => setRetryFile(e.target.files?.[0] || null)}
              style={{ fontSize: '0.8rem' }}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!retryFile || retrying}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} className={retrying ? 'spin' : ''} />
              {retrying ? 'Reintentando...' : 'Reintentar transcripción'}
            </button>
          </form>
          {retryError && <div style={{ fontSize: '0.8rem', marginTop: '6px', color: '#b42318' }}>{retryError}</div>}
        </div>
      )}

      {/* Barra de pestañas */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px',
          marginBottom: '14px',
          borderBottom: '1px solid var(--outline-variant, #e0e0e0)'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('segments')}
          style={{
            padding: '8px 14px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'segments' ? 600 : 400,
            color: activeTab === 'segments' ? 'var(--primary, #6750A4)' : 'var(--on-surface-variant, #666)',
            borderBottom: activeTab === 'segments' ? '2px solid var(--primary, #6750A4)' : '2px solid transparent'
          }}
        >
          Segmentos con Timestamps ({segments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('full')}
          style={{
            padding: '8px 14px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'full' ? 600 : 400,
            color: activeTab === 'full' ? 'var(--primary, #6750A4)' : 'var(--on-surface-variant, #666)',
            borderBottom: activeTab === 'full' ? '2px solid var(--primary, #6750A4)' : '2px solid transparent'
          }}
        >
          Texto Completo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('meta')}
          style={{
            padding: '8px 14px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'meta' ? 600 : 400,
            color: activeTab === 'meta' ? 'var(--primary, #6750A4)' : 'var(--on-surface-variant, #666)',
            borderBottom: activeTab === 'meta' ? '2px solid var(--primary, #6750A4)' : '2px solid transparent'
          }}
        >
          Metadatos Técnicos
        </button>
      </div>

      {/* Contenido según pestaña */}
      {activeTab === 'segments' && (
        <div>
          {/* Buscador de segmentos */}
          {segments.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    color: 'var(--on-surface-variant, #888)'
                  }}
                />
                <input
                  type="text"
                  placeholder="Buscar en el diálogo de la transcripción..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: '32px', fontSize: '0.82rem' }}
                />
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleCopyText(extractedText)}
                title="Copiar texto completo"
              >
                {copied ? <Check size={14} color="#157347" /> : <Copy size={14} />}
                <span style={{ marginLeft: '4px' }}>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          )}

          {/* Listado de segmentos */}
          {filteredSegments.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '24px',
                color: 'var(--secondary, #777)',
                fontSize: '0.85rem'
              }}
            >
              {segments.length === 0
                ? 'No hay segmentos detallados disponibles para esta versión.'
                : 'No se encontraron segmentos con el término buscado.'}
            </div>
          ) : (
            <div
              style={{
                maxHeight: '380px',
                overflowY: 'auto',
                display: 'grid',
                gap: '8px',
                paddingRight: '4px'
              }}
            >
              {filteredSegments.map((segment, idx) => (
                <div
                  key={segment.id || idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '10px 12px',
                    background: 'var(--surface-container-low, #f8f9fa)',
                    border: '1px solid var(--outline-variant, #eaeaea)',
                    borderRadius: '6px',
                    fontSize: '0.84rem'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: 'rgba(0, 0, 0, 0.05)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.74rem',
                          fontFamily: 'monospace',
                          color: 'var(--primary, #444)'
                        }}
                      >
                        <Clock size={11} />
                        {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                      </span>

                      {segment.speaker ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(103, 80, 164, 0.12)',
                            color: 'var(--primary, #6750A4)',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.74rem'
                          }}
                        >
                          <User size={11} />
                          {segment.speaker}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--outline, #999)' }}>
                          #{segment.sequence || idx + 1}
                        </span>
                      )}
                    </div>

                    {segment.confidence !== null && segment.confidence !== undefined && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color:
                            segment.confidence > 0.8
                              ? '#157347'
                              : segment.confidence > 0.5
                              ? '#9a6700'
                              : '#b42318'
                        }}
                      >
                        {Math.round(segment.confidence * 100)}% conf.
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      margin: '4px 0 0 0',
                      lineHeight: '1.4',
                      color: 'var(--on-surface, #222)'
                    }}
                  >
                    {segment.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'full' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px'
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
              {extractedText ? `${extractedText.split(/\s+/).length} palabras` : '0 palabras'}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleCopyText(extractedText)}
              disabled={!extractedText}
            >
              {copied ? <Check size={14} color="#157347" /> : <Copy size={14} />}
              <span style={{ marginLeft: '4px' }}>{copied ? 'Copiado al portapapeles' : 'Copiar texto'}</span>
            </button>
          </div>
          <div
            style={{
              padding: '14px',
              background: 'var(--surface-container-low, #f9f9f9)',
              border: '1px solid var(--outline-variant, #eaeaea)',
              borderRadius: '6px',
              maxHeight: '340px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: '0.84rem',
              lineHeight: '1.6',
              fontFamily: 'inherit'
            }}
          >
            {extractedText || (
              <span style={{ color: 'var(--secondary, #888)', fontStyle: 'italic' }}>
                No hay transcripción disponible en esta versión.
              </span>
            )}
          </div>
        </div>
      )}

      {activeTab === 'meta' && (
        <div style={{ fontSize: '0.82rem', display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
            <strong>Tipo MIME:</strong>
            <span>{source.mimeType || 'audio/mpeg'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
            <strong>Tamaño:</strong>
            <span>{source.fileSize ? `${(source.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
            <strong>Hash SHA-256:</strong>
            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{source.fileHash}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
            <strong>Duración estimada:</strong>
            <span>{duration ? `${formatTime(duration)} (${duration}s)` : 'No provista'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
            <strong>Proveedor de orquestación:</strong>
            <span>{metadata.provider || 'n8n'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <strong>Fecha de transcripción:</strong>
            <span>{metadata.transcribedAt ? new Date(metadata.transcribedAt).toLocaleString() : new Date(source.createdAt).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
