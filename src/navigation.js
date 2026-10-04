const WORK_KEY = 'navigation_work_address';

function normalize(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function validateAddress(value) {
  if (typeof value !== 'string') return null;
  const address = value.trim();
  if (address.length < 12 || address.length > 300 || /[<>\x00-\x1f]|https?:|javascript:|waze:/i.test(address)) return null;
  // Exige local e cidade separados, sem tentar adivinhar um endereço incompleto.
  if (!/[,;].{2,}/.test(address)) return null;
  return address;
}

async function prepareWorkNavigation(memory) {
  const address = validateAddress(await memory.getPreference(WORK_KEY));
  if (!address) return {
    ok: true,
    reply: 'Qual é o endereço completo do seu trabalho? Diga: meu endereço de trabalho é, seguido do local e da cidade.',
    source: 'navigation',
    accessory: 'none'
  };
  const url = new URL('https://waze.com/ul');
  url.searchParams.set('q', address);
  url.searchParams.set('navigate', 'yes');
  url.searchParams.set('utm_source', 'echo_companion');
  return {
    ok: true,
    reply: 'Vou solicitar a rota para seu trabalho no Waze. Se ele não abrir, toque em Abrir Waze.',
    source: 'navigation',
    accessory: 'none',
    card: { badge: 'WAZE', title: 'Viagem para o trabalho', detail1: address, detail2: 'Confira o destino no Waze antes de sair.' },
    action: { type: 'open_waze', url: url.href }
  };
}

async function handleNavigationMessage(message, memory) {
  if (typeof message !== 'string') return null;
  const text = normalize(message).replace(/^(?:echo[,!:.]?\s+|por favor[, ]+)/g, '');
  const registration = message.match(/^(?:echo[,!:.]?\s+)?meu endere[cç]o de trabalho [eé]\s*[:,]?\s*(.*)$/i);
  if (registration) {
    const address = validateAddress(registration[1]);
    if (!address) return { ok: true, source: 'navigation', reply: 'Informe o endereço completo com local e cidade separados por vírgula. Por exemplo: Rua das Flores, 123, Centro, Serra, ES.' };
    await memory.setPreference(WORK_KEY, address);
    return { ok: true, source: 'navigation', reply: 'Endereço de trabalho salvo. Confira o endereço exibido antes de pedir a viagem.', card: { badge: 'DESTINO SALVO', title: 'Trabalho', detail1: address, detail2: 'Para corrigir, diga novamente: meu endereço de trabalho é...' } };
  }
  if (/^(?:(?:quero|pode|poderia)\s+)?(?:ir|iniciar|inicie|comecar|comece|abrir|abra|navegar|navegue|me levar|leve-me|tracar|trace)\b/.test(text) && /\b(?:para|pro|ao|ate)\s+(?:o\s+)?(?:meu\s+)?trabalho\b/.test(text)) {
    return prepareWorkNavigation(memory);
  }
  return null;
}

function createNavigationMiddleware(memory) {
  return async (req, res, next) => {
    try {
      const result = await handleNavigationMessage(req.body?.message, memory);
      if (result) return res.json(result);
      return next();
    } catch (_) {
      return res.status(503).json({ ok: false, reply: 'Não consegui acessar a memória do destino. Tente novamente.', source: 'navigation' });
    }
  };
}

module.exports = { WORK_KEY, validateAddress, prepareWorkNavigation, handleNavigationMessage, createNavigationMiddleware };
