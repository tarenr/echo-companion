// Robô // peças exclusivas da Luna: a fantasia de boneca de pano (sem braços)
// Carregado depois de robo-roupas.js pela Luna e pela página de testes da Luna (/robo-luna.html); o Echo não carrega.
// Desenho próprio no estilo de boneca de pano de Halloween (cabelo ruivo comprido, costuras no rosto e vestido de
// retalhos), feito do zero, sem copiar personagem.
// Coordenadas: as de robo-roupas.js. O cabelo é preso ao robô (anchor 'robo'): origem na base do corpo, com a
// cabeça centrada em (0, -151), 91 de meia largura e 65 de meia altura.

(function (root) {
  'use strict';

  const Roupas = root.RoboRoupas;
  if (!Roupas) return;

  const { BODY, clipBodyWithoutScreen, bodyOutline, stitchedCurve } = Roupas.shape;
  const THREAD = '#2b1d2e';
  const LUNA_INK = '#2e1065';

  function gradient(x, c, top, bottom) {
    const g = x.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, c.top);
    g.addColorStop(1, c.bottom);
    return g;
  }

  // Cabelo comprido e liso com risca no meio (o corte do ruivo), nas cores dadas:
  // { top, bottom } do degradê, line (contorno e risca), strandsBack e strandsFront (fios), shine (brilho)
  function longHair(c) {
    return {
      // Parte de trás: comprida, por trás da cabeça e do corpo, com as pontas balançando
      back(x, t, a) {
        const sl = a[0] * 8, sr = a[1] * 8;
        x.beginPath();
        x.moveTo(0, -226);
        x.bezierCurveTo(66, -230, 104, -205, 104, -150);
        x.bezierCurveTo(104, -100, 106, -50, 112 + sr, -18);
        x.quadraticCurveTo(106 + sr, -6, 98 + sr, -16);
        x.quadraticCurveTo(92 + sr, -4, 84 + sr, -16);
        x.quadraticCurveTo(78 + sr * 0.5, -6, 70, -18);
        x.quadraticCurveTo(62 + sr * 0.3, -6, 52, -18);
        // Borda de dentro sobe por dentro do corpo até baixo da cabeça: o cabelo encosta no corpo e o resto
        // fica escondido atrás dele
        x.lineTo(36, -22);
        x.lineTo(42, -92);
        x.lineTo(-42, -92);
        x.lineTo(-36, -22);
        x.lineTo(-52, -18);
        x.quadraticCurveTo(-62 + sl * 0.3, -6, -70, -18);
        x.quadraticCurveTo(-78 + sl * 0.5, -6, -84 + sl, -16);
        x.quadraticCurveTo(-92 + sl, -4, -98 + sl, -16);
        x.quadraticCurveTo(-106 + sl, -6, -112 + sl, -18);
        x.bezierCurveTo(-106, -50, -104, -100, -104, -150);
        x.bezierCurveTo(-104, -205, -66, -230, 0, -226);
        x.closePath();
        x.fillStyle = gradient(x, c, -226, -10);
        x.fill();
        x.strokeStyle = c.line;
        x.lineWidth = 1.5;
        x.stroke();
        // Fios
        x.strokeStyle = c.strandsBack;
        x.lineWidth = 1.4;
        for (const sd of [-1, 1]) {
          const sw = sd < 0 ? sl : sr;
          for (const [x0, x1] of [[96, 104], [88, 94]]) {
            x.beginPath();
            x.moveTo(sd * x0, -170);
            x.quadraticCurveTo(sd * (x0 + 6), -100, sd * x1 + sw, -24);
            x.stroke();
          }
        }
      },
      // Frente: cobre o alto da cabeça com risca no meio e desce pelos lados do rosto
      draw(x, t, a) {
        for (const sd of [-1, 1]) {
          const sw = (sd < 0 ? a[0] : a[1]) * 4;
          x.save();
          x.scale(sd, 1);
          x.beginPath();
          x.moveTo(0, -220);
          x.bezierCurveTo(48, -226, 92, -214, 96, -178);
          x.bezierCurveTo(99, -150, 100, -118, 97 + sw, -92);
          x.lineTo(86 + sw, -96);
          x.bezierCurveTo(86, -130, 84, -160, 76, -180);
          x.bezierCurveTo(60, -198, 30, -204, 2, -201);
          x.closePath();
          x.fillStyle = gradient(x, c, -224, -92);
          x.fill();
          x.strokeStyle = c.line;
          x.lineWidth = 1.4;
          x.stroke();
          // Fios do alto da cabeça e da mecha
          x.strokeStyle = c.strandsFront;
          x.lineWidth = 1.2;
          x.beginPath();
          x.moveTo(8, -214);
          x.quadraticCurveTo(50, -214, 82, -190);
          x.moveTo(14, -207);
          x.quadraticCurveTo(52, -206, 78, -184);
          x.moveTo(92, -170);
          x.quadraticCurveTo(95, -130, 92 + sw, -98);
          x.stroke();
          // Brilho
          x.strokeStyle = c.shine;
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(24, -216);
          x.quadraticCurveTo(50, -219, 68, -210);
          x.stroke();
          x.restore();
        }
        // Risca no meio
        x.strokeStyle = c.line;
        x.lineWidth = 1.6;
        x.beginPath();
        x.moveTo(0, -221);
        x.lineTo(0, -202);
        x.stroke();
      }
    };
  }

  const RUIVO = {
    top: '#ef4444', bottom: '#991b1b', line: '#7f1d1d',
    strandsBack: 'rgba(127, 29, 29, 0.75)', strandsFront: 'rgba(127, 29, 29, 0.7)', shine: 'rgba(254, 202, 202, 0.45)'
  };

  // Espiral dos retalhos rosa
  function swirl(x, cx, cy, turns) {
    x.beginPath();
    for (let th = 0; th <= turns * Math.PI * 2; th += 0.25) {
      const r = 0.8 + th * 1.05;
      const px = cx + Math.cos(th) * r, py = cy + Math.sin(th) * r;
      th ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }

  // Retalhos do vestido: [cor, pontos]; o corpo vai de y = -78 (ombros) a 0 (base)
  const PATCHES = [
    ['#2fa4a0', [[-56, -84], [-6, -84], [-18, -46], [-56, -40]]],              // verde-água
    ['#f2c14e', [[-56, -40], [-18, -46], [-6, -22], [-26, 4], [-56, 4]]],      // amarelo
    ['#f19bb8', [[6, -84], [56, -84], [56, -34], [16, -42]]],                  // rosa com espirais
    ['#f7c6d6', [[-26, 4], [-6, -22], [14, -30], [20, 4]]],                    // rosa claro
    ['#4b4f58', [[14, -30], [16, -42], [56, -34], [56, 4], [20, 4]]]           // cinza
  ];
  // Costuras entre os retalhos
  const SEAMS = [
    [[-56, -40], [-18, -46]], [[-18, -46], [-6, -84]], [[-18, -46], [-6, -22]], [[-6, -22], [-26, 4]],
    [[-6, -22], [14, -30]], [[14, -30], [20, 4]], [[14, -30], [16, -42]], [[16, -42], [56, -34]], [[16, -42], [6, -84]]
  ];

  Object.assign(Roupas.ITEMS, {
    cabeloRuivo: {
      label: 'Cabelo ruivo', slot: 'cabeca', owner: 'luna', anchor: 'robo', top: 4,
      springs: [[45, 4, -1], [50, 4, 1]],
      ...longHair(RUIVO)
    },
    rostoBoneca: {
      label: 'Rosto de boneca', slot: 'rosto', owner: 'luna', top: 0, springs: [],
      draw(x) {
        x.lineCap = 'round';
        // Cílios no canto de fora, em cima de cada olho (olhos em ±35,5)
        x.strokeStyle = '#fce7f3';
        x.lineWidth = 1.8;
        for (const sd of [-1, 1]) {
          const ex = sd * 35.5;
          x.beginPath();
          x.moveTo(ex + sd * 3, -12);
          x.lineTo(ex + sd * 9, -19);
          x.moveTo(ex + sd * 6, -9);
          x.lineTo(ex + sd * 13, -14);
          x.moveTo(ex - sd * 1, -13);
          x.lineTo(ex + sd * 2, -21);
          x.stroke();
        }
        // Sorriso costurado fino, no lugar da boca (0, 38)
        x.strokeStyle = LUNA_INK;
        x.lineWidth = 2;
        stitchedCurve(x, [-24, 33], [0, 43], [24, 33], 7, 3.5);
        // Costuras nas bochechas, descendo para os lados
        x.lineWidth = 1.8;
        for (const sd of [-1, 1]) stitchedCurve(x, [sd * 56, 26], [sd * 66, 36], [sd * 78, 50], 4, 4);
      }
    },
    vestidoRetalhos: {
      label: 'Vestido de retalhos', slot: 'pescoco', owner: 'luna', top: 0, springs: [],
      draw(x) {
        x.save();
        clipBodyWithoutScreen(x);
        x.fillStyle = '#d8c4f0';
        x.fillRect(-BODY.hw - 2, -2 * BODY.hh - 2, 2 * BODY.hw + 4, 2 * BODY.hh + 4);
        for (const [color, pts] of PATCHES) {
          x.beginPath();
          pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
          x.closePath();
          x.fillStyle = color;
          x.fill();
        }
        // Espirais no retalho rosa
        x.strokeStyle = '#b4547a';
        x.lineWidth = 1.3;
        swirl(x, 34, -70, 2.2);
        swirl(x, 44, -50, 1.8);
        // Costuras
        x.strokeStyle = THREAD;
        x.lineWidth = 1.4;
        for (const [p0, p1] of SEAMS) {
          const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
          const count = Math.max(2, Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 7));
          stitchedCurve(x, p0, mid, p1, count, 3);
        }
        // Gola em V (aparece acima da tela)
        x.beginPath();
        x.moveTo(-20, -2 * BODY.hh);
        x.lineTo(20, -2 * BODY.hh);
        x.lineTo(0, -62);
        x.closePath();
        x.fillStyle = '#efe6fb';
        x.fill();
        x.strokeStyle = THREAD;
        x.lineWidth = 1.6;
        x.stroke();
        // Sombra nas laterais, para o corpo continuar redondo
        const g = x.createLinearGradient(-BODY.hw, 0, BODY.hw, 0);
        g.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
        g.addColorStop(0.3, 'rgba(0, 0, 0, 0)');
        g.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
        x.fillStyle = g;
        x.fillRect(-BODY.hw - 2, -2 * BODY.hh - 2, 2 * BODY.hw + 4, 2 * BODY.hh + 4);
        x.restore();
        x.beginPath();
        bodyOutline(x);
        x.strokeStyle = THREAD;
        x.lineWidth = 1.6;
        x.stroke();
      }
    }
  });

  // Corte comprido disponível para outros cabelos da Luna (robo-roupas-luna-teste.js)
  Roupas.longHair = longHair;

  // Tirar a fantasia devolve o laço comum (o visual da Luna sem fantasia)
  Roupas.SETS.bonecaDePano = {
    label: 'Fantasia de boneca de pano', owner: 'luna',
    items: ['cabeloRuivo', 'rostoBoneca', 'vestidoRetalhos'],
    afterRemove: { cabeca: 'laco' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
