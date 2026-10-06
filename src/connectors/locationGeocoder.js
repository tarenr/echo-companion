// Endereço a partir das coordenadas, só quando alguém pergunta: nunca é chamado durante publicação periódica de GPS.
// Padrão: OpenStreetMap (Nominatim, gratuito e sem chave). Com LOCATION_GOOGLE_GEOCODING_KEY, usa o Google.
// LOCATION_GEOCODING=off desliga: nenhuma coordenada sai do servidor.
const USER_AGENT = 'echo-companion/1.0 (+https://github.com/tarenr/echo-companion)';

// "Avenida Paulista, 1578 – Morro dos Ingleses, São Paulo – SP, CEP 01310-200"; partes ausentes ficam de fora.
function formatAddress({ road, number, district, city, uf, postcode }) {
  const street = road ? [road, number].filter(Boolean).join(', ') : '';
  const town = [city, uf].filter(Boolean).join(' – ');
  const rest = [district, town, postcode && `CEP ${postcode}`].filter(Boolean).join(', ');
  return [street, rest].filter(Boolean).join(' – ') || null;
}

function fromOpenStreetMap(a = {}) {
  const iso = a['ISO3166-2-lvl4'] || '';
  return formatAddress({
    road: a.road || a.pedestrian || a.footway || a.cycleway || a.path,
    number: a.house_number,
    district: a.suburb || a.neighbourhood || a.quarter || a.city_district,
    city: a.city || a.town || a.village || a.municipality,
    uf: iso.startsWith('BR-') ? iso.slice(3) : a.state,
    postcode: a.postcode
  });
}

function fromGoogle(parts = []) {
  const part = (type, field = 'long_name') => parts.find(p => p.types.includes(type))?.[field];
  return formatAddress({
    road: part('route'),
    number: part('street_number'),
    district: part('sublocality_level_1') || part('neighborhood'),
    city: part('administrative_area_level_2') || part('locality'),
    uf: part('administrative_area_level_1', 'short_name'),
    postcode: part('postal_code')
  });
}

class LocationGeocoder {
  constructor({ key = process.env.LOCATION_GOOGLE_GEOCODING_KEY, mode = process.env.LOCATION_GEOCODING, fetchImpl = fetch } = {}) {
    this.key = key; this.fetch = fetchImpl; this.lastRequest = 0; this.pending = false;
    this.provider = String(mode || '').toLowerCase() === 'off' ? null : key ? 'google' : 'osm';
    // Só o último endereço, na memória: perguntar de novo na mesma posição não depende do limite de 10 s
    this.last = null;
  }
  async address(position) {
    if (!this.provider) return null;
    const spot = `${Number(position.latitude).toFixed(5)},${Number(position.longitude).toFixed(5)}`;
    if (this.last?.spot === spot) return this.last.address;
    if (this.pending || Date.now() - this.lastRequest < 10000) return null;
    this.pending = true; this.lastRequest = Date.now();
    try {
      const address = this.provider === 'google' ? await this.google(position) : await this.openStreetMap(position);
      if (address) this.last = { spot, address };
      return address;
    } catch (_) { return null; }
    finally { this.pending = false; }
  }
  async openStreetMap(position) {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2'); url.searchParams.set('addressdetails', '1'); url.searchParams.set('zoom', '18');
    url.searchParams.set('lat', String(position.latitude)); url.searchParams.set('lon', String(position.longitude));
    url.searchParams.set('accept-language', 'pt-BR');
    const response = await this.fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.error ? null : fromOpenStreetMap(data?.address);
  }
  async google(position) {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${position.latitude},${position.longitude}`);
    url.searchParams.set('language', 'pt-BR'); url.searchParams.set('key', this.key);
    const response = await this.fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const data = await response.json();
    return data.status === 'OK' ? fromGoogle(data.results?.[0]?.address_components) : null;
  }
}
module.exports = { LocationGeocoder, formatAddress };
