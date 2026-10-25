// Robô // peças exclusivas do Echo: as fantasias de esqueleto, de Kratos, de Tyrael, de Darth Vader, de TI, de Yusuke,
// de Toguro (sem braços) e os 9 figurinos da Vida de TI (médico, mago, mecânico, adivinho, bombeiro, arqueólogo, psicólogo, detetive e hacker, em teste)
// Carregado depois de robo-roupas.js pelo Echo e pela página de testes do Echo (/robo.html); a Luna não carrega.
// Esqueleto: desenho próprio no estilo de fantasia de Halloween (sorriso costurado, terno listrado e gravata de
// morcego), feito do zero, sem copiar personagem. Kratos: fantasia inspirada no personagem de God of War (marca
// vermelha, barba, ombreira, saiote e machado nas costas), desenhada do zero para o corpo do robô.
// Tyrael: fantasia inspirada no Arcanjo da Justiça de Diablo III (capuz com barra dourada, rosto nas sombras,
// armadura prateada e asas de luz que ondulam), desenhada do zero para o corpo do robô.
// Darth Vader: fantasia inspirada no personagem de Star Wars (capacete com a aba larga, máscara cobrindo o rosto
// todo, painel do peito e capa), desenhada do zero para o corpo do robô.
// TI: fantasia do Dia do Profissional de Informática (headset, óculos de programador e moletom aberto sobre a
// camiseta do Estratégia Nerd, com a caveira do site redesenhada em vetor).
// Yusuke: fantasia inspirada no protagonista de Yu Yu Hakusho (cabelo preto penteado para trás com gel e o
// uniforme verde fechado, de gola alta e botões dourados), desenhada do zero para o corpo do robô.
// Toguro: fantasia inspirada no vilão de Yu Yu Hakusho (cabelo alto cortado reto, óculos escuros em lâmina e
// paletó verde-oliva aberto sobre a regata, com ombreiras largas), desenhada do zero para o corpo do robô. Toda fantasia fica por trás da
// tela do peito, exceto a camiseta do TI (estampa no lugar da tela, aprovada assim).
// Coordenadas: as mesmas de robo-roupas.js (rosto: centro do visor; pescoço: base do corpo, y negativo para cima).

