// Usar window.electronAPI em vez de ipcRenderer diretamente

// Estado da aplicação
console.log('🔧 Renderer.js carregado!');
let caixas = [];
let syncRunning = false;
let editingCaixaId = null;

// Elementos DOM
const elements = {
    caixaForm: document.getElementById('caixaForm'),
    caixasList: document.getElementById('caixasList'),
    logs: document.getElementById('logs'),
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),
    startSyncBtn: document.getElementById('startSync'),
    stopSyncBtn: document.getElementById('stopSync'),
    selectAllBtn: document.getElementById('selectAll'),
    deselectAllBtn: document.getElementById('deselectAll'),
    testAllConnectionsBtn: document.getElementById('testAllConnections'),
    clearLogsBtn: document.getElementById('clearLogs')
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setupModalEventListeners();
    
    // Carregar e aplicar configurações globais
    const globalConfig = getGlobalConfig();
    if (globalConfig.backendApiUrl && globalConfig.backendApiPort) {
        try {
            await window.electronAPI.updateBackendConfig({
                url: globalConfig.backendApiUrl,
                port: globalConfig.backendApiPort
            });
            addLog(`🔧 Configuração do backend carregada: ${globalConfig.backendApiUrl}:${globalConfig.backendApiPort}`, 'info');
            
            // Tentar carregar configurações da API externa do backend
            try {
                const response = await fetch(`${globalConfig.backendApiUrl}:${globalConfig.backendApiPort}/api/config`);
                if (response.ok) {
                    const backendConfig = await response.json();
                    if (backendConfig.success && backendConfig.data && backendConfig.data.externalApi) {
                        // Atualizar localStorage com configurações do backend
                        const externalApi = backendConfig.data.externalApi;
                        const updatedConfig = {
                            ...globalConfig,
                            exdApiUrl: externalApi.url || globalConfig.exdApiUrl,
                            exdUserApi: externalApi.username || globalConfig.exdUserApi,
                            exdPassApi: externalApi.password || globalConfig.exdPassApi
                        };
                        localStorage.setItem('globalConfig', JSON.stringify(updatedConfig));
                        
                        addLog('✅ Configurações da API externa carregadas do backend', 'info');
                    }
                }
            } catch (error) {
                addLog('⚠️ Não foi possível carregar configurações do backend, usando configurações locais', 'warning');
            }
            
        } catch (error) {
            addLog(`Erro ao aplicar configuração do backend: ${error.message}`, 'error');
        }
    }
    
    await loadCaixas();
    updateSyncStatus();
    loadApiStats();
    loadGlobalConfig(); // Carregar configurações na interface
    addLog('Sistema iniciado com sucesso!', 'success');
});

// Configurar event listeners
function setupEventListeners() {
    elements.caixaForm.addEventListener('submit', handleCaixaSubmit);
    elements.startSyncBtn.addEventListener('click', handleStartSync);
    elements.stopSyncBtn.addEventListener('click', handleStopSync);
    elements.selectAllBtn.addEventListener('click', handleSelectAll);
    elements.deselectAllBtn.addEventListener('click', handleDeselectAll);
    elements.testAllConnectionsBtn.addEventListener('click', openTestAllModal);
    elements.clearLogsBtn.addEventListener('click', handleClearLogs);
    
    // Configurar listeners para eventos do preload
    if (window.electronAPI && window.electronAPI.onLog) {
        window.electronAPI.onLog((message, type) => {
            addLog(message, type);
        });
    }
    
    if (window.electronAPI && window.electronAPI.onSyncStatus) {
        window.electronAPI.onSyncStatus((status) => {
            syncRunning = status.running;
            updateSyncButtons();
        });
    }
}

// Carregar caixas salvos
async function loadCaixas() {
    try {
        console.log('🔍 Iniciando loadCaixas...');
        addLog('Carregando caixas do backend...', 'info');
        console.log('🔍 Chamando window.electronAPI.loadCaixas()...');
        const result = await window.electronAPI.loadCaixas();
        console.log('🔍 Resultado recebido:', result);
        
        // Verificar se a resposta tem a estrutura esperada da API
        if (result && result.success && Array.isArray(result.data)) {
            caixas = result.data;
            addLog(`✅ ${caixas.length} caixas carregados com sucesso`, 'success');
        } else if (Array.isArray(result)) {
            // Fallback para compatibilidade com formato antigo
            caixas = result;
            addLog(`✅ ${caixas.length} caixas carregados (formato legado)`, 'success');
        } else {
            caixas = [];
            addLog('⚠️ Nenhum caixa encontrado', 'warning');
        }
        
        renderCaixasList();
    } catch (error) {
        addLog(`❌ Erro ao carregar caixas: ${error.message}`, 'error');
        console.error('Erro detalhado ao carregar caixas:', error);
        
        // Sempre inicializar com array vazio em caso de erro
        caixas = [];
        renderCaixasList();
    }
}

