const { contextBridge, ipcRenderer } = require('electron');

// Expor APIs do Electron para o renderer de forma segura
contextBridge.exposeInMainWorld('electronAPI', {
  // Funções para caixas
  loadCaixas: () => ipcRenderer.invoke('load-caixas'),
  saveCaixas: (caixas) => ipcRenderer.invoke('save-caixas', caixas),
  testConnection: (caixaConfig) => ipcRenderer.invoke('test-connection', caixaConfig),
  
  // Funções para sincronização
  startSync: (selectedCaixas, globalConfig) => ipcRenderer.invoke('start-sync', selectedCaixas, globalConfig),
  stopSync: () => ipcRenderer.invoke('stop-sync'),
  syncStatus: () => ipcRenderer.invoke('sync-status'),
  
  // Funções para estatísticas da API
  getApiStats: () => ipcRenderer.invoke('get-api-stats'),
  resetApiStats: () => ipcRenderer.invoke('reset-api-stats'),
  
  // Função para atualizar configuração do backend
  updateBackendConfig: (config) => ipcRenderer.invoke('update-backend-config', config),
  
  // Função genérica para invoke
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Listeners para eventos
  on: (channel, callback) => {
    const validChannels = ['sync-log', 'sync-status-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },
  
  onLog: (callback) => {
    ipcRenderer.on('sync-log', (event, message, type) => callback(message, type));
  },
  
  onSyncStatus: (callback) => {
    ipcRenderer.on('sync-status-changed', (event, status) => callback(status));
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});