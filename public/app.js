// Echo // Estratégia Nerd Companion Client
// 100% Display Only - Sem botões, reativo a SSE do PC

(function () {
  'use strict';

  // Elementos do DOM
  const screen = document.getElementById('screen');
  const echoWrapper = document.getElementById('echo-wrapper');
  const echoFace = document.getElementById('echo-face');
  const eyeLeft = document.getElementById('eye-left');
  const eyeRight = document.getElementById('eye-right');
  const mouth = document.getElementById('mouth');

  const brandProject = document.getElementById('brand-project');
  const agentLabel = document.getElementById('agent-label');
  const badgeTop = document.getElementById('badge-top');
  const statusDot = document.getElementById('status-dot');

  const infoPanel = document.getElementById('info-panel');
  const panelBadge = document.getElementById('panel-badge');
  const panelMainText = document.getElementById('panel-main-text');
  const panelFill = document.getElementById('panel-fill');
  const panelSubLine1 = document.getElementById('panel-sub-line1');
  const panelSubLine2 = document.getElementById('panel-sub-line2');
  const panelVoice = document.getElementById('panel-voice');
  const voiceText = document.getElementById('voice-text');

  const connectionStatus = document.getElementById('connection-status');
  const telemetryBar = document.getElementById('telemetry-bar');
  const audioToast = document.getElementById('audio-toast');

  // Estado Local
  let audioUnlocked = false;
  let currentAudio = null;
  let mouthTalkInterval = null;
  let lastVoicePlayed = '';
  let wakeLock = null;

  // 1. Desbloqueio de Áudio e Wake Lock no primeiro toque na tela
  async function unlockAudioAndWakeLock() {
    if (!audioUnlocked) {
      audioUnlocked = true;
      audioToast.classList.add('hidden');

      // Toca um bipe silencioso para liberar o contexto de áudio móvel
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(0);
        osc.stop(0.05);
      } catch (e) {
        console.warn('Erro ao inicializar AudioContext:', e);
      }

      // Ativa WakeLock para manter tela do celular sempre acesa
      requestWakeLock();
    }
  }

  screen.addEventListener('click', unlockAudioAndWakeLock);
  screen.addEventListener('touchstart', unlockAudioAndWakeLock, { passive: true });

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('💡 WakeLock ativo: Tela mantida ligada.');
      }
    } catch (err) {
      console.warn('WakeLock não suportado ou negado:', err.message);
    }
  }

  // Se o usuário alternar de app e voltar, restabelece o WakeLock
  document.addEventListener('visibilitychange', () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });

  // 2. Animação de Fala do Mascote (_ <-> o)
  function startSpeakingAnimation() {
    if (mouthTalkInterval) clearInterval(mouthTalkInterval);
    let open = false;
    mouthTalkInterval = setInterval(() => {
      open = !open;
      mouth.textContent = open ? 'o' : '_';
    }, 130);
  }

  function stopSpeakingAnimation() {
    if (mouthTalkInterval) {
      clearInterval(mouthTalkInterval);
      mouthTalkInterval = null;
    }
    mouth.textContent = '_';
  }

  // Piscar de Olhos Natural Contínuo
  setInterval(() => {
    if (mouthTalkInterval) return; // Não pisca no meio da fala
    eyeLeft.textContent = '-';
    eyeRight.textContent = '-';
    setTimeout(() => {
      eyeLeft.textContent = '^';
      eyeRight.textContent = '^';
    }, 130);
  }, 3500);

  // 3. Síntese e Execução de Voz OpenAI TTS
  async function speak(text) {
    if (!text || !audioUnlocked) return;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      stopSpeakingAnimation();
    }

    try {
      startSpeakingAnimation();

      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`TTS HTTP error: ${response.status}`);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(audioUrl);

      currentAudio.onended = () => {
        stopSpeakingAnimation();
        currentAudio = null;
        URL.revokeObjectURL(audioUrl);
      };

      currentAudio.onerror = (e) => {
        console.warn('Erro ao tocar áudio:', e);
        stopSpeakingAnimation();
        currentAudio = null;
      };

      await currentAudio.play();
    } catch (err) {
      console.warn('Falha no playback de voz:', err.message);
      stopSpeakingAnimation();
    }
  }

  // 4. Aplicação do Estado no Layout
  function renderState(state) {
    // Header
    if (state.project) brandProject.textContent = state.project;
    if (state.agent) agentLabel.textContent = state.agent;
    if (state.badge) badgeTop.textContent = state.badge;

    // Telemetria no rodapé
    if (state.telemetry) {
      telemetryBar.textContent = `CPU: ${state.telemetry.cpuPercent}% | RAM: ${state.telemetry.ramPercent}%`;
    }

    // Modo Visual (Full vs Info)
    const isInfoMode = state.mode === 'info';

    if (isInfoMode) {
      echoWrapper.className = 'echo-wrapper mode-info';
      infoPanel.classList.add('visible');
    } else {
      echoWrapper.className = 'echo-wrapper mode-full';
      infoPanel.classList.remove('visible');
    }

    // Cores e Emoções
    echoFace.className = 'echo-face';
    panelBadge.className = 'badge-tag';

    if (state.state === 'waiting' || state.badge === 'APROVAÇÃO NECESSÁRIA') {
      echoFace.classList.add('color-amber');
      panelBadge.className = 'badge-tag';
      panelBadge.textContent = state.badge || 'APROVAÇÃO NECESSÁRIA';
      panelMainText.textContent = state.title || 'APROVAR?';
      panelMainText.style.color = 'var(--amber-neon)';
      panelFill.style.width = '100%';
      panelFill.style.backgroundColor = 'var(--amber-neon)';
      panelSubLine1.textContent = state.detail || 'Aguardando autorização no terminal do PC';
      panelSubLine2.textContent = 'Verifique o plano proposto no console';
    } 
    else if (state.state === 'error') {
      echoFace.classList.add('color-rose');
      panelBadge.className = 'badge-tag badge-rose';
      panelBadge.textContent = state.badge || 'ERRO';
      panelMainText.textContent = state.title || 'FALHA NA TAREFA';
      panelMainText.style.color = 'var(--rose-neon)';
      panelFill.style.width = '100%';
      panelFill.style.backgroundColor = 'var(--rose-neon)';
      panelSubLine1.textContent = state.detail || 'Ocorreu um erro durante a execução';
      panelSubLine2.textContent = 'Consulte o log de erro no PC';
    } 
    else if (state.state === 'success') {
      echoFace.classList.add('color-emerald');
      mouth.textContent = 'v';
    } 
    else if (state.state === 'working') {
      echoFace.className = 'echo-face'; // Neon cyan padrão
      mouth.textContent = '_';
    } 
    else {
      // Idle / Standby
      echoFace.className = 'echo-face';
      mouth.textContent = '_';
    }

    // Fala por voz caso haja uma mensagem nova
    if (state.voiceMessage && state.voiceMessage !== lastVoicePlayed) {
      lastVoicePlayed = state.voiceMessage;
      voiceText.textContent = state.voiceMessage;
      panelVoice.style.display = 'block';
      speak(state.voiceMessage);
    }
  }

  // 5. Conexão SSE (Server-Sent Events)
  function connectSSE() {
    connectionStatus.textContent = 'WI-FI LOCAL: CONECTANDO...';
    connectionStatus.style.color = 'var(--cyan-neon)';

    const sse = new EventSource('/api/stream');

    sse.onopen = () => {
      connectionStatus.textContent = 'WI-FI LOCAL: CONECTADO';
      connectionStatus.style.color = 'var(--emerald-neon)';
      statusDot.style.backgroundColor = 'var(--cyan-neon)';
    };

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        renderState(data);
      } catch (e) {
        console.error('Erro ao processar estado SSE:', e);
      }
    };

    sse.addEventListener('telemetry_alert', (event) => {
      try {
        const data = JSON.parse(event.data);
        echoWrapper.className = 'echo-wrapper mode-info';
        infoPanel.classList.add('visible');
        echoFace.className = 'echo-face color-amber';
        panelBadge.className = 'badge-tag';
        panelBadge.textContent = data.badge;
        panelMainText.textContent = data.mainText;
        panelMainText.style.color = 'var(--amber-neon)';
        panelFill.style.width = '90%';
        panelFill.style.backgroundColor = 'var(--amber-neon)';
        panelSubLine1.textContent = data.subText;
        panelSubLine2.textContent = 'Hardware sob alta demanda';

        if (data.voiceText && data.voiceText !== lastVoicePlayed) {
          lastVoicePlayed = data.voiceText;
          voiceText.textContent = data.voiceText;
          panelVoice.style.display = 'block';
          speak(data.voiceText);
        }
      } catch (e) {
        console.error('Erro ao processar alerta:', e);
      }
    });

    sse.onerror = () => {
      connectionStatus.textContent = 'WI-FI LOCAL: RECONECTANDO...';
      connectionStatus.style.color = 'var(--amber-neon)';
      statusDot.style.backgroundColor = 'var(--amber-neon)';
      sse.close();
      setTimeout(connectSSE, 2500);
    };
  }

  // Inicia conexão SSE
  connectSSE();

})();