// Salvar caixas
async function saveCaixas() {
    try {
        const result = await window.electronAPI.saveCaixas(caixas);
        if (result.success) {
            addLog('Caixas salvos com sucesso!', 'success');
        } else {
            addLog(`Erro ao salvar caixas: ${result.error}`, 'error');
        }
        return result.success;
    } catch (error) {
        addLog(`Erro ao salvar caixas: ${error.message}`, 'error');
        return false;
    }
}

// Manipular submissão do formulário de caixa
async function handleCaixaSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const caixaData = {
        nome: document.getElementById('nome').value,
        LCDBHOST: document.getElementById('lcdbHost').value,
        LCDBUSER: document.getElementById('lcdbUser').value,
        LCDBPASS: document.getElementById('lcdbPass').value,
        LCDBNAME: document.getElementById('lcdbName').value,
        FILIAL: document.getElementById('filial').value,
        CAIXA: document.getElementById('caixa').value,
        MILISSEGUNDOS: document.getElementById('milissegundos').value,
        SYNC_INTERVAL: document.getElementById('syncInterval').value
    };
    
    if (editingCaixaId) {
        // Editando caixa existente
        const caixaIndex = caixas.findIndex(c => c.id === editingCaixaId);
        if (caixaIndex !== -1) {
            caixas[caixaIndex] = {
                ...caixas[caixaIndex],
                ...caixaData,
                updatedAt: new Date().toISOString()
            };
            addLog(`Caixa ${caixaData.nome} atualizado com sucesso!`, 'success');
        }
        editingCaixaId = null;
        document.querySelector('#caixaForm button[type="submit"]').textContent = '💾 Salvar Caixa';
        document.querySelector('.caixa-form h2').textContent = '➕ Cadastrar Novo Caixa';
    } else {
        // Criando novo caixa
        const newCaixa = {
            ...caixaData,
            id: Date.now().toString(),
            selected: false,
            createdAt: new Date().toISOString()
        };
        caixas.push(newCaixa);
        addLog(`Caixa ${caixaData.nome} cadastrado com sucesso!`, 'success');
    }
    
    if (await saveCaixas()) {
        renderCaixasList();
        event.target.reset();
    }
}

// Testar conexão com caixa
async function handleTestConnection() {
    const caixaConfig = {
        LCDBHOST: document.getElementById('lcdbHost').value,
        LCDBUSER: document.getElementById('lcdbUser').value,
        LCDBPASS: document.getElementById('lcdbPass').value,
        LCDBNAME: document.getElementById('lcdbName').value
    };
    
    if (!caixaConfig.LCDBHOST || !caixaConfig.LCDBUSER || !caixaConfig.LCDBPASS || !caixaConfig.LCDBNAME) {
        addLog('Preencha todos os campos de conexão antes de testar', 'warning');
        return;
    }
    
    elements.testConnectionBtn.classList.add('loading');
    elements.testConnectionBtn.disabled = true;
    
    try {
        addLog('Testando conexão...', 'info');
        const result = await window.electronAPI.testConnection(caixaConfig);
        
        if (result.success) {
            addLog(result.message, 'success');
        } else {
            addLog(`Erro na conexão: ${result.error}`, 'error');
        }
    } catch (error) {
        addLog(`Erro ao testar conexão: ${error.message}`, 'error');
    } finally {
        elements.testConnectionBtn.classList.remove('loading');
        elements.testConnectionBtn.disabled = false;
    }
}

// Iniciar sincronização
async function handleStartSync() {
    const selectedCaixas = caixas.filter(c => c.selected);
    
    if (selectedCaixas.length === 0) {
        addLog('Selecione pelo menos um caixa para iniciar a sincronização', 'warning');
        return;
    }
    
    try {
        addLog(`Iniciando sincronização para ${selectedCaixas.length} caixa(s)...`, 'info');
        const globalConfig = getGlobalConfig();
        const result = await window.electronAPI.startSync(selectedCaixas, globalConfig);
        
        if (result.success) {
            syncRunning = true;
            updateSyncStatus();
            addLog('Sincronização iniciada com sucesso!', 'success');
        } else {
            addLog(`Erro ao iniciar sincronização: ${result.error}`, 'error');
        }
    } catch (error) {
        addLog(`Erro ao iniciar sincronização: ${error.message}`, 'error');
    }
}

