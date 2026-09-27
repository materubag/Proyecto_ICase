require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 8080,
  DATABASE_URL: process.env.DATABASE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Selección de proveedor de IA (gemini | ollama | openai | mock)
  AI_PROVIDER: process.env.AI_PROVIDER || 'gemini',

  // Configuración Gemini (gemini-3.1-flash-lite)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  GEMINI_MAX_INPUT_CHARS: parseInt(process.env.GEMINI_MAX_INPUT_CHARS || '16000', 10),
  GEMINI_MAX_OUTPUT_TOKENS: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '384', 10),
  GEMINI_MAX_ITEMS_PER_BATCH: parseInt(process.env.GEMINI_MAX_ITEMS_PER_BATCH || '20', 10),
  GEMINI_MIN_REQUEST_INTERVAL_MS: parseInt(process.env.GEMINI_MIN_REQUEST_INTERVAL_MS || '6000', 10),
  GEMINI_THINKING_LEVEL: process.env.GEMINI_THINKING_LEVEL || 'minimal',
  GEMINI_TEMPERATURE: parseFloat(process.env.GEMINI_TEMPERATURE || '0'),
  GEMINI_TOKEN_PREFLIGHT: process.env.GEMINI_TOKEN_PREFLIGHT === 'true',

  // Configuración Ollama
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3',
  OLLAMA_TIMEOUT: parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10),

  // Configuración Faster-Whisper (Transcripción Local)
  WHISPER_BASE_URL: process.env.WHISPER_BASE_URL || 'http://whisper:8001',
  WHISPER_MODEL: process.env.WHISPER_MODEL || 'base',
  WHISPER_DEVICE: process.env.WHISPER_DEVICE || 'cpu',
  WHISPER_COMPUTE_TYPE: process.env.WHISPER_COMPUTE_TYPE || 'int8',
  WHISPER_BEAM_SIZE: parseInt(process.env.WHISPER_BEAM_SIZE || '1', 10),
  WHISPER_LANGUAGE: process.env.WHISPER_LANGUAGE || 'es',
  WHISPER_VAD_FILTER: process.env.WHISPER_VAD_FILTER !== 'false',

  // Configuración Documentos / PDF y Audio
  MAX_PDF_SIZE_MB: parseInt(process.env.MAX_PDF_SIZE_MB || '10', 10),
  MAX_AUDIO_SIZE_MB: parseInt(process.env.MAX_AUDIO_SIZE_MB || '100', 10),
  SIMILARITY_THRESHOLD: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.85'),

  // Configuración OpenAI (Opcional - nunca obligatorio para el flujo principal)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',

  // Configuración n8n (Exclusivo para Mockups)
  N8N_BASE_URL: process.env.N8N_BASE_URL || '',
  N8N_MOCKUP_WEBHOOK: process.env.N8N_MOCKUP_WEBHOOK || '',
  N8N_TIMEOUT: parseInt(process.env.N8N_TIMEOUT || '120000', 10),
  MOCKUP_MAX_REQUIREMENTS: parseInt(process.env.MOCKUP_MAX_REQUIREMENTS || '12', 10),

  // Configuración de Análisis Inteligente de Requisitos
  AI_ANALYSIS_STRATEGY: process.env.AI_ANALYSIS_STRATEGY || 'rules-first',
  AI_FALLBACK_CONFIDENCE_THRESHOLD: parseFloat(process.env.AI_FALLBACK_CONFIDENCE_THRESHOLD || '0.65'),
  AI_MAX_CHUNKS: parseInt(process.env.AI_MAX_CHUNKS || '20', 10),
  AI_CHUNK_MAX_LENGTH: parseInt(process.env.AI_CHUNK_MAX_LENGTH || '350', 10)
};
