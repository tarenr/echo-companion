// Robô // peças exclusivas do Echo: a fantasia de esqueleto (sem braços)
// Carregado depois de robo-roupas.js pelo Echo e pela página de testes do Echo (/robo.html); a Luna não carrega.
// Desenho próprio no estilo de fantasia de Halloween (sorriso costurado, terno listrado e gravata de morcego),
// feito do zero, sem copiar personagem.
// Coordenadas: as mesmas de robo-roupas.js (rosto: centro do visor; pescoço: base do corpo, y negativo para cima).

(function (root) {
  'use strict';

  const Roupas = root.RoboRoupas;
  if (!Roupas) return;

  const { BODY, clipBodyWithoutScreen, bodyOutline, stitchedCurve } = Roupas.shape;
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
    }
  });

  Roupas.SETS.esqueleto = {
    label: 'Fantasia de esqueleto', owner: 'echo',
    items: ['sorrisoCosturado', 'ternoEsqueleto']
  };
})(typeof window !== 'undefined' ? window : globalThis);