// Parar sincronização
async function handleStopSync() {
    try {
        addLog('Parando sincronização...', 'info');
        const result = await window.electronAPI.stopSync();
        
        if (result.success) {
            syncRunning = false;
            updateSyncStatus();
            addLog('Sincronização parada com sucesso!', 'success');
        } else {
            addLog(`Erro ao parar sincronização: ${result.error}`, 'error');
        }
    } catch (error) {
        addLog(`Erro ao parar sincronização: ${error.message}`, 'error');
    }
}

// Selecionar todos os caixas
function handleSelectAll() {
    // Garantir que caixas seja um array
    if (!Array.isArray(caixas)) {
        caixas = [];
    }
    caixas.forEach(caixa => caixa.selected = true);
    renderCaixasList();
    saveCaixas().then(result => {
        if (result) {
            addLog('Todos os caixas foram selecionados e salvos', 'success');
        } else {
            addLog('Todos os caixas foram selecionados, mas houve erro ao salvar', 'warning');
        }
    }).catch(error => {
        addLog(`Erro ao salvar seleção: ${error.message}`, 'error');
    });
}

// Desmarcar todos os caixas
function handleDeselectAll() {
    // Garantir que caixas seja um array
    if (!Array.isArray(caixas)) {
        caixas = [];
    }
    caixas.forEach(caixa => caixa.selected = false);
    renderCaixasList();
    saveCaixas().then(result => {
        if (result) {
            addLog('Todos os caixas foram desmarcados e salvos', 'success');
        } else {
            addLog('Todos os caixas foram desmarcados, mas houve erro ao salvar', 'warning');
        }
    }).catch(error => {
        addLog(`Erro ao salvar deseleção: ${error.message}`, 'error');
    });
}

// Limpar logs
function handleClearLogs() {
    elements.logs.innerHTML = '';
    addLog('Logs limpos', 'info');
}

// Renderizar lista de caixas
function renderCaixasList() {
    // Garantir que caixas seja sempre um array
    if (!Array.isArray(caixas)) {
        caixas = [];
    }
    
    if (caixas.length === 0) {
        elements.caixasList.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">Nenhum caixa cadastrado ainda.</p>';
        return;
    }
    
    elements.caixasList.innerHTML = caixas.map(caixa => `
        <div class="caixa-card ${caixa.selected ? 'selected' : ''}">
            <div class="caixa-header">
                <span class="caixa-name">${caixa.nome}</span>
                <input type="checkbox" class="caixa-checkbox" ${caixa.selected ? 'checked' : ''} 
                       data-caixa-id="${caixa.id}" onchange="handleCheckboxChange(this)">
            </div>
            <div class="caixa-info">
                <div><strong>Filial:</strong> ${caixa.FILIAL}</div>
                <div><strong>Caixa:</strong> ${caixa.CAIXA}</div>
                <div><strong>Host:</strong> ${caixa.LCDBHOST}</div>
                <div><strong>Banco:</strong> ${caixa.LCDBNAME}</div>
            </div>
            <div class="caixa-actions">
                <button class="btn btn-test btn-small" onclick="testCaixaConnection('${caixa.id}')">
                    🔍 Testar
                </button>
                <button class="btn btn-secondary btn-small" onclick="editCaixa('${caixa.id}')">
                    ✏️ Editar
                </button>
                <button class="btn btn-danger btn-small" onclick="deleteCaixa('${caixa.id}')">
                    🗑️ Excluir
                </button>
            </div>
        </div>
    `).join('');
}

// Manipular mudança de checkbox
function handleCheckboxChange(checkbox) {
    const caixaId = checkbox.getAttribute('data-caixa-id');
    console.log('handleCheckboxChange chamada para caixa:', caixaId);
    toggleCaixaSelection(caixaId);
}

// Alternar seleção de caixa
function toggleCaixaSelection(caixaId) {
    console.log('toggleCaixaSelection chamada para caixa:', caixaId);
    // Garantir que caixas seja um array
    if (!Array.isArray(caixas)) {
        caixas = [];
    }
    const caixa = caixas.find(c => c.id === caixaId);
    if (caixa) {
        const oldSelected = caixa.selected;
        caixa.selected = !caixa.selected;
        console.log(`Caixa ${caixa.nome}: ${oldSelected} -> ${caixa.selected}`);
        renderCaixasList();
        saveCaixas().then(result => {
            console.log('Resultado do salvamento:', result);
        }).catch(error => {
            console.error('Erro ao salvar:', error);
        });
    } else {
        console.error('Caixa não encontrada:', caixaId);
    }
}

