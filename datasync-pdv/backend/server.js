const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const MultiCaixaManager = require('../multi-caixa-manager');

const app = express();

// Configurações globais
let globalConfig = {
  externalApi: {
    url: 'https://novotokapi.online/api/v1',
    username: 'admin@gmail.com',
    password: '@Ntkti1793'
  },
  server: {
    port: 3333,
    cors: {
      enabled: true,
      origins: ['*']
    },

  },
  logging: {
    enabled: true,
    level: 'info'
  }
};



// Caminho para o arquivo de configuração global
const globalConfigPath = path.join(__dirname, 'config.json');

// Função para carregar configurações do JSON
function loadGlobalConfig() {
  try {
    if (fs.existsSync(globalConfigPath)) {
      console.log('📁 [CONFIG] Carregando configurações do arquivo:', globalConfigPath);
      const data = fs.readFileSync(globalConfigPath, 'utf8');
      globalConfig = { ...globalConfig, ...JSON.parse(data) };
      console.log('✅ [CONFIG] Configurações carregadas com sucesso');
    } else {
      console.log('⚠️ [CONFIG] Arquivo de configuração não encontrado, usando configurações padrão');
      saveGlobalConfig(); // Criar arquivo com configurações padrão
    }
  } catch (error) {
    console.error('❌ [CONFIG] Erro ao carregar configurações:', error);
    console.log('🔄 [CONFIG] Usando configurações padrão');
  }
}

// Função para salvar configurações no JSON
function saveGlobalConfig() {
  try {
    console.log('💾 [CONFIG] Salvando configurações no arquivo:', globalConfigPath);
    fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));
    console.log('✅ [CONFIG] Configurações salvas com sucesso');
  } catch (error) {
    console.error('❌ [CONFIG] Erro ao salvar configurações:', error);
  }
}

// Função para obter configurações
function getGlobalConfig() {
  return globalConfig;
}

// Carregar configurações na inicialização
loadGlobalConfig();

const PORT = globalConfig.server.port;

// Função para restaurar estado da sincronização na inicialização
async function restoreSyncState() {
  try {
    console.log('🔄 [RESTORE] Verificando estado da sincronização anterior...');
    
    // Criar instância temporária para verificar estado
    const tempManager = new MultiCaixaManager(getGlobalConfig());
    const restored = await tempManager.restoreFromState();
    
    if (restored) {
      console.log('✅ [RESTORE] Sincronização restaurada com sucesso!');
      multiCaixaManager = tempManager;
    } else {
      console.log('ℹ️ [RESTORE] Nenhum estado ativo encontrado para restaurar');
    }
  } catch (error) {
    console.error('❌ [RESTORE] Erro ao restaurar estado da sincronização:', error);
  }
}

// Middleware de logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  console.log(`\n[${timestamp}] ${method} ${url}`);
  console.log(`User-Agent: ${userAgent}`);
  
  if (Object.keys(req.query).length > 0) {
    console.log('Query params:', JSON.stringify(req.query, null, 2));
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  
  const startTime = Date.now();
  
  // Interceptar a resposta
  const originalSend = res.send;
  res.send = function(data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`Response status: ${res.statusCode} | Duration: ${duration}ms`);
    
    if (data && typeof data === 'string') {
      try {
        const parsedData = JSON.parse(data);
        console.log('Response data:', JSON.stringify(parsedData, null, 2));
      } catch (e) {
        console.log('Response data (raw):', data.substring(0, 200) + (data.length > 200 ? '...' : ''));
      }
    }
    console.log('---');
    
    originalSend.call(this, data);
  };
  
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Instância global do gerenciador
let multiCaixaManager = null;

// Caminho para o arquivo de configuração
const configPath = path.join(__dirname, '..', 'caixas-config.json');

// Rotas da API

