const { app, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

let getWindow = () => null;
let manual = false;
let prompted = '';

function canInstall() {
  if (process.platform !== 'darwin') return true;
  return !!(pkg.cichnovaDesktop && pkg.cichnovaDesktop.macSigned === true);
}

function releasesUrl() {
  try {
    const yml = fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf8');
    const owner = /owner:\s*(\S+)/.exec(yml);
    const repo = /repo:\s*(\S+)/.exec(yml);
    if (owner && repo) return `https://github.com/${owner[1]}/${repo[1]}/releases/latest`;
  } catch (e) {
    log.warn('app-update.yml nenalezen');
  }
  return null;
}

function box(options) {
  const win = getWindow();
  return win && !win.isDestroyed() ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

async function offerManualDownload(info) {
  if (prompted === info.version && !manual) return;
  prompted = info.version;
  const url = releasesUrl();
  const buttons = url ? ['Otevřít stránku ke stažení', 'Později'] : ['OK'];
  const result = await box({
    type: 'info',
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    title: 'Je dostupná nová verze',
    message: `Je dostupná verze ${info.version}.`,
    detail: 'Na macOS se aplikace nainstaluje ručně: stáhněte nový soubor a přetáhněte aplikaci do složky Aplikace.'
  });
  if (url && result.response === 0) shell.openExternal(url);
}

function setup(windowGetter) {
  getWindow = windowGetter;
  autoUpdater.logger = log;
  autoUpdater.autoDownload = canInstall();
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('update-available', info => {
    log.info('Nová verze', info.version);
    if (!canInstall()) {
      offerManualDownload(info);
      manual = false;
      return;
    }
    if (manual) {
      box({
        type: 'info',
        buttons: ['OK'],
        title: 'Aktualizace',
        message: `Stahuji verzi ${info.version}.`,
        detail: 'Až bude hotovo, aplikace se zeptá, jestli se má restartovat.'
      });
      manual = false;
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (!manual) return;
    manual = false;
    box({ type: 'info', buttons: ['OK'], title: 'Aktualizace', message: 'Máte nejnovější verzi.', detail: `Verze ${app.getVersion()}` });
  });

  autoUpdater.on('update-downloaded', async info => {
    const result = await box({
      type: 'question',
      buttons: ['Restartovat a nainstalovat', 'Později'],
      defaultId: 0,
      cancelId: 1,
      title: 'Aktualizace je připravena',
      message: `Verze ${info.version} je stažená.`,
      detail: 'Když zvolíte Později, nainstaluje se při příštím zavření aplikace.'
    });
    if (result.response === 0) setImmediate(() => autoUpdater.quitAndInstall());
  });

  autoUpdater.on('error', err => {
    log.error('Aktualizace selhala:', err && err.message);
    if (!manual) return;
    manual = false;
    box({ type: 'warning', buttons: ['OK'], title: 'Aktualizace', message: 'Aktualizace se nepodařila zkontrolovat.', detail: String((err && err.message) || err).slice(0, 300) });
  });

  if (!app.isPackaged) return;
  setTimeout(check, 8000);
  setInterval(check, CHECK_EVERY_MS);
}

function check() {
  if (!app.isPackaged) return Promise.resolve();
  return autoUpdater.checkForUpdates().catch(err => log.warn('Kontrola aktualizací selhala:', err && err.message));
}

function checkManually() {
  if (!app.isPackaged) {
    return box({ type: 'info', buttons: ['OK'], title: 'Aktualizace', message: 'Ve vývojovém režimu se aktualizace nekontrolují.' });
  }
  manual = true;
  return check();
}

module.exports = { setup, checkManually };