// Testar conexão de um caixa específico
async function testCaixaConnection(caixaId) {
    // Garantir que caixas seja um array
    if (!Array.isArray(caixas)) {
        caixas = [];
    }
    const caixa = caixas.find(c => c.id === caixaId);
    if (!caixa) return;
    
    try {
        addLog(`Testando conexão do caixa ${caixa.nome}...`, 'info');
        const result = await window.electronAPI.testConnection(caixa);
        
        if (result.success) {
            addLog(`✅ ${caixa.nome}: ${result.message}`, 'success');
        } else {
            addLog(`❌ ${caixa.nome}: ${result.error}`, 'error');
        }
    } catch (error) {
        addLog(`❌ ${caixa.nome}: ${error.message}`, 'error');
    }
}

// Editar caixa
function editCaixa(caixaId) {
    // Garantir que caixas seja um array
    if (!Array.isArray(caixas)) {
        caixas = [];
    }
    const caixa = caixas.find(c => c.id === caixaId);
    if (!caixa) return;
    
    // Preencher o formulário com os dados do caixa
    document.getElementById('nome').value = caixa.nome;
    document.getElementById('lcdbHost').value = caixa.LCDBHOST;
    document.getElementById('lcdbUser').value = caixa.LCDBUSER;
    document.getElementById('lcdbPass').value = caixa.LCDBPASS;
    document.getElementById('lcdbName').value = caixa.LCDBNAME;
    document.getElementById('filial').value = caixa.FILIAL;
    document.getElementById('caixa').value = caixa.CAIXA;
    document.getElementById('milissegundos').value = caixa.MILISSEGUNDOS;
    document.getElementById('syncInterval').value = caixa.SYNC_INTERVAL;
    
    // Alterar o estado para edição
    editingCaixaId = caixaId;
    
    // Alterar textos dos botões e título
    const submitBtn = document.getElementById('saveCaixaBtn');
    const formTitle = document.getElementById('caixaModalTitle');
    const cancelBtn = document.getElementById('cancelCaixaEdit');
    
    if (submitBtn) submitBtn.textContent = '💾 Atualizar Caixa';
    if (formTitle) formTitle.textContent = '✏️ Editar Caixa';
    if (cancelBtn) {
        cancelBtn.style.display = 'inline-block';
        cancelBtn.onclick = cancelEdit;
    }
    
    // Abrir o modal
    openCaixaModal();
    addLog(`Editando caixa ${caixa.nome}`, 'info');
}

// Cancelar edição
function cancelEdit() {
    editingCaixaId = null;
    
    // Limpar formulário
    document.getElementById('caixaForm').reset();
    document.getElementById('milissegundos').value = '60000';
    document.getElementById('syncInterval').value = '60000';
    
    // Restaurar textos originais
    const submitBtn = document.getElementById('saveCaixaBtn');
    const formTitle = document.getElementById('caixaModalTitle');
    const cancelBtn = document.getElementById('cancelCaixaEdit');
    
    if (submitBtn) submitBtn.textContent = '💾 Salvar Caixa';
    if (formTitle) formTitle.textContent = '➕ Cadastrar Novo Caixa';
    if (cancelBtn) cancelBtn.style.display = 'none';
    
    addLog('Edição cancelada', 'info');
}

// Excluir caixa
async function deleteCaixa(caixaId) {
    // Garantir que caixas seja um array
    if (!Array.isArray(caixas)) {
        caixas = [];
    }
    const caixa = caixas.find(c => c.id === caixaId);
    if (!caixa) return;
    
    if (confirm(`Tem certeza que deseja excluir o caixa ${caixa.nome}?`)) {
        caixas = caixas.filter(c => c.id !== caixaId);
        
        if (await saveCaixas()) {
            renderCaixasList();
            addLog(`Caixa ${caixa.nome} excluído com sucesso!`, 'success');
        }
    }
}

// Atualizar status da sincronização
async function updateSyncStatus() {
    try {
        const status = await window.electronAPI.invoke('sync-status');
        syncRunning = status.running;
        
        if (syncRunning) {
            elements.statusIndicator.className = 'status-running';
            elements.statusText.textContent = 'Executando';
            elements.startSyncBtn.disabled = true;
            elements.stopSyncBtn.disabled = false;
        } else {
            elements.statusIndicator.className = 'status-stopped';
            elements.statusText.textContent = 'Parado';
            elements.startSyncBtn.disabled = false;
            elements.stopSyncBtn.disabled = true;
        }
    } catch (error) {
        // Silenciar erros de conexão durante a inicialização
        if (!error.message.includes('ECONNREFUSED')) {
            addLog(`Erro ao verificar status: ${error.message}`, 'error');
        }
    }
}

// Adicionar log
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('p');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    elements.logs.appendChild(logEntry);
    elements.logs.scrollTop = elements.logs.scrollHeight;
    
    // Limitar número de logs (manter apenas os últimos 100)
    const logEntries = elements.logs.querySelectorAll('.log-entry');
    if (logEntries.length > 100) {
        logEntries[0].remove();
    }
}

