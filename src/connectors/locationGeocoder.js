// Opcional: nunca é chamado durante publicação periódica de GPS.
class LocationGeocoder {
  constructor({ key = process.env.LOCATION_GOOGLE_GEOCODING_KEY, fetchImpl = fetch } = {}) {
    this.key = key; this.fetch = fetchImpl; this.lastRequest = 0; this.pending = false;
  }
  async address(position) {
    if (!this.key || this.pending || Date.now() - this.lastRequest < 10000) return null;
    this.pending = true; this.lastRequest = Date.now();
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${position.latitude},${position.longitude}`);
      url.searchParams.set('language', 'pt-BR'); url.searchParams.set('key', this.key);
      const response = await this.fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) return null;
      const data = await response.json();
      if (data.status !== 'OK') return null;
      const parts = data.results?.[0]?.address_components || [];
      const part = type => parts.find(p => p.types.includes(type))?.long_name;
      return [part('route'), part('sublocality_level_1') || part('neighborhood'), part('administrative_area_level_2') || part('locality')].filter(Boolean).join(', ') || null;
    } catch (_) { return null; }
    finally { this.pending = false; }
  }
}
module.exports = { LocationGeocoder };
