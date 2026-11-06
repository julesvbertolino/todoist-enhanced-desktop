// Runs before the page, with access to Electron; the page only gets what is
// handed over below.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('enhancedDesktop', {
  hideQuickAdd: () => ipcRenderer.send('quickadd:hide'),
  // Since 1.1: the site lets you choose the shortcut. An older app has neither
  // function, which is how the site knows to offer the new download instead.
  getQuickAddShortcut: () => ipcRenderer.invoke('shortcut:get'),
  setQuickAddShortcut: (accelerator) => ipcRenderer.invoke('shortcut:set', accelerator),
  openSignIn: (url) => ipcRenderer.invoke('oauth:open', url),
  // Since 1.1.1: lets the site say when a newer app can be downloaded. An older app has no
  // such function, which the site reads as "1.1.0 or older".
  getVersion: () => ipcRenderer.invoke('app:version'),
  testMode: process.env.ENHANCED_TEST_MODE === '1',
});

// The quick-add window is kept alive and shown again on each shortcut press.
ipcRenderer.on('quickadd:show', () => {
  window.dispatchEvent(new CustomEvent('enhanced:quickadd'));
});

// Lets the site's stylesheet make room for the window buttons.
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('desktop-app');
});
