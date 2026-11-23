const { app, BrowserWindow, Menu, shell, dialog, ipcMain, session } = require('electron');
const path = require('path');
const log = require('electron-log');
const config = require('./config');
const updater = require('./updater');
const pkg = require('../package.json');

const PARTITION = 'persist:cichnova-admin';
const DEV = process.argv.includes('--dev');
const TITLE = 'Čichnova Screens – administrace';
const ICON = path.join(__dirname, 'icon.png');

let win = null;
let serverWin = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.setAppUserModelId('eu.papousek.cichnova.admin');
  app.whenReady().then(start);
  app.on('window-all-closed', () => app.quit());
  app.on('activate', () => {
    if (app.isReady() && !BrowserWindow.getAllWindows().length) createWindow();
  });
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', e => e.preventDefault());
  });
}

function isLocalSender(event) {
  try {
    return new URL(event.senderFrame.url).protocol === 'file:';
  } catch (e) {
    return false;
  }
}

function isInternal(url) {
  try {
    return new URL(url).origin === new URL(config.server()).origin;
  } catch (e) {
    return false;
  }
}

function isLocalFile(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'file:' && decodeURIComponent(u.pathname).replace(/^\/([A-Za-z]:)/, '$1').toLowerCase().startsWith(__dirname.replace(/\\/g, '/').toLowerCase());
  } catch (e) {
    return false;
  }
}

function openExternal(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') shell.openExternal(url);
  } catch (e) {
    log.warn('Neplatný odkaz', url);
  }
}

function secureSession() {
  const ses = session.fromPartition(PARTITION);
  const allowed = ['fullscreen', 'clipboard-sanitized-write'];
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.includes(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => allowed.includes(permission));
  return ses;
}

function loadAdmin() {
  if (!win || win.isDestroyed()) return;
  win.loadURL(config.adminUrl()).catch(err => log.warn('Načtení administrace selhalo:', err && err.message));
}

function showOffline(description) {
  if (!win || win.isDestroyed()) return;
  win.loadFile(path.join(__dirname, 'offline.html'), {
    query: { server: config.server(), error: description || '' }
  });
}

