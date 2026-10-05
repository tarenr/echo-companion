const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Executa o fechamento real do frontend sem conta Google, rede ou temporização real.
function cardTimer({ confirmation = null, stateMode = 'full', waze = false } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const start = source.indexOf('    infoCardTimeout = setTimeout(');
  const end = source.indexOf('\n  async function processAndRespond', start);
  let close;
  const context = vm.createContext({
    infoCardTimeout: null, infoCardCloser: null, duration: 20000,
    calendarActions: { hidden: false }, calendarConfirmation: confirmation,
    currentState: { mode: stateMode }, wazeLink: { hidden: !waze },
    echoWrapper: { className: 'echo-wrapper mode-info', classList: { contains: () => true } },
    infoPanel: { dataset: { card: 'open' }, classList: { remove: () => { context.closed = true; } } },
    panelExtraItems: null, mochi: { look: {} },
    setTimeout: callback => { close = callback; }
  });
  vm.runInContext(source.slice(start, end).trim().replace(/\}\s*$/, ''), context);
  return { context, close };
}

test('consulta da Agenda fecha controles e card ao terminar o tempo de leitura', () => {
  const { context, close } = cardTimer();
  close();
  assert.equal(context.calendarActions.hidden, true);
  assert.equal(context.closed, true);
  assert.equal(context.echoWrapper.className, 'echo-wrapper mode-full');
});

test('proposta da Agenda mantém o card e a confirmação disponíveis', () => {
  const { context, close } = cardTimer({ confirmation: 'draft-id' });
  close();
  assert.equal(context.calendarActions.hidden, false);
  assert.equal(context.closed, undefined);
  assert.equal(context.calendarConfirmation, 'draft-id');
});

test('encerrar consulta da Agenda não fecha uma aprovação ou ação Waze pendente', () => {
  for (const options of [{ stateMode: 'info' }, { waze: true }]) {
    const { context, close } = cardTimer(options);
    close();
    assert.equal(context.calendarActions.hidden, true);
    assert.equal(context.closed, undefined);
  }
});
