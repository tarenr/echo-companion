// Echo // Estratégia Nerd Companion Client
// 100% Display Only - Sem botões, reativo a SSE do PC

(function () {
  'use strict';

  // Elementos do DOM
  const screen = document.getElementById('screen');
  const echoWrapper = document.getElementById('echo-wrapper');
  const echoFace = document.getElementById('echo-face');
  const armLeft = document.getElementById('arm-left');
  const armRight = document.getElementById('arm-right');
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

  // Elementos do PIN Modal
  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinBtn = document.getElementById('pin-btn');
  const pinError = document.getElementById('pin-error');

  // Estado Local
  let audioUnlocked = false;
  let currentAudio = null;
  let mouthTalkInterval = null;
  let lastVoicePlayed = '';
  let wakeLock = null;
  let sseSource = null;
  let idleInterval = null;
  let currentState = null;
  let idlePoseIndex = 0;

  // 1. Desbloqueio de Áudio e Wake Lock no primeiro toque na tela
  async function unlockAudioAndWakeLock() {
    if (!audioUnlocked) {
      audioUnlocked = true;
      audioToast.classList.add('hidden');

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

  document.addEventListener('visibilitychange', () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });

  // 2. Regra Estrita da Boca: ESTRITAMENTE '_' e 'o'
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
    // Boca fechada por padrão
    mouth.textContent = '_';
  }

  // Piscar de Olhos Natural Contínuo
  setInterval(() => {
    if (mouthTalkInterval) return;
    if (currentState && currentState.state !== 'idle') return;
    
    // Pisca rápido apenas se estiver com olhos abertos
    const prevL = eyeLeft.textContent;
    const prevR = eyeRight.textContent;
    if (prevL === '^' && prevR === '^') {
      eyeLeft.textContent = '-';
      eyeRight.textContent = '-';
      setTimeout(() => {
        eyeLeft.textContent = '^';
        eyeRight.textContent = '^';
      }, 130);
    }
  }, 3800);

  // 3. Ciclo Orgânico de Poses no Modo Ocioso (Idle)
  function applyIdlePose(index) {
    if (mouthTalkInterval) return;

    armLeft.className = 'arm-side';
    armRight.className = 'arm-side';
    mouth.textContent = '_'; // Regra estrita: boca sempre '_' quando quieto

    if (index === 0) {
      // Repouso suave e sereno
      armLeft.textContent = '';
      armRight.textContent = '';
      eyeLeft.textContent = '^';
      eyeRight.textContent = '^';
    } 
    else if (index === 1) {
      // Dando de ombros pensando na vida: ¯\_(¬_¬)_/¯
      armLeft.textContent = '¯\\_';
      armRight.textContent = '_/¯';
      armLeft.style.marginTop = '0.5rem';
      armRight.style.marginTop = '0.5rem';
      eyeLeft.textContent = '¬';
      eyeRight.textContent = '¬';
    } 
    else if (index === 2) {
      // Relaxando / dançando: ~(˘_˘~)
      armLeft.textContent = '~';
      armRight.textContent = '~';
      armLeft.style.marginTop = '0';
      armRight.style.marginTop = '0';
      eyeLeft.textContent = '˘';
      eyeRight.textContent = '˘';
    }
  }

  function startIdleCycle() {
    if (idleInterval) clearInterval(idleInterval);
    idlePoseIndex = 0;
    applyIdlePose(0);

    idleInterval = setInterval(() => {
      if (!currentState || currentState.state === 'idle') {
        idlePoseIndex = (idlePoseIndex + 1) % 3;
        applyIdlePose(idlePoseIndex);
      }
    }, 22000);
  }

  // 4. Síntese e Execução de Voz OpenAI TTS
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

      currentAudio.onerror = () => {
        stopSpeakingAnimation();
        currentAudio = null;
      };

      await currentAudio.play();
    } catch (err) {
      console.warn('Falha no playback de voz:', err.message);
      stopSpeakingAnimation();
    }
  }

  // 5. Renderização do Estado no Layout
  function renderState(state) {
    currentState = state;

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

    // Reseta classes básicas de braços
    armLeft.className = 'arm-side';
    armRight.className = 'arm-side';
    armLeft.style.marginTop = '0';
    armRight.style.marginTop = '0';

    // Determina Tema de Cor
    let themeClass = 'theme-cyan';
    if (state.state === 'waiting') themeClass = 'theme-waiting';
    else if (state.state === 'success') themeClass = 'theme-success';
    else if (state.state === 'error') themeClass = 'theme-error';
    else if (state.agentTheme === 'claude') themeClass = 'theme-claude';
    else if (state.agentTheme === 'antigravity') themeClass = 'theme-antigravity';
    else if (state.agentTheme === 'codex') themeClass = 'theme-codex';

    echoFace.className = `echo-face ${themeClass}`;

    // Configuração das Faces Kaomoji por Ação
    if (state.state === 'waiting' || state.badge === 'APROVAÇÃO NECESSÁRIA') {
      // Chamando atenção: \( ? o ? )/
      armLeft.className = 'arm-side arm-animated-left';
      armRight.className = 'arm-side arm-animated-right';
      armLeft.textContent = '\\';
      armRight.textContent = '/';
      eyeLeft.textContent = '?';
      eyeRight.textContent = '?';
      mouth.textContent = 'o'; // Boca aberta chamando você

      panelBadge.textContent = state.badge || 'APROVAÇÃO NECESSÁRIA';
      panelMainText.textContent = state.title || 'APROVAR?';
      panelMainText.style.color = 'var(--amber-neon)';
      panelFill.style.width = '100%';
      panelFill.style.backgroundColor = 'var(--amber-neon)';
      panelSubLine1.textContent = state.detail || 'Aguardando autorização no terminal do PC';
      panelSubLine2.textContent = 'Verifique o plano proposto no console';
    } 
    else if (state.state === 'error') {
      // Erro: ¯\_( x _ x )_/¯
      armLeft.textContent = '¯\\_';
      armRight.textContent = '_/¯';
      eyeLeft.textContent = 'x';
      eyeRight.textContent = 'x';
      mouth.textContent = '_';

      panelBadge.textContent = state.badge || 'ERRO';
      panelMainText.textContent = state.title || 'FALHA NA TAREFA';
      panelMainText.style.color = 'var(--rose-neon)';
      panelFill.style.width = '100%';
      panelFill.style.backgroundColor = 'var(--rose-neon)';
      panelSubLine1.textContent = state.detail || 'Ocorreu um erro durante a execução';
      panelSubLine2.textContent = 'Consulte o log de erro no PC';
    } 
    else if (state.state === 'success') {
      // Comemorando vitória: *\ ( ^ _ ^ ) /*
      armLeft.className = 'arm-side arm-animated-left';
      armRight.className = 'arm-side arm-animated-right';
      armLeft.textContent = '*\\';
      armRight.textContent = '/*';
      eyeLeft.textContent = '^';
      eyeRight.textContent = '^';
      mouth.textContent = '_';
    } 
    else if (state.state === 'working') {
      if (state.actionType === 'executing') {
        // Implementando (escrita): \( ò _ ó )/
        armLeft.textContent = '\\';
        armRight.textContent = '/';
        eyeLeft.textContent = 'ò';
        eyeRight.textContent = 'ó';
        mouth.textContent = '_';
      } else {
        // Pesquisando (leitura): c( • _ • )כ
        armLeft.textContent = 'c';
        armRight.textContent = 'כ';
        eyeLeft.textContent = '•';
        eyeRight.textContent = '•';
        mouth.textContent = '_';
      }
    } 
    else {
      // Standby: segue o ciclo orgânico ocioso
      applyIdlePose(idlePoseIndex);
    }

    // Voz
    if (state.voiceMessage && state.voiceMessage !== lastVoicePlayed) {
      lastVoicePlayed = state.voiceMessage;
      voiceText.textContent = state.voiceMessage;
      panelVoice.style.display = 'block';
      speak(state.voiceMessage);
    }
  }

  // 6. Conexão SSE
  function connectSSE() {
    if (sseSource) sseSource.close();

    connectionStatus.textContent = 'CONECTANDO...';
    connectionStatus.style.color = 'var(--cyan-neon)';

    sseSource = new EventSource('/api/stream');

    sseSource.onopen = () => {
      connectionStatus.textContent = 'ONLINE // CONECTADO';
      connectionStatus.style.color = 'var(--matrix-neon)';
      statusDot.style.backgroundColor = 'var(--cyan-neon)';
      pinModal.classList.add('hidden');
    };

    sseSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        renderState(data);
      } catch (e) {
        console.error('Erro ao processar estado SSE:', e);
      }
    };

    sseSource.onerror = (err) => {
      console.warn('SSE Desconectado ou Não Autorizado:', err);
      connectionStatus.textContent = 'DESCONECTADO // RECONECTANDO...';
      connectionStatus.style.color = 'var(--amber-neon)';
      statusDot.style.backgroundColor = 'var(--amber-neon)';
      sseSource.close();

      // Checa se foi bloqueado por falta de PIN
      checkAuthAndPromptPin();
      setTimeout(connectSSE, 4000);
    };
  }

  // 7. Autenticação e Desbloqueio por PIN
  async function checkAuthAndPromptPin() {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (!data.authorized) {
        pinModal.classList.remove('hidden');
        pinInput.focus();
      } else {
        pinModal.classList.add('hidden');
      }
    } catch (e) {
      // Ignora erro de rede temporário
    }
  }

  async function submitPin() {
    const pin = pinInput.value.trim();
    if (!pin) return;

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (data.ok) {
        pinModal.classList.add('hidden');
        pinError.style.display = 'none';
        localStorage.setItem('echo_pin', pin);
        connectSSE();
      } else {
        pinError.style.display = 'block';
      }
    } catch (err) {
      pinError.textContent = 'Erro ao validar PIN. Tente novamente.';
      pinError.style.display = 'block';
    }
  }

  pinBtn.addEventListener('click', submitPin);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPin();
  });

  // Inicialização
  const urlParams = new URLSearchParams(window.location.search);
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl) {
    pinInput.value = pinFromUrl;
    submitPin();
  } else {
    checkAuthAndPromptPin();
  }

  startIdleCycle();
  connectSSE();

})();