function createWindow() {
  const saved = config.load().window || {};
  win = new BrowserWindow({
    width: saved.width || 1360,
    height: saved.height || 860,
    x: saved.x,
    y: saved.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0b0b2b',
    title: TITLE,
    icon: ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: DEV
    }
  });
  if (saved.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  const wc = win.webContents;

  wc.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 760,
          autoHideMenuBar: true,
          icon: ICON,
          webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true }
        }
      };
    }
    openExternal(url);
    return { action: 'deny' };
  });

  wc.on('will-navigate', (event, url) => {
    if (isInternal(url) || isLocalFile(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  wc.on('did-fail-load', (_e, code, description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    log.warn('Načtení selhalo', code, description);
    showOffline(description);
  });

  wc.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Zůstat', 'Odejít bez uložení'],
      defaultId: 0,
      cancelId: 0,
      title: 'Neuložené změny',
      message: 'Máte neuložené změny.',
      detail: 'Opravdu chcete odejít bez uložení?'
    });
    if (choice === 1) event.preventDefault();
  });

  const remember = () => {
    if (!win || win.isDestroyed()) return;
    const maximized = win.isMaximized();
    const bounds = maximized ? (config.load().window || {}) : win.getBounds();
    config.save({ window: { ...bounds, maximized } });
  };
  win.on('close', remember);
  win.on('closed', () => {
    win = null;
  });

  loadAdmin();
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const template = [
    ...(mac ? [{ label: app.name, submenu: [{ role: 'about', label: 'O aplikaci' }, { type: 'separator' }, { role: 'hide', label: 'Skrýt' }, { role: 'hideOthers', label: 'Skrýt ostatní' }, { role: 'unhide', label: 'Zobrazit vše' }, { type: 'separator' }, { role: 'quit', label: 'Ukončit' }] }] : []),
    {
      label: 'Soubor',
      submenu: [
        { label: 'Obnovit stránku', accelerator: 'CmdOrCtrl+R', click: () => win && win.webContents.reload() },
        { label: 'Zpět na administraci', accelerator: 'CmdOrCtrl+Shift+H', click: loadAdmin },
        { label: 'Změnit adresu serveru…', click: openServerDialog },
        { type: 'separator' },
        mac ? { role: 'close', label: 'Zavřít okno' } : { role: 'quit', label: 'Ukončit' }
      ]
    },
    {
      label: 'Úpravy',
      submenu: [
        { role: 'undo', label: 'Zpět' },
        { role: 'redo', label: 'Znovu' },
        { type: 'separator' },
        { role: 'cut', label: 'Vyjmout' },
        { role: 'copy', label: 'Kopírovat' },
        { role: 'paste', label: 'Vložit' },
        { role: 'selectAll', label: 'Vybrat vše' }
      ]
    },
    {
      label: 'Zobrazení',
      submenu: [
        { role: 'resetZoom', label: 'Původní velikost' },
        { role: 'zoomIn', label: 'Přiblížit', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', label: 'Oddálit' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Celá obrazovka' },
        ...(DEV ? [{ type: 'separator' }, { role: 'toggleDevTools', label: 'Nástroje pro vývojáře' }] : [])
      ]
    },
    {
      label: 'Nápověda',
      submenu: [
        { label: 'Zkontrolovat aktualizace', click: () => updater.checkManually() },
        { label: 'Otevřít administraci v prohlížeči', click: () => openExternal(config.adminUrl()) },
        { type: 'separator' },
        { label: `Verze ${app.getVersion()}`, enabled: false }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function openServerDialog() {
  if (serverWin && !serverWin.isDestroyed()) {
    serverWin.focus();
    return;
  }
  serverWin = new BrowserWindow({
    width: 480,
    height: 330,
    parent: win || undefined,
    modal: !!win,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: 'Adresa serveru',
    icon: ICON,
    backgroundColor: '#17171d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  serverWin.setMenu(null);
  serverWin.loadFile(path.join(__dirname, 'server.html'), { query: { server: config.server() } });
  serverWin.on('closed', () => {
    serverWin = null;
  });
}

ipcMain.handle('desktop:info', () => ({
  version: app.getVersion(),
  server: config.server(),
  defaultServer: config.DEFAULT_SERVER,
  platform: process.platform,
  packaged: app.isPackaged
}));

ipcMain.handle('desktop:retry', event => {
  if (!isLocalSender(event)) return false;
  loadAdmin();
  return true;
});

ipcMain.handle('desktop:open-server-dialog', event => {
  if (!isLocalSender(event)) return false;
  openServerDialog();
  return true;
});

ipcMain.handle('desktop:close-dialog', event => {
  if (!isLocalSender(event)) return false;
  if (serverWin && !serverWin.isDestroyed()) serverWin.close();
  return true;
});

ipcMain.handle('desktop:save-server', (event, url) => {
  if (!isLocalSender(event)) return { ok: false, error: 'Nepovolené volání.' };
  const origin = config.normalizeServer(url);
  if (!origin) return { ok: false, error: 'Zadejte adresu ve tvaru https://cichnovabrno.papousek.eu' };
  config.save({ server: origin });
  if (serverWin && !serverWin.isDestroyed()) serverWin.close();
  loadAdmin();
  return { ok: true, server: origin };
});

ipcMain.handle('desktop:reset-server', event => {
  if (!isLocalSender(event)) return { ok: false };
  config.save({ server: config.DEFAULT_SERVER });
  return { ok: true, server: config.DEFAULT_SERVER };
});

ipcMain.handle('desktop:check-updates', event => {
  if (!isLocalSender(event)) return false;
  updater.checkManually();
  return true;
});

function start() {
  log.info(`Start ${pkg.name} ${app.getVersion()} (${process.platform})`);
  secureSession();
  buildMenu();
  createWindow();
  updater.setup(() => win);
}
