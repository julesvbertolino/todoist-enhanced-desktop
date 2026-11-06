const {
  app, BrowserWindow, Menu, Notification, globalShortcut, ipcMain, shell,
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { oauthCallback } = require('./oauth-callback');

// The local test build gets its own session and settings, separate from the installed app.
if (process.env.ENHANCED_TEST_MODE === '1') app.setPath('userData', path.join(app.getPath('appData'), 'enhanced-for-todoist-local-test'));

/* The site is the app: nothing is bundled, so a new deploy of it is a new
   version here the next time the window loads. Point ENHANCED_URL at
   http://localhost:5192 to try a change from `npm run dev`. */
const APP_URL = (process.env.ENHANCED_URL || 'https://todoistenhanced.julesbertolino.fr/').trim();
const APP_ORIGIN = new URL(APP_URL).origin;

/* Option+Space by default. It is chosen on the site (Settings, in the Mac app)
   and kept as `quickAddShortcut` in config.json in the app's data folder, in
   Electron accelerator syntax, e.g. "Alt+Shift+Space". QUICKADD_SHORTCUT in
   the environment still wins, to try one without saving it. */
const DEFAULT_SHORTCUT = 'Alt+Space';
const configFile = () => path.join(app.getPath('userData'), 'config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), 'utf8')) || {};
  } catch {
    return {};
  }
}

function readShortcut() {
  return process.env.QUICKADD_SHORTCUT || readConfig().quickAddShortcut || DEFAULT_SHORTCUT;
}

function saveShortcut(accelerator) {
  fs.writeFileSync(configFile(), JSON.stringify({ ...readConfig(), quickAddShortcut: accelerator }, null, 2));
}

let main = null;
let quick = null;
let mainWasFocused = false;
let mainWasVisible = false;
let quickLoadedAt = 0;
let quickShownAt = 0;
const OAUTH_SCHEME = process.env.ENHANCED_TEST_MODE === '1' ? 'enhanced-todoist-test' : 'enhanced-todoist';

function receiveOAuth(raw) {
  const target = oauthCallback(raw, APP_URL, OAUTH_SCHEME);
  if (!target || !main) return;
  main.loadURL(target);
  main.show();
  main.focus();
}

app.on('open-url', (event, url) => { event.preventDefault(); receiveOAuth(url); });

/* The quick-add window is created once and kept hidden, so without this it
   keeps showing whatever version of the site it loaded when the app started:
   after a release it would still be the old composer until the app is
   restarted. A page older than this is loaded again before it is shown. */
const QUICK_MAX_AGE_MS = 10 * 60 * 1000;

/** Todoist's own pages (sign-in) may load in the window; everything else opens in the browser. */
function isOurs(url) {
  try {
    const { origin, hostname } = new URL(url);
    return origin === APP_ORIGIN || hostname === 'todoist.com' || hostname.endsWith('.todoist.com');
  } catch {
    return false;
  }
}

function guardNavigation(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isOurs(url)) return;
    event.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
}

function createMain() {
  main = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  guardNavigation(main);
  main.loadURL(APP_URL);
  main.on('closed', () => { main = null; });
}

