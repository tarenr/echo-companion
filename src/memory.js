const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'echo_memory.sqlite');
let db = null;
let conversationalMemory = null;
function configureConversation(options) {
  conversationalMemory = require('./memoryMem0').createMemory(options);
}

function getDb() {
  if (!db) {
    db = new sqlite3.Database(dbPath);
  }
  return db;
}

function initMemory() {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.serialize(() => {
      database.run(`
        CREATE TABLE IF NOT EXISTS conversation_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS tool_executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tool_name TEXT NOT NULL,
          params TEXT,
          result_summary TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  });
}

function addMessage(role, content) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.run(
      'INSERT INTO conversation_history (role, content) VALUES (?, ?)',
      [role, content],
      function (err) {
        if (err) return reject(err);
        // Prune older messages keeping last 150
        database.run(
          'DELETE FROM conversation_history WHERE id NOT IN (SELECT id FROM conversation_history ORDER BY id DESC LIMIT 150)',
          () => resolve(this.lastID)
        );
      }
    );
  });
}

function getRecentHistory(limit = 10) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.all(
      'SELECT role, content, created_at FROM conversation_history ORDER BY id DESC LIMIT ?',
      [limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows ? rows.reverse() : []);
      }
    );
  });
}

function setPreference(key, value) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.run(
      'INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
      [key, typeof value === 'object' ? JSON.stringify(value) : String(value)],
      function (err) {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

function getPreference(key) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.get('SELECT value FROM user_preferences WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
}

function getAllPreferences() {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.all('SELECT key, value FROM user_preferences ORDER BY key ASC', [], (err, rows) => {
      if (err) return reject(err);
      const prefs = {};
      if (rows) {
        for (const row of rows) {
          prefs[row.key] = row.value;
        }
      }
      resolve(prefs);
    });
  });
}

function logToolExecution(tool_name, params, summary) {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.run(
      'INSERT INTO tool_executions (tool_name, params, result_summary) VALUES (?, ?, ?)',
      [
        tool_name,
        typeof params === 'object' ? JSON.stringify(params) : String(params || ''),
        typeof summary === 'object' ? JSON.stringify(summary) : String(summary || '')
      ],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

module.exports = {
  configureConversation,
  isPersonalMemoryQuery: message => require('./memoryMem0').isPersonalMemoryQuery(message),
  handleMemoryCommand: message => conversationalMemory?.command(message) || null,
  rememberFact: (key, value) => {
    if (!conversationalMemory) throw new Error('Memória de conversa indisponível.');
    return conversationalMemory.remember(key, value);
  },
  listFacts: () => conversationalMemory?.list().map(f => ({ topico:f.key, conteudo:f.content })) || [],
  conversationContext: message => conversationalMemory?.context(message) || Promise.resolve({history:[],facts:[],summaries:[]}),
  isContextCurrent: context => !conversationalMemory || conversationalMemory.isCurrent(context),
  recordTurn: (message, reply) => conversationalMemory?.recordTurn(message, reply),
  initMemory,
  addMessage,
  getRecentHistory,
  setPreference,
  getPreference,
  getAllPreferences,
  logToolExecution
};
