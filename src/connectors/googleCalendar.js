const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
class GoogleCalendar {
  constructor(auth) { this.auth = auth; }
  async request(method, suffix = '', params = {}, data, etag) {
    const url = new URL(BASE + suffix);
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
    try {
      const response = await this.auth.client().request({ url: url.href, method, data,
        headers: etag ? { 'If-Match': etag } : {}, timeout: 15000, retry: false });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.data?.error === 'invalid_grant') {
        this.auth.getStore().update(state => { state.reconnectRequired = true; });
        this.auth.epoch++;
      }
      throw error;
    }
  }
  async list({ timeMin, timeMax, q }) {
    const result = [];
    let pageToken;
    do {
      const page = await this.request('GET', '', { timeMin, timeMax, q, singleEvents: true, orderBy: 'startTime', timeZone: 'America/Sao_Paulo', maxResults: 250, pageToken });
      result.push(...(page.items || []));
      pageToken = page.nextPageToken;
      // Nunca declarar uma busca completa quando ela foi truncada.
      if (result.length > 2000) throw new Error('Período amplo demais. Consulte um intervalo menor.');
    } while (pageToken);
    return result.filter(event => event.status !== 'cancelled');
  }
  get(id) { return this.request('GET', '/' + encodeURIComponent(id)); }
  create(event) { return this.request('POST', '', { sendUpdates: 'none' }, event); }
  update(id, event, etag) { return this.request('PATCH', '/' + encodeURIComponent(id), { sendUpdates: 'none' }, event, etag); }
  delete(id, etag) { return this.request('DELETE', '/' + encodeURIComponent(id), { sendUpdates: 'none' }, undefined, etag); }
}
module.exports = { GoogleCalendar };
