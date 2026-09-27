const crypto = require('crypto');
const id = value => 'N_' + crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 20);
const label = value => String(value || '').replace(/[&<>"\n\r\\`]/g, ' ').replace(/[^\p{L}\p{N} _.,:/()-]/gu, ' ').trim().slice(0, 180);
const token = value => 'T_' + String(value || 'unknown').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_]/g, '_');
module.exports = { id, label, token };
