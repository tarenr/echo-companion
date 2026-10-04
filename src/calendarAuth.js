const crypto = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const { CalendarStore } = require('./calendarStore');
const SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';

class CalendarAuth {
  constructor({ env = process.env, store, clientFactory } = {}) {
    this.env = env;
    this.store = store;
    this.clientFactory = clientFactory || (() => new OAuth2Client(env.GOOGLE_CALENDAR_CLIENT_ID, env.GOOGLE_CALENDAR_CLIENT_SECRET, env.GOOGLE_CALENDAR_REDIRECT_URI));
    this.states = new Map();
    this.epoch = 0;
  }
  configured() {
    try {
      const url = new URL(this.env.GOOGLE_CALENDAR_REDIRECT_URI);
      const local = ['localhost', '127.0.0.1'].includes(url.hostname);
      return Boolean(this.env.GOOGLE_CALENDAR_CLIENT_ID && this.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
        Buffer.from(this.env.GOOGLE_CALENDAR_ENCRYPTION_KEY || '', 'base64').length === 32 &&
        (url.protocol === 'https:' || (local && url.protocol === 'http:')) && !url.username && !url.password &&
        url.pathname === '/api/calendar/oauth/callback' && !url.search && !url.hash);
    } catch (_) { return false; }
  }
  getStore() {
    if (!this.configured()) throw new Error('Configure o Google Agenda conforme o guia antes de conectar.');
    if (!this.store) this.store = new CalendarStore({ key: this.env.GOOGLE_CALENDAR_ENCRYPTION_KEY });
    return this.store;
  }
  status() {
    if (!this.configured()) return { configured: false, connected: false };
    const data = this.getStore().read();
    return { configured: true, connected: !!data.tokens?.refresh_token && !data.reconnectRequired, reconnectRequired: !!data.reconnectRequired };
  }
  async start(sessionId) {
    this.getStore();
    for (const [key, value] of this.states) if (value.expires < Date.now() || value.sessionId === sessionId) this.states.delete(key);
    const client = this.clientFactory();
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const state = crypto.randomBytes(32).toString('hex');
    this.states.set(state, { sessionId, codeVerifier, expires: Date.now() + 10 * 60 * 1000 });
    return client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [SCOPE], state, code_challenge: codeChallenge, code_challenge_method: 'S256' });
  }
  async callback(sessionId, query) {
    const pending = this.states.get(query.state);
    if (!pending || pending.sessionId !== sessionId || pending.expires < Date.now()) throw new Error('Autorização expirada ou pertencente a outro dispositivo. Inicie a conexão novamente.');
    this.states.delete(query.state);
    if (query.error || typeof query.code !== 'string' || query.code.length > 4096) throw new Error('Conexão não autorizada.');
    const client = this.clientFactory();
    const { tokens } = await client.getToken({ code: query.code, codeVerifier: pending.codeVerifier, redirect_uri: this.env.GOOGLE_CALENDAR_REDIRECT_URI });
    if (!tokens.refresh_token || !tokens.access_token) throw new Error('Autorize o acesso offline novamente para conectar a agenda.');
    const info = await client.getTokenInfo(tokens.access_token);
    if (!info.scopes.includes(SCOPE)) throw new Error('A permissão necessária para eventos não foi concedida.');
    this.getStore().update(data => { data.tokens = tokens; data.accountId = crypto.randomUUID(); delete data.reconnectRequired; });
    this.epoch++;
  }
  client() {
    const store = this.getStore();
    const data = store.read();
    if (!data.tokens?.refresh_token || data.reconnectRequired) throw new Error('Conecte sua conta Google antes de consultar a agenda.');
    const client = this.clientFactory();
    client.setCredentials(data.tokens);
    client.on('tokens', tokens => store.update(current => {
      // Um refresh iniciado antes de desconectar não pode restaurar o acesso.
      if (current.accountId === data.accountId && current.tokens) current.tokens = { ...current.tokens, ...tokens };
    }));
    return client;
  }
  async disconnect() {
    const store = this.getStore();
    const data = store.read();
    // Primeiro interrompe o uso local. Uma falha remota não reativa credenciais.
    store.update(current => { delete current.tokens; delete current.accountId; delete current.reconnectRequired; });
    this.states.clear();
    this.epoch++;
    if (data.tokens?.refresh_token) {
      try { await this.clientFactory().revokeToken(data.tokens.refresh_token); }
      catch (_) { return { revoked: false }; }
    }
    return { revoked: true };
  }
}
module.exports = { CalendarAuth, SCOPE };
