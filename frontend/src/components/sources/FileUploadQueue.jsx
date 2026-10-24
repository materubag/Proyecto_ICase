import React, { useState, useRef } from 'react';
import {
  FileText,
  FileAudio,
  Upload,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Plus,
  Play
} from 'lucide-react';

/**
 * FileUploadQueue
 * Multi-file upload queue for PDFs and Audios.
 * Displays files queued with explicit status badges, allows removing files,
 * and gives real file-by-file feedback without fake percentages.
 */
export default function FileUploadQueue({
  onStartProcessing,
  isProcessing = false,
  processedCount = 0,
  currentProcessingFile = null,
  files = [],
  onFilesChange
}) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const classifyFile = (file) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) return 'PDF';
    const audioExts = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.aac', '.flac', '.mp4'];
    if (audioExts.some((ext) => name.endsWith(ext))) return 'AUDIO';
    return 'UNKNOWN';
  };

  const handleAddFiles = (newFileList) => {
    const added = [];
    Array.from(newFileList).forEach((file) => {
      const type = classifyFile(file);
      if (type !== 'UNKNOWN') {
        // avoid exact duplicate by name and size in current pending queue
        const exists = files.some(
          (f) => f.rawFile.name === file.name && f.rawFile.size === file.size
        );
        if (!exists) {
          added.push({
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            rawFile: file,
            name: file.name,
            size: file.size,
            type, // 'PDF' | 'AUDIO'
            status: 'PENDING', // 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'ERROR'
            error: null
          });
        }
      }
    });

    if (added.length > 0) {
      onFilesChange([...files, ...added]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isProcessing) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleRemoveFile = (id) => {
    if (isProcessing) return;
    onFilesChange(files.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    if (isProcessing) return;
    onFilesChange([]);
  };

  const getStatusBadge = (item) => {
    switch (item.status) {
      case 'UPLOADING':
        return (
          <span className="badge badge-in-progress" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <RefreshCw size={12} className="spin" /> Cargando...
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="badge badge-in-progress" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <RefreshCw size={12} className="spin" /> Procesando...
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} /> Completado
          </span>
        );
      case 'ERROR':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={12} /> Error
          </span>
        );
      default:
        return (
          <span className="badge badge-planning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> En espera
          </span>
        );
    }
  };

  const pdfCount = files.filter((f) => f.type === 'PDF').length;
  const audioCount = files.filter((f) => f.type === 'AUDIO').length;
  const pendingCount = files.filter((f) => f.status === 'PENDING').length;

  return (
    <div className="file-upload-queue-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--outline-variant)'}`,
          borderRadius: 'var(--radius-md)',
          background: dragActive ? 'var(--surface-container)' : 'var(--surface-container-low)',
          padding: '24px 16px',
          textAlign: 'center',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          opacity: isProcessing ? 0.7 : 1
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf,audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac,.mp4"
          hidden
          disabled={isProcessing}
          onChange={(e) => {
            if (e.target.files?.length) {
              handleAddFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'var(--surface-container)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Upload size={22} />
          </div>
          <div>
            <strong style={{ fontSize: '0.9375rem', color: 'var(--on-surface)' }}>
              Arrastra archivos aquí o haz clic para seleccionar
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              Permite múltiples documentos <strong>PDF</strong> y audios de entrevistas (<strong>MP3, WAV, M4A</strong>)
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ marginTop: '6px' }}
            disabled={isProcessing}
          >
            <Plus size={14} />
            <span>Seleccionar archivos</span>
          </button>
        </div>
      </div>

      {/* Queue Listing */}
      {files.length > 0 && (
        <div
          className="queue-list-panel"
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-container-lowest)',
            overflow: 'hidden'
          }}
        >
          {/* Queue Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-default)',
              background: 'var(--surface-container-low)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <strong style={{ fontSize: '0.875rem', color: 'var(--on-surface)' }}>
                Archivos en cola ({files.length})
              </strong>
              <div style={{ display: 'flex', gap: '6px' }}>
                {pdfCount > 0 && (
                  <span className="badge badge-planning" style={{ fontSize: '0.7rem' }}>
                    {pdfCount} PDF{pdfCount > 1 ? 's' : ''}
                  </span>
                )}
                {audioCount > 0 && (
                  <span className="badge badge-planning" style={{ fontSize: '0.7rem' }}>
                    {audioCount} Audio{audioCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isProcessing && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleClearAll}
                  style={{ fontSize: '0.75rem', color: 'var(--outline)' }}
                >
                  Limpiar cola
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onStartProcessing}
                disabled={isProcessing || pendingCount === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>Iniciar análisis ({pendingCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Processing Progress Feedback Banner */}
          {isProcessing && (
            <div
              style={{
                padding: '10px 16px',
                background: 'rgba(41, 82, 217, 0.08)',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RefreshCw size={16} className="spin" style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--primary)' }}>
                  {currentProcessingFile
                    ? `Procesando "${currentProcessingFile}"...`
                    : 'Procesando fuentes del proyecto...'}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--primary)',
                  background: 'var(--surface-container-lowest)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                {processedCount} de {files.length} procesados
              </span>
            </div>
          )}

          {/* Files List */}
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {files.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 16px',
                  borderBottom: '1px solid var(--surface-container)',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--radius-xs)',
                      background:
                        item.type === 'PDF' ? 'rgba(21, 115, 71, 0.1)' : 'rgba(124, 58, 237, 0.1)',
                      color: item.type === 'PDF' ? '#157347' : '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {item.type === 'PDF' ? <FileText size={16} /> : <FileAudio size={16} />}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: 'var(--on-surface)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </p>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--secondary)' }}>
                      {item.type} · {formatFileSize(item.size)}
                      {item.error ? ` · ${item.error}` : ''}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {getStatusBadge(item)}
                  {!isProcessing && item.status === 'PENDING' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => handleRemoveFile(item.id)}
                      title="Quitar archivo"
                      aria-label="Quitar archivo"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
