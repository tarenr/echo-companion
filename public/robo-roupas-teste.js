// Robô // peças só da página de testes (/robo.html): o visual é aprovado aqui antes de ir para o Echo.
// Carregado depois de robo-roupas.js; acrescenta as peças ao mesmo guarda-roupa. O Echo não carrega este arquivo.
// Fantasia de esqueleto (sem braços): desenho próprio no estilo de fantasia de Halloween (sorriso costurado,
// terno listrado e gravata de morcego), feito do zero, sem copiar personagem.
// Coordenadas: as mesmas de robo-roupas.js (rosto: centro do visor; pescoço: base do corpo, y negativo para cima).

(function (root) {
  'use strict';

  const Roupas = root.RoboRoupas;
  if (!Roupas) return;

  // Mesmas medidas do corpo em robo-motor.js (BODY); um teste confere
  const BODY = { cy: -39, hw: 50, bottomHw: 40, hh: 39, r: 24 };
  // Tela do peito (rr(-30, -64, 60, 36, 10) no motor) com 1 px de folga para a borda colorida
  const SCREEN = { x: -31, y: -65, w: 62, h: 38, r: 11 };
  const INK = '#0b1220';
  const SUIT = '#121417';
  const PIN = 'rgba(226, 232, 240, 0.9)';
  const SHIRT = '#f1f5f9';

  // Contorno do corpo (trapézio arredondado), sem beginPath: entra num caminho composto
  function bodyOutline(x) {
    const { cy, hw, bottomHw, hh, r } = BODY, top = cy - hh, bottom = cy + hh;
    x.moveTo(-hw + r, top);
    x.lineTo(hw - r, top);
    x.quadraticCurveTo(hw, top, hw, top + r);
    x.lineTo(bottomHw, bottom - r);
    x.quadraticCurveTo(bottomHw, bottom, bottomHw - r, bottom);
    x.lineTo(-bottomHw + r, bottom);
    x.quadraticCurveTo(-bottomHw, bottom, -bottomHw, bottom - r);
    x.lineTo(-hw, top + r);
    x.quadraticCurveTo(-hw, top, -hw + r, top);
    x.closePath();
  }

  // Retângulo arredondado sem beginPath (o buraco da tela no caminho composto)
  function roundRectOutline(x, { x: X, y: Y, w: W, h: H, r: R }) {
    x.moveTo(X + R, Y);
    x.arcTo(X + W, Y, X + W, Y + H, R);
    x.arcTo(X + W, Y + H, X, Y + H, R);
    x.arcTo(X, Y + H, X, Y, R);
    x.arcTo(X, Y, X + W, Y, R);
    x.closePath();
  }

  // Sorriso: curva entre as bochechas, passando pelo lugar da boca (0, 38)
  const SMILE = { from: [-44, 29], ctrl: [0, 47], to: [44, 29] };
  function smilePoint(t) {
    const u = 1 - t, { from: a, ctrl: c, to: b } = SMILE;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  }
  function smileNormal(t) {
    const { from: a, ctrl: c, to: b } = SMILE;
    const dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
    const dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  }

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

  Object.assign(Roupas.ITEMS, {
    sorrisoCosturado: {
      label: 'Sorriso costurado', slot: 'rosto', top: 0, springs: [],
      draw(x) {
        x.strokeStyle = INK;
        x.lineCap = 'round';
        x.lineWidth = 2.6;
        x.beginPath();
        x.moveTo(-49, 24);
        x.lineTo(...SMILE.from);
        x.quadraticCurveTo(...SMILE.ctrl, ...SMILE.to);
        x.lineTo(49, 24);
        x.stroke();
        // Pontos de costura cruzando a linha
        x.lineWidth = 2;
        for (let i = 0; i <= 10; i++) {
          const t = 0.04 + i * 0.092;
          const [px, py] = smilePoint(t), [nx, ny] = smileNormal(t);
          x.beginPath();
          x.moveTo(px - nx * 5, py - ny * 5);
          x.lineTo(px + nx * 5, py + ny * 5);
          x.stroke();
        }
      }
    },
    ternoEsqueleto: {
      label: 'Terno de esqueleto', slot: 'pescoco', top: 0, springs: [[90, 6, 0]],
      draw(x, t, a) {
        // Terno só no corpo, com abertura para a tela do peito
        x.save();
        x.beginPath();
        bodyOutline(x);
        roundRectOutline(x, SCREEN);
        x.clip('evenodd');
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
    }
  });

  Roupas.LAB_ITEMS = ['sorrisoCosturado', 'ternoEsqueleto'];
  Roupas.SUIT_BODY = BODY;
})(typeof window !== 'undefined' ? window : globalThis);
