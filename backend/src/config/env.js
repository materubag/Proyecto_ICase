require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 8080,
  DATABASE_URL: process.env.DATABASE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Selección de proveedor de IA (mock | gemini | ollama | openai | n8n)
  AI_PROVIDER: process.env.AI_PROVIDER || 'mock',

  // Configuración Gemini
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-pro',

  // Configuración Ollama
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3',
  OLLAMA_TIMEOUT: parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10),

  // Configuración Documentos / PDF
  MAX_PDF_SIZE_MB: parseInt(process.env.MAX_PDF_SIZE_MB || '10', 10),
  MAX_AUDIO_SIZE_MB: parseInt(process.env.MAX_AUDIO_SIZE_MB || '100', 10),

  // Configuración OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5.4-nano',

  // Configuración n8n
  N8N_BASE_URL: process.env.N8N_BASE_URL || '',
  N8N_ANALYZE_WEBHOOK: process.env.N8N_ANALYZE_WEBHOOK || '',
  N8N_AUDIO_WEBHOOK: process.env.N8N_AUDIO_WEBHOOK || process.env.N8N_TRANSCRIBE_WEBHOOK || process.env.N8N_ANALYZE_WEBHOOK || '',
  N8N_TRANSCRIBE_WEBHOOK: process.env.N8N_TRANSCRIBE_WEBHOOK || process.env.N8N_TRANSCRIPTION_WEBHOOK || process.env.N8N_AUDIO_WEBHOOK || '',
  N8N_TRANSCRIPTION_WEBHOOK: process.env.N8N_TRANSCRIPTION_WEBHOOK || process.env.N8N_TRANSCRIBE_WEBHOOK || process.env.N8N_AUDIO_WEBHOOK || '',
  N8N_MOCKUP_WEBHOOK: process.env.N8N_MOCKUP_WEBHOOK || '',
  N8N_TIMEOUT: parseInt(process.env.N8N_TIMEOUT || '120000', 10),
  MOCKUP_MAX_REQUIREMENTS: parseInt(process.env.MOCKUP_MAX_REQUIREMENTS || '12', 10),

  // Configuración de Análisis Inteligente de Requisitos (Fase 3)
  AI_ANALYSIS_STRATEGY: process.env.AI_ANALYSIS_STRATEGY || 'ollama-first',
  AI_FALLBACK_CONFIDENCE_THRESHOLD: parseFloat(process.env.AI_FALLBACK_CONFIDENCE_THRESHOLD || '0.65'),
  AI_MAX_CHUNKS: parseInt(process.env.AI_MAX_CHUNKS || '12', 10),
  AI_CHUNK_MAX_LENGTH: parseInt(process.env.AI_CHUNK_MAX_LENGTH || '350', 10)
};
