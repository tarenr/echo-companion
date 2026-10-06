const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

class LocationStore {
  constructor({ key = process.env.LOCATION_ENCRYPTION_KEY, file = path.join(__dirname, '../data/location/secure.json') } = {}) {
    this.key = Buffer.from(key || '', 'base64'); this.file = file;
  }
  get configured() { return this.key.length === 32; }
  read() {
    if (!this.configured) throw new Error('Localização não configurada no servidor.');
    if (!fs.existsSync(this.file)) return {};
    try {
      const e = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (e.version !== 1) throw new Error();
      const d = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(e.iv, 'base64'));
      d.setAAD(Buffer.from('echo-location-v1')); d.setAuthTag(Buffer.from(e.tag, 'base64'));
      return JSON.parse(Buffer.concat([d.update(Buffer.from(e.data, 'base64')), d.final()]).toString('utf8'));
    } catch (_) { throw new Error('Não foi possível abrir a localização. Preserve o arquivo e a chave.'); }
  }
  write(value) {
    if (!this.configured) throw new Error('Localização não configurada no servidor.');
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    c.setAAD(Buffer.from('echo-location-v1'));
    const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }), { mode: 0o600 });
    fs.renameSync(this.file + '.tmp', this.file);
  }
}
module.exports = { LocationStore };
