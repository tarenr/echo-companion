const { test } = require('node:test');
const assert = require('node:assert/strict');
const { wantsPage, renderPinPage } = require('../src/pinPage');

const req = (overrides = {}) => ({ method: 'GET', path: '/robo.html', headers: {}, ...overrides });

test('reconhece a abertura de uma página, e não scripts, estilos ou API', () => {
  assert.equal(wantsPage(req({ headers: { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' } })), true);
  assert.equal(wantsPage(req({ headers: { 'sec-fetch-dest': 'document', accept: '*/*' } })), true);
  assert.equal(wantsPage(req({ path: '/robo.js', headers: { 'sec-fetch-dest': 'script', accept: '*/*' } })), false);
  assert.equal(wantsPage(req({ path: '/robo.css', headers: { 'sec-fetch-dest': 'style', accept: 'text/css,*/*;q=0.1' } })), false);
  assert.equal(wantsPage(req({ path: '/robo.js', headers: { accept: '*/*' } })), false, 'sem cabeçalhos de navegação');
  assert.equal(wantsPage(req({ path: '/api/events', headers: { accept: 'text/html' } })), false, 'API continua com o erro em JSON');
  assert.equal(wantsPage(req({ method: 'POST', headers: { accept: 'text/html' } })), false);
});

test('tela de PIN: envia para /api/auth/verify, recarrega e não carrega nada de fora', () => {
  const html = renderPinPage();
  assert.match(html, /fetch\('\/api\/auth\/verify'/);
  assert.match(html, /credentials: 'same-origin'/);
  assert.match(html, /location\.reload\(\)/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /https?:\/\//, 'sem endereços de fora');
  assert.doesNotMatch(html, /<link|<script src=|<img/, 'tudo embutido');
  assert.match(html, /<p class="erro" id="erro" role="alert"><\/p>/, 'sem aviso de bloqueio quando não está bloqueado');
});

test('tela de PIN avisa o bloqueio por tentativas, com os minutos restantes', () => {
  assert.match(renderPinPage({ blocked: true, retryMinutes: 3.2 }), /Muitas tentativas de PIN\. Tente de novo em 4 min\./);
});
