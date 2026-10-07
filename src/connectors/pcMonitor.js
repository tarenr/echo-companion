// Somente GET, destinos fixos. Nunca aceita URL ou comando do usuário.
const WINDOWS = ['1min', '5min', '15min', '30min', '1h'];
const SECTIONS = ['resumo', 'cpu', 'ram', 'gpu', 'discos', 'rede', 'midia', 'processos', 'historico', 'sistema', 'servicos', 'cotas'];
const finite = v => typeof v === 'number' && Number.isFinite(v);
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o?.[k] !== undefined).map(k => [k, o[k]]));

function createMonitor({ fetchImpl = global.fetch, now = Date.now, baseUrl = process.env.NERDOPS_URL || 'http://127.0.0.1:5000', timeoutMs = 2800 } = {}) {
  async function get(route) {
    const response = await fetchImpl(`${baseUrl}${route}`, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`Dashboard respondeu HTTP ${response.status}`);
    const data = await response.json();
    if (!data || typeof data !== 'object' || data.ok === false) throw new Error('Resposta indisponível do dashboard');
    return data;
  }
  async function query({ secao = 'resumo', periodo = '5min', recurso = 'cpu', disco, provedor } = {}) {
    if (!SECTIONS.includes(secao) || !WINDOWS.includes(periodo) || !['cpu', 'ram', 'gpu'].includes(recurso)) return { ok: false, erro: 'Filtro de consulta inválido.' };
    try {
      let dados;
      let age = null;
      if (['resumo', 'cpu', 'ram', 'gpu', 'discos', 'rede', 'midia'].includes(secao)) {
        const s = await get('/api/stats');
        if (!finite(s.sampled_at)) throw new Error('Amostra sem horário de coleta');
        age = Math.max(0, (now() / 1000) - s.sampled_at);
        if (age >= 10) return { ok: false, secao, fonte: 'nerdops', idade_s: Math.round(age), erro: 'Amostra do dashboard desatualizada (10 segundos ou mais).' };
        const cpu = pick(s.cpu, ['percent', 'per_cpu', 'freq_ghz', 'cores', 'threads']);
        const ram = pick(s.ram, ['percent', 'used_gb', 'total_gb', 'free_gb']);
        const gpu = pick(s.gpu, ['online', 'name', 'load_pct', 'vram_used_gb', 'vram_total_gb', 'vram_pct', 'temp_c', 'power_w', 'clock_core_mhz', 'clock_mem_mhz', 'fan_pct', 'encoder_pct', 'decoder_pct']);
        let disks = (Array.isArray(s.disks) ? s.disks : []).map(d => ({ ...pick(d, ['device', 'mountpoint', 'percent', 'used_gb', 'total_gb']), free_gb: finite(d.total_gb) && finite(d.used_gb) ? +(d.total_gb - d.used_gb).toFixed(1) : null }));
        if (disco) disks = disks.filter(d => String(d.device || d.mountpoint).toLowerCase().startsWith(String(disco).toLowerCase().replace(/[:\\]/g, '') + ':'));
        const sections = { cpu, ram, gpu, discos: { unidades: disks, io: pick(s.disk_io, ['read_mb_s', 'write_mb_s']) }, rede: pick(s.network, ['up_mb_s', 'down_mb_s', 'total_sent_gb', 'total_recv_gb']), midia: { media: pick(s.media, ['status', 'enabled']), volume: pick(s.volume, ['level', 'muted']) } };
        dados = secao === 'resumo' ? { cpu, ram, gpu } : sections[secao];
        if (secao === 'gpu' && gpu.online !== true) throw new Error('GPU indisponível no dashboard');
        if (secao === 'discos' && !disks.length) throw new Error('Unidade não encontrada no dashboard');
      } else if (secao === 'processos') {
        const [s, health] = await Promise.all([get('/api/processes'), get('/api/system')]);
        if (health.collector_ok !== true) throw new Error('Coletor do dashboard desatualizado');
        dados = { recurso, processos: (s[`top_${recurso}`] || []).slice(0, 5).map(p => pick(p, ['name', 'cpu_pct', 'mem_mb', 'gpu_mem_mb'])), aplicativos: s.app_status };
      } else if (secao === 'historico') {
        const samples = await get(`/api/history?window=${periodo}`);
        if (!Array.isArray(samples) || !samples.length) throw new Error('Sem histórico no período solicitado');
        const valid = samples.filter(s => finite(s.t));
        if (!valid.length) throw new Error('Histórico sem horários válidos');
        age = Math.max(0, now() / 1000 - Math.max(...valid.map(s => s.t)));
        dados = { periodo, recurso, amostras: valid.length, inicio: Math.min(...valid.map(s => s.t)), fim: Math.max(...valid.map(s => s.t)), metricas: {} };
        for (const key of ['cpu', 'ram', 'gpu', 'temp', 'net_down', 'net_up', 'disk_pct']) {
          const values = valid.map(s => s[key]).filter(finite);
          dados.metricas[key] = values.length ? { media: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2), maximo: Math.max(...values), ultimo: values.at(-1) } : null;
        }
      } else if (secao === 'sistema') {
        dados = pick(await get('/api/system'), ['os', 'os_version', 'cpu_model', 'gpu_model', 'ram_total_gb', 'disks_count', 'disks_total_gb', 'uptime_s', 'resolution', 'collector_ok', 'last_sample_age_s']);
      } else if (secao === 'servicos') {
        const s = await get('/api/forge-status');
        dados = { projetos: (s.projetos || []).map(p => ({ nome: p.nome, servicos: (p.servicos || []).map(v => pick(v, ['nome', 'tipo', 'status', 'last_checked_at'])) })) };
      } else {
        const s = await get('/api/ai-quota-status');
        dados = { provedores: (s.dados?.provedores || []).filter(p => !provedor || `${p.id} ${p.label}`.toLowerCase().includes(String(provedor).toLowerCase())).map(p => ({ ...pick(p, ['id', 'label', 'status', 'age_s', 'stale', 'count_only', 'backoff']), windows: (p.windows || []).map(w => ({ ...pick(w, ['label', 'count', 'resets_at', 'derived']), restante_pct: finite(w.used) && w.used >= 0 && w.used <= 1 ? +((1 - w.used) * 100).toFixed(1) : null })) })) };
      }
      return { ok: true, fonte: 'nerdops', secao, idade_s: age === null ? null : Math.round(age), desatualizado: age !== null && age >= 10, dados };
    } catch (_) {
      return { ok: false, fonte: 'nerdops', secao, erro: _.name === 'TimeoutError' || _.name === 'AbortError' ? 'Dashboard não respondeu no prazo.' : (_.message.startsWith('fetch') ? 'Dashboard indisponível.' : _.message) };
    }
  }
  return { query };
}
module.exports = { createMonitor, query: createMonitor().query };
