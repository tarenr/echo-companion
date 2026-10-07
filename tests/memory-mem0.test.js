const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createMemory, isPersonalMemoryQuery } = require('../src/memoryMem0');
test('memória pessoal não é confundida com consulta de RAM', () => {
  assert.equal(isPersonalMemoryQuery('Qual o valor do meu teste de memória?'),true);
  assert.equal(isPersonalMemoryQuery('Como está sua memória de conversa?'),true);
  for(const question of ['Qual minha memória RAM?', 'Qual a memória do computador?', 'Qual a cota do Codex?']) assert.equal(isPersonalMemoryQuery(question),false);
});

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-memory-test-'));
  const vectors = new Map();
  let sequence = 0;
  const sdk = {
    async add(text, config) { const id = String(++sequence); vectors.set(id, {text,metadata:config.metadata}); return {results:[{id}]}; },
    async delete(id) { vectors.delete(id); },
    async search() { return {results:[...vectors.values()].map(v=>({metadata:v.metadata}))}; }
  };
  return {directory,sdk,vectors};
}

test('fatos persistem, corrigem e esquecem sem depender de embeddings', async () => {
  const {directory} = fixture();
  let memory = createMemory({directory});
  assert.equal(memory.command('lembre bebida preferida: café').ok,true);
  await memory.close();
  memory = createMemory({directory});
  assert.match(memory.command('o que você lembra sobre mim?').mensagem,/café/);
  assert.equal(memory.command('corrija bebida preferida para chá').ok,true);
  assert.equal(memory.list()[0].content,'chá');
  memory.recordTurn('Eu gosto de chá','Você gosta de chá');
  assert.equal(memory.command('esqueça bebida preferida').ok,true);
  assert.equal(memory.list().length,0);
  assert.deepEqual((await memory.context('bebida preferida')).history,[]);
  await memory.close();
  memory = createMemory({directory});
  assert.deepEqual((await memory.context('bebida')).facts,[]);
  assert.equal(memory.command('esqueça bebida preferida').ok,false);
  await memory.close();
});

test('índice usa fatos explícitos e versões, sem resultados obsoletos nem conteúdo do assistente', async () => {
  const {directory,sdk,vectors} = fixture();
  const memory = createMemory({directory,sdk});
  memory.remember('bebida','café');
  await memory.sync();
  const first = [...vectors.values()][0];
  assert.equal(first.metadata.revision,1);
  memory.recordTurn('Bom dia','Seu nome é Inventado');
  assert.equal(vectors.size,1);
  memory.remember('bebida','chá');
  await memory.sync();
  assert.equal(vectors.size,1);
  assert.deepEqual((await memory.context('bebida')).facts,[{topic:'bebida',content:'chá'}]);
  const savedContext = await memory.context('bebida');
  assert.equal(memory.isCurrent(savedContext),true);
  sdk.search = async () => ({results:[{metadata:first.metadata}]});
  assert.deepEqual((await memory.context('assunto sem relação')).facts,[]);
  memory.forget('bebida');
  assert.equal(memory.isCurrent(savedContext),false);
  await memory.sync();
  assert.equal(vectors.size,0);
  await memory.close();
});

test('falha e lentidão na IA mantêm fatos salvos e recuperação local limitada', async () => {
  const {directory,sdk} = fixture();
  sdk.add = async () => { throw new Error('offline'); };
  sdk.search = () => new Promise(()=>{});
  const memory = createMemory({directory,sdk,retrievalMs:10});
  memory.remember('bebida','café');
  await memory.sync();
  assert.equal(memory.status().pending,1);
  const start = Date.now();
  assert.equal((await memory.context('Qual minha bebida?')).facts[0].content,'café');
  assert.ok(Date.now()-start<500);
  await memory.close();
});