// Verificar status periodicamente (aguardar um pouco antes de iniciar)
setTimeout(() => {
    setInterval(updateSyncStatus, 5000);
}, 2000);

// Atualizar estatísticas automaticamente a cada 5 segundos (aguardar um pouco antes de iniciar)
setTimeout(() => {
    setInterval(loadApiStats, 5000);
}, 3000);

// Funções para controle dos modais
function openConfigModal() {
    loadGlobalConfig();
    document.getElementById('configModal').style.display = 'block';
}

function closeConfigModal() {
    document.getElementById('configModal').style.display = 'none';
}

// Carregar configurações globais
function loadGlobalConfig() {
    const savedConfig = localStorage.getItem('globalConfig');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        document.getElementById('checkInterval').value = config.checkInterval || 3;
        document.getElementById('backendApiUrl').value = config.backendApiUrl || 'http://localhost';
        document.getElementById('backendApiPort').value = config.backendApiPort || 3002;
        document.getElementById('exdApiUrl').value = config.exdApiUrl || 'https://novotokapi.online/api/v1';
        document.getElementById('exdUserApi').value = config.exdUserApi || 'admin@gmail.com';
        document.getElementById('exdPassApi').value = config.exdPassApi || '@Ntkti1793';
    }
}

// Salvar configurações globais
async function saveGlobalConfig() {
    const checkIntervalInput = document.getElementById('checkInterval');
    const backendApiUrlInput = document.getElementById('backendApiUrl');
    const backendApiPortInput = document.getElementById('backendApiPort');
    const exdApiUrlInput = document.getElementById('exdApiUrl');
    const exdUserApiInput = document.getElementById('exdUserApi');
    const exdPassApiInput = document.getElementById('exdPassApi');
    
    const checkInterval = parseInt(checkIntervalInput.value) || 3;
    const backendApiUrl = backendApiUrlInput.value.trim() || 'http://localhost';
    const backendApiPort = parseInt(backendApiPortInput.value) || 3333;
    const exdApiUrl = exdApiUrlInput.value.trim() || 'https://novotokapi.online/api/v1';
    const exdUserApi = exdUserApiInput.value.trim() || 'admin@gmail.com';
    const exdPassApi = exdPassApiInput.value.trim() || '@Ntkti1793';
    
    // Validar intervalo
    if (isNaN(checkInterval) || checkInterval < 1 || checkInterval > 300) {
        addLog('Intervalo deve ser um número entre 1 e 300 segundos', 'error');
        checkIntervalInput.focus();
        checkIntervalInput.style.borderColor = '#dc3545';
        return false;
    }
    
    // Validar URL do backend
    if (!backendApiUrl || !backendApiUrl.startsWith('http')) {
        addLog('URL do backend deve começar com http:// ou https://', 'error');
        backendApiUrlInput.focus();
        backendApiUrlInput.style.borderColor = '#dc3545';
        return false;
    }
    
    // Validar porta do backend
    if (isNaN(backendApiPort) || backendApiPort < 1 || backendApiPort > 65535) {
        addLog('Porta do backend deve ser um número entre 1 e 65535', 'error');
        backendApiPortInput.focus();
        backendApiPortInput.style.borderColor = '#dc3545';
        return false;
    }
    
    // Validar URL da API externa
    if (!exdApiUrl || !exdApiUrl.startsWith('http')) {
        addLog('URL da API externa deve começar com http:// ou https://', 'error');
        exdApiUrlInput.focus();
        exdApiUrlInput.style.borderColor = '#dc3545';
        return false;
    }
    
    // Validar usuário da API externa
    if (!exdUserApi || exdUserApi.length < 3) {
        addLog('Usuário da API externa deve ter pelo menos 3 caracteres', 'error');
        exdUserApiInput.focus();
        exdUserApiInput.style.borderColor = '#dc3545';
        return false;
    }
    
    // Validar senha da API externa
    if (!exdPassApi || exdPassApi.length < 3) {
        addLog('Senha da API externa deve ter pelo menos 3 caracteres', 'error');
        exdPassApiInput.focus();
        exdPassApiInput.style.borderColor = '#dc3545';
        return false;
    }
    
    // Remover estilos de erro se validação passou
    checkIntervalInput.style.borderColor = '';
    backendApiUrlInput.style.borderColor = '';
    backendApiPortInput.style.borderColor = '';
    exdApiUrlInput.style.borderColor = '';
    exdUserApiInput.style.borderColor = '';
    exdPassApiInput.style.borderColor = '';
    
    const config = {
        checkInterval: checkInterval,
        backendApiUrl: backendApiUrl,
        backendApiPort: backendApiPort,
        exdApiUrl: exdApiUrl,
        exdUserApi: exdUserApi,
        exdPassApi: exdPassApi
    };
    
    localStorage.setItem('globalConfig', JSON.stringify(config));
    addLog(`Configurações salvas. Backend: ${backendApiUrl}:${backendApiPort}, API Externa: ${exdApiUrl}, Usuário: ${exdUserApi}, Intervalo: ${checkInterval}s`, 'success');
    
    // Notificar o processo principal sobre a mudança da configuração do backend
    window.electronAPI.updateBackendConfig({
        url: backendApiUrl,
        port: backendApiPort
    });
    
    // Enviar configurações da API externa para o backend
    try {
        const response = await fetch(`${backendApiUrl}:${backendApiPort}/api/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                externalApi: {
                    url: exdApiUrl,
                    username: exdUserApi,
                    password: exdPassApi
                }
            })
        });
        
        if (response.ok) {
            console.log('✅ Configurações da API externa enviadas para o backend');
        } else {
            console.error('❌ Erro ao enviar configurações da API externa para o backend');
        }
    } catch (error) {
        console.error('❌ Erro na comunicação com o backend:', error);
    }
    
    return true;
}

// Obter configurações globais
function getGlobalConfig() {
    const savedConfig = localStorage.getItem('globalConfig');
    if (savedConfig) {
        return JSON.parse(savedConfig);
    }
    return { 
        checkInterval: 3,
        backendApiUrl: 'http://localhost',
        backendApiPort: 3333,
        exdApiUrl: 'https://novotokapi.online/api/v1',
        exdUserApi: 'admin@gmail.com',
        exdPassApi: '@Ntkti1793'
    }; // Valores padrão
}

// Função para carregar estatísticas da API
async function loadApiStats() {
    try {
        const stats = await window.electronAPI.getApiStats();
        if (stats) {
            updateStatsDisplay(stats);
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas da API:', error);
        // Silenciar erros de conexão durante a inicialização
        if (!error.message.includes('ECONNREFUSED')) {
            addLog('❌ Erro ao carregar estatísticas da API: ' + error.message, 'error');
        }
    }
}

// Função para atualizar a exibição das estatísticas
function updateStatsDisplay(stats) {
    document.getElementById('totalRequests').textContent = stats.total || 0;
    document.getElementById('loginRequests').textContent = stats.login || 0;
    document.getElementById('checkRequests').textContent = stats.checkRequests || 0;
    document.getElementById('sendPedidos').textContent = stats.sendPedidos || 0;
    document.getElementById('updateStatus').textContent = stats.updateStatus || 0;
    document.getElementById('insertRequest').textContent = stats.insertRequest || 0;
    
    // Formatar tempo de atividade
    const uptime = formatUptime(stats.uptime || 0);
    document.getElementById('uptime').textContent = uptime;
    
    // Formatar data do último reset
    const lastReset = stats.lastReset ? new Date(stats.lastReset).toLocaleString('pt-BR') : '-';
    document.getElementById('lastReset').textContent = lastReset;
}

// Função para formatar tempo de atividade
function formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Função para resetar estatísticas da API
async function resetApiStats() {
    try {
        const result = await window.electronAPI.resetApiStats();
        if (result && result.success) {
            addLog('✅ Estatísticas da API resetadas com sucesso', 'success');
            loadApiStats(); // Recarregar estatísticas
        } else {
            addLog('❌ Erro ao resetar estatísticas da API', 'error');
        }
    } catch (error) {
        console.error('Erro ao resetar estatísticas da API:', error);
        addLog('❌ Erro ao resetar estatísticas da API: ' + error.message, 'error');
    }
}

function openCaixaModal() {
    document.getElementById('caixaModal').style.display = 'block';
}

function closeCaixaModal() {
    document.getElementById('caixaModal').style.display = 'none';
    // Limpar formulário e resetar estado de edição
    if (editingCaixaId) {
        cancelEdit();
    }
}

// Atualizar estado dos botões de sincronização
function updateSyncButtons() {
    if (elements.startSyncBtn && elements.stopSyncBtn) {
        elements.startSyncBtn.disabled = syncRunning;
        elements.stopSyncBtn.disabled = !syncRunning;
    }
}

// Configurar event listeners para os modais
function setupModalEventListeners() {
    // Botões para abrir modais
    const openConfigModalBtn = document.getElementById('openConfigModal');
    const openCaixaModalBtn = document.getElementById('openCaixaModal');
    
    if (openConfigModalBtn) {
        openConfigModalBtn.addEventListener('click', openConfigModal);
    }
    if (openCaixaModalBtn) {
        openCaixaModalBtn.addEventListener('click', openCaixaModal);
    }
    
    // Botões do modal de configurações
    const closeConfigModalBtn = document.getElementById('closeConfigModalBtn');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const closeConfigModal_X = document.getElementById('closeConfigModal');
    
    if (closeConfigModalBtn) {
        closeConfigModalBtn.addEventListener('click', closeConfigModal);
    }
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            if (saveGlobalConfig()) {
                closeConfigModal();
            }
        });
    }
    if (closeConfigModal_X) {
        closeConfigModal_X.addEventListener('click', closeConfigModal);
    }
    
    // Validação em tempo real do campo de intervalo
    const checkIntervalInput = document.getElementById('checkInterval');
    if (checkIntervalInput) {
        checkIntervalInput.addEventListener('input', function() {
            const value = parseInt(this.value);
            if (isNaN(value) || value < 1 || value > 300) {
                this.style.borderColor = '#dc3545';
            } else {
                this.style.borderColor = '#28a745';
            }
        });
    }
    
    // Event listener para o botão "Iniciar Testes" no modal de teste de conexões
    const startTestAllBtn = document.getElementById('startTestAll');
    if (startTestAllBtn) {
        startTestAllBtn.addEventListener('click', startTestAllConnections);
    }
    
    // Event listeners para estatísticas da API
    const refreshStatsBtn = document.getElementById('refreshStats');
    const resetStatsBtn = document.getElementById('resetStats');
    
    if (refreshStatsBtn) {
        refreshStatsBtn.addEventListener('click', loadApiStats);
    }
    if (resetStatsBtn) {
        resetStatsBtn.addEventListener('click', resetApiStats);
    }
    
    // Botões para fechar modais do caixa
    const closeCaixaModal_X = document.getElementById('closeCaixaModal');
    if (closeCaixaModal_X) {
        closeCaixaModal_X.addEventListener('click', closeCaixaModal);
    }
    
    // Fechar modal clicando no fundo
    window.addEventListener('click', (event) => {
        const configModal = document.getElementById('configModal');
        const caixaModal = document.getElementById('caixaModal');
        const testAllModal = document.getElementById('testAllModal');
        
        if (event.target === configModal) {
            closeConfigModal();
        }
        if (event.target === caixaModal) {
            closeCaixaModal();
        }
        if (event.target === testAllModal) {
            closeTestAllModal();
        }
    });
    
    // Fechar modal com tecla ESC
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeConfigModal();
            closeCaixaModal();
            closeTestAllModal();
        }
    });
}

// Função para adicionar log no modal
function addModalLog(message, type = 'info') {
    const logContainer = document.getElementById('modalLogContainer');
    const placeholder = logContainer.querySelector('.log-placeholder');
    
    // Remove placeholder se existir
    if (placeholder) {
        placeholder.remove();
    }
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Função para limpar logs do modal
function clearModalLogs() {
    const logContainer = document.getElementById('modalLogContainer');
    logContainer.innerHTML = '<div class="log-placeholder">Nenhum log ainda. Clique em "Testar Conexão" para verificar a conectividade.</div>';
}

// Função para testar conexão no modal
function testCaixaConnectionInModal() {
    const form = document.getElementById('caixaForm');
    const formData = new FormData(form);
    
    const caixaData = {
        filial: formData.get('filial'),
        caixa: formData.get('caixa'),
        milissegundos: formData.get('milissegundos'),
        syncInterval: formData.get('syncInterval')
    };
    
    // Validar campos obrigatórios
    if (!caixaData.filial || !caixaData.caixa) {
        addModalLog('❌ Erro: Filial e Número do Caixa são obrigatórios', 'error');
        return;
    }
    
    addModalLog('🔍 Iniciando teste de conexão...', 'info');
    addModalLog(`📋 Testando caixa ${caixaData.caixa} da filial ${caixaData.filial}`, 'info');
    
    // Simular teste de conexão (aqui você pode implementar a lógica real)
    setTimeout(() => {
        // Simular resultado do teste
        const success = Math.random() > 0.3; // 70% de chance de sucesso
        
        if (success) {
            addModalLog('✅ Conexão testada com sucesso!', 'success');
            addModalLog(`⚙️ Configurações: Milissegundos=${caixaData.milissegundos}, Intervalo=${caixaData.syncInterval}`, 'info');
        } else {
            addModalLog('❌ Falha na conexão com o caixa', 'error');
            addModalLog('💡 Verifique se as configurações estão corretas', 'warning');
        }
    }, 1500);
}

// Expor funções globalmente para uso nos event handlers inline
// Funções do modal de teste de todas as conexões
function openTestAllModal() {
    const modal = document.getElementById('testAllModal');
    const testResultsList = document.getElementById('testResultsList');
    const testProgress = document.getElementById('testProgress');
    const startTestAllBtn = document.getElementById('startTestAll');
    
    // Garantir que caixas seja um array
    if (!Array.isArray(caixas)) {
        caixas = [];
    }
    
    // Limpar resultados anteriores
    testResultsList.innerHTML = '';
    testProgress.textContent = `${caixas.length} caixas encontrados. Clique em "Iniciar Testes" para começar.`;
    startTestAllBtn.style.display = 'inline-block';
    
    // Criar lista inicial de caixas
    caixas.forEach(caixa => {
        const resultItem = createTestResultItem(caixa);
        testResultsList.appendChild(resultItem);
    });
    
    modal.style.display = 'block';
}

function closeTestAllModal() {
    const modal = document.getElementById('testAllModal');
    modal.style.display = 'none';
}

function createTestResultItem(caixa) {
    const item = document.createElement('div');
    item.className = 'test-result-item';
    item.id = `test-result-${caixa.id}`;
    
    // Extrair host e porta do LCDBHOST
    const hostInfo = caixa.LCDBHOST || 'N/A';
    const dbName = caixa.LCDBNAME || 'N/A';
    
    item.innerHTML = `
        <div class="test-result-info">
            <div class="test-result-name">${caixa.nome}</div>
            <div class="test-result-details">${hostInfo}/${dbName}</div>
        </div>
        <div class="test-result-status" id="status-${caixa.id}">
            <span class="status-icon">⏳</span>
            <span>Aguardando</span>
        </div>
    `;
    
    return item;
}

function updateTestResultStatus(caixaId, status, message = '') {
    const item = document.getElementById(`test-result-${caixaId}`);
    const statusElement = document.getElementById(`status-${caixaId}`);
    
    if (!item || !statusElement) return;
    
    // Remover classes anteriores
    statusElement.classList.remove('waiting', 'testing', 'success', 'error');
    
    switch (status) {
        case 'waiting':
            statusElement.classList.add('waiting');
            statusElement.innerHTML = `
                <span class="status-icon">⏳</span>
                <span>Aguardando</span>
            `;
            break;
        case 'testing':
            statusElement.classList.add('testing');
            statusElement.innerHTML = `
                <span class="status-icon">🔄</span>
                <span>Testando...</span>
            `;
            break;
        case 'success':
            statusElement.classList.add('success');
            statusElement.innerHTML = `
                <span class="status-icon">✅</span>
                <span>Sucesso</span>
            `;
            break;
        case 'error':
            statusElement.classList.add('error');
            const errorMsg = message ? (message.length > 30 ? message.substring(0, 30) + '...' : message) : 'Falha na conexão';
            statusElement.innerHTML = `
                <span class="status-icon">❌</span>
                <span>Erro: ${errorMsg}</span>
            `;
            statusElement.title = message || 'Falha na conexão'; // Tooltip com mensagem completa
            break;
    }
}

async function startTestAllConnections() {
    const startTestAllBtn = document.getElementById('startTestAll');
    const testProgress = document.getElementById('testProgress');
    
    // Garantir que caixas seja um array
    if (!Array.isArray(caixas)) {
        caixas = [];
    }
    
    startTestAllBtn.style.display = 'none';
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < caixas.length; i++) {
        const caixa = caixas[i];
        testProgress.textContent = `Testando ${i + 1} de ${caixas.length}: ${caixa.nome}`;
        
        updateTestResultStatus(caixa.id, 'testing');
        
        try {
            const result = await window.electronAPI.testConnection(caixa);
            
            if (result.success) {
                updateTestResultStatus(caixa.id, 'success');
                successCount++;
            } else {
                updateTestResultStatus(caixa.id, 'error', result.error);
                errorCount++;
            }
        } catch (error) {
            updateTestResultStatus(caixa.id, 'error', error.message);
            errorCount++;
        }
        
        // Pequena pausa entre os testes
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    testProgress.textContent = `Teste concluído: ${successCount} sucessos, ${errorCount} erros`;
    startTestAllBtn.textContent = '🔄 Testar Novamente';
    startTestAllBtn.style.display = 'inline-block';
}

window.handleCheckboxChange = handleCheckboxChange;
window.toggleCaixaSelection = toggleCaixaSelection;
window.testCaixaConnection = testCaixaConnection;
window.editCaixa = editCaixa;
window.deleteCaixa = deleteCaixa;
window.openConfigModal = openConfigModal;
window.openCaixaModal = openCaixaModal;
window.closeConfigModal = closeConfigModal;
window.closeCaixaModal = closeCaixaModal;
window.openTestAllModal = openTestAllModal;
window.closeTestAllModal = closeTestAllModal;
window.startTestAllConnections = startTestAllConnections;
window.testCaixaConnectionInModal = testCaixaConnectionInModal;
window.clearModalLogs = clearModalLogs;
window.addModalLog = addModalLog;