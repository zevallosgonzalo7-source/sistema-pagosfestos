const { app, BrowserWindow, shell, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { stat } = require('fs/promises');

// Origin seguro para servir también WASM/modelos locales sin usar file://.
protocol.registerSchemesAsPrivileged([{
  scheme: 'festos', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

const isDev = !app.isPackaged;
const productionOrigin = 'festos://app';
let mainWindow = null;
let splashWindow = null;

function createWindow() {
  // Ventana visual de arranque: no consulta Supabase ni contiene credenciales.
  const splash = new BrowserWindow({
    width: 530,
    height: 365,
    center: true,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#10282d',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  splashWindow = splash;
  splash.once('ready-to-show', () => {
    if (!splash.isDestroyed()) splash.show();
  });
  splash.loadFile(path.join(__dirname, 'splash.html')).catch((error) => {
    console.error('No se pudo abrir la pantalla de inicio:', error);
  });

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f6fafb',
    show: false,
    autoHideMenuBar: true,
    title: 'FESTOS Gestión Empresarial',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow = win;

  const splashStart = Date.now();
  let wasRevealed = false;
  let revealTimeout = null;
  let fallbackTimeout = null;

  function revealMain() {
    if (wasRevealed || win.isDestroyed()) return;
    wasRevealed = true;
    if (fallbackTimeout) clearTimeout(fallbackTimeout);
    // Mantener visible la animación durante aproximadamente 5 segundos.
    const delay = Math.max(0, 5000 - (Date.now() - splashStart));
    revealTimeout = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.show();
        win.focus();
      }
      if (!splash.isDestroyed()) splash.close();
      if (splashWindow === splash) splashWindow = null;
      revealTimeout = null;
    }, delay);
  }

  const onRendererReady = (event) => {
    // Solo la ventana principal puede indicar que la UI ya está montada.
    if (event.sender === win.webContents) revealMain();
  };
  ipcMain.on('festos:ui-ready', onRendererReady);

  // Si hay un fallo en el renderer, no bloquear eternamente al usuario con la animación.
  fallbackTimeout = setTimeout(() => {
    if (!wasRevealed) {
      console.warn('FESTOS tardó más de 18 s en completar su renderizado inicial.');
      revealMain();
    }
  }, 18000);

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Fallo al cargar FESTOS:', errorCode, errorDescription);
    revealMain();
    dialog.showErrorBox('No se pudo iniciar FESTOS',
      'La aplicación no pudo cargar su ventana principal. Intenta cerrarla y abrirla nuevamente.\n\n' + errorDescription);
  });

  win.on('closed', () => {
    ipcMain.removeListener('festos:ui-ready', onRendererReady);
    if (fallbackTimeout) clearTimeout(fallbackTimeout);
    if (revealTimeout) clearTimeout(revealTimeout);
    if (!splash.isDestroyed()) splash.close();
    if (mainWindow === win) mainWindow = null;
    if (splashWindow === splash) splashWindow = null;
  });

  // V29: no permitir que contenido arbitrario abra sitios externos desde Electron.
  // Solo se autorizan dominios corporativos/documentales conocidos.
  const externalHostsPermitidos = new Set([
    'festosmkt.com',
    'www.festosmkt.com',
    'drive.google.com',
  ]);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file:')) {
      try {
        const { fileURLToPath } = require('url');
        const manual = path.resolve(__dirname, '..', 'dist', 'Manual_Usuario_FESTOS_V21.pdf');
        if (path.resolve(fileURLToPath(url)) === manual) shell.openPath(manual);
      } catch (err) {
        console.error('No se pudo abrir el manual de FESTOS:', err);
      }
      return { action: 'deny' };
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && externalHostsPermitidos.has(parsed.hostname)) {
        shell.openExternal(url);
      }
    } catch (err) {
      console.warn('URL externa bloqueada por FESTOS:', url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const permitidoDev = isDev && url.startsWith('http://localhost:5173');
    const permitidoLocal = !isDev && url.startsWith(`${productionOrigin}/`);
    if (!permitidoDev && !permitidoLocal) event.preventDefault();
  });

  // Electron V29.3 bloqueaba expresamente "media", por eso el botón no
  // podía acceder al micrófono aunque Windows ya lo hubiera autorizado.
  // Otorgar SOLO micrófono, previa solicitud, a la ventana principal local.
  const esVentanaFestos = (wc) => wc === win.webContents && !wc.isDestroyed();
  const esOrigenFestos = (requestingUrl = '') => {
    if (isDev) return requestingUrl.startsWith('http://localhost:5173/') || requestingUrl === 'http://localhost:5173';
    return requestingUrl.startsWith(`${productionOrigin}/`) || requestingUrl === productionOrigin;
  };
  win.webContents.session.setPermissionRequestHandler((wc, permission, callback, details = {}) => {
    if (!esVentanaFestos(wc) || !esOrigenFestos(details.requestingUrl || wc.getURL())) return callback(false);
    if (permission === 'notifications') return callback(true);
    if (permission === 'media') {
      // No autorizar cámara ni compartir pantalla mediante esta excepción.
      const types = details.mediaTypes || [];
      return callback(types.length > 0 && types.every(type => type === 'audio'));
    }
    callback(false);
  });
  win.webContents.session.setPermissionCheckHandler((wc, permission, requestingOrigin, details = {}) => {
    if (!esVentanaFestos(wc) || !esOrigenFestos(requestingOrigin || wc.getURL())) return false;
    if (permission === 'notifications') return true;
    if (permission === 'media') {
      const type = details.mediaType || details.mediaTypes?.[0];
      return type === 'audio';
    }
    return false;
  });

  if (isDev) {
    win.loadURL('http://localhost:5173').catch((err) => console.error('Fallo al abrir FESTOS:', err));
  } else {
    win.loadURL(`${productionOrigin}/index.html`)
      .catch((err) => console.error('Fallo al abrir FESTOS:', err));
  }
}

app.whenReady().then(() => {
  // Ruta confinada al directorio dist, impidiendo acceso a archivos ajenos.
  if (!isDev) {
    const distRoot = path.resolve(__dirname, '..', 'dist');
    protocol.handle('festos', async request => {
      try {
        const address = new URL(request.url);
        if (address.hostname !== 'app') return new Response('Forbidden', { status: 403 });
        const requested = decodeURIComponent(address.pathname);
        const candidate = path.resolve(distRoot, '.' + requested);
        if (candidate !== distRoot && !candidate.startsWith(distRoot + path.sep)) {
          return new Response('Forbidden', { status: 403 });
        }
        const info = await stat(candidate).catch(() => null);
        if (!info?.isFile()) return new Response('Not found', { status: 404 });
        return net.fetch(pathToFileURL(candidate).toString());
      } catch (error) {
        console.error('Archivo FESTOS no disponible:', error);
        return new Response('Not found', { status: 404 });
      }
    });
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