(function (root) {
  'use strict';

  const Roupas = root.RoboRoupas;
  if (!Roupas) return;

  const { BODY, clipBodyWithoutScreen, bodyOutline, stitchedCurve, roundRectOutline } = Roupas.shape;
  const INK = '#0b1220';
  const SUIT = '#121417';
  const PIN = 'rgba(226, 232, 240, 0.9)';
  const SHIRT = '#f1f5f9';

  // Gravata de morcego: asas com a borda de baixo recortada, cabecinha com orelhas e olhos brancos.
  // Fica logo abaixo da cabeça (que termina em y = -86), sobre a camisa branca.
  function drawBat(x, a) {
    x.save();
    x.translate(0, -75);
    x.scale(1.3, 1.3);
    x.rotate(a[0] * 0.3);
    for (const sd of [-1, 1]) {
      x.save();
      x.scale(sd, 1);
      x.beginPath();
      x.moveTo(3, -2);
      x.quadraticCurveTo(14, -10, 30, -9);
      x.quadraticCurveTo(26, -2, 23, 3);
      x.quadraticCurveTo(19, 0, 15, 4);
      x.quadraticCurveTo(11, 1, 4, 3);
      x.closePath();
      x.fillStyle = '#0a0a0f';
      x.fill();
      x.strokeStyle = 'rgba(226, 232, 240, 0.85)';
      x.lineWidth = 1;
      x.stroke();
      // Varetas da asa
      x.strokeStyle = 'rgba(226, 232, 240, 0.3)';
      x.beginPath();
      x.moveTo(5, -1);
      x.lineTo(23, 2);
      x.moveTo(5, -1);
      x.lineTo(15, 3);
      x.stroke();
      // Orelha
      x.beginPath();
      x.moveTo(1, -4);
      x.lineTo(4, -8.5);
      x.lineTo(5, -3);
      x.closePath();
      x.fillStyle = '#0a0a0f';
      x.fill();
      x.restore();
    }
    x.beginPath();
    x.arc(0, 0, 5.5, 0, Math.PI * 2);
    x.fillStyle = '#0a0a0f';
    x.fill();
    x.strokeStyle = 'rgba(226, 232, 240, 0.85)';
    x.lineWidth = 1;
    x.stroke();
    x.fillStyle = '#f8fafc';
    for (const ex of [-2.1, 2.1]) {
      x.beginPath();
      x.arc(ex, -0.6, 1.3, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  }

  // ========================================================
  // KRATOS: partes do desenho
  // ========================================================
  // Rosto: origem no centro do visor (150 x 54, cantos de 27); com o rosto parado, a cabeça vai de y = -69 a 61
  // e x = ±91. Corpo: origem na base do corpo (y negativo para cima), como o terno de esqueleto.
  const VISOR = { x: -75, y: -27, w: 150, h: 54, r: 27 };
  const RED = '#b3121f';
  const RED_DARK = '#6e0710';
  const BEARD = '#4a2c1a';
  const BEARD_DARK = '#24130a';
  const LEATHER = '#6b4226';
  const LEATHER_DARK = '#3a2213';
  const BRONZE_EDGE = '#4a3008';

  function bronze(x, x0, y0, x1, y1) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#f3cf7a');
    g.addColorStop(0.45, '#c08d34');
    g.addColorStop(1, '#6f4a14');
    return g;
  }

  // Marca vermelha: tatuagem de guerra pintada na casca, do lado direito de quem olha. Larga no alto da cabeça,
  // afina ao descer, quebra em ângulo acima do olho e passa por baixo do visor (que fica por cima dela); reaparece
  // um pouco abaixo dele, na bochecha, e a ponta entra na barba.
  function warMarkPath(x) {
    x.beginPath();
    x.moveTo(-6, -112);
    x.lineTo(36, -112);
    x.lineTo(44, -58);
    x.lineTo(60, -36);
    x.lineTo(58, 24);
    x.lineTo(46, 46);
    x.lineTo(32, 24);
    x.lineTo(30, -38);
    x.lineTo(16, -58);
    x.closePath();
  }

  function drawWarMark(x) {
    x.save();
    // Recorte sem o visor: a marca fica por baixo dele
    x.beginPath();
    x.rect(-130, -130, 260, 260);
    roundRectOutline(x, VISOR);
    x.clip('evenodd');
    warMarkPath(x);
    x.fillStyle = RED;
    x.fill();
    x.strokeStyle = RED_DARK;
    x.lineWidth = 1.6;
    x.lineJoin = 'miter';
    x.stroke();
    // Pincelada mais clara no meio, acompanhando o ângulo
    x.strokeStyle = 'rgba(255, 120, 120, 0.35)';
    x.lineWidth = 3;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(12, -96);
    x.lineTo(28, -58);
    x.lineTo(42, -40);
    x.stroke();
    x.restore();
  }

  // Barba cheia: uma forma só, das costeletas (nas pontas do visor) até abaixo do queixo, com a borda de baixo em
  // pontas onduladas. É a parte "por cima" (over) da peça: o motor a desenha sobre o contorno da cabeça, então as
  // pontas passam da borda de baixo e caem sobre o pescoço. Contorna a boca, que continua falando.
  const MOUTH = { y: 40, rx: 9.5, ry: 7 };
  const BEARD_HALF = 72;   // meia largura da borda de baixo, onde ficam as pontas

  function beardPath(x) {
    const R = 28;
    x.beginPath();
    x.moveTo(-90, -12);
    x.lineTo(-78, -12);
    x.lineTo(-48 - R, 0);
    // Bochechas à mostra embaixo do visor, dos dois lados; na da direita (de quem olha) aparece a ponta da marca
    // antes de entrar na barba
    x.arc(-48, 0, R, Math.PI, Math.PI * 2 / 3, true);
    x.quadraticCurveTo(-44, 50, -26, R);
    x.lineTo(26, R);
    x.quadraticCurveTo(44, 50, 62, R * Math.sin(Math.PI / 3));
    x.arc(48, 0, R, Math.PI / 3, 0, true);
    x.lineTo(78, -12);
    x.lineTo(90, -12);
    x.quadraticCurveTo(92, 30, 88, 54);
    x.quadraticCurveTo(84, 66, BEARD_HALF, 66);
    // Pontas de baixo, da direita para a esquerda; as do meio descem mais
    const n = 7, step = (BEARD_HALF * 2) / n;
    for (let i = 0; i < n; i++) {
      const x0 = BEARD_HALF - i * step, x1 = x0 - step, cx = (x0 + x1) / 2;
      const middle = 1 - Math.abs(cx) / BEARD_HALF;
      x.quadraticCurveTo(cx, 84 + 8 * middle, x1, 66 + 2 * (1 - Math.abs(x1) / BEARD_HALF));
    }
    x.quadraticCurveTo(-84, 66, -88, 54);
    x.quadraticCurveTo(-92, 30, -90, -12);
    x.closePath();
  }

  function mouthHole(x) {
    x.moveTo(MOUTH.rx, MOUTH.y);
    x.ellipse(0, MOUTH.y, MOUTH.rx, MOUTH.ry, 0, 0, Math.PI * 2);
  }

  function drawBeard(x) {
    x.save();
    beardPath(x);
    mouthHole(x);
    const g = x.createLinearGradient(0, -12, 0, 84);
    g.addColorStop(0, '#2e1a0e');
    g.addColorStop(0.5, BEARD);
    g.addColorStop(1, '#3b2214');
    x.fillStyle = g;
    x.fill('evenodd');
    x.strokeStyle = BEARD_DARK;
    x.lineWidth = 1.6;
    x.stroke();
    x.clip('evenodd');

    // Fios: poucas mechas curvas que seguem o caimento (das bochechas para o queixo)
    x.lineCap = 'round';
    const strands = [
      [-82, 2, -84, 26, -70, 42], [-70, 30, -66, 44, -52, 54], [-52, 34, -46, 48, -36, 58],
      [-32, 46, -28, 56, -18, 64], [82, 2, 84, 26, 70, 42], [70, 30, 66, 44, 52, 54],
      [52, 34, 46, 48, 36, 58], [32, 46, 28, 56, 18, 64], [-6, 50, -4, 58, 2, 66],
      [-78, 40, -74, 56, -62, 68], [78, 40, 74, 56, 62, 68], [-46, 56, -42, 66, -34, 76], [46, 56, 42, 66, 34, 76],
      [-16, 60, -14, 70, -8, 80], [16, 60, 14, 70, 8, 80]
    ];
    strands.forEach(([x0, y0, cx, cy, x1, y1], i) => {
      x.strokeStyle = i % 2 ? 'rgba(150, 100, 62, 0.55)' : 'rgba(24, 12, 5, 0.55)';
      x.lineWidth = i % 2 ? 1.4 : 1.8;
      x.beginPath();
      x.moveTo(x0, y0);
      x.quadraticCurveTo(cx, cy, x1, y1);
      x.stroke();
    });
    x.restore();

    // Bigode: duas mechas grossas que saem de baixo do visor e descem pelos lados da boca
    x.save();
    x.strokeStyle = BEARD_DARK;
    x.lineWidth = 1.4;
    for (const sd of [-1, 1]) {
      x.beginPath();
      x.moveTo(sd * 1, 29);
      x.quadraticCurveTo(sd * 16, 27, sd * 19, 38);
      x.quadraticCurveTo(sd * 20, 48, sd * 13, 55);
      x.quadraticCurveTo(sd * 13, 42, sd * 1, 34);
      x.closePath();
      x.fillStyle = '#3a2213';
      x.fill();
      x.stroke();
      x.strokeStyle = 'rgba(160, 108, 66, 0.6)';
      x.beginPath();
      x.moveTo(sd * 6, 30.5);
      x.quadraticCurveTo(sd * 15, 31, sd * 16, 40);
      x.stroke();
      x.strokeStyle = BEARD_DARK;
    }
    // Sombra dentro da abertura da boca, para ela ler como lábio e não como nariz
    x.beginPath();
    mouthHole(x);
    x.fillStyle = 'rgba(70, 38, 22, 0.28)';
    x.fill();
    x.restore();
  }

  // Machado nas costas: lâmina de aço com runas azuis saindo à esquerda do corpo (de quem olha) e o cabo de couro
  // enrolado atravessando por trás até o pomo, que aparece embaixo, à direita
  function drawAxe(x) {
    const ang = Math.atan2(58, 110);
    const L = 126;
    x.save();
    x.translate(-60, -50);
    x.rotate(ang);

    // Cabo
    x.beginPath();
    roundRectOutline(x, { x: -10, y: -3.5, w: L + 10, h: 7, r: 3.5 });
    x.fillStyle = '#4a2e1b';
    x.fill();
    x.strokeStyle = '#1f130a';
    x.lineWidth = 1.2;
    x.stroke();
    x.strokeStyle = 'rgba(15, 8, 3, 0.55)';
    x.lineWidth = 1;
    x.beginPath();
    for (let u = 12; u < L - 6; u += 5) {
      x.moveTo(u, -3.5);
      x.lineTo(u + 3, 3.5);
    }
    x.stroke();
    // Pomo
    x.beginPath();
    x.arc(L + 2, 0, 5, 0, Math.PI * 2);
    x.fillStyle = bronze(x, L - 3, -5, L + 7, 5);
    x.fill();
    x.strokeStyle = BRONZE_EDGE;
    x.stroke();

    // Lâmina: o fio fica para fora; a "barba" do machado desce em direção ao cabo
    x.beginPath();
    x.moveTo(-7, -5);
    x.lineTo(9, -5);
    x.lineTo(9, 5);
    x.quadraticCurveTo(12, 16, 25, 26);
    x.quadraticCurveTo(10, 41, -17, 36);
    x.quadraticCurveTo(-14, 18, -7, 5);
    x.closePath();
    const steel = x.createLinearGradient(0, -5, 0, 40);
    steel.addColorStop(0, '#e6f2fb');
    steel.addColorStop(0.55, '#8eabc2');
    steel.addColorStop(1, '#55708a');
    x.fillStyle = steel;
    x.fill();
    x.strokeStyle = '#1c2833';
    x.lineWidth = 1.4;
    x.stroke();
    // Fio afiado
    x.strokeStyle = 'rgba(248, 252, 255, 0.95)';
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(23, 28);
    x.quadraticCurveTo(10, 39, -15, 34);
    x.stroke();
    // Runas de gelo
    x.save();
    x.strokeStyle = '#67e8f9';
    x.shadowColor = 'rgba(103, 232, 249, 0.9)';
    x.shadowBlur = 6;
    x.lineWidth = 1.3;
    x.beginPath();
    x.moveTo(-6, 14);
    x.lineTo(-2, 22);
    x.lineTo(2, 14);
    x.moveTo(5, 18);
    x.lineTo(9, 26);
    x.moveTo(-9, 26);
    x.lineTo(-3, 28);
    x.stroke();
    x.restore();
    // Colar de bronze no olho do machado
    x.beginPath();
    roundRectOutline(x, { x: -8, y: -6, w: 18, h: 12, r: 2.5 });
    x.fillStyle = bronze(x, -8, -6, 10, 6);
    x.fill();
    x.strokeStyle = BRONZE_EDGE;
    x.lineWidth = 1.2;
    x.stroke();

    x.restore();
  }

  // Saiote de tiras de couro com tachinhas e o pano vermelho da frente, que balança
  function drawKilt(x, a) {
    for (let i = 0; i < 7; i++) {
      const cx = -36 + i * 12;
      x.beginPath();
      roundRectOutline(x, { x: cx - 5.5, y: -16, w: 11, h: 22, r: 4 });
      x.fillStyle = i % 2 ? '#5a361e' : '#704628';
      x.fill();
      x.strokeStyle = LEATHER_DARK;
      x.lineWidth = 1;
      x.stroke();
      x.beginPath();
      x.arc(cx, 1, 1.5, 0, Math.PI * 2);
      x.fillStyle = '#d9a849';
      x.fill();
    }

    x.save();
    x.translate(0, -14);
    x.rotate(a[0] * 0.25);
    x.beginPath();
    x.moveTo(-10, 0);
    x.lineTo(10, 0);
    x.lineTo(8, 23);
    x.quadraticCurveTo(0, 27, -8, 23);
    x.closePath();
    const cloth = x.createLinearGradient(0, 0, 0, 26);
    cloth.addColorStop(0, '#d0202f');
    cloth.addColorStop(1, '#7f0d16');
    x.fillStyle = cloth;
    x.fill();
    x.strokeStyle = RED_DARK;
    x.lineWidth = 1.2;
    x.stroke();
    x.strokeStyle = 'rgba(60, 0, 6, 0.45)';
    x.beginPath();
    x.moveTo(-3, 3);
    x.lineTo(-2.5, 22);
    x.moveTo(4, 3);
    x.lineTo(3.5, 22);
    x.stroke();
    x.restore();
  }

  // Correia de couro do ombro com a ombreira até o quadril do outro lado (passa por trás da tela >_)
  function drawStrap(x) {
    x.save();
    x.translate(56, -82);
    x.rotate(Math.atan2(70, -104));
    const L = Math.hypot(104, 70) + 12;
    x.beginPath();
    x.rect(0, -6.5, L, 13);
    x.fillStyle = LEATHER;
    x.fill();
    x.strokeStyle = LEATHER_DARK;
    x.lineWidth = 1.4;
    x.beginPath();
    x.moveTo(0, -6);
    x.lineTo(L, -6);
    x.moveTo(0, 6);
    x.lineTo(L, 6);
    x.stroke();
    // Costura
    x.strokeStyle = 'rgba(230, 200, 150, 0.55)';
    x.lineWidth = 0.9;
    x.beginPath();
    for (let u = 4; u < L; u += 6) {
      x.moveTo(u, -3.5);
      x.lineTo(u + 3, -3.5);
      x.moveTo(u + 1, 3.5);
      x.lineTo(u + 4, 3.5);
    }
    x.stroke();
    x.restore();
  }

  // Cinto de couro grosso logo abaixo da tela
  function drawBelt(x) {
    x.beginPath();
    x.rect(-60, -25, 120, 11);
    x.fillStyle = '#3d2616';
    x.fill();
    x.strokeStyle = 'rgba(160, 110, 70, 0.6)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(-60, -24);
    x.lineTo(60, -24);
    x.stroke();
    x.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    x.beginPath();
    x.moveTo(-60, -14.5);
    x.lineTo(60, -14.5);
    x.stroke();
  }

  // Fivela redonda de bronze com o lambda de Esparta
  function drawBuckle(x) {
    x.beginPath();
    x.arc(0, -19.5, 8, 0, Math.PI * 2);
    x.fillStyle = bronze(x, -8, -27, 8, -12);
    x.fill();
    x.strokeStyle = BRONZE_EDGE;
    x.lineWidth = 1.4;
    x.stroke();
    x.beginPath();
    x.arc(0, -19.5, 5.6, 0, Math.PI * 2);
    x.strokeStyle = 'rgba(74, 48, 8, 0.7)';
    x.lineWidth = 0.9;
    x.stroke();
    x.strokeStyle = '#5a3a0c';
    x.lineWidth = 1.6;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-3, -16.5);
    x.lineTo(0, -23);
    x.lineTo(3, -16.5);
    x.stroke();
  }

  // Ombreira de bronze em lâminas, no ombro direito de quem olha, com friso grego e rebites
  function drawPauldron(x) {
    x.save();
    x.translate(56, -71);
    x.rotate(0.5);
    // Lâminas de baixo, cada uma um pouco menor
    for (const [y, w] of [[13, 20], [6, 23]]) {
      x.beginPath();
      x.moveTo(-w, y);
      x.quadraticCurveTo(0, y - 6, w, y);
      x.lineTo(w - 2, y + 7);
      x.quadraticCurveTo(0, y + 1, -w + 2, y + 7);
      x.closePath();
      x.fillStyle = bronze(x, -w, y - 5, w, y + 7);
      x.fill();
      x.strokeStyle = BRONZE_EDGE;
      x.lineWidth = 1.3;
      x.stroke();
    }
    // Placa de cima: larga e baixa, curvada sobre o ombro
    x.beginPath();
    x.moveTo(-26, 6);
    x.quadraticCurveTo(-24, -10, 0, -11);
    x.quadraticCurveTo(24, -10, 26, 6);
    x.quadraticCurveTo(0, -1, -26, 6);
    x.closePath();
    x.fillStyle = bronze(x, -26, -11, 26, 6);
    x.fill();
    x.strokeStyle = BRONZE_EDGE;
    x.lineWidth = 1.5;
    x.stroke();
    // Friso grego (gregas em degraus)
    x.save();
    x.clip();
    x.strokeStyle = 'rgba(74, 48, 8, 0.85)';
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(-22, 0);
    for (let k = -22; k < 22; k += 6) {
      x.lineTo(k, -4);
      x.lineTo(k + 3, -4);
      x.lineTo(k + 3, 0);
      x.lineTo(k + 6, 0);
    }
    x.stroke();
    x.restore();
    // Brilho
    x.fillStyle = 'rgba(255, 246, 214, 0.55)';
    x.beginPath();
    x.ellipse(-8, -6, 9, 2.4, -0.15, 0, Math.PI * 2);
    x.fill();
    // Rebites
    x.fillStyle = '#fbe3a4';
    for (const rx of [-20, 20]) {
      x.beginPath();
      x.arc(rx, 3.5, 1.6, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  }


  // ========================================================
  // TYRAEL: partes do desenho
  // ========================================================
  // Capuz: desenhado nas coordenadas do robô (origem na base do corpo, cabeça centrada em (0, -151), 91 de meia
  // largura e 65 de meia altura), embora fique preso na base dos chapéus. Rosto: origem no centro do visor. Corpo: origem na base do corpo.
  const CLOTH = ['#eef1f6', '#b4bdcc', '#7d889c'];
  const CLOTH_LINE = '#4b5568';
  const GOLD = ['#fbe39b', '#d4a843', '#8a6416'];
  const GOLD_EDGE = '#6b4a0c';
  const SILVER = ['#f8fafc', '#c7d0dc', '#8892a3'];
  const SILVER_EDGE = '#3f4859';
  // Base dos chapéus no motor (HAT em robo-motor.js: alto da cabeça, à direita da etiqueta >_)
  const HAT_BASE = { x: 18, y: -151 - 65 + 2 };

  function vgrad(x, y0, y1, stops) {
    const g = x.createLinearGradient(0, y0, 0, y1);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }

  // Capuz, frente: um arco de pano sobre o alto e os lados da cabeça, aberto embaixo. A borda de dentro faz uma
  // ponta sobre a testa e desce ao lado do visor.
  function hoodInnerEdge(x, start) {
    if (start) x.moveTo(89, -86);
    else x.lineTo(89, -86);
    x.lineTo(89, -168);
    x.quadraticCurveTo(88, -192, 66, -197);
    x.quadraticCurveTo(34, -200, 0, -187);
    x.quadraticCurveTo(-34, -200, -66, -197);
    x.quadraticCurveTo(-88, -192, -89, -168);
    x.lineTo(-89, -86);
  }

  function hoodArch(x) {
    x.beginPath();
    x.moveTo(-100, -84);
    x.bezierCurveTo(-106, -106, -108, -136, -106, -168);
    x.bezierCurveTo(-104, -216, -56, -234, 0, -236);
    x.bezierCurveTo(56, -234, 104, -216, 106, -168);
    x.bezierCurveTo(108, -136, 106, -106, 100, -84);
    hoodInnerEdge(x, false);
    x.closePath();
  }

  // Capuz, parte de trás: só o fundo do capuz atrás da cabeça (dá a espessura do pano em volta dela); termina logo
  // abaixo da cabeça, para as asas de luz aparecerem contra o fundo
  function drawHoodBack(x) {
    x.beginPath();
    x.moveTo(0, -238);
    x.bezierCurveTo(60, -236, 110, -214, 112, -160);
    x.bezierCurveTo(113, -130, 110, -106, 104, -90);
    x.lineTo(-104, -90);
    x.bezierCurveTo(-110, -106, -113, -130, -112, -160);
    x.bezierCurveTo(-110, -214, -60, -236, 0, -238);
    x.closePath();
    x.fillStyle = vgrad(x, -238, -90, ['#9aa4b6', '#6b7487', '#4a5263']);
    x.fill();
    x.strokeStyle = CLOTH_LINE;
    x.lineWidth = 1.4;
    x.stroke();
  }

  // Capuz, frente: pano claro sobre o alto e os lados da cabeça, com barra dourada em volta da abertura
  function drawHoodFront(x) {
    x.save();
    hoodArch(x);
    x.fillStyle = vgrad(x, -236, -84, CLOTH);
    x.fill();
    x.strokeStyle = CLOTH_LINE;
    x.lineWidth = 1.5;
    x.stroke();
    x.clip();
    // Dobras
    x.strokeStyle = 'rgba(75, 85, 104, 0.45)';
    x.lineWidth = 1.3;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-40, -226);
    x.quadraticCurveTo(-74, -214, -94, -180);
    x.moveTo(40, -226);
    x.quadraticCurveTo(74, -214, 94, -180);
    x.moveTo(-98, -150);
    x.quadraticCurveTo(-100, -120, -96, -92);
    x.moveTo(98, -150);
    x.quadraticCurveTo(100, -120, 96, -92);
    x.moveTo(0, -232);
    x.lineTo(0, -214);
    x.stroke();
    // Brilho do pano no alto
    x.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    x.lineWidth = 2.4;
    x.beginPath();
    x.moveTo(-50, -224);
    x.quadraticCurveTo(-20, -232, 14, -230);
    x.stroke();
    x.restore();

    // Barra dourada na borda de dentro (aberta embaixo, como o capuz)
    x.save();
    x.beginPath();
    hoodInnerEdge(x, true);
    x.strokeStyle = GOLD_EDGE;
    x.lineWidth = 7.5;
    x.lineJoin = 'round';
    x.stroke();
    x.strokeStyle = vgrad(x, -200, -96, GOLD);
    x.lineWidth = 5;
    x.stroke();
    x.restore();
    // Joia na ponta da testa
    x.save();
    x.translate(0, -191);
    x.beginPath();
    x.moveTo(0, -6);
    x.lineTo(5, 0);
    x.lineTo(0, 7);
    x.lineTo(-5, 0);
    x.closePath();
    x.fillStyle = '#7dd3fc';
    x.shadowColor = 'rgba(125, 211, 252, 0.9)';
    x.shadowBlur = 8;
    x.fill();
    x.shadowBlur = 0;
    x.strokeStyle = GOLD_EDGE;
    x.lineWidth = 1.2;
    x.stroke();
    x.restore();
  }

  // Rosto nas sombras: escurece a casca em volta do visor (o visor fica por cima). Mais escuro nas bordas, perto
  // do capuz, e mais leve embaixo do visor, para a boca continuar aparecendo quando ele fala.
  function drawShadowFace(x) {
    x.save();
    x.beginPath();
    x.rect(-130, -130, 260, 260);
    roundRectOutline(x, VISOR);
    x.clip('evenodd');
    const g = x.createRadialGradient(0, 34, 8, 0, 0, 120);
    g.addColorStop(0, 'rgba(10, 16, 30, 0.22)');
    g.addColorStop(0.45, 'rgba(10, 16, 30, 0.7)');
    g.addColorStop(1, 'rgba(6, 10, 20, 0.95)');
    x.fillStyle = g;
    x.fillRect(-130, -130, 260, 260);
    // Luz fria que vem de dentro do capuz, logo abaixo do visor
    const glow = x.createRadialGradient(0, 30, 0, 0, 30, 46);
    glow.addColorStop(0, 'rgba(125, 211, 252, 0.18)');
    glow.addColorStop(1, 'rgba(125, 211, 252, 0)');
    x.fillStyle = glow;
    x.fillRect(-60, 0, 120, 70);
    x.restore();
  }

  // Asas de luz: faixas brilhantes que saem de trás dos ombros, se abrem para fora e se curvam para baixo como pano,
  // ao lado do corpo (onde cabem no quadro), ondulando devagar
  const WING_RIBBONS = [
    // ângulo (rad, 0 = para fora, positivo = para baixo), comprimento, largura na base, fase
    [-0.62, 100, 10, 0.0], [-0.34, 108, 11, 0.8], [-0.06, 112, 11, 1.6], [0.24, 108, 10, 2.4], [0.54, 98, 9, 3.2], [0.84, 84, 8, 4.0]
  ];

  function drawWings(x, t) {
    x.save();
    x.lineJoin = 'round';
    for (const sd of [-1, 1]) {
      WING_RIBBONS.forEach(([ang, len, w0, ph]) => {
        const bx = sd * 36, by = -98;
        const dx = Math.cos(ang) * sd, dy = Math.sin(ang);
        const nx = -dy * sd, ny = dx * sd;
        const left = [], right = [];
        const N = 18;
        for (let i = 0; i <= N; i++) {
          const s = i / N;
          const wave = Math.sin(s * Math.PI * 1.8 - t * 1.4 + ph) * 11 * s;
          const cx = bx + dx * len * s + nx * wave;
          const cy = by + dy * len * s + ny * wave + s * s * 34;   // as faixas se curvam para baixo, como pano
          const hw = w0 * (1 - s * 0.6) * (0.8 + 0.2 * Math.sin(s * Math.PI));
          left.push([cx + nx * hw, cy + ny * hw]);
          right.push([cx - nx * hw, cy - ny * hw]);
        }
        x.beginPath();
        x.moveTo(left[0][0], left[0][1]);
        left.forEach(([px, py]) => x.lineTo(px, py));
        for (let i = right.length - 1; i >= 0; i--) x.lineTo(right[i][0], right[i][1]);
        x.closePath();
        const g = x.createLinearGradient(bx, by, bx + dx * len, by + dy * len);
        // Luz branca na base, azul no meio e se apagando na ponta
        g.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        g.addColorStop(0.5, 'rgba(160, 218, 255, 0.88)');
        g.addColorStop(1, 'rgba(110, 185, 255, 0.18)');
        x.fillStyle = g;
        x.shadowColor = 'rgba(125, 211, 252, 1)';
        x.shadowBlur = 16;
        x.fill();
        x.shadowBlur = 0;
        // Fio de luz no meio da faixa
        x.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        x.lineWidth = 1.4;
        x.beginPath();
        for (let i = 0; i <= N - 3; i++) {
          const mx = (left[i][0] + right[i][0]) / 2, my = (left[i][1] + right[i][1]) / 2;
          if (i === 0) x.moveTo(mx, my);
          else x.lineTo(mx, my);
        }
        x.stroke();
      });
    }
    x.restore();
  }

  // Ombreira prateada em lâminas com barra dourada; sd = -1 (esquerda de quem olha) ou 1 (direita)
  function drawSilverPauldron(x, sd) {
    x.save();
    x.translate(sd * 50, -74);
    x.scale(sd, 1);
    x.rotate(0.42);
    for (const [y, w] of [[10, 18], [3, 21]]) {
      x.beginPath();
      x.moveTo(-w, y);
      x.quadraticCurveTo(0, y - 6, w, y);
      x.lineTo(w - 2, y + 7);
      x.quadraticCurveTo(0, y + 1, -w + 2, y + 7);
      x.closePath();
      x.fillStyle = vgrad(x, y - 6, y + 7, SILVER);
      x.fill();
      x.strokeStyle = SILVER_EDGE;
      x.lineWidth = 1.2;
      x.stroke();
    }
    x.beginPath();
    x.moveTo(-24, 4);
    x.quadraticCurveTo(-22, -12, 0, -13);
    x.quadraticCurveTo(22, -12, 24, 4);
    x.quadraticCurveTo(0, -2, -24, 4);
    x.closePath();
    x.fillStyle = vgrad(x, -13, 4, SILVER);
    x.fill();
    x.strokeStyle = SILVER_EDGE;
    x.lineWidth = 1.4;
    x.stroke();
    // Barra dourada
    x.strokeStyle = vgrad(x, -4, 4, GOLD);
    x.lineWidth = 2.6;
    x.beginPath();
    x.moveTo(-22, 2);
    x.quadraticCurveTo(0, -4, 22, 2);
    x.stroke();
    x.fillStyle = 'rgba(255, 255, 255, 0.7)';
    x.beginPath();
    x.ellipse(-7, -7, 8, 2.2, -0.15, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }

  // Peitoral prateado com filetes dourados, moldura dourada com asinhas em volta da tela, cinto e pano da frente
  function drawTyraelArmor(x, a) {
    // Pano claro que pende do cinto, por baixo do peitoral, balançando
    x.save();
    x.translate(0, -18);
    x.rotate(a[0] * 0.18);
    x.beginPath();
    x.moveTo(-16, 0);
    x.lineTo(16, 0);
    x.lineTo(13, 30);
    x.lineTo(0, 36);
    x.lineTo(-13, 30);
    x.closePath();
    x.fillStyle = vgrad(x, 0, 36, CLOTH);
    x.fill();
    x.strokeStyle = CLOTH_LINE;
    x.lineWidth = 1.2;
    x.stroke();
    x.strokeStyle = vgrad(x, 0, 36, GOLD);
    x.lineWidth = 2.2;
    x.beginPath();
    x.moveTo(-11, 2);
    x.lineTo(-9.5, 28);
    x.lineTo(0, 32.5);
    x.lineTo(9.5, 28);
    x.lineTo(11, 2);
    x.stroke();
    x.restore();

    // Peitoral: cobre o corpo todo, menos a tela
    x.save();
    clipBodyWithoutScreen(x);
    x.fillStyle = vgrad(x, -80, 0, SILVER);
    x.fillRect(-60, -80, 120, 80);
    // Filetes dourados: linha do peito e curvas laterais
    x.strokeStyle = vgrad(x, -80, 0, GOLD);
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(-44, -74);
    x.quadraticCurveTo(-38, -46, -46, -26);
    x.moveTo(44, -74);
    x.quadraticCurveTo(38, -46, 46, -26);
    x.stroke();
    // Cinto
    x.fillStyle = '#5b4630';
    x.fillRect(-60, -24, 120, 8);
    x.strokeStyle = vgrad(x, -24, -16, GOLD);
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(-60, -23.5);
    x.lineTo(60, -23.5);
    x.moveTo(-60, -16.5);
    x.lineTo(60, -16.5);
    x.stroke();
    // Reflexo
    x.fillStyle = 'rgba(255, 255, 255, 0.45)';
    x.beginPath();
    x.ellipse(-30, -70, 10, 3, -0.4, 0, Math.PI * 2);
    x.fill();
    x.restore();

    // Moldura dourada da tela, com asinhas dos lados (o emblema do peito)
    x.save();
    x.beginPath();
    roundRectOutline(x, { x: -33, y: -67, w: 66, h: 42, r: 12 });
    x.strokeStyle = GOLD_EDGE;
    x.lineWidth = 4.5;
    x.stroke();
    x.strokeStyle = vgrad(x, -67, -25, GOLD);
    x.lineWidth = 2.8;
    x.stroke();
    for (const sd of [-1, 1]) {
      x.save();
      x.scale(sd, 1);
      x.beginPath();
      x.moveTo(33, -52);
      x.quadraticCurveTo(42, -60, 47, -58);
      x.quadraticCurveTo(43, -53, 45, -48);
      x.quadraticCurveTo(40, -48, 33, -42);
      x.closePath();
      x.fillStyle = vgrad(x, -60, -42, GOLD);
      x.fill();
      x.strokeStyle = GOLD_EDGE;
      x.lineWidth = 1;
      x.stroke();
      x.restore();
    }
    // Fivela
    x.beginPath();
    x.moveTo(0, -25);
    x.lineTo(6, -20);
    x.lineTo(0, -15);
    x.lineTo(-6, -20);
    x.closePath();
    x.fillStyle = vgrad(x, -25, -15, GOLD);
    x.fill();
    x.strokeStyle = GOLD_EDGE;
    x.lineWidth = 1.2;
    x.stroke();
    x.restore();

    drawSilverPauldron(x, -1);
    drawSilverPauldron(x, 1);
  }

  // ========================================================
  // DARTH VADER: partes do desenho
  // ========================================================
  // Capacete: desenhado nas coordenadas do robô (origem na base do corpo, cabeça centrada em (0, -151)), preso na
  // base dos chapéus como o capuz do Tyrael. Máscara: origem no centro do visor; cobre a frente da cabeça inteira.
  const VADER_BLACK = ['#3a4252', '#14171e', '#050608'];
  const VADER_RIM = '#5f6f88';
  const VADER_SHINE = 'rgba(200, 215, 240, 0.55)';

  // Capacete, parte de trás: a aba larga continua atrás da cabeça e cobre a nuca
  function drawVaderHelmetBack(x) {
    x.beginPath();
    x.moveTo(0, -242);
    x.bezierCurveTo(64, -240, 108, -214, 108, -160);
    x.bezierCurveTo(108, -120, 112, -96, 124, -74);
    x.lineTo(-124, -74);
    x.bezierCurveTo(-112, -96, -108, -120, -108, -160);
    x.bezierCurveTo(-108, -214, -64, -240, 0, -242);
    x.closePath();
    x.fillStyle = vgrad(x, -242, -74, ['#20252f', '#0b0d12']);
    x.fill();
    x.strokeStyle = VADER_RIM;
    x.lineWidth = 1.4;
    x.stroke();
  }

  // Capacete, frente: cúpula, testa com a ponta no meio e a aba que se abre para os lados na base
  function vaderHelmetPath(x) {
    x.beginPath();
    x.moveTo(-124, -72);
    x.quadraticCurveTo(-108, -88, -104, -116);
    x.bezierCurveTo(-102, -150, -104, -196, -70, -222);
    x.bezierCurveTo(-46, -240, 46, -240, 70, -222);
    x.bezierCurveTo(104, -196, 102, -150, 104, -116);
    x.quadraticCurveTo(108, -88, 124, -72);
    // Borda de baixo da aba, voltando para dentro
    x.quadraticCurveTo(104, -78, 90, -88);
    // Borda de dentro: sobe ao lado da máscara até a testa
    x.lineTo(86, -166);
    x.quadraticCurveTo(82, -186, 56, -188);
    x.lineTo(10, -186);
    x.lineTo(0, -176);
    x.lineTo(-10, -186);
    x.lineTo(-56, -188);
    x.quadraticCurveTo(-82, -186, -86, -166);
    x.lineTo(-90, -88);
    x.quadraticCurveTo(-104, -78, -124, -72);
    x.closePath();
  }

  function drawVaderHelmetFront(x) {
    x.save();
    vaderHelmetPath(x);
    const g = x.createRadialGradient(-30, -220, 6, 0, -170, 140);
    g.addColorStop(0, VADER_BLACK[0]);
    g.addColorStop(0.5, VADER_BLACK[1]);
    g.addColorStop(1, VADER_BLACK[2]);
    x.fillStyle = g;
    x.fill();
    x.strokeStyle = VADER_RIM;
    x.lineWidth = 1.6;
    x.stroke();
    x.clip();
    // Costura do meio da cúpula
    x.strokeStyle = 'rgba(95, 111, 136, 0.7)';
    x.lineWidth = 1.4;
    x.beginPath();
    x.moveTo(0, -238);
    x.lineTo(0, -192);
    x.stroke();
    // Testa saliente: sombra logo acima da borda de dentro
    x.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(-82, -170);
    x.quadraticCurveTo(-78, -192, -54, -194);
    x.lineTo(0, -192);
    x.lineTo(54, -194);
    x.quadraticCurveTo(78, -192, 82, -170);
    x.stroke();
    // Reflexos de plástico
    x.strokeStyle = VADER_SHINE;
    x.lineWidth = 3;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-60, -222);
    x.quadraticCurveTo(-30, -236, 6, -234);
    x.stroke();
    x.lineWidth = 2;
    x.strokeStyle = 'rgba(200, 215, 240, 0.3)';
    x.beginPath();
    x.moveTo(-98, -150);
    x.quadraticCurveTo(-98, -112, -112, -84);
    x.moveTo(98, -150);
    x.quadraticCurveTo(98, -112, 112, -84);
    x.stroke();
    x.restore();
  }

  // Máscara: placa preta por cima de todo o rosto (visor, olhos e boca), lentes, nariz, respirador e maçãs do rosto
  function drawVaderMask(x) {
    // Placa: maior que a cabeça, para continuar cobrindo quando o rosto desliza (o recorte da cabeça dá a borda)
    const g = x.createLinearGradient(0, -80, 0, 70);
    g.addColorStop(0, '#262b35');
    g.addColorStop(0.55, '#11141a');
    g.addColorStop(1, '#07080b');
    x.fillStyle = g;
    x.fillRect(-150, -150, 300, 300);

    // Lentes triangulares no lugar dos olhos
    for (const sd of [-1, 1]) {
      x.save();
      x.scale(sd, 1);
      x.beginPath();
      x.moveTo(8, -16);
      x.quadraticCurveTo(40, -24, 66, -14);
      x.quadraticCurveTo(60, 4, 44, 12);
      x.quadraticCurveTo(22, 10, 10, -2);
      x.closePath();
      const lg = x.createLinearGradient(8, -20, 60, 12);
      lg.addColorStop(0, '#1a0a0c');
      lg.addColorStop(1, '#020203');
      x.fillStyle = lg;
      x.fill();
      x.strokeStyle = 'rgba(120, 135, 160, 0.7)';
      x.lineWidth = 1.4;
      x.stroke();
      // Reflexo avermelhado na borda de cima e um brilho pequeno
      x.strokeStyle = 'rgba(220, 40, 50, 0.55)';
      x.lineWidth = 1.6;
      x.beginPath();
      x.moveTo(14, -15);
      x.quadraticCurveTo(40, -21, 60, -13);
      x.stroke();
      x.fillStyle = 'rgba(255, 255, 255, 0.5)';
      x.beginPath();
      x.ellipse(50, -9, 4, 1.6, -0.3, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }

    // Nariz em ponta
    x.beginPath();
    x.moveTo(0, -18);
    x.lineTo(7, 14);
    x.lineTo(0, 22);
    x.lineTo(-7, 14);
    x.closePath();
    x.fillStyle = vgrad(x, -18, 22, ['#2c323d', '#0d0f14']);
    x.fill();
    x.strokeStyle = 'rgba(120, 135, 160, 0.6)';
    x.lineWidth = 1.2;
    x.stroke();

    // Maçãs do rosto: linhas que descem das lentes até o respirador
    x.strokeStyle = 'rgba(120, 135, 160, 0.65)';
    x.lineWidth = 1.6;
    x.lineCap = 'round';
    x.beginPath();
    for (const sd of [-1, 1]) {
      x.moveTo(sd * 62, -8);
      x.quadraticCurveTo(sd * 60, 22, sd * 32, 50);
      x.moveTo(sd * 46, 14);
      x.lineTo(sd * 26, 30);
    }
    x.stroke();

    // Respirador: triângulo cinza com fendas verticais
    x.beginPath();
    x.moveTo(0, 25);
    x.lineTo(28, 58);
    x.quadraticCurveTo(0, 64, -28, 58);
    x.closePath();
    x.fillStyle = vgrad(x, 25, 62, ['#d7dce3', '#9aa2ae', '#5c6470']);
    x.fill();
    x.strokeStyle = '#2b313b';
    x.lineWidth = 1.4;
    x.stroke();
    x.save();
    x.clip();
    x.strokeStyle = 'rgba(20, 24, 30, 0.85)';
    x.lineWidth = 1.6;
    x.beginPath();
    for (let k = -18; k <= 18; k += 4.5) {
      x.moveTo(k, 34);
      x.lineTo(k, 62);
    }
    x.stroke();
    x.restore();

    // Brilho de plástico na testa da máscara
    x.strokeStyle = 'rgba(200, 215, 240, 0.25)';
    x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(-40, -30);
    x.quadraticCurveTo(0, -38, 40, -30);
    x.stroke();
  }

  // Capa: cai dos ombros por trás do corpo até abaixo dele, abrindo para os lados; a barra balança
  function drawVaderCape(x, a) {
    const sl = a[0] * 6, sr = a[1] * 6;
    x.beginPath();
    x.moveTo(-46, -88);
    x.lineTo(46, -88);
    x.quadraticCurveTo(80, -50, 94 + sr, 12);
    x.quadraticCurveTo(80 + sr, 6, 66 + sr * 0.6, 14);
    x.quadraticCurveTo(46, 8, 26, 16);
    x.quadraticCurveTo(0, 10, -26, 16);
    x.quadraticCurveTo(-46, 8, -66 + sl * 0.6, 14);
    x.quadraticCurveTo(-80 + sl, 6, -94 + sl, 12);
    x.quadraticCurveTo(-80, -50, -46, -88);
    x.closePath();
    x.fillStyle = vgrad(x, -88, 16, ['#1a1e26', '#0b0d12', '#050608']);
    x.fill();
    x.strokeStyle = VADER_RIM;
    x.lineWidth = 1.3;
    x.stroke();
    // Dobras
    x.strokeStyle = 'rgba(70, 82, 104, 0.5)';
    x.lineWidth = 1.3;
    for (const sd of [-1, 1]) {
      const sw = sd < 0 ? sl : sr;
      x.beginPath();
      x.moveTo(sd * 54, -70);
      x.quadraticCurveTo(sd * 70, -30, sd * 78 + sw, 8);
      x.moveTo(sd * 50, -50);
      x.quadraticCurveTo(sd * 58, -16, sd * 56 + sw * 0.5, 12);
      x.stroke();
    }
  }

  // Armadura: corpo preto acolchoado, painel do peito em volta da tela, ombreiras e cinto com as caixas prateadas
  function drawVaderArmor(x) {
    x.save();
    clipBodyWithoutScreen(x);
    x.fillStyle = vgrad(x, -80, 0, ['#2a303b', '#14171e', '#0b0d12']);
    x.fillRect(-60, -80, 120, 80);
    // Acolchoado
    x.strokeStyle = 'rgba(90, 104, 128, 0.35)';
    x.lineWidth = 1;
    x.beginPath();
    for (const y of [-58, -46, -34]) {
      x.moveTo(-60, y);
      x.lineTo(-34, y);
      x.moveTo(34, y);
      x.lineTo(60, y);
    }
    x.stroke();
    // Cinto
    x.fillStyle = '#07080b';
    x.fillRect(-60, -25, 120, 10);
    x.restore();

    // Caixas do cinto e fivela
    for (const bx of [-24, 24]) {
      x.beginPath();
      roundRectOutline(x, { x: bx - 8, y: -27, w: 16, h: 13, r: 2 });
      x.fillStyle = vgrad(x, -27, -14, ['#e5e7eb', '#9ca3af', '#4b5563']);
      x.fill();
      x.strokeStyle = '#1f2937';
      x.lineWidth = 1.1;
      x.stroke();
      x.strokeStyle = 'rgba(31, 41, 55, 0.7)';
      x.beginPath();
      x.moveTo(bx - 5, -23);
      x.lineTo(bx + 5, -23);
      x.moveTo(bx - 5, -19);
      x.lineTo(bx + 5, -19);
      x.stroke();
    }
    x.beginPath();
    roundRectOutline(x, { x: -6, y: -26, w: 12, h: 11, r: 2 });
    x.fillStyle = vgrad(x, -26, -15, ['#d1d5db', '#6b7280']);
    x.fill();
    x.strokeStyle = '#1f2937';
    x.stroke();

    // Painel do peito: moldura cinza em volta da tela e as luzinhas ao lado
    x.beginPath();
    roundRectOutline(x, { x: -34, y: -68, w: 68, h: 44, r: 12 });
    x.strokeStyle = '#1f2937';
    x.lineWidth = 6;
    x.stroke();
    x.strokeStyle = vgrad(x, -68, -24, ['#e5e7eb', '#9ca3af', '#6b7280']);
    x.lineWidth = 3.6;
    x.stroke();
    const lights = [['#ef4444', -60], ['#22c55e', -52], ['#3b82f6', -44], ['#ef4444', -36]];
    for (const [col, y] of lights) {
      x.beginPath();
      roundRectOutline(x, { x: 38, y, w: 7, h: 5, r: 1.2 });
      x.fillStyle = col;
      x.shadowColor = col;
      x.shadowBlur = 5;
      x.fill();
      x.shadowBlur = 0;
    }
    for (const y of [-60, -52, -44, -36]) {
      x.beginPath();
      roundRectOutline(x, { x: -45, y, w: 7, h: 5, r: 1.2 });
      x.fillStyle = '#9ca3af';
      x.fill();
    }

    // Ombreiras pretas
    for (const sd of [-1, 1]) {
      x.save();
      x.translate(sd * 48, -76);
      x.scale(sd, 1);
      x.rotate(0.4);
      x.beginPath();
      x.moveTo(-20, 6);
      x.quadraticCurveTo(-18, -10, 0, -11);
      x.quadraticCurveTo(18, -10, 20, 6);
      x.quadraticCurveTo(0, 0, -20, 6);
      x.closePath();
      x.fillStyle = vgrad(x, -11, 6, ['#3a4252', '#0b0d12']);
      x.fill();
      x.strokeStyle = VADER_RIM;
      x.lineWidth = 1.3;
      x.stroke();
      x.strokeStyle = VADER_SHINE;
      x.lineWidth = 1.6;
      x.beginPath();
      x.moveTo(-12, -5);
      x.quadraticCurveTo(-2, -9, 8, -7);
      x.stroke();
      x.restore();
    }
  }

  // ========================================================
  // TI (Dia do Profissional de Informática): partes do desenho
  // ========================================================
  // Headset: coordenadas do robô, preso na base dos chapéus. Óculos: rosto (olhos em ±LENS_X). Moletom e camiseta:
  // base do corpo.
  const { LENS_X } = Roupas;   // centro de cada olho no visor
  const TI_CYAN = '#22d3ee';
  const TI_CYAN_SOFT = '#7dd3fc';

  function drawHeadset(x) {
    // Arco sobre a cabeça
    x.save();
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-97, -146);
    x.bezierCurveTo(-101, -214, -60, -226, 0, -226);
    x.bezierCurveTo(60, -226, 101, -214, 97, -146);
    x.strokeStyle = '#0d0f13';
    x.lineWidth = 11;
    x.stroke();
    x.strokeStyle = '#2b313b';
    x.lineWidth = 6;
    x.stroke();
    x.strokeStyle = 'rgba(200, 215, 240, 0.45)';
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(-60, -224);
    x.quadraticCurveTo(-20, -230, 20, -229);
    x.stroke();
    x.restore();

    // Conchas acolchoadas nas laterais da cabeça
    for (const sd of [-1, 1]) {
      x.beginPath();
      roundRectOutline(x, { x: sd * 101 - 11, y: -172, w: 22, h: 46, r: 10 });
      x.fillStyle = vgrad(x, -172, -126, ['#3a404c', '#15181e']);
      x.fill();
      x.strokeStyle = '#06070a';
      x.lineWidth = 1.6;
      x.stroke();
      // Almofada encostada na cabeça
      x.beginPath();
      roundRectOutline(x, { x: sd * 101 - (sd > 0 ? 13 : -5), y: -168, w: 8, h: 38, r: 4 });
      x.fillStyle = '#0b0d11';
      x.fill();
      // Detalhe ciano na concha
      x.strokeStyle = 'rgba(34, 211, 238, 0.8)';
      x.lineWidth = 1.4;
      x.beginPath();
      x.arc(sd * 103, -149, 6, 0, Math.PI * 2);
      x.stroke();
    }

    // Haste do microfone: sai da concha da esquerda (de quem olha) e para ao lado da boca, sem cobri-la
    x.save();
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-96, -134);
    x.quadraticCurveTo(-84, -100, -40, -104);
    x.strokeStyle = '#0d0f13';
    x.lineWidth = 4;
    x.stroke();
    x.strokeStyle = 'rgba(200, 215, 240, 0.35)';
    x.lineWidth = 1;
    x.stroke();
    // Cápsula do microfone com espuma
    x.beginPath();
    x.ellipse(-34, -105, 7, 5.2, -0.1, 0, Math.PI * 2);
    x.fillStyle = '#1b1f27';
    x.fill();
    x.strokeStyle = '#06070a';
    x.lineWidth = 1.2;
    x.stroke();
    x.fillStyle = 'rgba(160, 170, 185, 0.35)';
    for (const [dx, dy] of [[-3, -1.5], [0, 1], [3, -1], [-1, -3], [2, 2.4]]) {
      x.beginPath();
      x.arc(-34 + dx, -105 + dy, 0.8, 0, Math.PI * 2);
      x.fill();
    }
    // LED verde de "em ligação"
    x.beginPath();
    x.arc(-88, -114, 2.2, 0, Math.PI * 2);
    x.fillStyle = '#4ade80';
    x.shadowColor = 'rgba(74, 222, 128, 0.95)';
    x.shadowBlur = 6;
    x.fill();
    x.restore();
  }

  // Óculos de programador: armação preta grossa e retangular com borda clara (para aparecer sobre o visor escuro)
  function drawDevGlasses(x) {
    x.save();
    x.lineJoin = 'round';
    x.lineCap = 'round';
    // Hastes até as pontas do visor
    for (const sd of [-1, 1]) {
      x.beginPath();
      x.moveTo(sd * (LENS_X + 24), -8);
      x.lineTo(sd * 76, -10);
      x.strokeStyle = '#0b0c10';
      x.lineWidth = 4;
      x.stroke();
      x.strokeStyle = 'rgba(203, 213, 225, 0.75)';
      x.lineWidth = 1;
      x.stroke();
    }
    for (const ex of [-LENS_X, LENS_X]) {
      x.beginPath();
      roundRectOutline(x, { x: ex - 24, y: -19, w: 48, h: 36, r: 8 });
      x.fillStyle = 'rgba(186, 230, 253, 0.12)';
      x.fill();
      x.strokeStyle = '#0b0c10';
      x.lineWidth = 6;
      x.stroke();
      x.strokeStyle = 'rgba(203, 213, 225, 0.8)';
      x.lineWidth = 1.2;
      x.stroke();
      // Reflexo de tela nas lentes
      x.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(ex - 16, -6);
      x.lineTo(ex - 8, -14);
      x.moveTo(ex - 11, 0);
      x.lineTo(ex - 1, -10);
      x.stroke();
    }
    // Ponte
    x.beginPath();
    x.moveTo(-LENS_X + 24, -6);
    x.quadraticCurveTo(0, -13, LENS_X - 24, -6);
    x.strokeStyle = '#0b0c10';
    x.lineWidth = 4.5;
    x.stroke();
    x.strokeStyle = 'rgba(203, 213, 225, 0.75)';
    x.lineWidth = 1;
    x.stroke();
    x.restore();
  }

  // Caveira cibernética do Estratégia Nerd (o símbolo do site), redesenhada em vetor. Centro em (0, 0), cerca de
  // 100 de largura por 120 de altura; quem chama escala.
  function drawNerdSkull(x) {
    x.save();
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.shadowColor = 'rgba(34, 211, 238, 0.9)';
    x.shadowBlur = 6;
    x.strokeStyle = TI_CYAN_SOFT;
    x.lineWidth = 4;
    // Crânio: cúpula com as "orelhas" de fone dos lados
    x.beginPath();
    x.moveTo(-36, 18);
    x.bezierCurveTo(-44, -10, -38, -48, 0, -50);
    x.bezierCurveTo(38, -48, 44, -10, 36, 18);
    x.stroke();
    for (const sd of [-1, 1]) {
      x.beginPath();
      roundRectOutline(x, { x: sd * 46 - 6, y: -16, w: 12, h: 30, r: 6 });
      x.stroke();
    }
    // Trilhas de circuito no alto da cabeça, com os pontos
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(-22, -36);
    x.lineTo(-22, -24);
    x.lineTo(-12, -18);
    x.moveTo(0, -42);
    x.lineTo(0, -28);
    x.moveTo(22, -36);
    x.lineTo(22, -24);
    x.lineTo(12, -18);
    x.moveTo(-32, -18);
    x.lineTo(-26, -10);
    x.moveTo(32, -18);
    x.lineTo(26, -10);
    x.stroke();
    x.fillStyle = TI_CYAN_SOFT;
    for (const [px, py] of [[-12, -18], [0, -28], [12, -18], [-26, -10], [26, -10]]) {
      x.beginPath();
      x.arc(px, py, 3, 0, Math.PI * 2);
      x.fill();
    }
    // Olhos em ângulo, brilhando
    x.fillStyle = TI_CYAN;
    x.shadowBlur = 10;
    for (const sd of [-1, 1]) {
      x.save();
      x.scale(sd, 1);
      x.beginPath();
      x.moveTo(6, -4);
      x.lineTo(28, -10);
      x.lineTo(24, 4);
      x.lineTo(10, 6);
      x.closePath();
      x.fill();
      x.restore();
    }
    // Nariz e maçãs
    x.shadowBlur = 6;
    x.strokeStyle = TI_CYAN_SOFT;
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(-4, 12);
    x.lineTo(0, 18);
    x.lineTo(4, 12);
    x.moveTo(-30, 10);
    x.lineTo(-18, 26);
    x.moveTo(30, 10);
    x.lineTo(18, 26);
    x.stroke();
    // Barras de baixo (dentes que descem), mais compridas no meio
    const g = x.createLinearGradient(0, 26, 0, 70);
    g.addColorStop(0, TI_CYAN_SOFT);
    g.addColorStop(1, 'rgba(59, 130, 246, 0.6)');
    x.strokeStyle = g;
    x.lineWidth = 4;
    x.beginPath();
    for (const [bx, len] of [[-15, 30], [-9, 40], [-3, 46], [3, 46], [9, 40], [15, 30]]) {
      x.moveTo(bx, 28);
      x.lineTo(bx, 28 + len);
    }
    x.stroke();
    x.restore();
  }

  // Moletom preto aberto sobre a camiseta preta do Estratégia Nerd (a camiseta cobre a tela do peito)
  function drawNerdHoodie(x) {
    // Camiseta: o corpo todo, por cima da tela
    x.save();
    x.beginPath();
    bodyOutline(x);
    x.clip();
    x.fillStyle = vgrad(x, -80, 0, ['#1c1f26', '#0e1015']);
    x.fillRect(-60, -80, 120, 80);
    // Estampa: caveira e o nome do site
    x.save();
    x.translate(0, -56);
    x.scale(0.3, 0.3);
    drawNerdSkull(x);
    x.restore();
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    x.fillStyle = '#f8fafc';
    x.font = '800 7px "Arial Black", Arial, sans-serif';
    x.fillText('ESTRATÉGIA', 0, -24);
    x.fillStyle = TI_CYAN;
    x.shadowColor = 'rgba(34, 211, 238, 0.8)';
    x.shadowBlur = 4;
    x.font = '800 9px "Arial Black", Arial, sans-serif';
    x.fillText('NERD', 0, -15);
    x.shadowBlur = 0;

    // Moletom: as duas metades abertas, com zíper na borda de dentro e o punho embaixo
    for (const sd of [-1, 1]) {
      x.save();
      x.scale(sd, 1);
      x.beginPath();
      x.moveTo(29, -82);
      x.quadraticCurveTo(33, -44, 34, 2);
      x.lineTo(62, 2);
      x.lineTo(62, -82);
      x.closePath();
      x.fillStyle = vgrad(x, -82, 2, ['#3a3f4a', '#23272f', '#191c22']);
      x.fill();
      x.strokeStyle = '#08090c';
      x.lineWidth = 1.4;
      x.stroke();
      // Zíper
      x.strokeStyle = 'rgba(180, 190, 205, 0.7)';
      x.lineWidth = 1;
      x.beginPath();
      for (let y = -76; y < -2; y += 3.2) {
        const zx = 29 + 4 * ((y + 82) / 84) + 1.2;
        x.moveTo(zx, y);
        x.lineTo(zx + 2.2, y);
      }
      x.stroke();
      // Dobra do pano
      x.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      x.lineWidth = 1.2;
      x.beginPath();
      x.moveTo(44, -64);
      x.quadraticCurveTo(46, -40, 42, -14);
      x.stroke();
      // Punho (barra canelada)
      x.fillStyle = '#16191f';
      x.fillRect(33, -8, 30, 8);
      x.strokeStyle = 'rgba(120, 130, 145, 0.35)';
      x.lineWidth = 0.8;
      x.beginPath();
      for (let k = 35; k < 62; k += 2.6) {
        x.moveTo(k, -7);
        x.lineTo(k, -1);
      }
      x.stroke();
      x.restore();
    }
    x.restore();

    // Cordões do capuz, pendendo da gola
    x.save();
    x.lineCap = 'round';
    for (const sd of [-1, 1]) {
      x.beginPath();
      x.moveTo(sd * 24, -80);
      x.quadraticCurveTo(sd * 23, -66, sd * 22, -54);
      x.strokeStyle = '#e5e7eb';
      x.lineWidth = 2;
      x.stroke();
      x.beginPath();
      roundRectOutline(x, { x: sd * 22 - 1.6, y: -55, w: 3.2, h: 5, r: 1.2 });
      x.fillStyle = '#9ca3af';
      x.fill();
    }
    x.restore();
  }

  // ========================================================
  // YUSUKE (Yu Yu Hakusho): partes do desenho
  // ========================================================
  // Cabelo: coordenadas do robô, preso na base dos chapéus. Uniforme: base do corpo.
  const YU_HAIR = ['#1f4243', '#0e2223', '#050c0d'];
  const YU_HAIR_LINE = '#020606';
  const YU_SHINE = 'rgba(110, 215, 195, 0.75)';
  const YU_GREEN = ['#43b360', '#26904b', '#176a35'];
  const YU_GREEN_DARK = ['#2f9a50', '#1a6a36'];
  const YU_GREEN_EDGE = '#0d2a17';

  // Cabelo penteado para trás com gel, no verde-petróleo quase preto do anime: alto no meio, laterais que vão
  // para trás e terminam em ponta atrás da orelha, linha do cabelo em "M" e a mecha da frente descendo em ponta
  // sobre a testa (o visor termina em y = -174)
  function yusukeHairPath(x) {
    x.beginPath();
    x.moveTo(0, -251);
    x.bezierCurveTo(38, -253, 72, -244, 88, -222);
    x.bezierCurveTo(96, -210, 99, -186, 99, -162);
    x.lineTo(96, -142);
    x.bezierCurveTo(93, -152, 90, -158, 85, -160);
    x.lineTo(84, -172);
    x.bezierCurveTo(82, -178, 80, -182, 78, -184);
    x.bezierCurveTo(66, -192, 52, -200, 40, -205);
    // Mecha da frente: vem da direita e desce até a ponta, um pouco à esquerda do meio
    x.bezierCurveTo(26, -206, 12, -198, -6, -188);
    x.bezierCurveTo(-14, -196, -24, -204, -40, -205);
    x.bezierCurveTo(-52, -200, -66, -192, -78, -184);
    x.bezierCurveTo(-80, -182, -82, -178, -84, -172);
    x.lineTo(-85, -160);
    x.bezierCurveTo(-90, -158, -93, -152, -96, -142);
    x.lineTo(-99, -162);
    x.bezierCurveTo(-99, -186, -96, -210, -88, -222);
    x.bezierCurveTo(-72, -244, -38, -253, 0, -251);
    x.closePath();
  }

  // Reflexo em forma de folha: fino nas pontas, mais largo no meio, seguindo o fio de p0 a p1
  function yusukeStreak(x, p0, c, p1, w) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * w, ny = dx / len * w;
    x.beginPath();
    x.moveTo(p0[0], p0[1]);
    x.quadraticCurveTo(c[0] + nx, c[1] + ny, p1[0], p1[1]);
    x.quadraticCurveTo(c[0] - nx, c[1] - ny, p0[0], p0[1]);
    x.closePath();
    x.fill();
  }

  function drawYusukeHair(x) {
    // Sombra do cabelo na testa, logo abaixo da linha do cabelo
    x.save();
    x.strokeStyle = 'rgba(15, 23, 42, 0.14)';
    x.lineWidth = 6;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(-74, -181);
    x.bezierCurveTo(-60, -190, -48, -197, -38, -201);
    x.bezierCurveTo(-24, -199, -14, -192, -6, -184);
    x.bezierCurveTo(12, -194, 26, -201, 38, -201);
    x.bezierCurveTo(50, -197, 62, -190, 74, -181);
    x.stroke();
    x.restore();

    x.save();
    yusukeHairPath(x);
    x.fillStyle = vgrad(x, -253, -142, YU_HAIR);
    x.fill();
    x.strokeStyle = YU_HAIR_LINE;
    x.lineWidth = 1.8;
    x.lineJoin = 'round';
    x.stroke();
    x.clip();
    x.lineCap = 'round';

    // Borda de cima da mecha da frente, separando-a do resto do cabelo
    x.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    x.lineWidth = 1.8;
    x.beginPath();
    x.moveTo(34, -238);
    x.bezierCurveTo(22, -222, 8, -204, -6, -188);
    x.stroke();

    // Reflexos verde-água ao longo dos fios, todos indo para trás
    x.fillStyle = YU_SHINE;
    yusukeStreak(x, [-64, -200], [-60, -222], [-46, -240], 3.2);
    yusukeStreak(x, [-34, -208], [-30, -232], [-14, -247], 3.6);
    yusukeStreak(x, [22, -212], [30, -232], [44, -244], 3.4);
    yusukeStreak(x, [62, -200], [70, -218], [78, -232], 2.6);
    yusukeStreak(x, [-2, -196], [12, -212], [26, -230], 2.6);
    x.fillStyle = 'rgba(110, 205, 190, 0.35)';
    yusukeStreak(x, [-93, -158], [-95, -184], [-88, -210], 2.4);
    yusukeStreak(x, [93, -158], [95, -184], [88, -210], 2.4);
    x.restore();
  }

  // Uniforme verde fechado (gakuran): cobre o corpo por trás da tela do peito (a tela continua à mostra), gola alta
  // fechada na frente e os botões dourados acima e abaixo da tela
  function drawYusukeUniform(x) {
    x.save();
    clipBodyWithoutScreen(x);
    x.fillStyle = vgrad(x, -80, 2, YU_GREEN);
    x.fillRect(-60, -80, 120, 82);
    // Abertura da frente: a metade da direita (de quem olha) passa por cima da outra
    x.strokeStyle = YU_GREEN_EDGE;
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(3, -78);
    x.lineTo(3, 0);
    x.stroke();
    x.strokeStyle = 'rgba(170, 235, 185, 0.4)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(4.6, -76);
    x.lineTo(4.6, 0);
    x.stroke();
    // Dobras do pano
    x.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    x.lineWidth = 1.3;
    x.lineCap = 'round';
    x.beginPath();
    for (const sd of [-1, 1]) {
      x.moveTo(sd * 32, -70);
      x.quadraticCurveTo(sd * 35, -44, sd * 30, -16);
      x.moveTo(sd * 18, -10);
      x.quadraticCurveTo(sd * 24, -6, sd * 28, -1);
    }
    x.stroke();
    // Barra de baixo
    x.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(-46, -5);
    x.lineTo(46, -5);
    x.stroke();
    // Sombra nas laterais, para o corpo continuar redondo
    const sg = x.createLinearGradient(-BODY.hw, 0, BODY.hw, 0);
    sg.addColorStop(0, 'rgba(0, 0, 0, 0.38)');
    sg.addColorStop(0.25, 'rgba(0, 0, 0, 0)');
    sg.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
    sg.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    x.fillStyle = sg;
    x.fillRect(-60, -80, 120, 82);
    // Brilho do pano no ombro
    x.fillStyle = 'rgba(255, 255, 255, 0.18)';
    x.beginPath();
    x.ellipse(-24, -70, 16, 4.5, -0.15, 0, Math.PI * 2);
    x.fill();
    x.restore();

    // Botões dourados na abertura, acima e abaixo da tela
    for (const by of [-71.5, -20, -11]) {
      x.beginPath();
      x.arc(3, by, 3, 0, Math.PI * 2);
      x.fillStyle = vgrad(x, by - 3, by + 3, GOLD);
      x.fill();
      x.strokeStyle = GOLD_EDGE;
      x.lineWidth = 0.9;
      x.stroke();
      x.fillStyle = 'rgba(255, 255, 255, 0.7)';
      x.beginPath();
      x.arc(2, by - 1, 0.9, 0, Math.PI * 2);
      x.fill();
    }

    // Gola alta fechada em volta do pescoço, com o fecho dourado na frente
    x.beginPath();
    x.moveTo(-38, -76);
    x.lineTo(-36, -88);
    x.quadraticCurveTo(0, -94, 36, -88);
    x.lineTo(38, -76);
    x.quadraticCurveTo(0, -80, -38, -76);
    x.closePath();
    x.fillStyle = vgrad(x, -94, -76, YU_GREEN_DARK);
    x.fill();
    x.strokeStyle = YU_GREEN_EDGE;
    x.lineWidth = 1.4;
    x.stroke();
    x.strokeStyle = YU_GREEN_EDGE;
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(0, -92);
    x.lineTo(0, -79);
    x.stroke();
    x.beginPath();
    x.arc(0, -81.5, 2.4, 0, Math.PI * 2);
    x.fillStyle = vgrad(x, -84, -79, GOLD);
    x.fill();
    x.strokeStyle = GOLD_EDGE;
    x.lineWidth = 0.8;
    x.stroke();

    // Contorno do uniforme
    x.beginPath();
    bodyOutline(x);
    x.strokeStyle = YU_GREEN_EDGE;
    x.lineWidth = 1.6;
    x.stroke();
  }

  // ========================================================
  // TOGURO (Yu Yu Hakusho): partes do desenho
  // ========================================================
  // Cabelo: coordenadas do robô, preso na base dos chapéus. Óculos: rosto (centro do visor). Paletó: base do corpo.
  const TO_HAIR = ['#24272d', '#101215', '#050506'];
  const TO_SKIN = ['#d39a6a', '#b0754a', '#875232'];
  const TO_SKIN_LINE = '#5e3519';
  const TO_JACKET = ['#7a7350', '#5b5536', '#3a3620'];
  const TO_JACKET_EDGE = '#1c1a0d';
  const TO_TANK = ['#2f5e3d', '#1d3f27'];

  // Cabelo alto, cortado reto em cima (o alto da cabeça fica em y = -216), laterais retas e a linha do cabelo reta
  // na testa, com as entradas nas têmporas
  function toguroHairPath(x) {
    x.beginPath();
    x.moveTo(-82, -184);
    x.lineTo(-90, -232);
    x.quadraticCurveTo(-91, -246, -76, -247);
    x.lineTo(76, -247);
    x.quadraticCurveTo(91, -246, 90, -232);
    x.lineTo(82, -184);
    x.quadraticCurveTo(76, -195, 58, -197);
    x.lineTo(-58, -197);
    x.quadraticCurveTo(-76, -195, -82, -184);
    x.closePath();
  }

  function drawToguroHair(x) {
    // Costeletas curtas, abaixo do cabelo
    x.fillStyle = '#121418';
    for (const sd of [-1, 1]) {
      x.beginPath();
      x.moveTo(sd * 80, -186);
      x.lineTo(sd * 88, -190);
      x.lineTo(sd * 90, -162);
      x.lineTo(sd * 85, -162);
      x.closePath();
      x.fill();
    }
    x.save();
    toguroHairPath(x);
    x.fillStyle = vgrad(x, -247, -184, TO_HAIR);
    x.fill();
    x.strokeStyle = '#020203';
    x.lineWidth = 1.8;
    x.lineJoin = 'round';
    x.stroke();
    x.clip();
    // Face de cima do corte, vista um pouco de cima: faixa mais clara
    x.beginPath();
    x.moveTo(-88, -247);
    x.lineTo(88, -247);
    x.lineTo(82, -237);
    x.lineTo(-82, -237);
    x.closePath();
    x.fillStyle = '#3b3f48';
    x.fill();
    x.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(-82, -237);
    x.lineTo(82, -237);
    x.stroke();
    // Pontas dos fios no topo
    x.strokeStyle = 'rgba(170, 180, 200, 0.45)';
    x.lineWidth = 1;
    x.lineCap = 'round';
    x.beginPath();
    for (let hx = -78; hx <= 78; hx += 6) {
      x.moveTo(hx, -245);
      x.lineTo(hx + 1.5, -240);
    }
    x.stroke();
    // Fios em pé na frente, poucos e discretos
    x.strokeStyle = 'rgba(150, 160, 180, 0.12)';
    x.beginPath();
    for (let hx = -72; hx <= 72; hx += 16) {
      x.moveTo(hx, -200);
      x.lineTo(hx * 1.02, -236);
    }
    x.stroke();
    // Brilho na frente do corte
    x.strokeStyle = 'rgba(200, 210, 230, 0.3)';
    x.lineWidth = 2.6;
    x.beginPath();
    x.moveTo(-62, -229);
    x.lineTo(20, -229);
    x.stroke();
    x.restore();
  }

  // Óculos escuros em lâmina: as duas lentes formam uma faixa só, com a borda de cima quase reta e um reflexo prateado
  // nela; embaixo, cada lente é funda perto do nariz e afina até uma ponta do lado de fora. O visor é pintado de novo
  // por baixo (mesmas cores do visor do Echo), então os olhos somem e o rosto fica sem expressão; a boca fica fora do
  // visor.
  function toguroLensPath(x) {
    x.beginPath();
    x.moveTo(3, -3);
    x.quadraticCurveTo(36, -12, 73, -10);
    x.quadraticCurveTo(56, 6, 30, 12);
    x.quadraticCurveTo(9, 15, 3, 3);
    x.closePath();
  }

  function drawToguroGlasses(x) {
    x.save();
    const g = x.createLinearGradient(0, -27, 0, 27);
    g.addColorStop(0, '#0a2333');
    g.addColorStop(1, '#020b12');
    x.fillStyle = g;
    x.beginPath();
    roundRectOutline(x, { x: -74, y: -26, w: 148, h: 52, r: 26 });
    x.fill();
    x.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(-48, -22);
    x.lineTo(48, -22);
    x.stroke();

    x.lineJoin = 'round';
    x.lineCap = 'round';
    // Hastes até as laterais da cabeça (o recorte da cabeça corta o resto)
    x.strokeStyle = '#020203';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(-70, -9);
    x.lineTo(-96, -11);
    x.moveTo(70, -9);
    x.lineTo(96, -11);
    x.stroke();
    for (const sd of [-1, 1]) {
      x.save();
      x.scale(sd, 1);
      toguroLensPath(x);
      const lg = x.createLinearGradient(0, -10, 0, 14);
      lg.addColorStop(0, '#16181e');
      lg.addColorStop(0.6, '#030304');
      lg.addColorStop(1, '#0d1118');
      x.fillStyle = lg;
      x.fill();
      x.save();
      x.clip();
      // Reflexo prateado ao longo da borda de cima
      x.beginPath();
      x.moveTo(3, -3);
      x.quadraticCurveTo(36, -12, 73, -10);
      x.quadraticCurveTo(40, -2, 3, 4);
      x.closePath();
      const hg = x.createLinearGradient(0, -12, 0, 2);
      hg.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      hg.addColorStop(1, 'rgba(175, 185, 200, 0.75)');
      x.fillStyle = hg;
      x.fill();
      x.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(3, 4);
      x.quadraticCurveTo(40, -2, 73, -10);
      x.stroke();
      x.restore();
      // Contorno claro por fora e preto por dentro: a lente aparece sobre o visor escuro
      toguroLensPath(x);
      x.strokeStyle = 'rgba(205, 215, 230, 0.8)';
      x.lineWidth = 4;
      x.stroke();
      x.strokeStyle = '#000';
      x.lineWidth = 2;
      x.stroke();
      x.restore();
    }
    // Ponte: as lentes se encontram no meio
    x.fillStyle = '#000';
    x.beginPath();
    roundRectOutline(x, { x: -5, y: -4, w: 10, h: 7, r: 2 });
    x.fill();
    x.restore();
  }

  // Paletó verde-oliva aberto sobre a regata verde-escura, com ombreiras largas e um pouco do peito no decote.
  // Tudo por trás da tela do peito; o paletó fecha num botão abaixo dela.
  function toguroJacketHalf(x) {
    x.beginPath();
    x.moveTo(17, -80);
    x.lineTo(31, -66);
    x.lineTo(34, -30);
    x.lineTo(2, -12);
    x.lineTo(2, 2);
    x.lineTo(64, 2);
    x.lineTo(64, -82);
    x.closePath();
  }

  function drawToguroJacket(x) {
    // Ombreiras: passam da borda do corpo, para os ombros ficarem largos
    for (const sd of [-1, 1]) {
      x.save();
      x.scale(sd, 1);
      x.beginPath();
      x.moveTo(24, -79);
      x.quadraticCurveTo(52, -86, 61, -70);
      x.quadraticCurveTo(66, -58, 57, -44);
      x.lineTo(44, -44);
      x.lineTo(40, -79);
      x.closePath();
      x.fillStyle = vgrad(x, -86, -44, TO_JACKET);
      x.fill();
      x.strokeStyle = TO_JACKET_EDGE;
      x.lineWidth = 1.5;
      x.stroke();
      // Gola do paletó em volta do pescoço (a cabeça cobre o alto)
      x.beginPath();
      x.moveTo(14, -78);
      x.lineTo(19, -91);
      x.quadraticCurveTo(36, -93, 48, -83);
      x.lineTo(40, -76);
      x.closePath();
      x.fillStyle = vgrad(x, -93, -76, [TO_JACKET[1], TO_JACKET[2]]);
      x.fill();
      x.strokeStyle = TO_JACKET_EDGE;
      x.lineWidth = 1.3;
      x.stroke();
      x.restore();
    }

    x.save();
    clipBodyWithoutScreen(x);
    // Peito no decote
    x.fillStyle = vgrad(x, -80, -60, TO_SKIN);
    x.fillRect(-40, -82, 80, 24);
    x.strokeStyle = 'rgba(94, 53, 25, 0.7)';
    x.lineWidth = 1.1;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-6, -76);
    x.quadraticCurveTo(-14, -75, -22, -77);
    x.moveTo(6, -76);
    x.quadraticCurveTo(14, -75, 22, -77);
    x.stroke();
    // Regata
    x.beginPath();
    x.moveTo(-40, -72);
    x.quadraticCurveTo(0, -64, 40, -72);
    x.lineTo(40, 2);
    x.lineTo(-40, 2);
    x.closePath();
    x.fillStyle = vgrad(x, -72, 2, TO_TANK);
    x.fill();
    x.strokeStyle = 'rgba(8, 20, 12, 0.8)';
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(-40, -72);
    x.quadraticCurveTo(0, -64, 40, -72);
    x.stroke();
    // As duas metades do paletó (a da direita, de quem olha, fica por cima)
    for (const sd of [-1, 1]) {
      x.save();
      x.scale(sd, 1);
      toguroJacketHalf(x);
      x.fillStyle = vgrad(x, -82, 2, TO_JACKET);
      x.fill();
      x.strokeStyle = TO_JACKET_EDGE;
      x.lineWidth = 1.5;
      x.stroke();
      // Lapela com o recorte em V
      x.beginPath();
      x.moveTo(17, -80);
      x.lineTo(31, -66);
      x.lineTo(33, -42);
      x.lineTo(41, -56);
      x.lineTo(38, -64);
      x.lineTo(44, -70);
      x.lineTo(30, -82);
      x.closePath();
      x.fillStyle = vgrad(x, -82, -42, [TO_JACKET[0], TO_JACKET[2]]);
      x.fill();
      x.strokeStyle = TO_JACKET_EDGE;
      x.lineWidth = 1.2;
      x.stroke();
      // Dobras do pano
      x.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      x.lineWidth = 1.2;
      x.beginPath();
      x.moveTo(46, -48);
      x.quadraticCurveTo(48, -28, 42, -8);
      x.moveTo(14, -6);
      x.quadraticCurveTo(22, -12, 30, -10);
      x.stroke();
      x.restore();
    }
    // Sombra nas laterais, para o corpo continuar redondo
    const sg = x.createLinearGradient(-BODY.hw, 0, BODY.hw, 0);
    sg.addColorStop(0, 'rgba(0, 0, 0, 0.38)');
    sg.addColorStop(0.25, 'rgba(0, 0, 0, 0)');
    sg.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
    sg.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    x.fillStyle = sg;
    x.fillRect(-64, -82, 128, 84);
    x.restore();

    // Botão do paletó, abaixo da tela
    x.beginPath();
    x.arc(3, -8, 2.8, 0, Math.PI * 2);
    x.fillStyle = '#2a2614';
    x.fill();
    x.strokeStyle = '#0c0b05';
    x.lineWidth = 0.9;
    x.stroke();

    // Contorno do paletó abaixo das ombreiras
    x.save();
    x.beginPath();
    x.rect(-70, -46, 140, 50);
    x.clip();
    x.beginPath();
    bodyOutline(x);
    x.strokeStyle = TO_JACKET_EDGE;
    x.lineWidth = 1.6;
    x.stroke();
    x.restore();
  }

  // ========================================================
  // VIDA DE TI (carrossel)
  // Figurinos em teste: médico, mago, mecânico, adivinho,
  // bombeiro, arqueólogo, psicólogo, detetive e hacker
  // ========================================================
  const VidaTI = (() => {
    const INK = '#123345';

    function path(x, p, fill, stroke, w = 1.2) {
      x.beginPath();
      x.moveTo(...p[0]);
      p.slice(1).forEach(q => x.lineTo(...q));
      x.closePath();
      if (fill) { x.fillStyle = fill; x.fill(); }
      if (stroke) { x.strokeStyle = stroke; x.lineWidth = w; x.stroke(); }
    }

    function shape(x, p, col, stroke = INK, w = 1.2) {
      x.beginPath();
      x.moveTo(...p[0]);
      p.slice(1).forEach(q => x.lineTo(...q));
      x.closePath();
      if (col) { x.fillStyle = col; x.fill(); }
      if (stroke) { x.strokeStyle = stroke; x.lineWidth = w; x.stroke(); }
    }

    function round(x, a, b, w, h, r, fill, stroke) {
      x.beginPath();
      x.roundRect(a, b, w, h, r);
      if (fill) { x.fillStyle = fill; x.fill(); }
      if (stroke) { x.strokeStyle = stroke; x.lineWidth = 1; x.stroke(); }
    }

    function rr(x, a, b, w, h, r, col, stroke, lw = 1) {
      x.beginPath();
      x.roundRect(a, b, w, h, r);
      if (col) { x.fillStyle = col; x.fill(); }
      if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
    }

    function line(x, p, col, w = 1.5) {
      x.beginPath();
      x.moveTo(...p[0]);
      p.slice(1).forEach(q => x.lineTo(...q));
      x.strokeStyle = col;
      x.lineWidth = w;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.stroke();
    }

    function ellipse(x, a, b, rx, ry, col) {
      x.beginPath();
      x.ellipse(a, b, rx, ry, 0, 0, Math.PI * 2);
      x.fillStyle = col;
      x.fill();
    }

    function gradient(x, y0, y1, cols) {
      const g = x.createLinearGradient(-45, y0, 45, y1);
      cols.forEach((v, i) => g.addColorStop(i / (cols.length - 1), v));
      return g;
    }

    function grad(x, cols) {
      const g = x.createLinearGradient(-45, -80, 45, 0);
      cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
      return g;
    }

    function grad4(x, x0, y0, x1, y1, cols) {
      const g = x.createLinearGradient(x0, y0, x1, y1);
      cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
      return g;
    }

    function star(x, a, b, r, col) {
      const p = [];
      for (let i = 0; i < 10; i++) {
        const z = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * 0.44 : r;
        p.push([a + Math.cos(z) * d, b + Math.sin(z) * d]);
      }
      path(x, p, col);
    }

    function plaid(x, x0, y0, w, h) {
      x.save();
      x.beginPath();
      x.rect(x0, y0, w, h);
      x.clip();
      for (let a = x0; a < x0 + w; a += 12) {
        line(x, [[a, y0], [a, y0 + h]], 'rgba(79,58,49,.28)', 3);
        line(x, [[a + 4, y0], [a + 4, y0 + h]], 'rgba(241,215,164,.28)', 0.7);
      }
      for (let b = y0; b < y0 + h; b += 12) {
        line(x, [[x0, b], [x0 + w, b]], 'rgba(79,58,49,.28)', 3);
        line(x, [[x0, b + 4], [x0 + w, b + 4]], 'rgba(241,215,164,.28)', 0.7);
      }
      x.restore();
    }

    function body(x, cols, detail) {
      x.save();
      clipBodyWithoutScreen(x);
      x.fillStyle = gradient(x, -78, 0, cols);
      x.fillRect(-55, -83, 110, 87);
      detail(x);
      x.restore();
      x.beginPath();
      bodyOutline(x);
      x.strokeStyle = INK;
      x.lineWidth = 1.2;
      x.stroke();
    }

    // --- 1. MÉDICO ---
    function drawJalecoMedico(x) {
      x.save();
      clipBodyWithoutScreen(x);
      x.fillStyle = grad4(x, -50, -70, 50, 0, ['#faffff', '#eff6f3', '#b7cdd4']);
      x.fillRect(-54, -82, 108, 86);
      path(x, [[-15, -79], [15, -79], [13, -6], [-12, -6]], '#408a9b', null, 1);
      path(x, [[-27, -78], [-8, -78], [-6, -66], [-24, -66], [-32, -60], [-24, -66]], '#ffffff', '#9cb8c4', 1);
      path(x, [[27, -78], [8, -78], [6, -66], [24, -66], [32, -60], [24, -66]], '#e6f1f4', '#9cb8c4', 1);
      rr(x, -40, -25, 18, 17, 3, '#e7f2f6', '#a7bec8', 0.8);
      line(x, [[-38, -22], [-24, -22]], '#93aeb8', 0.8);
      line(x, [[-33, -25], [-33, -14]], '#21a7c4', 2);
      rr(x, 22, -25, 17, 14, 2, '#d8eef0', '#98b8bf', 0.6);
      rr(x, 27, -23, 6, 3, 1, '#1298ab', null, 0);
      for (const y of [-24, -15, -6]) ellipse(x, 4, y, 1.1, 1.1, '#678b97');
      x.restore();
      x.beginPath();
      bodyOutline(x);
      x.strokeStyle = INK;
      x.lineWidth = 1.2;
      x.stroke();
      // Estetoscópio: desce pelos lados e cruza abaixo da tela; o recorte garante que nunca passa por cima dela
      x.save();
      x.beginPath();
      x.rect(-80, -100, 160, 110);
      roundRectOutline(x, { x: -31, y: -65, w: 62, h: 38, r: 11 });
      x.clip('evenodd');
      x.beginPath();
      x.moveTo(-23, -81);
      x.bezierCurveTo(-42, -66, -42, -32, -24, -18);
      x.bezierCurveTo(-10, -13, 10, -13, 24, -18);
      x.bezierCurveTo(42, -32, 42, -66, 26, -78);
      x.strokeStyle = '#142f43';
      x.lineWidth = 3.4;
      x.stroke();
      x.restore();
      line(x, [[-23, -81], [-27, -68]], '#bbdce0', 2);
      line(x, [[26, -78], [22, -65]], '#bbdce0', 2);
      ellipse(x, -23, -81, 2.3, 2.3, '#163a4d');
      ellipse(x, 26, -78, 2.3, 2.3, '#163a4d');
    }

    // --- 2. MAGO ---
    // Chapéu de mago grande: aba larga cobrindo o alto da cabeça e o cone com a ponta caída para a direita
    function drawChapeuMago(x) {
      x.save();
      // Aba (atrás do cone)
      ellipse(x, 0, -217, 98, 12, '#3c3a70');
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      // Cone
      x.beginPath();
      x.moveTo(-62, -222);
      x.bezierCurveTo(-46, -246, -22, -274, 6, -286);
      x.quadraticCurveTo(26, -292, 32, -279);
      x.quadraticCurveTo(20, -280, 14, -273);
      x.bezierCurveTo(30, -254, 48, -238, 62, -222);
      x.closePath();
      x.fillStyle = gradient(x, -292, -218, ['#8476c4', '#3a3a6c']);
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      // Dobra do pano no cone
      x.strokeStyle = 'rgba(20, 22, 50, 0.45)';
      x.lineWidth = 1.4;
      x.beginPath();
      x.moveTo(-20, -226);
      x.quadraticCurveTo(-8, -252, 4, -276);
      x.stroke();
      // Faixa dourada
      path(x, [[-58, -234], [58, -234], [62, -222], [-62, -222]], '#d7b06e', '#8b7147');
      // Frente da aba, por cima da base do cone
      x.beginPath();
      x.ellipse(0, -217, 98, 12, 0, 0, Math.PI);
      x.fillStyle = '#34326a';
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      x.beginPath();
      x.ellipse(0, -219, 95, 9, 0, Math.PI * 1.05, Math.PI * 1.95);
      x.strokeStyle = '#8e80bb';
      x.lineWidth = 1.5;
      x.stroke();
      star(x, -12, -256, 8, '#e8cf93');
      star(x, 22, -244, 4.5, '#cbbb94');
      star(x, -34, -240, 3.5, '#cbbb94');
      x.restore();
    }

    function drawTunicaMagoBack(x) {
      x.beginPath();
      x.moveTo(-35, -83);
      x.bezierCurveTo(-58, -78, -62, -13, -66, 5);
      x.quadraticCurveTo(0, 23, 65, 4);
      x.bezierCurveTo(58, -15, 59, -72, 33, -83);
      x.closePath();
      x.fillStyle = gradient(x, -70, 15, ['#383669', '#171c3e']);
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      line(x, [[-40, -65], [-54, 3], [-25, 8]], '#8274ae', 1);
    }

    function drawTunicaMago(x) {
      body(x, ['#6558a2', '#393a72', '#24254c'], () => {
        path(x, [[-27, -80], [0, -68], [27, -80], [24, -67], [0, -66], [-24, -67]], '#d3ac68', '#85673e');
        ellipse(x, 0, -73, 4, 4, '#72d5d4');
        ellipse(x, -1, -74, 1.4, 1.4, '#e6ffff');
        line(x, [[0, -27], [0, -3]], '#cbb582', 2);
        line(x, [[-44, -11], [41, -11]], '#b99a62', 3);
        star(x, -36, -33, 6, '#dfc68d');
        star(x, 34, -24, 4, '#bcab88');
      });
    }

    // --- 3. MECÂNICO ---
    function drawBoneMecanico(x) {
      x.beginPath();
      x.moveTo(-66, -211);
      x.quadraticCurveTo(-64, -239, -9, -239);
      x.quadraticCurveTo(42, -239, 54, -216);
      x.lineTo(50, -207);
      x.closePath();
      x.fillStyle = gradient(x, -239, -207, ['#526f7e', '#1d3e55']);
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      x.beginPath();
      x.moveTo(-5, -237);
      x.quadraticCurveTo(-13, -225, -10, -212);
      x.strokeStyle = '#85a2ad';
      x.lineWidth = 1.2;
      x.stroke();
      x.beginPath();
      x.moveTo(-33, -212);
      x.quadraticCurveTo(18, -221, 81, -208);
      x.quadraticCurveTo(98, -200, 66, -197);
      x.quadraticCurveTo(5, -199, -33, -207);
      x.closePath();
      x.fillStyle = '#294e66';
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      round(x, -47, -232, 24, 15, 4, '#d0a26b', '#8a673e');
      line(x, [[-40, -221], [-31, -227]], '#345567', 2.2);
      ellipse(x, -40, -221, 2, 2, '#345567');
      ellipse(x, -31, -227, 2, 2, '#345567');
    }

    function drawMacacaoMecanico(x) {
      body(x, ['#d59a56', '#b7743d'], () => {
        path(x, [[-43, -30], [-34, -38], [-33, -78], [-23, -78], [-20, -66], [20, -66], [23, -78], [33, -78], [34, -38], [43, -30], [43, 3], [-43, 3]],
          gradient(x, -66, 0, ['#416b82', '#244258']), INK, 1.1);
        line(x, [[-30, -76], [-26, -68]], '#93afbb', 1);
        line(x, [[30, -76], [26, -68]], '#93afbb', 1);
        ellipse(x, -26, -68, 2, 2, '#efc07b');
        ellipse(x, 26, -68, 2, 2, '#efc07b');
        round(x, -19, -25, 38, 20, 4, '#2d5066', '#7293a0');
        line(x, [[-16, -21], [16, -21]], '#7895a1', 1);
        round(x, 8, -26, 3, 10, 1, '#e7bd75');
        line(x, [[0, -12], [0, 0]], '#819ca4', 1);
        line(x, [[-38, -7], [-21, -10]], '#7895a1', 1);
        line(x, [[21, -10], [36, -8]], '#7895a1', 1);
      });
    }

    // --- 4. ADIVINHO ---
    function drawTurbanteAdivinho(x) {
      x.beginPath();
      x.moveTo(-76, -202);
      x.bezierCurveTo(-89, -239, -40, -247, -6, -238);
      x.bezierCurveTo(39, -254, 88, -233, 76, -202);
      x.quadraticCurveTo(36, -215, 0, -203);
      x.quadraticCurveTo(-36, -217, -76, -202);
      x.closePath();
      x.fillStyle = gradient(x, -246, -200, ['#b57b96', '#7b466e', '#542f55']);
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      x.beginPath();
      x.moveTo(-67, -226);
      x.quadraticCurveTo(-28, -235, 5, -211);
      x.moveTo(68, -226);
      x.quadraticCurveTo(25, -234, -5, -209);
      x.moveTo(-71, -215);
      x.quadraticCurveTo(-37, -223, -10, -208);
      x.moveTo(70, -214);
      x.quadraticCurveTo(41, -224, 13, -210);
      x.strokeStyle = '#d3a3af';
      x.lineWidth = 1.5;
      x.stroke();
      ellipse(x, 0, -212, 9, 11, '#d4b17c');
      ellipse(x, 0, -212, 5.6, 7.8, '#4fbbc3');
      ellipse(x, -1.6, -214.5, 1.8, 2.5, '#cafff9');
    }

    function drawTrajeAdivinho(x) {
      body(x, ['#9b5379', '#683959', '#412b4b'], () => {
        path(x, [[-36, -79], [-11, -77], [6, -66], [-10, -2], [-40, -1]], '#b7798e');
        line(x, [[-12, -76], [6, -66]], '#ecc481', 2.1);
        line(x, [[0, -27], [-9, -2]], '#ecc481', 2.1);
        line(x, [[30, -75], [26, -66]], '#cd9c69', 1);
        line(x, [[24, -27], [30, -5]], '#cd9c69', 1);
        for (const [a, b] of [[-36, -49], [-34, -22], [35, -23]]) star(x, a, b, 4, '#e8bf80');
        ellipse(x, 0, -72, 5, 6, '#c69a61');
        ellipse(x, 0, -72, 3.3, 4.2, '#58b9bb');
        ellipse(x, -1, -74, 1, 1.6, '#d8ffff');
      });
    }

    // --- 5. BOMBEIRO ---
    function drawCapaceteBombeiro(x) {
      x.beginPath();
      x.moveTo(-71, -210);
      x.bezierCurveTo(-68, -250, 64, -252, 69, -211);
      x.closePath();
      x.fillStyle = grad(x, ['#edbd61', '#bd7f3e']);
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      rr(x, -6, -242, 12, 30, 4, '#f4d48a', '#926b3c');
      ellipse(x, 0, -208, 82, 7, '#a96f37');
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      shape(x, [[-20, -234], [20, -234], [18, -211], [0, -201], [-18, -211]], '#e5cf96', '#654e35', 1.5);
      shape(x, [[-7, -228], [7, -228], [7, -215], [0, -211], [-7, -215]], '#496371', null);
      line(x, [[-64, -213], [-57, -199]], '#f0c879', 3);
    }

    function drawJaquetaBombeiro(x) {
      body(x, ['#a28350', '#65583f'], () => {
        rr(x, -55, -25, 110, 11, 0, '#c4d274');
        rr(x, -55, -22, 110, 4, 0, '#edf3c1');
        shape(x, [[-29, -79], [-9, -78], [0, -67], [9, -78], [29, -79], [19, -68], [0, -66], [-19, -68]], '#3f3b33');
        line(x, [[0, -25], [0, 0]], '#b5af94', 1.5);
        for (const a of [-38, 25]) rr(x, a, -13, 13, 12, 2, '#5f533c', '#c6b27e');
        rr(x, -8, -74, 16, 7, 1, '#405344', '#b1ca86');
      });
    }

    // --- 6. ARQUEÓLOGO ---
    function drawChapeuArqueologo(x) {
      x.beginPath();
      x.moveTo(-54, -210);
      x.lineTo(-43, -239);
      x.quadraticCurveTo(-22, -246, 0, -237);
      x.quadraticCurveTo(24, -246, 44, -238);
      x.lineTo(56, -210);
      x.closePath();
      x.fillStyle = grad(x, ['#d6ba8e', '#9e7e54']);
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      shape(x, [[-51, -221], [51, -221], [55, -211], [-55, -211]], '#775a3f', null);
      ellipse(x, 0, -208, 79, 10, '#b89969');
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      x.beginPath();
      x.ellipse(0, -211, 76, 6, 0, Math.PI, Math.PI * 2);
      x.strokeStyle = '#e5cda3';
      x.lineWidth = 1.5;
      x.stroke();
    }

    function drawColeteArqueologo(x) {
      body(x, ['#d2b68a', '#a1855c'], () => {
        shape(x, [[-13, -80], [13, -80], [16, 1], [-16, 1]], '#a2926c', null);
        shape(x, [[-31, -79], [-15, -79], [-9, -66], [-24, -66], [-34, -72]], '#e1c59a', '#836b4e');
        shape(x, [[31, -79], [15, -79], [9, -66], [24, -66], [34, -72]], '#c7ac80', '#836b4e');
        for (const a of [-38, 21]) {
          rr(x, a, -25, 17, 20, 2, '#b89a6d', '#78654e');
          line(x, [[a + 2, -21], [a + 15, -21]], '#e0c9a3', 1);
        }
        line(x, [[0, -25], [0, 0]], '#75674f', 1);
        for (const y of [-24, -15, -6]) ellipse(x, 3, y, 1.3, 1.3, '#ead8b8');
        line(x, [[-35, -34], [-35, -45]], '#6d795e', 3);
      });
    }

    // --- 7. PSICÓLOGO ---
    function drawOculosPsicologo(x) {
      for (const a of [-38, 38]) {
        x.beginPath();
        x.ellipse(a, -1, 24, 18, 0, 0, Math.PI * 2);
        x.fillStyle = 'rgba(143,209,213,.035)';
        x.fill();
        x.strokeStyle = '#ba9d74';
        x.lineWidth = 2.4;
        x.stroke();
      }
      x.beginPath();
      x.moveTo(-14, -2);
      x.quadraticCurveTo(0, -9, 14, -2);
      x.strokeStyle = '#ba9d74';
      x.lineWidth = 2.1;
      x.stroke();
      line(x, [[-62, -3], [-75, -8]], '#ba9d74', 2);
      line(x, [[62, -3], [75, -8]], '#ba9d74', 2);
    }

    function drawCardigaPsicologo(x) {
      body(x, ['#9b8e88', '#68696d'], () => {
        shape(x, [[-18, -80], [18, -80], [18, 0], [-16, 0]], '#d4d4bd', null);
        shape(x, [[-19, -80], [-6, -66], [0, -73], [8, -66], [19, -80]], '#eae9d5', '#a8b4ac');
        line(x, [[-21, -76], [-15, -66]], '#4a555c', 2);
        line(x, [[-15, -27], [-16, 0]], '#4a555c', 2);
        line(x, [[21, -76], [16, -66]], '#bec0ad', 1.5);
        line(x, [[16, -27], [16, 0]], '#bec0ad', 1.5);
        for (const y of [-24, -15, -6]) ellipse(x, 20, y, 1.7, 1.7, '#d3c6ac');
        rr(x, -41, -24, 19, 18, 2, '#7b7775', '#a7a39a');
      });
    }

    // --- 8. DETETIVE ---
    function drawChapeuSherlock(x) {
      x.save();
      x.beginPath();
      x.moveTo(-64, -211);
      x.bezierCurveTo(-61, -242, 57, -245, 62, -211);
      x.closePath();
      x.fillStyle = '#b89f79';
      x.fill();
      x.clip();
      plaid(x, -68, -244, 136, 38);
      x.restore();
      x.beginPath();
      x.moveTo(-64, -211);
      x.bezierCurveTo(-61, -242, 57, -245, 62, -211);
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      x.beginPath();
      x.moveTo(-62, -214);
      x.quadraticCurveTo(-91, -206, -72, -199);
      x.lineTo(-38, -203);
      x.lineTo(24, -202);
      x.quadraticCurveTo(104, -189, 85, -207);
      x.quadraticCurveTo(38, -219, -62, -214);
      x.fillStyle = '#9a805f';
      x.fill();
      x.stroke();
      shape(x, [[-42, -226], [-23, -235], [-9, -227], [-21, -213], [-43, -214]], '#c3aa84', '#806a53');
      shape(x, [[22, -235], [41, -225], [42, -212], [21, -213], [8, -228]], '#a98f6b', '#806a53');
      ellipse(x, 0, -231, 5, 3, '#695d4a');
      line(x, [[-12, -235], [0, -231], [11, -235]], '#6c5b45', 2);
    }

    function drawSobretudoSherlock(x) {
      body(x, ['#bca17a', '#8f765c'], () => {
        plaid(x, -52, -80, 104, 82);
        shape(x, [[-10, -80], [10, -80], [13, 0], [-12, 0]], '#665d50', null);
        shape(x, [[-32, -80], [-16, -81], [-6, -66], [-24, -66], [-38, -72]], '#c2a47a', '#80674f');
        shape(x, [[32, -80], [16, -81], [6, -66], [24, -66], [38, -72]], '#a68c6a', '#80674f');
        for (const y of [-24, -15, -6]) {
          ellipse(x, -10, y, 1.7, 1.7, '#463f36');
          ellipse(x, 10, y, 1.7, 1.7, '#463f36');
        }
      });
      x.save();
      x.beginPath();
      x.moveTo(-28, -81);
      x.quadraticCurveTo(-51, -79, -56, -45);
      x.quadraticCurveTo(-44, -42, -33, -52);
      x.lineTo(-10, -77);
      x.closePath();
      x.fillStyle = '#b29a77';
      x.fill();
      x.clip();
      plaid(x, -60, -82, 54, 42);
      x.restore();
      x.save();
      x.beginPath();
      x.moveTo(28, -81);
      x.quadraticCurveTo(51, -79, 56, -45);
      x.quadraticCurveTo(44, -42, 33, -52);
      x.lineTo(10, -77);
      x.closePath();
      x.fillStyle = '#a18869';
      x.fill();
      x.clip();
      plaid(x, 7, -82, 54, 42);
      x.restore();
    }

    // --- 9. HACKER ---
    // Capuz de moletom preto: parte de trás atrás da cabeça, descendo até os ombros
    function drawCapuzHackerBack(x) {
      x.beginPath();
      x.moveTo(0, -252);
      x.bezierCurveTo(70, -250, 116, -212, 114, -150);
      x.bezierCurveTo(113, -110, 100, -84, 70, -70);
      x.lineTo(-70, -70);
      x.bezierCurveTo(-100, -84, -113, -110, -114, -150);
      x.bezierCurveTo(-116, -212, -70, -250, 0, -252);
      x.closePath();
      x.fillStyle = '#060708';
      x.fill();
    }

    // Abertura do capuz: justa em volta do rosto (visor e boca à mostra) e fechando embaixo do queixo
    function hackerHoodOpening(x, start) {
      if (start) x.moveTo(44, -86);
      else x.lineTo(44, -86);
      x.bezierCurveTo(78, -104, 88, -150, 66, -188);
      x.quadraticCurveTo(0, -206, -66, -188);
      x.bezierCurveTo(-88, -150, -78, -104, -44, -86);
    }

    // Capuz, frente: pano sobre o alto e os lados da cabeça, caindo nos ombros, aberto em volta do rosto, com
    // sombra por dentro, barra grossa na abertura, costura no meio e os cordões
    function drawCapuzHacker(x) {
      x.save();
      x.beginPath();
      x.moveTo(-62, -70);
      x.bezierCurveTo(-108, -96, -114, -180, -70, -232);
      x.quadraticCurveTo(0, -262, 70, -232);
      x.bezierCurveTo(114, -180, 108, -96, 62, -70);
      hackerHoodOpening(x, false);
      x.closePath();
      x.fillStyle = grad(x, ['#2e3138', '#0c0d10']);
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 2;
      x.stroke();
      x.restore();

      // Sombra por dentro da abertura
      x.save();
      x.beginPath();
      hackerHoodOpening(x, true);
      x.closePath();
      x.clip();
      x.beginPath();
      hackerHoodOpening(x, true);
      x.strokeStyle = 'rgba(4, 12, 16, 0.5)';
      x.lineWidth = 16;
      x.stroke();
      x.restore();

      x.save();
      x.lineCap = 'round';
      x.lineJoin = 'round';
      // Barra grossa (pano dobrado) em volta da abertura
      x.beginPath();
      hackerHoodOpening(x, true);
      x.strokeStyle = '#141619';
      x.lineWidth = 7;
      x.stroke();
      x.strokeStyle = '#4b515c';
      x.lineWidth = 2;
      x.stroke();
      // Costura no meio e dobras nos lados
      x.strokeStyle = 'rgba(110, 118, 132, 0.5)';
      x.lineWidth = 1.2;
      x.beginPath();
      x.moveTo(0, -246);
      x.lineTo(0, -208);
      x.moveTo(-98, -160);
      x.quadraticCurveTo(-100, -120, -86, -92);
      x.moveTo(98, -160);
      x.quadraticCurveTo(100, -120, 86, -92);
      x.stroke();
      // Cordões saindo de baixo da abertura (por fora da tela do peito)
      for (const sd of [-1, 1]) {
        x.beginPath();
        x.moveTo(sd * 40, -88);
        x.quadraticCurveTo(sd * 42, -78, sd * 39, -66);
        x.strokeStyle = '#c9d6cf';
        x.lineWidth = 2;
        x.stroke();
        x.beginPath();
        roundRectOutline(x, { x: sd * 39 - 1.6, y: -67, w: 3.2, h: 5, r: 1.2 });
        x.fillStyle = '#7a818c';
        x.fill();
      }
      x.restore();
    }

    function drawMoletomHacker(x) {
      body(x, ['#26292f', '#0b0c0f'], () => {
        shape(x, [[-20, -80], [0, -66], [20, -80], [12, -67], [-12, -67]], '#08090b', '#3f4550');
        line(x, [[-14, -73], [-14, -66]], '#c9ced6', 1.7);
        line(x, [[14, -73], [14, -66]], '#c9ced6', 1.7);
        ellipse(x, -14, -66, 1.2, 1.2, '#c9ced6');
        ellipse(x, 14, -66, 1.2, 1.2, '#c9ced6');
        rr(x, -28, -24, 56, 18, 5, '#16181c', '#3a3f48');
        line(x, [[-18, -22], [-25, -15]], '#4a505a', 1);
        line(x, [[18, -22], [25, -15]], '#4a505a', 1);
        x.font = '700 11px Consolas';
        x.textAlign = 'center';
        x.fillStyle = '#a5d898';
        x.fillText('>_', 0, -13);
      });
    }

    return {
      drawJalecoMedico,
      drawChapeuMago,
      drawTunicaMagoBack,
      drawTunicaMago,
      drawBoneMecanico,
      drawMacacaoMecanico,
      drawTurbanteAdivinho,
      drawTrajeAdivinho,
      drawCapaceteBombeiro,
      drawJaquetaBombeiro,
      drawChapeuArqueologo,
      drawColeteArqueologo,
      drawOculosPsicologo,
      drawCardigaPsicologo,
      drawChapeuSherlock,
      drawSobretudoSherlock,
      drawCapuzHackerBack,
      drawCapuzHacker,
      drawMoletomHacker
    };
  })();

  // Espelho de testa do médico: faixa sobre a testa (acima do visor, que começa em y = -174) e o espelho redondo
  // no meio, com o furo central. Coordenadas do robô, preso na base dos chapéus.
  function drawEspelhoMedico(x) {
    x.save();
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-88, -184);
    x.quadraticCurveTo(0, -202, 88, -184);
    x.strokeStyle = '#2f3a45';
    x.lineWidth = 7;
    x.stroke();
    x.strokeStyle = 'rgba(200, 215, 230, 0.4)';
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(-84, -187);
    x.quadraticCurveTo(0, -204, 84, -187);
    x.stroke();
    // Suporte e espelho
    x.fillStyle = '#5b6773';
    x.fillRect(-4, -198, 8, 6);
    x.beginPath();
    x.arc(0, -207, 15, 0, Math.PI * 2);
    const g = x.createRadialGradient(-5, -212, 2, 0, -207, 16);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#cfd8e3');
    g.addColorStop(1, '#7c8a99');
    x.fillStyle = g;
    x.fill();
    x.strokeStyle = '#3d4855';
    x.lineWidth = 2.4;
    x.stroke();
    x.beginPath();
    x.arc(0, -207, 3, 0, Math.PI * 2);
    x.fillStyle = '#1f2933';
    x.fill();
    x.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(0, -207, 10, Math.PI * 1.1, Math.PI * 1.45);
    x.stroke();
    x.restore();
  }

  Object.assign(Roupas.ITEMS, {
    sorrisoCosturado: {
      label: 'Sorriso costurado', slot: 'rosto', owner: 'echo', top: 0, springs: [],
      draw(x) {
        // Curva entre as bochechas, passando pelo lugar da boca (0, 38), com as pontas viradas para cima
        x.strokeStyle = INK;
        x.lineCap = 'round';
        x.lineWidth = 2.6;
        x.beginPath();
        x.moveTo(-49, 24);
        x.lineTo(-44, 29);
        x.moveTo(44, 29);
        x.lineTo(49, 24);
        x.stroke();
        stitchedCurve(x, [-44, 29], [0, 47], [44, 29], 11, 5);
      }
    },
    ternoEsqueleto: {
      label: 'Terno de esqueleto', slot: 'pescoco', owner: 'echo', top: 0, springs: [[90, 6, 0]],
      draw(x, t, a) {
        // Terno só no corpo, com abertura para a tela do peito
        x.save();
        clipBodyWithoutScreen(x);
        x.fillStyle = SUIT;
        x.fillRect(-BODY.hw - 2, -2 * BODY.hh - 2, 2 * BODY.hw + 4, 2 * BODY.hh + 4);
        // Listras finas que acompanham o corpo (mais estreito embaixo)
        x.strokeStyle = PIN;
        x.lineWidth = 1.4;
        const narrow = BODY.bottomHw / BODY.hw;
        for (let k = -7; k <= 7; k++) {
          x.beginPath();
          x.moveTo(k * 7, -2 * BODY.hh);
          x.lineTo(k * 7 * narrow, 0);
          x.stroke();
        }
        // Camisa branca em V (aparece acima e abaixo da tela)
        x.beginPath();
        x.moveTo(-24, -2 * BODY.hh);
        x.lineTo(24, -2 * BODY.hh);
        x.lineTo(0, -5);
        x.closePath();
        x.fillStyle = SHIRT;
        x.fill();
        x.strokeStyle = '#0a0a0f';
        x.lineWidth = 2.2;
        x.stroke();
        // Sombra nas laterais, para o corpo continuar redondo
        const g = x.createLinearGradient(-BODY.hw, 0, BODY.hw, 0);
        g.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
        g.addColorStop(0.3, 'rgba(0, 0, 0, 0)');
        g.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        x.fillStyle = g;
        x.fillRect(-BODY.hw - 2, -2 * BODY.hh - 2, 2 * BODY.hw + 4, 2 * BODY.hh + 4);
        x.restore();
        // Contorno do terno
        x.beginPath();
        bodyOutline(x);
        x.strokeStyle = '#05070c';
        x.lineWidth = 1.6;
        x.stroke();
        drawBat(x, a);
      }
    },

    // ========================================================
    // FANTASIA DE KRATOS (inspirada no personagem de God of War)
    // ========================================================
    // Barba e marca de guerra no mesmo referencial do rosto: acompanham o olhar e o giro.
    guerraEspartana: {
      label: 'Barba e marca de guerra', slot: 'rosto', owner: 'echo', top: 0, springs: [],
      draw(x) {
        drawWarMark(x);
      },
      // A barba fica por cima do contorno da cabeça
      over(x) {
        drawBeard(x);
      }
    },

    // Ombreira de bronze, correia cruzada, cinto, saiote de couro com pano vermelho e o machado nas costas
    armaduraKratos: {
      label: 'Armadura e machado', slot: 'pescoco', owner: 'echo', top: 0, springs: [[70, 6, 0]],
      back(x) {
        drawAxe(x);
      },
      draw(x, t, a) {
        drawKilt(x, a);
        x.save();
        clipBodyWithoutScreen(x);
        drawStrap(x);
        drawBelt(x);
        x.restore();
        drawBuckle(x);
        drawPauldron(x);
      }
    },

    // ========================================================
    // FANTASIA DE TYRAEL (inspirada no Arcanjo da Justiça de Diablo III)
    // ========================================================
    capuzTyrael: {
      // Preso como os chapéus (base no alto da cabeça), para acompanhar um pouco o rosto ao olhar para os lados;
      // desenhado nas coordenadas do robô, voltando da base dos chapéus. O fundo (back) fica parado atrás da cabeça.
      label: 'Capuz de Tyrael', slot: 'cabeca', owner: 'echo', top: 20, springs: [],
      back(x) {
        drawHoodBack(x);
      },
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        drawHoodFront(x);
        x.restore();
      }
    },

    rostoSombras: {
      label: 'Rosto nas sombras', slot: 'rosto', owner: 'echo', top: 0, springs: [],
      draw(x) {
        drawShadowFace(x);
      }
    },

    // As asas de luz ficam na parte de trás e ondulam com o tempo
    armaduraTyrael: {
      label: 'Armadura e asas de luz', slot: 'pescoco', owner: 'echo', top: 0, springs: [[60, 5, 0]],
      back(x, t) {
        drawWings(x, t);
      },
      draw(x, t, a) {
        drawTyraelArmor(x, a);
      }
    },

    // ========================================================
    // FANTASIA DE DARTH VADER (inspirada no personagem de Star Wars)
    // ========================================================
    // Preso como os chapéus, igual ao capuz do Tyrael; desenhado nas coordenadas do robô
    capaceteVader: {
      label: 'Capacete de Darth Vader', slot: 'cabeca', owner: 'echo', top: 26, springs: [],
      back(x) {
        drawVaderHelmetBack(x);
      },
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        drawVaderHelmetFront(x);
        x.restore();
      }
    },

    // Tampa o rosto todo: olhos e boca do Echo ficam escondidos enquanto estiver de Vader
    mascaraVader: {
      label: 'Máscara de Darth Vader', slot: 'rosto', owner: 'echo', top: 0, springs: [],
      draw(x) {
        drawVaderMask(x);
      }
    },

    // A capa fica na parte de trás e balança
    armaduraVader: {
      label: 'Armadura e capa', slot: 'pescoco', owner: 'echo', top: 0, springs: [[50, 5, -1], [55, 5, 1]],
      back(x, t, a) {
        drawVaderCape(x, a);
      },
      draw(x) {
        drawVaderArmor(x);
      }
    },

    // ========================================================
    // FANTASIA DE TI (Dia do Profissional de Informática, 19/10)
    // ========================================================
    // Preso como os chapéus, igual ao capuz do Tyrael; desenhado nas coordenadas do robô
    headsetTI: {
      label: 'Headset de suporte', slot: 'cabeca', owner: 'echo', top: 11, springs: [],
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        drawHeadset(x);
        x.restore();
      }
    },

    oculosProgramador: {
      label: 'Óculos de programador', slot: 'rosto', owner: 'echo', top: 0, springs: [],
      draw(x) {
        drawDevGlasses(x);
      }
    },

    // A camiseta cobre a tela >_ do peito: a estampa do Estratégia Nerd fica no lugar dela
    moletomNerd: {
      label: 'Moletom e camiseta do Estratégia Nerd', slot: 'pescoco', owner: 'echo', top: 0, springs: [],
      draw(x) {
        drawNerdHoodie(x);
      }
    },

    // ========================================================
    // FANTASIA DE YUSUKE (inspirada no protagonista de Yu Yu Hakusho)
    // ========================================================
    // Preso como os chapéus, igual ao capuz do Tyrael; desenhado nas coordenadas do robô
    cabeloYusuke: {
      label: 'Cabelo penteado para trás', slot: 'cabeca', owner: 'echo', lab: true, top: 38, springs: [],
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        drawYusukeHair(x);
        x.restore();
      }
    },

    uniformeYusuke: {
      label: 'Uniforme verde da escola', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) {
        drawYusukeUniform(x);
      }
    },

    // ========================================================
    // FANTASIA DE TOGURO (inspirada no vilão de Yu Yu Hakusho)
    // ========================================================
    // Preso como os chapéus, igual ao capuz do Tyrael; desenhado nas coordenadas do robô
    cabeloToguro: {
      label: 'Cabelo alto cortado reto', slot: 'cabeca', owner: 'echo', lab: true, top: 32, springs: [],
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        drawToguroHair(x);
        x.restore();
      }
    },

    // O visor é pintado de novo por baixo das lentes: os olhos do Echo somem; a boca continua livre para falar
    oculosToguro: {
      label: 'Óculos escuros do Toguro', slot: 'rosto', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) {
        drawToguroGlasses(x);
      }
    },

    paletoToguro: {
      label: 'Paletó e regata', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) {
        drawToguroJacket(x);
      }
    },

    // VIDA DE TI (carrossel, em teste)
    espelhoMedico: {
      label: 'Espelho de testa', slot: 'cabeca', owner: 'echo', lab: true, top: 6, springs: [],
      // Preso na base dos chapéus (acompanha um pouco o rosto); desenhado nas coordenadas do robô
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        drawEspelhoMedico(x);
        x.restore();
      }
    },
    jalecoMedico: {
      label: 'Jaleco médico', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) { VidaTI.drawJalecoMedico(x); }
    },

    chapeuMago: {
      label: 'Chapéu de mago', slot: 'cabeca', owner: 'echo', lab: true, top: 78, springs: [],
      // Preso na base dos chapéus (acompanha um pouco o rosto); desenhado nas coordenadas do robô
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        VidaTI.drawChapeuMago(x);
        x.restore();
      }
    },
    tunicaMago: {
      label: 'Túnica e capa de mago', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      back(x) { VidaTI.drawTunicaMagoBack(x); },
      draw(x) { VidaTI.drawTunicaMago(x); }
    },

    boneMecanico: {
      label: 'Boné de oficina', slot: 'cabeca', owner: 'echo', lab: true, top: 20, springs: [],
      // Preso na base dos chapéus (acompanha um pouco o rosto); desenhado nas coordenadas do robô
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        VidaTI.drawBoneMecanico(x);
        x.restore();
      }
    },
    macacaoMecanico: {
      label: 'Macacão de mecânico', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) { VidaTI.drawMacacaoMecanico(x); }
    },

    turbanteAdivinho: {
      label: 'Turbante de adivinho', slot: 'cabeca', owner: 'echo', lab: true, top: 24, springs: [],
      // Preso na base dos chapéus (acompanha um pouco o rosto); desenhado nas coordenadas do robô
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        VidaTI.drawTurbanteAdivinho(x);
        x.restore();
      }
    },
    trajeAdivinho: {
      label: 'Traje de adivinho', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) { VidaTI.drawTrajeAdivinho(x); }
    },

    capaceteBombeiro: {
      label: 'Capacete de bombeiro', slot: 'cabeca', owner: 'echo', lab: true, top: 28, springs: [],
      // Preso na base dos chapéus (acompanha um pouco o rosto); desenhado nas coordenadas do robô
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        VidaTI.drawCapaceteBombeiro(x);
        x.restore();
      }
    },
    jaquetaBombeiro: {
      label: 'Jaqueta de bombeiro', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) { VidaTI.drawJaquetaBombeiro(x); }
    },

    chapeuArqueologo: {
      label: 'Chapéu de exploração', slot: 'cabeca', owner: 'echo', lab: true, top: 25, springs: [],
      // Preso na base dos chapéus (acompanha um pouco o rosto); desenhado nas coordenadas do robô
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        VidaTI.drawChapeuArqueologo(x);
        x.restore();
      }
    },
    coleteArqueologo: {
      label: 'Colete de arqueólogo', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) { VidaTI.drawColeteArqueologo(x); }
    },

    oculosPsicologo: {
      label: 'Óculos de leitura', slot: 'rosto', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) { VidaTI.drawOculosPsicologo(x); }
    },
    cardigaPsicologo: {
      label: 'Cardigã de psicólogo', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) { VidaTI.drawCardigaPsicologo(x); }
    },

    chapeuSherlock: {
      label: 'Chapéu de Sherlock Holmes', slot: 'cabeca', owner: 'echo', lab: true, top: 22, springs: [],
      // Preso na base dos chapéus (acompanha um pouco o rosto); desenhado nas coordenadas do robô
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        VidaTI.drawChapeuSherlock(x);
        x.restore();
      }
    },
    sobretudoSherlock: {
      label: 'Sobretudo e capa de Sherlock', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) { VidaTI.drawSobretudoSherlock(x); }
    },

    capuzHacker: {
      label: 'Capuz hacker', slot: 'cabeca', owner: 'echo', lab: true, top: 34, springs: [],
      back(x) { VidaTI.drawCapuzHackerBack(x); },
      // Preso na base dos chapéus (acompanha um pouco o rosto); desenhado nas coordenadas do robô
      draw(x) {
        x.save();
        x.translate(-HAT_BASE.x, -HAT_BASE.y);
        VidaTI.drawCapuzHacker(x);
        x.restore();
      }
    },
    moletomHacker: {
      label: 'Moletom hacker', slot: 'pescoco', owner: 'echo', lab: true, top: 0, springs: [],
      draw(x) { VidaTI.drawMoletomHacker(x); }
    }
  });

  Roupas.SETS.esqueleto = {
    label: 'Fantasia de esqueleto', owner: 'echo',
    items: ['sorrisoCosturado', 'ternoEsqueleto']
  };

  Roupas.SETS.kratos = {
    label: 'Fantasia de Kratos', owner: 'echo',
    items: ['guerraEspartana', 'armaduraKratos']
  };

  Roupas.SETS.tyrael = {
    label: 'Fantasia de Tyrael', owner: 'echo',
    items: ['capuzTyrael', 'rostoSombras', 'armaduraTyrael']
  };

  Roupas.SETS.darthVader = {
    label: 'Fantasia de Darth Vader', owner: 'echo',
    items: ['capaceteVader', 'mascaraVader', 'armaduraVader']
  };

  Roupas.SETS.ti = {
    label: 'Fantasia de TI', owner: 'echo',
    items: ['headsetTI', 'oculosProgramador', 'moletomNerd']
  };

  // Em teste (lab): só na página de testes até a aprovação para o Echo
  Roupas.SETS.yusuke = {
    label: 'Fantasia de Yusuke', owner: 'echo', lab: true,
    items: ['cabeloYusuke', 'uniformeYusuke']
  };

  Roupas.SETS.toguro = {
    label: 'Fantasia de Toguro', owner: 'echo', lab: true,
    items: ['cabeloToguro', 'oculosToguro', 'paletoToguro']
  };

  Roupas.SETS.medico = {
    label: 'Fantasia de médico', owner: 'echo', lab: true,
    items: ['espelhoMedico', 'jalecoMedico']
  };

  Roupas.SETS.mago = {
    label: 'Fantasia de mago', owner: 'echo', lab: true,
    items: ['chapeuMago', 'tunicaMago']
  };

  Roupas.SETS.mecanico = {
    label: 'Fantasia de mecânico', owner: 'echo', lab: true,
    items: ['boneMecanico', 'macacaoMecanico']
  };

  Roupas.SETS.adivinho = {
    label: 'Fantasia de adivinho', owner: 'echo', lab: true,
    items: ['turbanteAdivinho', 'trajeAdivinho']
  };

  Roupas.SETS.bombeiro = {
    label: 'Fantasia de bombeiro', owner: 'echo', lab: true,
    items: ['capaceteBombeiro', 'jaquetaBombeiro']
  };

  Roupas.SETS.arqueologo = {
    label: 'Fantasia de arqueólogo', owner: 'echo', lab: true,
    items: ['chapeuArqueologo', 'coleteArqueologo']
  };

  Roupas.SETS.psicologo = {
    label: 'Fantasia de psicólogo', owner: 'echo', lab: true,
    items: ['oculosPsicologo', 'cardigaPsicologo']
  };

  Roupas.SETS.detetive = {
    label: 'Fantasia de detetive', owner: 'echo', lab: true,
    items: ['chapeuSherlock', 'sobretudoSherlock']
  };

  Roupas.SETS.hacker = {
    label: 'Fantasia de hacker', owner: 'echo', lab: true,
    items: ['capuzHacker', 'moletomHacker']
  };
})(typeof window !== 'undefined' ? window : globalThis);
