const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_SERVER = 'https://cichnovabrno.papousek.eu';
const ADMIN_PATH = '/admin/index.html';

let data = null;

function file() {
  return path.join(app.getPath('userData'), 'config.json');
}

function load() {
  if (data) return data;
  try {
    data = JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch (e) {
    data = {};
  }
  return data;
}

function save(patch) {
  data = { ...load(), ...patch };
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('Config se nepodařilo uložit:', e.message);
  }
}

function normalizeServer(input) {
  let value = String(input || '').trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = 'https://' + value;
  let url;
  try {
    url = new URL(value);
  } catch (e) {
    return null;
  }
  const local = url.hostname === 'localhost' || /^127\./.test(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
  return url.origin;
}

function server() {
  return normalizeServer(load().server) || DEFAULT_SERVER;
}

function adminUrl() {
  return server() + ADMIN_PATH;
}

module.exports = { DEFAULT_SERVER, load, save, normalizeServer, server, adminUrl };
