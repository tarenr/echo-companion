const { recognizeProvider } = require('./connectors/pcMonitor');
const number = v => typeof v === 'number' && Number.isFinite(v);
const fmt = (v, unit = '') => number(v) ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${unit}` : 'indisponível';

function parseQuery(message) {
  const t = String(message).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Ações não são consultas; não consumir comandos de volume, mídia ou programas.
  if (/\b(imprima|imprimir|abra|abrir|feche|fechar|aumente|aumentar|diminua|diminuir|pause|pausar|toque|reinicie)\b/.test(t)) return null;
  const pc = /\b(cpu|ram|gpu|vram|processador|placa de video|memoria|disco|ssd|hd|computador|pc|telemetria|rede|upload|download)\b/.test(t);
  const provider = recognizeProvider(t);
  if (/\b(cotas?|quotas?|tokens?|limites?|saldo|resta|restam|restante|restantes|renova|renovam|renovacao|reset|reseta|resetam|disponivel|disponiveis)\b/.test(t) && (provider || /\b(ia|ias|ai|provedores|inteligencia artificial)\b/.test(t))) {
    return { secao: 'cotas', provedor: provider };
  }
  if (pc && /historico|ultimos?\s+\d+|ultima hora/.test(t)) {
    const minutes = /\b(\d+)\s*(?:min|minutos)\b/.exec(t)?.[1];
    return { secao: 'historico', periodo: minutes === '60' || /ultima hora|1\s*h(?:ora)?\b/.test(t) ? '1h' : minutes ? `${minutes}min` : '5min', recurso: /gpu|placa de video/.test(t) ? 'gpu' : /ram|memoria/.test(t) ? 'ram' : 'cpu' };
  }
  if (/\b(processos?|programas?|aplicativos?)\b/.test(t) && /consum|usando|uso|gast|abert|rodando/.test(t)) return { secao: 'processos', recurso: /gpu|vram|placa de video/.test(t) ? 'gpu' : /ram|memoria/.test(t) ? 'ram' : 'cpu' };
  if (/ficha|especificac|tempo ligado|uptime|sistema operacional|modelo do/.test(t) && (pc || /uptime|sistema operacional/.test(t))) return { secao: 'sistema' };
  if (/\b(volume|midia|reproducao)\b/.test(t) || /musica.*tocando/.test(t)) return { secao: 'midia' };
  if (/gpu|vram|placa de video/.test(t)) return { secao: 'gpu' };
  if (/\b(disco|ssd|hd)\b|espaco.*(?:livre|c:)|unidade/.test(t)) return { secao: 'discos', disco: /\b([a-z]):(?:\\)?/.exec(t)?.[1] };
  if (/\b(rede|upload|download)\b/.test(t)) return { secao: 'rede' };
  if (/\b(cpu|processador)\b/.test(t) && !/\bram\b|memoria/.test(t)) return { secao: 'cpu' };
  if (/\b(ram|memoria)\b/.test(t) && !/\bcpu\b|processador/.test(t)) return { secao: 'ram' };
  if (pc) return { secao: 'resumo' };
  return null;
}

function presentation(result) {
  if (!result?.ok) return { badge: 'NERD OPS', title: 'Indisponível', rows: [{ label: 'Consulta', value: result?.erro || 'Dashboard indisponível', status: 'error' }], reply: result?.erro || 'Não consegui consultar o dashboard agora.' };
  const d = result.dados;
  const rows = [];
  const add = (label, value, status) => rows.push({ label, value: String(value), ...(status ? { status } : {}) });
  const metrics = (o, fields) => fields.forEach(([key, label, unit]) => add(label, fmt(o?.[key], unit)));
  let title = result.secao.toUpperCase();
  switch (result.secao) {
    case 'resumo':
      add('CPU', fmt(d.cpu?.percent, '%')); add('RAM', fmt(d.ram?.percent, '%')); add('GPU', d.gpu?.online ? fmt(d.gpu.load_pct, '%') : 'indisponível'); break;
    case 'cpu':
      metrics(d, [['percent', 'Uso', '%'], ['freq_ghz', 'Frequência', ' GHz'], ['cores', 'Núcleos', ''], ['threads', 'Threads', '']]);
      if (Array.isArray(d.per_cpu)) add('Por processador lógico', d.per_cpu.map(v => fmt(v, '%')).join(' / ')); break;
    case 'ram': metrics(d, [['percent', 'Uso', '%'], ['used_gb', 'Em uso', ' GB'], ['total_gb', 'Total', ' GB'], ['free_gb', 'Disponível', ' GB']]); break;
    case 'gpu':
      title = d.name || 'GPU';
      metrics(d, [['load_pct', 'Uso', '%'], ['temp_c', 'Temperatura', ' °C'], ['vram_used_gb', 'VRAM usada', ' GB'], ['vram_total_gb', 'VRAM total', ' GB'], ['power_w', 'Potência', ' W'], ['fan_pct', 'Ventoinha', '%'], ['clock_core_mhz', 'Clock GPU', ' MHz'], ['clock_mem_mhz', 'Clock memória', ' MHz'], ['encoder_pct', 'Encoder', '%'], ['decoder_pct', 'Decoder', '%']]); break;
    case 'discos':
      d.unidades.forEach(v => add(v.device || v.mountpoint, `${fmt(v.free_gb, ' GB')} livres / ${fmt(v.total_gb, ' GB')} • ${fmt(v.percent, '%')} usado`));
      metrics(d.io, [['read_mb_s', 'Leitura', ' MB/s'], ['write_mb_s', 'Escrita', ' MB/s']]); break;
    case 'rede': metrics(d, [['down_mb_s', 'Download', ' MB/s'], ['up_mb_s', 'Upload', ' MB/s'], ['total_recv_gb', 'Recebido', ' GB'], ['total_sent_gb', 'Enviado', ' GB']]); break;
    case 'midia':
      add('Reprodução', ({ playing: 'tocando', paused: 'pausada', stopped: 'parada', none: 'nenhuma sessão', unavailable: 'indisponível' })[d.media?.status] || 'indisponível');
      add('Volume', fmt(d.volume?.level, '%')); add('Mudo', typeof d.volume?.muted === 'boolean' ? d.volume.muted ? 'sim' : 'não' : 'indisponível'); break;
    case 'processos':
      title = `Processos • ${d.recurso.toUpperCase()}`;
      d.processos.forEach(p => add(p.name, fmt(p[d.recurso === 'cpu' ? 'cpu_pct' : d.recurso === 'gpu' ? 'gpu_mem_mb' : 'mem_mb'], d.recurso === 'cpu' ? '%' : ' MB')));
      if (!d.processos.length) add('Processos', 'nenhum dado disponível');
      if (d.aplicativos) Object.entries(d.aplicativos).forEach(([name, running]) => add(name, running ? 'aberto' : 'fechado')); break;
    case 'historico':
      title = `Histórico • ${d.periodo}`;
      for (const [key, label, unit] of [['cpu', 'CPU', '%'], ['ram', 'RAM', '%'], ['gpu', 'GPU', '%'], ['temp', 'Temperatura GPU', ' °C'], ['net_down', 'Download', ' MB/s'], ['net_up', 'Upload', ' MB/s'], ['disk_pct', 'Primeiro disco', '%']]) {
        const m = d.metricas[key]; add(label, m ? `média ${fmt(m.media, unit)} • pico ${fmt(m.maximo, unit)}` : 'indisponível');
      }
      if (result.desatualizado) add('Última amostra', `${result.idade_s} s atrás`, 'warn'); break;
    case 'sistema':
      add('Sistema', d.os || 'indisponível'); add('CPU', d.cpu_model || 'indisponível'); add('GPU', d.gpu_model || 'indisponível');
      add('Ligado há', fmt(number(d.uptime_s) ? d.uptime_s / 3600 : null, ' horas')); add('RAM total', fmt(d.ram_total_gb, ' GB')); add('Discos', fmt(d.disks_count)); add('Capacidade total', fmt(d.disks_total_gb, ' GB')); add('Resolução', d.resolution || 'indisponível');
      if (d.collector_ok !== true) add('Coletor', 'desatualizado ou indisponível', 'warn'); break;
    case 'servicos':
      d.projetos.forEach(p => p.servicos.forEach(s => add(`${p.nome} • ${s.nome}`, s.status || 'desconhecido', s.status === 'online' ? 'ok' : 'warn')));
      if (!rows.length) add('Serviços', 'nenhum dado disponível'); break;
    case 'cotas':
      d.provedores.forEach(p => {
        if (!p.windows.length) add(p.label, p.status || 'indisponível', 'warn');
        p.windows.forEach(w => {
          const reset = number(w.resets_at) && w.resets_at > 0 && !Number.isNaN(new Date(w.resets_at).getTime())
            ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(w.resets_at)
            : null;
          const remaining = p.count_only || !number(w.restante_pct)
            ? number(w.count) ? `${w.count} usos (sem percentual)` : 'percentual indisponível'
            : `${fmt(w.restante_pct, '%')} restante`;
          add(`${p.label} • ${w.label}`, `${remaining} • ${reset ? `renova em ${reset} (Brasília)` : 'renovação não informada'}${p.stale ? ' • desatualizado' : ''}${p.backoff ? ' • consultas em espera' : ''}${p.status !== 'ok' ? ` • ${p.status}` : ''}`, p.stale || p.backoff || p.status !== 'ok' ? 'warn' : undefined);
        });
      });
      if (!rows.length) add('Cotas', 'nenhum provedor disponível'); break;
  }
  if (result.foco) rows.sort((a, b) => Number(b.label === result.foco) - Number(a.label === result.foco));
  const warning = result.desatualizado ? ' Dados desatualizados.' : '';
  return { badge: `NERD OPS • ${result.secao.toUpperCase()}`, title, rows, reply: `${title}: ${rows.slice(0, 2).map(r => `${r.label}, ${r.value}`).join('; ')}.${warning}` };
}

async function answerQuery(message, monitor) {
  const args = parseQuery(message);
  if (!args) return null;
  const result = await monitor.query(args);
  const view = presentation(result);
  if (result.ok && args.secao === 'cotas' && !args.provedor && result.dados.provedores.length) {
    const summaries = result.dados.provedores.map(p => view.rows.find(r => r.label === p.label || r.label.startsWith(`${p.label} • `))).filter(Boolean);
    view.reply = `COTAS: ${summaries.map(r => `${r.label}, ${r.value}`).join('; ')}. Consulte um provedor para ouvir suas outras janelas.`;
  }
  if (args.secao === 'cotas' && /\btokens?\b/i.test(message)) view.reply = `O dashboard informa cotas, sem quantidade exata de tokens. ${view.reply}`;
  // Para perguntas específicas, prioriza a linha que contém o dado solicitado.
  const normalized = String(message).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const focus = /temperatura/.test(normalized) ? 'Temperatura' : /ventoinha/.test(normalized) ? 'Ventoinha' : /potencia/.test(normalized) ? 'Potência' : /decoder/.test(normalized) ? 'Decoder' : /encoder/.test(normalized) ? 'Encoder' : /clock.*memoria/.test(normalized) ? 'Clock memória' : /clock/.test(normalized) ? 'Clock GPU' : /vram.*total/.test(normalized) ? 'VRAM total' : /vram/.test(normalized) ? 'VRAM' : /frequencia/.test(normalized) ? 'Frequência' : /tempo ligado|uptime/.test(normalized) ? 'Ligado há' : /volume/.test(normalized) ? 'Volume' : /download/.test(normalized) ? 'Download' : /upload/.test(normalized) ? 'Upload' : /nucleos/.test(normalized) ? 'Núcleos' : /threads/.test(normalized) ? 'Threads' : /livre|disponivel/.test(normalized) && args.secao === 'ram' ? 'Disponível' : result.secao === 'historico' ? args.recurso.toUpperCase() : null;
  const focused = focus && view.rows.find(r => r.label.startsWith(focus));
  if (result.ok && focused) {
    result.foco = focused.label;
    view.reply = `${focused.label}: ${focused.value}.${result.desatualizado ? ' Dados desatualizados.' : ''}`;
  }
  return { result, ...view };
}
module.exports = { parseQuery, presentation, answerQuery };
