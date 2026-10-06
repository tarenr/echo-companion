// GPS opt-in de Echo e Luna. Não captura nem transmite com a página escondida.
(() => {
  window.createEchoLocation = function ({ scope, getHeaders, speak }) {
    const other = scope === 'echo' ? 'Luna' : 'Echo';
    let state = {}, csrf = '', watch = null, heartbeat = null, retryTimer = null, sentAt = 0, previous = null, sending = false, busy = false, generation = 0;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'footer-btn location-footer-btn'; button.setAttribute('aria-label', 'Localização compartilhada');
    button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14Z"/><circle cx="12" cy="8" r="3"/></svg><span class="footer-label">LOCAL</span>';
    (document.querySelector('.bottom-actions') || document.querySelector('.bottom-bar')).append(button);
    const panel = document.createElement('dialog'); panel.className = 'location-dialog'; panel.setAttribute('aria-label', 'Localização compartilhada');
    const heading = document.createElement('h2'); heading.textContent = 'Localização';
    const status = document.createElement('p'), consent = document.createElement('p'), gpsMessage = document.createElement('p');
    consent.textContent = `Compartilhe a localização deste celular com ${other} enquanto este aplicativo estiver aberto e visível. Você pode parar a qualquer momento. Guarda apenas a última posição por até 24 horas.`;
    const addressNotice = document.createElement('p');
    const result = document.createElement('p'), actions = document.createElement('div'); actions.className = 'location-controls';
    const start = document.createElement('button'), stop = document.createElement('button'), query = document.createElement('button'), close = document.createElement('button'), map = document.createElement('a');
    for (const b of [start, stop, query, close]) { b.type = 'button'; actions.append(b); }
    start.textContent = 'Compartilhar minha localização'; stop.textContent = 'Parar compartilhamento'; query.textContent = `Onde ${other} está?`; close.textContent = 'Fechar';
    map.textContent = 'Ver no mapa'; map.target = '_blank'; map.rel = 'noopener noreferrer'; map.referrerPolicy = 'no-referrer'; map.hidden = true;
    panel.append(heading, status, consent, addressNotice, gpsMessage, result, map, actions); document.body.append(panel);
    function visible() { return document.visibilityState === 'visible'; }
    function render() {
      button.classList.toggle('sharing', !!state.sharing && !!state.owner);
      button.title = state.sharing ? (state.owner ? 'Localização compartilhada neste celular' : 'Outro celular compartilha esta localização') : 'Ativar localização compartilhada';
      status.textContent = !state.configured ? 'Localização não configurada no servidor.' : !state.sharing ? 'Compartilhamento desligado.' : !state.owner ? 'Outro celular é o transmissor deste mascote.' : !visible() ? 'Atualizações pausadas: aplicativo fora da frente.' : watch !== null ? 'Compartilhamento ativo enquanto esta tela estiver visível.' : 'Compartilhamento ativado; aguardando GPS.';
      addressNotice.textContent = state.geocoding === 'google' ? 'Ao consultar um endereço, as coordenadas são enviadas ao Google Maps.'
        : state.geocoding ? 'Ao consultar um endereço, as coordenadas são enviadas ao OpenStreetMap.'
        : 'Sem API de endereços: locais cadastrados e posição no mapa continuam disponíveis.';
      start.textContent = state.sharing && !state.owner ? 'Usar este celular no lugar do outro' : state.owner ? 'Atualizar GPS deste celular' : 'Compartilhar minha localização';
      start.disabled = busy || !state.configured; stop.disabled = busy; stop.hidden = !state.sharing; query.disabled = busy || !state.configured;
    }
    async function request(path, body) {
      const response = await fetch(`/api/location/${scope}/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...getHeaders(), 'x-location-csrf': csrf }, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.reply || 'Desbloqueie o assistente para acessar a localização.');
      return data;
    }
    async function refresh() { state = await request('status'); csrf = state.csrf; if ((!state.owner || !state.sharing) && watch !== null) pause(); render(); return state; }
    function pause() { generation++; if (watch !== null) navigator.geolocation.clearWatch(watch); watch = null; clearInterval(heartbeat); heartbeat = null; clearTimeout(retryTimer); retryTimer = null; render(); }
    function retry(epoch = generation) {
      if (!visible() || !state.owner || !state.sharing || epoch !== generation || retryTimer) return;
      retryTimer = setTimeout(async () => {
        retryTimer = null;
        if (!visible() || epoch !== generation) return;
        try { await refresh(); if (epoch === generation) { sentAt = 0; run(); } }
        catch (_) { retry(epoch); }
      }, 30000);
    }
    function error(e) {
      result.textContent = e.code === 1 ? 'Permissão de localização negada. Libere nas configurações do navegador para compartilhar.' : e.code === 2 || e.code === 3 ? 'GPS indisponível. A última posição não foi atualizada.' : e.message || 'Não foi possível atualizar a localização.';
      if (e.code === 1 && state.owner && state.sharing) {
        pause();
        request('stop', { confirm: 'stop', ownOnly: true }).then(() => { state.sharing = false; state.owner = false; map.hidden = true; map.removeAttribute('href'); render(); }).catch(() => { result.textContent += ' Não foi possível revogar no servidor; confira o estado ao reconectar.'; });
      }
    }
    function fix() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation || !window.isSecureContext) return reject(new Error('GPS requer HTTPS e navegador com localização disponível.'));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
      });
    }
    async function publish(position, epoch = generation) {
      if (!visible() || !state.owner || !state.sharing || sending || epoch !== generation) return;
      const now = Date.now(), p = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: position.timestamp };
      if (now - p.capturedAt > 120000 || now - sentAt < 15000) return;
      const moved = !previous || Math.abs(p.latitude - previous.latitude) + Math.abs(p.longitude - previous.longitude) > 0.0003;
      if (!moved && now - sentAt < 60000) return;
      sending = true;
      try {
        const response = await request('update', p);
        if (epoch !== generation) return;
        if (response.accepted) { previous = p; sentAt = now; gpsMessage.textContent = 'GPS deste celular atualizado. Precisão aproximada: ' + Math.ceil(p.accuracy) + ' m.'; }
      } catch (e) {
        error(e); pause();
        retry();
      } finally { sending = false; }
    }
    function run() {
      if (!visible() || !state.owner || !state.sharing || watch !== null || !navigator.geolocation) return;
      const epoch = generation;
      watch = navigator.geolocation.watchPosition(p => publish(p, epoch), error, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
      heartbeat = setInterval(async () => { if (visible()) { try { await publish(await fix(), epoch); } catch (e) { error(e); } } }, 60000);
      render();
    }
    function show(data) {
      if (data.source !== 'shared-location') return;
      result.textContent = data.reply || 'Localização indisponível.'; map.hidden = true; map.removeAttribute('href');
      if (data.mapUrl && data.location) {
        try { const url = new URL(data.mapUrl); if (url.origin === 'https://www.google.com' && url.pathname === '/maps/search/' && !url.username && !url.password) { map.href = url.href; map.hidden = false; } } catch (_) {}
      }
      if (!panel.open) panel.showModal();
    }
    button.addEventListener('click', async () => { if (!panel.open) panel.showModal(); try { await refresh(); run(); } catch (e) { error(e); } });
    close.addEventListener('click', () => panel.close());
    start.addEventListener('click', async () => {
      if (busy) return; busy = true; render();
      try {
        await refresh(); const replace = state.sharing && !state.owner;
        if (replace && !window.confirm('Substituir o celular que compartilha por este mascote? O outro deixará de publicar.')) return;
        if (!visible()) return;
        const epoch = generation, position = await fix(); if (epoch !== generation || !visible()) return;
        state = { ...state, ...await request('start', { consent: true, replace }) };
        sentAt = 0; previous = null; await publish(position); run();
      } catch (e) { error(e); } finally { busy = false; render(); }
    });
    stop.addEventListener('click', async () => {
      if (busy || !window.confirm('Parar o compartilhamento deste mascote e apagar a última posição?')) return;
      busy = true; pause(); render();
      try { await refresh(); await request('stop', { confirm: 'stop' }); state.sharing = false; state.owner = false; previous = null; sentAt = 0; gpsMessage.textContent = ''; result.textContent = 'Compartilhamento interrompido e posição removida.'; map.hidden = true; map.removeAttribute('href'); }
      catch (e) { error(e); } finally { busy = false; render(); }
    });
    query.addEventListener('click', async () => {
      if (busy) return; busy = true; render();
      try { await refresh(); const data = await request('query', {}); show(data); if (speak) await speak(data.reply); } catch (e) { error(e); } finally { busy = false; render(); }
    });
    document.addEventListener('visibilitychange', async () => {
      if (!visible()) { pause(); return; }
      try { await refresh(); sentAt = 0; run(); } catch (e) { error(e); }
    });
    window.addEventListener('pagehide', pause);
    refresh().then(run).catch(() => {});
    render(); return { show };
  };
})();
