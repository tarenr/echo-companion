const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

class CalendarStore {
  constructor({ key, file = path.join(__dirname, '../data/calendar/secure.json') }) {
    this.key = Buffer.from(key || '', 'base64');
    if (this.key.length !== 32) throw new Error('Chave de criptografia da agenda não configurada.');
    this.file = file;
  }
  read() {
    if (!fs.existsSync(this.file)) return {};
    try {
      const envelope = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (envelope.version !== 1) throw new Error();
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(Buffer.from('echo-calendar-v1'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
    } catch (_) { throw new Error('Não foi possível abrir o armazenamento seguro da agenda. Preserve o arquivo e a chave.'); }
  }
  update(change) {
    const state = this.read();
    change(state);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from('echo-calendar-v1'));
    const data = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
    const envelope = { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = this.file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(envelope), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
}
module.exports = { CalendarStore };
