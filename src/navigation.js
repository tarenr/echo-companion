const WORK_KEY = 'navigation_work_address';
const DESTINATIONS_KEY = 'navigation_saved_destinations';
const labels = { casa: 'Casa', trabalho1: 'DHL', trabalho2: 'Jayme' };
function normalize(text) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function validateQuery(value) {
  if (typeof value !== 'string') return null;
  const query = value.trim();
  return query.length >= 3 && query.length <= 300 && !/[<>\x00-\x1f]|\w+:|\/\//.test(query) ? query : null;
}
function validateAddress(value) {
  const address = validateQuery(value);
  return address && address.length >= 12 && /[,;].{2,}/.test(address) ? address : null;
}
function validateWazeLink(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://waze.com' || url.username || url.password || !/^\/ul\/[a-z0-9]{6,20}$/.test(url.pathname) || url.hash || url.search) return null;
    return url.href;
  } catch (_) { return null; }
}
function destinationId(value) {
  const name = normalize(String(value || '')).replace(/^(?:o|a|meu|minha)\s+/, '').replace(/\s+/g, ' ');
  if (['casa', 'lar'].includes(name)) return 'casa';
  if (['trabalho 1', 'trabalho um', 'primeiro trabalho', 'dhl'].includes(name)) return 'trabalho1';
  if (['trabalho 2', 'trabalho dois', 'segundo trabalho', 'jayme'].includes(name)) return 'trabalho2';
  if (name === 'trabalho') return 'trabalho';
  return null;
}
async function readDestinations(memory) {
  const raw = await memory.getPreference(DESTINATIONS_KEY);
  let saved = {};
  if (raw) {
    try { saved = JSON.parse(raw); } catch (_) { throw new Error('Cadastro inválido'); }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Cadastro inválido');
  }
  const result = {};
  for (const id of ['casa', 'trabalho1', 'trabalho2']) {
    const entry = saved[id];
    if (entry && (validateWazeLink(entry.link) || validateAddress(entry.address))) result[id] = entry;
  }
  // Mantém o valor antigo intacto e o usa como trabalho 1 quando necessário.
  if (!result.trabalho1) {
    const legacy = validateAddress(await memory.getPreference(WORK_KEY));
    if (legacy) result.trabalho1 = { address: legacy };
  }
  return result;
}
async function saveDestination(memory, name, value) {
  let id = destinationId(name);
  if (id === 'trabalho') id = 'trabalho1';
  const link = validateWazeLink(value);
  const address = validateAddress(value);
  if (!id || (!link && !address)) return { ok: true, source: 'navigation', reply: 'Informe casa, DHL ou Jayme, seguido de um link compartilhado do Waze ou endereço completo com cidade, separado por vírgula.' };
  const saved = await readDestinations(memory);
  saved[id] = link ? { link } : { address };
  await memory.setPreference(DESTINATIONS_KEY, saved);
  return { ok: true, source: 'navigation', reply: `${labels[id]} salvo. Confira o destino antes de pedir a viagem.`, card: { badge: 'DESTINO SALVO', title: labels[id], detail1: link || address, detail2: 'Repita o cadastro para corrigir este destino.' } };
}
function navigationResponse(target, label, searchOnly = false) {
  const url = new URL(target.link || 'https://waze.com/ul');
  if (!target.link) url.searchParams.set('q', target.address);
  if (!searchOnly) url.searchParams.set('navigate', 'yes');
  url.searchParams.set('utm_source', 'echo_companion');
  return { ok: true, source: 'navigation', accessory: 'none',
    reply: `Vou ${searchOnly ? 'buscar' : 'solicitar a rota para'} ${label} no Waze. Confira o resultado; se não abrir, toque em Abrir Waze.`,
    card: { badge: 'WAZE', title: `${searchOnly ? 'Busca' : 'Viagem'}: ${label}`, detail1: target.address || label, detail2: 'Confira o destino no Waze antes de sair.' },
    action: { type: 'open_waze', url: url.href }
  };
}
async function prepareNavigation(memory, destination, searchOnly = false) {
  const id = destinationId(destination);
  if (id) {
    const saved = await readDestinations(memory);
    if (id === 'trabalho' && saved.trabalho1 && saved.trabalho2) return { ok: true, source: 'navigation', reply: 'Qual trabalho: DHL ou Jayme? Diga: ir para DHL ou ir para Jayme.' };
    const resolved = id === 'trabalho' ? (saved.trabalho1 ? 'trabalho1' : 'trabalho2') : id;
    if (!saved[resolved]) return { ok: true, source: 'navigation', reply: `Qual é o endereço completo de ${labels[resolved] || 'seu trabalho'}? Diga: meu endereço de ${labels[resolved] || 'trabalho'} é, seguido do local e da cidade.` };
    return navigationResponse(saved[resolved], labels[resolved], searchOnly);
  }
  const query = validateQuery(destination);
  if (!query) return { ok: true, source: 'navigation', reply: 'Qual endereço ou lugar você quer buscar no Waze?' };
  return navigationResponse({ address: query }, query, searchOnly);
}
async function prepareWorkNavigation(memory) { return prepareNavigation(memory, 'trabalho'); }
async function handleNavigationMessage(message, memory) {
  if (typeof message !== 'string') return null;
  const original = message.trim().replace(/^echo[,!:.]?\s+/i, '').replace(/^por favor[, ]+/i, '');
  const registration = original.match(/^(?:meu|minha) (?:endere[cç]o de )?(casa|dhl|jayme|trabalho(?:\s+(?:1|2|um|dois))?) [eé]\s*[:,]?\s*(.*)$/i)
    || original.match(/^(?:salve|salvar|cadastre|cadastrar)\s+(casa|dhl|jayme|trabalho\s+(?:1|2|um|dois))\s*(?:como|[eé]|:)\s*(.*)$/i);
  if (registration) return saveDestination(memory, registration[1], registration[2]);
  const command = original.match(/^(?:(?:quero|pode|poderia)\s+)?(ir|iniciar|inicie|come[cç]ar|comece|abrir|abra|navegar|navegue|me levar|leve-me|tra[cç]ar|trace|buscar|busque|pesquisar|pesquise|procurar|procure)\b\s*(.*)$/i);
  if (!command) return null;
  const searchOnly = /^(buscar|busque|pesquisar|pesquise|procurar|procure)$/.test(normalize(command[1]));
  // Buscas genéricas do assistente não devem ser desviadas para navegação.
  if (searchOnly && !/\b(?:no|pelo)\s+waze[.!?]?$/i.test(command[2])) return null;
  let destination = command[2].replace(/\s+(?:no|pelo)\s+waze[.!?]?$/i, '').trim();
  if (searchOnly) destination = destination.replace(/^(?:por\s+|o\s+|a\s+)/i, '');
  else {
    const target = destination.match(/^(?:(?:o\s+)?waze\s+|(?:uma\s+)?(?:viagem|rota|navega[cç][aã]o)\s+)?(?:para|pro|pra|ao|[aà]|at[eé])\s+(.+)$/i);
    if (!target) return null;
    destination = target[1].replace(/^(?:o|a|meu|minha)\s+/i, '').replace(/^(?:meu|minha)\s+/i, '');
  }
  return prepareNavigation(memory, destination, searchOnly);
}
function createNavigationMiddleware(memory) {
  return async (req, res, next) => {
    try {
      const result = await handleNavigationMessage(req.body?.message, memory);
      return result ? res.json(result) : next();
    } catch (_) { return res.status(503).json({ ok: false, reply: 'Não consegui acessar a memória do destino. Tente novamente.', source: 'navigation' }); }
  };
}
module.exports = { WORK_KEY, DESTINATIONS_KEY, validateAddress, validateWazeLink, readDestinations, saveDestination, prepareNavigation, prepareWorkNavigation, handleNavigationMessage, createNavigationMiddleware };