function createQuick() {
  quick = new BrowserWindow({
    /* Wider than the composer (660): the window is transparent and clips what
       is drawn outside it, so the composer's shadow, which reaches about 56px
       to each side, needs that much room or it is cut off in a straight line. */
    width: 820,
    height: 680,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    /* A panel on macOS does not bring the app's other windows to the front
       when it opens: without it, the shortcut raised the whole app behind the
       composer instead of the composer alone. */
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  // Over other apps' full-screen windows and on whichever Space is current.
  quick.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  /* On macOS that call turns the app into an accessory: no Dock icon and no
     Cmd+Tab entry. The Dock is shown again right after it. */
  if (process.platform === 'darwin') app.dock?.show();
  quick.setAlwaysOnTop(true, 'floating');
  guardNavigation(quick);
  quick.loadURL(`${APP_URL}${APP_URL.includes('?') ? '&' : '?'}quickadd`);
  quick.webContents.on('did-finish-load', () => { quickLoadedAt = Date.now(); });
  // Like Spotlight: clicking elsewhere puts it away.
  quick.on('blur', () => hideQuick());
  quick.on('closed', () => { quick = null; });
}

/* The page is loaded again while the window is hidden, never on the press
   that shows it: loading it then showed the page half drawn for an instant
   before the composer, a flash of the whole app. */
function refreshHiddenQuick() {
  if (!quick || quick.isVisible() || !quickLoadedAt) return;
  if (Date.now() - quickLoadedAt <= QUICK_MAX_AGE_MS) return;
  quickLoadedAt = 0;
  quick.webContents.reloadIgnoringCache();
}

function showQuick() {
  if (!quick) createQuick();
  mainWasFocused = Boolean(main && main.isFocused());
  mainWasVisible = Boolean(main && main.isVisible());
  quickShownAt = Date.now();
  quick.center();
  quick.show();
  quick.focus();
  // Showing the composer unhides an app that was hidden, main window included.
  if (process.platform === 'darwin' && main && !mainWasVisible) main.hide();
  quick.webContents.send('quickadd:show');
}

function hideQuick() {
  if (!quick || !quick.isVisible()) return;
  quick.hide();
  refreshHiddenQuick();
  // Give the keyboard back to the app that was in front, unless this one was.
  if (process.platform === 'darwin' && !mainWasFocused) {
    /* Hiding the app also hides the main window as part of it, and showing the
       composer again shows the whole app: the main window came back with every
       shortcut press. A window that was closed or hidden before stays hidden. */
    if (main && !mainWasVisible) main.hide();
    app.hide();
  }
}

function toggleQuick() {
  if (quick && quick.isVisible()) hideQuick();
  else showQuick();
}

let registered = null;

/** Takes the shortcut over from the previous one; if another app holds it, the previous one stays. */
function useShortcut(accelerator) {
  if (accelerator === registered) return true;
  let ok = false;
  try {
    ok = globalShortcut.register(accelerator, toggleQuick);
  } catch {
    ok = false; // not a shortcut Electron understands
  }
  if (!ok) return false;
  if (registered) globalShortcut.unregister(registered);
  registered = accelerator;
  return true;
}

function registerShortcut() {
  const accelerator = readShortcut();
  if (!useShortcut(accelerator)) {
    new Notification({
      title: 'Enhanced for Todoist',
      body: `${accelerator} is already taken by another app. ` +
        'Choose another one in Settings, in the app.',
    }).show();
  }
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!main) createMain();
    else { if (main.isMinimized()) main.restore(); main.focus(); }
  });

  app.whenReady().then(() => {
    app.setAsDefaultProtocolClient(OAUTH_SCHEME);
    buildMenu();
    createMain();
    createQuick();
    setInterval(refreshHiddenQuick, 60 * 1000);
    registerShortcut();
    ipcMain.on('quickadd:hide', hideQuick);
    ipcMain.handle('oauth:open', async (event, raw) => {
      try {
        if (event.sender !== main?.webContents || !event.senderFrame || new URL(event.senderFrame.url).origin !== APP_ORIGIN || typeof raw !== 'string') return false;
        const url = new URL(raw);
        if (url.origin !== 'https://app.todoist.com' || url.pathname !== '/oauth/authorize') return false;
        await shell.openExternal(url.href);
        return true;
      } catch { return false; }
    });
    ipcMain.handle('app:version', (event) => (isOurs(event.senderFrame.url) ? app.getVersion() : null));
    ipcMain.handle('shortcut:get', () => registered || readShortcut());
    ipcMain.handle('shortcut:set', (event, accelerator) => {
      // Only the app's own pages may change it.
      if (!isOurs(event.senderFrame.url) || typeof accelerator !== 'string') return { ok: false, shortcut: registered || readShortcut() };
      const ok = useShortcut(accelerator);
      if (ok) saveShortcut(accelerator);
      return { ok, shortcut: registered || readShortcut() };
    });
    /* Showing the quick-add window activates the app, and macOS reports that
       as a Dock click: left alone, the main window would be brought up (or
       opened again, if it was closed) behind every shortcut press. */
    app.on('activate', () => {
      if (quick && (quick.isVisible() || Date.now() - quickShownAt < 1000)) return;
      if (!main) createMain(); else main.show();
    });
  });

  // The shortcut has to keep working with the main window closed.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
