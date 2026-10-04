/**
 * Conector Meteorológico Open-Meteo
 * Consulta previsão do tempo e condições atuais em tempo real (gratuito e sem necessidade de chave de API)
 * Cidade padrão: Serra, Espírito Santo
 */

const DEFAULT_COORDS = {
  nome: 'Serra, ES',
  latitude: -20.1286,
  longitude: -40.3078
};

// Tabela de Códigos Meteorológicos WMO (World Meteorological Organization)
const WMO_CODES = {
  0: 'Céu limpo',
  1: 'Predominantemente limpo',
  2: 'Parcialmente nublado',
  3: 'Encoberto / Nublado',
  45: 'Nevoeiro',
  48: 'Nevoeiro com formação de geada',
  51: 'Garoa leve',
  53: 'Garoa moderada',
  55: 'Garoa densa',
  56: 'Garoa congelante leve',
  57: 'Garoa congelante densa',
  61: 'Chuva fraca',
  62: 'Chuva fraca a moderada',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  66: 'Chuva congelante leve',
  67: 'Chuva congelante intensa',
  71: 'Neve fraca',
  73: 'Neve moderada',
  75: 'Neve intensa',
  77: 'Grãos de neve',
  80: 'Pancadas de chuva leves',
  81: 'Pancadas de chuva moderadas',
  82: 'Pancadas de chuva violentas',
  85: 'Pancadas de neve leves',
  86: 'Pancadas de neve pesadas',
  95: 'Tempestade com trovoadas',
  96: 'Tempestade com granizo leve',
  99: 'Tempestade com granizo forte'
};

function getConditionText(code) {
  return WMO_CODES[code] || 'Condições variáveis';
}

/**
 * Busca coordenadas de uma cidade via geocoding da Open-Meteo se não for Serra/ES
 */
async function resolveLocation(cidade) {
  if (!cidade || typeof cidade !== 'string') {
    return DEFAULT_COORDS;
  }

  const clean = cidade.trim().toLowerCase();
  if (clean.includes('serra') || clean.includes('aqui') || clean.includes('minha cidade') || clean.includes('região') || clean.includes('regiao')) {
    return DEFAULT_COORDS;
  }

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`;
    const res = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const r = data.results[0];
        const stateOrCountry = r.admin1 || r.country || '';
        return {
          nome: `${r.name}${stateOrCountry ? ', ' + stateOrCountry : ''}`,
          latitude: r.latitude,
          longitude: r.longitude
        };
      }
    }
  } catch (e) {
    console.warn('[WEATHER] Erro ao resolver coordenadas para:', cidade, e.message);
  }

  return DEFAULT_COORDS;
}

/**
 * Consulta a previsão do tempo para a localidade solicitada
 * @param {string} [cidade] - Nome da cidade (padrão: Serra, ES)
 */
async function getWeather(cidade = 'Serra, ES') {
  try {
    const loc = await resolveLocation(cidade);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const data = await res.json();
    const cur = data.current || {};
    const daily = data.daily || {};

    const temp = Math.round(cur.temperature_2m ?? 0);
    const sensacao = Math.round(cur.apparent_temperature ?? temp);
    const umidade = Math.round(cur.relative_humidity_2m ?? 0);
    const vento = Math.round(cur.wind_speed_10m ?? 0);
    const condicao = getConditionText(cur.weather_code);

    const tempMax = Math.round(daily.temperature_2m_max?.[0] ?? temp);
    const tempMin = Math.round(daily.temperature_2m_min?.[0] ?? temp);
    const probChuva = Math.round(daily.precipitation_probability_max?.[0] ?? 0);

    const chuvaAviso = probChuva >= 60 ? `chance alta de chuva de ${probChuva}%` : (probChuva >= 30 ? `chance moderada de chuva de ${probChuva}%` : `baixa chance de chuva (${probChuva}%)`);

    const resumoFala = `Em ${loc.nome} agora faz ${temp} graus com sensação de ${sensacao} e ${condicao.toLowerCase()}. Hoje a máxima chega a ${tempMax} graus e a mínima a ${tempMin}, com ${chuvaAviso}.`;

    return {
      ok: true,
      cidade: loc.nome,
      temperatura: temp,
      sensacao,
      umidade,
      vento: `${vento} km/h`,
      condicao,
      maxima: tempMax,
      minima: tempMin,
      probabilidade_chuva: probChuva,
      resumo_fala: resumoFala
    };
  } catch (err) {
    console.error('[WEATHER] Erro ao consultar previsão do tempo:', err.message);
    return {
      ok: false,
      cidade: cidade || 'Serra, ES',
      erro: `Não foi possível obter a previsão no momento: ${err.message}`
    };
  }
}

module.exports = {
  getWeather,
  DEFAULT_COORDS
};
