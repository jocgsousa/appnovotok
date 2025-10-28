const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');

// URL base da API (dinâmica)
let API_BASE_URL = 'http://localhost:3333/api';



// Função para construir URL da API
function getApiBaseUrl() {
  return API_BASE_URL;
}

// Função para atualizar URL da API
function updateApiBaseUrl(url, port) {
  API_BASE_URL = `${url}:${port}/api`;
  console.log(`🔧 URL da API atualizada para: ${API_BASE_URL}`);
}

// Função para carregar configurações salvas
function loadSavedBackendConfig() {
  try {
    // Simular carregamento das configurações do localStorage
    // Na prática, isso seria feito quando o renderer enviar as configurações
    console.log(`🚀 Aplicação iniciada com URL da API: ${API_BASE_URL}`);
  } catch (error) {
    console.error('Erro ao carregar configurações salvas:', error);
  }
}

console.log('🔧 Main.js carregado - IPC handlers sendo registrados...');

let mainWindow;
let tray;

// Função para criar a janela principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon-256.png'),
    autoHideMenuBar: true,
    show: true // Mostrar janela para debug
  });

  mainWindow.loadFile('renderer/index.html');

  // mainWindow.openDevTools(); // Comentado temporariamente

  // Abrir DevTools em modo de desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Evento quando a janela é fechada
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Evento quando a janela é minimizada
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

// Função para criar a bandeja do sistema
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Ocultar',
      click: () => {
        mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('DataSync PDV');

  // Duplo clique na bandeja para mostrar/ocultar
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

// Quando o Electron estiver pronto
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // Carregar configurações salvas na inicialização
  loadSavedBackendConfig();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Sair quando todas as janelas forem fechadas (exceto no macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handlers IPC que fazem chamadas para a API

// Carregar configurações dos caixas
ipcMain.handle('load-caixas', async () => {
  try {
    console.log('🔍 Fazendo requisição para:', `${getApiBaseUrl()}/caixas`);
    const response = await axios.get(`${getApiBaseUrl()}/caixas`);
    console.log('✅ Resposta recebida:', response.status, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao carregar caixas:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return { success: false, error: error.message };
  }
});

// Salvar configurações dos caixas
ipcMain.handle('save-caixas', async (event, caixas) => {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/caixas`, caixas);
    return response.data;
  } catch (error) {
    console.error('Erro ao salvar caixas:', error);
    return { success: false, error: error.message };
  }
});

// Iniciar sincronização
ipcMain.handle('start-sync', async (event, selectedCaixas, globalConfig = {}) => {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/sync/start`, {
      selectedCaixas,
      globalConfig
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao iniciar sincronização:', error);
    return { success: false, error: error.response?.data?.error || error.message };
  }
});

// Parar sincronização
ipcMain.handle('stop-sync', async () => {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/sync/stop`, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao parar sincronização:', error);
    return { success: false, error: error.response?.data?.error || error.message };
  }
});

// Handler para obter estatísticas da API
ipcMain.handle('get-api-stats', async () => {
  try {
    const response = await axios.get(`${getApiBaseUrl()}/stats`);
    return response.data;
  } catch (error) {
    console.error('Erro ao obter estatísticas da API:', error);
    return null;
  }
});

// Handler para resetar estatísticas da API
ipcMain.handle('reset-api-stats', async () => {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/stats/reset`);
    return response.data;
  } catch (error) {
    console.error('Erro ao resetar estatísticas da API:', error);
    return { success: false, error: error.response?.data?.error || error.message };
  }
});

// Status da sincronização
ipcMain.handle('sync-status', async () => {
  try {
    const response = await axios.get(`${getApiBaseUrl()}/sync/status`);
    return response.data;
  } catch (error) {
    console.error('Erro ao obter status:', error);
    return { running: false, connectedCaixas: 0, hasToken: false };
  }
});

// Testar conexão com caixa
ipcMain.handle('test-connection', async (event, caixaConfig) => {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/test-connection`, caixaConfig);
    return response.data;
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    return { success: false, error: error.response?.data?.error || error.message };
  }
});

// Atualizar configuração do backend
ipcMain.handle('update-backend-config', async (event, config) => {
  try {
    const { url, port } = config;
    updateApiBaseUrl(url, port);
    return { success: true, message: `Configuração atualizada: ${url}:${port}` };
  } catch (error) {
    console.error('Erro ao atualizar configuração do backend:', error);
    return { success: false, error: error.message };
  }
});