test('resumo incremental não bloqueia conversa e é invalidado pelo esquecimento', async () => {
  const {directory,sdk} = fixture();
  const memory = createMemory({directory,sdk,summarize:async ()=> 'Falamos de café.'});
  memory.remember('bebida','café');
  await memory.sync();
  for(let i=0;i<12;i++) memory.recordTurn(`Conversa ${i}`,'Café');
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual((await memory.context('assunto')).summaries,['Falamos de café.']);
  memory.forget('bebida');
  assert.deepEqual((await memory.context('café')).summaries,[]);
  await memory.close();
});

test('mudança durante recuperação não reinjeta um fato esquecido', async () => {
  const {directory,sdk} = fixture();
  let release;
  sdk.search = () => new Promise(resolve=> { release=resolve; });
  const memory = createMemory({directory,sdk});
  memory.remember('bebida','café');
  await memory.sync();
  const pending = memory.context('bebida');
  memory.forget('bebida');
  release({results:[{metadata:{topic:'bebida',revision:1}}]});
  assert.deepEqual(await pending,{history:[],facts:[],summaries:[]});
  await memory.close();
});

test('sessões persistem e separam períodos de inatividade; contexto tem limite', async () => {
  const {directory} = fixture();
  let time = Date.now();
  const memory = createMemory({directory,now:()=>time});
  for(let i=0;i<8;i++) memory.recordTurn(`Pergunta ${i}`,'x'.repeat(2000));
  const context = await memory.context('última pergunta');
  assert.equal(context.history.length,8);
  assert.ok(context.history.every(m=>m.content.length<=1000));
  time+=31*60000;
  memory.recordTurn('Outra sessão','Olá');
  const db = new Database(path.join(directory,'echo_mem0_state.sqlite'),{readonly:true});
  assert.equal(db.prepare('SELECT count(*) AS n FROM memory_sessions').get().n,2);
  db.close();
  await memory.close();
});

test('comandos ambíguos e segredos não geram fatos', async () => {
  const {directory} = fixture();
  const memory = createMemory({directory});
  assert.equal(memory.command('Qual a cota do Codex?'),null);
  assert.equal(memory.command('Lembre que gosto de café').ok,false);
  assert.throws(()=>memory.remember('senha','valor confidencial'),/Não guardo/);
  assert.equal(memory.list().length,0);
  await memory.close();
});

test('ferramenta da IA não salva fatos sem autorização explícita do pedido', async () => {
  const tools = require('../src/tools');
  const result = await tools.executeTool('gravar_preferencia_usuario', {chave:'inventado',valor:'não ensinado'});
  assert.equal(result.ok,false);
  assert.match(result.mensagem,/explicitamente/);
});

test('Mem0 real persiste vetores em SQLite entre instâncias sem chamadas de IA', async () => {
  process.env.MEM0_TELEMETRY='false';
  const { Memory } = require('mem0ai/oss');
  const {directory} = fixture();
  function client() {
    const m = new Memory({disableHistory:true,llm:{provider:'gemini',config:{apiKey:'test'}},embedder:{provider:'gemini',config:{apiKey:'test'}},vectorStore:{provider:'memory',config:{dimension:3,dbPath:path.join(directory,'vectors.sqlite')}}});
    for(const method of ['_captureEvent','_initializeTelemetry','_displayFirstRunNotice','_displayScaleThresholdNotice','_displayDecayUsageNotice','_displayPerformanceSlowQueryNotice']) m[method]=async()=>{};
    m.embedder.embed=async()=>[1,0,0];
    return m;
  }
  let m=client();
  const added=await m.add('bebida: café',{userId:'echo-test',infer:false,metadata:{topic:'bebida',revision:1}});
  m.vectorStore.db.close();
  m=client();
  const found=await m.search('bebida',{filters:{user_id:'echo-test'},topK:5});
  assert.equal(found.results[0].memory,'bebida: café');
  await m.delete(added.results[0].id);
  assert.equal((await m.getAll({filters:{user_id:'echo-test'}})).results.length,0);
  m.vectorStore.db.close();
});
