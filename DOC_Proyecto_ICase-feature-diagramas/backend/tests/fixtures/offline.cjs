global.fetch = async () => { throw new Error('Network disabled during tests'); };
process.env.OPENAI_API_KEY = '';
process.env.GEMINI_API_KEY = '';
