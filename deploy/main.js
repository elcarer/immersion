const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
	fullscreen: true,
    webPreferences: {
      webSecurity: false // Отключает строгие интернет-ограничения CORS для локальных файлов игры
    }
  });
  win.setMenuBarVisibility(false); // Прячет стандартное текстовое меню сверху
  win.loadFile(path.join(__dirname, 'index.html'));
    // Отслеживаем нажатия клавиш
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      // F11 — переключает режим (вкл / выкл)
      if (input.key === 'F11') {
        win.setFullScreen(!win.isFullScreen());
        event.preventDefault();
      }
    }
  });
});

app.on('window-all-closed', () => app.quit());