// Carregar configurações dos caixas
app.get('/api/caixas', (req, res) => {
  console.log('🔍 [CAIXAS] Iniciando carregamento das configurações dos caixas');
  try {
    if (fs.existsSync(configPath)) {
      console.log('📁 [CAIXAS] Arquivo de configuração encontrado:', configPath);
      const data = fs.readFileSync(configPath, 'utf8');
      const caixas = JSON.parse(data);
      console.log(`✅ [CAIXAS] ${caixas.length} caixas carregados com sucesso`);
      res.json({ success: true, data: caixas });
    } else {
      console.log('⚠️ [CAIXAS] Arquivo de configuração não encontrado, retornando lista vazia');
      res.json({ success: true, data: [] });
    }
  } catch (error) {
    console.error('❌ [CAIXAS] Erro ao carregar caixas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Salvar configurações dos caixas
app.post('/api/caixas', (req, res) => {
  console.log('💾 [CAIXAS] Iniciando salvamento das configurações dos caixas');
  try {
    const caixas = req.body;
    console.log(`📝 [CAIXAS] Salvando ${Array.isArray(caixas) ? caixas.length : 'dados'} no arquivo:`, configPath);
    fs.writeFileSync(configPath, JSON.stringify(caixas, null, 2));
    console.log('✅ [CAIXAS] Configurações salvas com sucesso');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [CAIXAS] Erro ao salvar caixas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Iniciar sincronização
app.post('/api/sync/start', async (req, res) => {
  console.log('🚀 [SYNC] Solicitação para iniciar sincronização recebida');
  try {
    const { selectedCaixas, globalConfig = {} } = req.body;
    console.log(`📋 [SYNC] Caixas selecionados: ${selectedCaixas ? selectedCaixas.length : 0}`);
    console.log('⚙️ [SYNC] Configuração global:', JSON.stringify(globalConfig, null, 2));
    
    if (multiCaixaManager && multiCaixaManager.getStatus().running) {
      console.log('⚠️ [SYNC] Sincronização já está em execução, rejeitando nova solicitação');
      return res.status(400).json({ success: false, error: 'Sincronização já está em execução' });
    }
    
    if (!selectedCaixas || selectedCaixas.length === 0) {
      console.log('❌ [SYNC] Nenhum caixa selecionado para sincronização');
      return res.status(400).json({ success: false, error: 'Nenhum caixa selecionado' });
    }
    
    console.log('🔧 [SYNC] Criando nova instância do MultiCaixaManager com configurações globais');
    // Criar nova instância do gerenciador com configurações globais
    multiCaixaManager = new MultiCaixaManager(getGlobalConfig());
    
    console.log('▶️ [SYNC] Iniciando sincronização...');
    // Iniciar sincronização com os caixas selecionados e configuração global
    await multiCaixaManager.startSync(selectedCaixas, globalConfig);
    
    console.log('✅ [SYNC] Sincronização iniciada com sucesso');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [SYNC] Erro ao iniciar sincronização:', error);
    multiCaixaManager = null;
    res.status(500).json({ success: false, error: error.message });
  }
});

// Parar sincronização
app.post('/api/sync/stop', async (req, res) => {
  console.log('🛑 [SYNC] Solicitação para parar sincronização recebida');
  try {
    if (multiCaixaManager && multiCaixaManager.getStatus().running) {
      console.log('⏹️ [SYNC] Parando sincronização em execução...');
      await multiCaixaManager.stopSync();
      multiCaixaManager = null;
      console.log('✅ [SYNC] Sincronização parada com sucesso');
      res.json({ success: true });
    } else {
      console.log('⚠️ [SYNC] Nenhuma sincronização em execução para parar');
      res.status(400).json({ success: false, error: 'Nenhuma sincronização em execução' });
    }
  } catch (error) {
    console.error('❌ [SYNC] Erro ao parar sincronização:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Status da sincronização
app.get('/api/sync/status', (req, res) => {
  console.log('📊 [STATUS] Solicitação de status da sincronização');
  try {
    if (multiCaixaManager) {
      const status = multiCaixaManager.getStatus();
      console.log('📈 [STATUS] Status obtido:', JSON.stringify(status, null, 2));
      res.json(status);
    } else {
      console.log('📉 [STATUS] Nenhum gerenciador ativo, retornando status padrão');
      res.json({ running: false, connectedCaixas: 0, hasToken: false });
    }
  } catch (error) {
    console.error('❌ [STATUS] Erro ao obter status:', error);
    res.status(500).json({ running: false, connectedCaixas: 0, hasToken: false });
  }
});

// Obter estatísticas da API
app.get('/api/stats', (req, res) => {
  console.log('📈 [STATS] Solicitação de estatísticas da API');
  try {
    if (multiCaixaManager) {
      const stats = multiCaixaManager.getApiStats();
      console.log('📊 [STATS] Estatísticas obtidas:', JSON.stringify(stats, null, 2));
      res.json(stats);
    } else {
      console.log('📉 [STATS] Nenhum gerenciador ativo, retornando estatísticas padrão');
      const defaultStats = {
        total: 0,
        login: 0,
        checkRequests: 0,
        sendPedidos: 0,
        updateStatus: 0,
        insertRequest: 0,
        lastReset: new Date().toISOString(),
        uptime: 0
      };
      res.json(defaultStats);
    }
  } catch (error) {
    console.error('❌ [STATS] Erro ao obter estatísticas da API:', error);
    const errorStats = {
      total: 0,
      login: 0,
      checkRequests: 0,
      sendPedidos: 0,
      updateStatus: 0,
      insertRequest: 0,
      lastReset: new Date().toISOString(),
      uptime: 0
    };
    res.status(500).json(errorStats);
  }
});

// Resetar estatísticas da API
app.post('/api/stats/reset', (req, res) => {
  console.log('🔄 [STATS] Solicitação para resetar estatísticas da API');
  try {
    if (multiCaixaManager) {
      multiCaixaManager.resetApiStats();
      console.log('✅ [STATS] Estatísticas resetadas com sucesso');
      res.json({ success: true, message: 'Estatísticas resetadas com sucesso' });
    } else {
      console.log('⚠️ [STATS] Manager não inicializado, mas reset aceito');
      res.json({ success: true, message: 'Reset aceito - nenhuma estatística ativa para resetar' });
    }
  } catch (error) {
    console.error('❌ [STATS] Erro ao resetar estatísticas da API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Testar conexão com caixa
app.post('/api/test-connection', async (req, res) => {
  console.log('🔌 [TEST] Solicitação para testar conexão com caixa');
  try {
    const caixaConfig = req.body;
    console.log('🏪 [TEST] Configuração do caixa:', JSON.stringify(caixaConfig, null, 2));
    
    console.log('🔧 [TEST] Criando instância temporária do MultiCaixaManager');
    // Criar instância temporária para teste
    const tempManager = new MultiCaixaManager();
    console.log('🚀 [TEST] Iniciando teste de conexão...');
    const result = await tempManager.testCaixaConnection(caixaConfig);
    console.log('📋 [TEST] Resultado do teste:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ [TEST] Conexão testada com sucesso');
    } else {
      console.log('❌ [TEST] Falha no teste de conexão');
    }
    
    res.json(result);
  } catch (error) {
    console.error('❌ [TEST] Erro ao testar conexão:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter configurações globais
app.get('/api/config', (req, res) => {
  console.log('🔍 [CONFIG] Solicitação para obter configurações globais');
  try {
    const config = getGlobalConfig();
    console.log('✅ [CONFIG] Configurações enviadas com sucesso');
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('❌ [CONFIG] Erro ao obter configurações:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Atualizar configurações globais
app.post('/api/config', (req, res) => {
  console.log('💾 [CONFIG] Solicitação para atualizar configurações globais');
  try {
    const newConfig = req.body;
    console.log('📝 [CONFIG] Novas configurações recebidas:', JSON.stringify(newConfig, null, 2));
    
    // Mesclar com configurações existentes
    globalConfig = { ...globalConfig, ...newConfig };
    
    // Salvar no arquivo
    saveGlobalConfig();
    
    // Atualizar configurações no MultiCaixaManager se existir
    if (multiCaixaManager) {
      console.log('🔄 [CONFIG] Atualizando configurações no MultiCaixaManager');
      multiCaixaManager.updateExternalApiConfig(globalConfig);
    }
    
    console.log('✅ [CONFIG] Configurações atualizadas com sucesso');
    res.json({ success: true, message: 'Configurações atualizadas com sucesso' });
  } catch (error) {
    console.error('❌ [CONFIG] Erro ao atualizar configurações:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('🚨 [ERROR] Erro no servidor:', err);
  console.error('🚨 [ERROR] Stack trace:', err.stack);
  res.status(500).json({ success: false, error: 'Erro interno do servidor' });
});

app.get('/', (req, res) => {
  res.json({
    name: 'DataSync PDV',
    version: '1.0.0',
    description: 'Sincronização de dados entre PDV e Novotok',
  })
});

// Iniciar servidor
app.listen(globalConfig.server.port, async () => {
  console.log('🚀 [SERVER] ========================================');
  console.log(`🚀 [SERVER] Servidor backend iniciado com sucesso!`);
  console.log(`🚀 [SERVER] Porta: ${PORT}`);
  console.log(`🚀 [SERVER] URL: http://localhost:${PORT}`);
  console.log(`🚀 [SERVER] Arquivo de configuração: ${configPath}`);
  console.log('🚀 [SERVER] Logs detalhados ativados para monitoramento');
  console.log('🚀 [SERVER] ========================================');
  
  // Tentar restaurar estado da sincronização anterior
  await restoreSyncState();
});

module.exports = app;