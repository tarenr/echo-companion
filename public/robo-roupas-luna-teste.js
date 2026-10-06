// Robô // peças da Luna só na página de testes (/robo-luna.html): o visual é aprovado aqui antes de ir para a Luna.
// Carregado depois de robo-roupas-luna.js; acrescenta as peças ao mesmo guarda-roupa. A Luna de verdade (luna.html) e
// o Echo não carregam este arquivo.
// Coordenadas: as do cabelo ruivo (presas ao robô: origem na base do corpo, cabeça centrada em (0, -151), 91 de meia
// largura e 65 de meia altura; o alto da cabeça fica em y = -216 e a base em y = -86).

(function (root) {
  'use strict';

  const Roupas = root.RoboRoupas;
  if (!Roupas || !Roupas.longHair) return;

  // Preto com brilho azulado, no mesmo corte do ruivo
  const PRETO = {
    top: '#2f3542', bottom: '#0b0d12', line: '#05060a',
    strandsBack: 'rgba(110, 130, 175, 0.45)', strandsFront: 'rgba(110, 130, 175, 0.5)', shine: 'rgba(170, 195, 255, 0.45)'
  };

  // Castanho dos cachos
  const CASTANHO = { light: '#b07a45', mid: '#7a4a24', dark: '#4a2c14', line: '#3a210e', spiral: 'rgba(235, 190, 140, 0.55)' };

  // Um cacho: bolinha com degradê (mais claro no alto) e uma volta de espiral
  function curl(x, cx, cy, r) {
    const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r);
    g.addColorStop(0, CASTANHO.light);
    g.addColorStop(0.6, CASTANHO.mid);
    g.addColorStop(1, CASTANHO.dark);
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fillStyle = g;
    x.fill();
    x.strokeStyle = CASTANHO.line;
    x.lineWidth = 1.2;
    x.stroke();
    x.strokeStyle = CASTANHO.spiral;
    x.lineWidth = 1.3;
    x.beginPath();
    x.arc(cx, cy, r * 0.55, Math.PI * 0.9, Math.PI * 2.3);
    x.stroke();
  }

  // Cachos de um lado (x positivo), espelhados para o outro; [x, y, raio]
  // Tamanhos variados, para os cachos não parecerem bolinhas iguais
  const BACK_CURLS = [
    [0, -230, 19], [31, -229, 18], [59, -217, 20], [83, -197, 17], [99, -172, 19],
    [107, -144, 16], [109, -116, 18], [105, -89, 15], [97, -66, 17], [85, -47, 14]
  ];
  // Franja de cachos só no alto da cabeça (para antes do visor, que começa em y = -174)
  const FRONT_CURLS = [
    [0, -214, 16], [22, -213, 14], [44, -207, 16], [64, -196, 13], [80, -182, 14], [90, -163, 11]
  ];

  Object.assign(Roupas.ITEMS, {
    cabeloPreto: {
      label: 'Cabelo preto', slot: 'cabeca', owner: 'luna', anchor: 'robo', top: 4,
      springs: [[45, 4, -1], [50, 4, 1]],
      ...Roupas.longHair(PRETO)
    },
    cabeloCacheado: {
      label: 'Cabelo cacheado castanho', slot: 'cabeca', owner: 'luna', anchor: 'robo', top: 34,   // cacho mais alto: 33 px acima da cabeça
      springs: [[40, 3.5, -1], [46, 3.5, 1]],
      // Parte de trás: volume de cachos em volta da cabeça até os ombros; os de baixo balançam
      back(x, t, a) {
        // Fundo escuro entre os cachos, para não aparecer buraco atrás da cabeça
        x.beginPath();
        x.ellipse(0, -150, 100, 84, 0, 0, Math.PI * 2);
        x.fillStyle = CASTANHO.dark;
        x.fill();
        for (const sd of [-1, 1]) {
          const sw = (sd < 0 ? a[0] : a[1]) * 7;
          x.beginPath();
          x.ellipse(sd * 90 + sw * 0.5, -86, 24, 46, sd * -0.12, 0, Math.PI * 2);
          x.fillStyle = CASTANHO.dark;
          x.fill();
          BACK_CURLS.forEach(([cx, cy, r], i) => {
            if (cx === 0 && sd < 0) return;   // o do meio só uma vez
            const swing = i >= 6 ? sw * (i - 5) / 4 : 0;
            curl(x, sd * cx + swing, cy, r);
          });
        }
      },
      // Frente: franja de cachos no alto da cabeça e cachos descendo pelos lados do rosto
      draw(x, t, a) {
        for (const sd of [-1, 1]) {
          const sw = (sd < 0 ? a[0] : a[1]) * 3;
          FRONT_CURLS.forEach(([cx, cy, r], i) => {
            if (cx === 0 && sd < 0) return;
            curl(x, sd * cx + (i >= 5 ? sw : 0), cy, r);
          });
        }
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
