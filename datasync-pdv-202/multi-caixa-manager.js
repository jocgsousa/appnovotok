require('dotenv').config();
const oracledb = require('oracledb');
const axios = require('axios');
const { format } = require('date-fns');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Configuração do Oracle Client
const oracleClientPath = path.resolve(__dirname, "instantclient_19_25");
oracledb.initOracleClient({ libDir: oracleClientPath });

class MultiCaixaManager {
    constructor(externalConfig = null) {
        this.caixaConnections = new Map();
        this.syncIntervals = new Map();
        this.loginIntervals = new Map();
        this.monitorInterval = null; // Variável para controlar o intervalo de monitoramento
        this.globalLoginInterval = null; // Variável para controlar o intervalo de login global
        this.isRunning = false;
        
        // Configurações da API externa - usar configurações passadas ou padrões
        if (externalConfig && externalConfig.externalApi) {
            this.globalConfig = {
                EXDAPIURL: externalConfig.externalApi.url || 'https://novotokapi.online/api/v1',
                EXDUSERAPI: externalConfig.externalApi.username || 'admin@gmail.com',
                EXDPASSAPI: externalConfig.externalApi.password || '@Ntkti1793'
            };
        } else {
            // Fallback para variáveis de ambiente se não houver configuração externa
            this.globalConfig = {
                EXDAPIURL: process.env.EXDAPIURL || 'https://novotokapi.online/api/v1',
                EXDUSERAPI: process.env.EXDUSERAPI || 'admin@gmail.com',
                EXDPASSAPI: process.env.EXDPASSAPI || '@Ntkti1793'
            };
        }
        
        this.token = null;
        // Contador de requisições para API externa
        this.apiRequestStats = {
            total: 0,
            login: 0,
            checkRequests: 0,
            sendPedidos: 0,
            updateStatus: 0,
            insertRequest: 0,
            lastReset: new Date()
        };
        
        // Caminho para o arquivo de estado
        this.stateFilePath = path.join(__dirname, 'backend', 'sync-state.json');
    }
    
    // Salvar estado atual da sincronização
    saveState() {
        try {
            const state = {
                isActive: this.isRunning,
                startedAt: this.isRunning ? new Date().toISOString() : null,
                caixasConfigs: this.currentCaixasConfigs || [],
                globalConfig: this.userGlobalConfig || {},
                connectedCaixas: Array.from(this.caixaConnections.keys()),
                lastSyncCycle: new Date().toISOString(),
                apiStats: this.apiRequestStats,
                token: this.token,
                intervals: {
                    syncInterval: this.syncInterval ? true : false,
                    loginInterval: this.loginInterval ? true : false,
                    monitorInterval: this.monitorInterval ? true : false,
                    globalLoginInterval: this.globalLoginInterval ? true : false
                }
            };
            
            fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2));
            this.sendLog('💾 Estado da sincronização salvo com sucesso');
        } catch (error) {
            this.sendLog(`❌ Erro ao salvar estado: ${error.message}`);
        }
    }
    
    // Carregar estado da sincronização
    loadState() {
        try {
            if (fs.existsSync(this.stateFilePath)) {
                const data = fs.readFileSync(this.stateFilePath, 'utf8');
                const state = JSON.parse(data);
                
                this.sendLog('📁 Estado da sincronização carregado');
                return state;
            }
        } catch (error) {
            this.sendLog(`❌ Erro ao carregar estado: ${error.message}`);
        }
        return null;
    }
    
    // Limpar estado da sincronização
    clearState() {
        try {
            const emptyState = {
                isActive: false,
                startedAt: null,
                caixasConfigs: [],
                globalConfig: {},
                connectedCaixas: [],
                lastSyncCycle: null,
                apiStats: {
                    total: 0,
                    login: 0,
                    checkRequests: 0,
                    sendPedidos: 0,
                    updateStatus: 0,
                    insertRequest: 0,
                    lastReset: null
                },
                token: null,
                intervals: {
                    syncInterval: null,
                    loginInterval: null,
                    monitorInterval: null,
                    globalLoginInterval: null
                }
            };
            
            fs.writeFileSync(this.stateFilePath, JSON.stringify(emptyState, null, 2));
            this.sendLog('🗑️ Estado da sincronização limpo');
        } catch (error) {
            this.sendLog(`❌ Erro ao limpar estado: ${error.message}`);
        }
    }
    
    // Restaurar sincronização a partir do estado salvo
    async restoreFromState() {
        try {
            const state = this.loadState();
            
            if (!state || !state.isActive || !state.caixasConfigs || state.caixasConfigs.length === 0) {
                this.sendLog('ℹ️ Nenhum estado ativo encontrado para restaurar');
                return false;
            }
            
            this.sendLog('🔄 Restaurando sincronização do estado salvo...');
            
            // Restaurar estatísticas da API se existirem
            if (state.apiStats) {
                this.apiRequestStats = { ...this.apiRequestStats, ...state.apiStats };
                // Converter lastReset de string para Date se necessário
                if (this.apiRequestStats.lastReset && typeof this.apiRequestStats.lastReset === 'string') {
                    this.apiRequestStats.lastReset = new Date(this.apiRequestStats.lastReset);
                }
            }
            
            // Restaurar token se existir
            if (state.token) {
                this.token = state.token;
            }
            
            // Iniciar sincronização com as configurações salvas
            await this.startSync(state.caixasConfigs, state.globalConfig);
            
            this.sendLog('✅ Sincronização restaurada com sucesso!');
            return true;
            
        } catch (error) {
            this.sendLog(`❌ Erro ao restaurar sincronização: ${error.message}`);
            // Limpar estado corrompido
            this.clearState();
            return false;
        }
    }
    
    // Método para atualizar configurações da API externa
    updateExternalApiConfig(externalConfig) {
        if (externalConfig && externalConfig.externalApi) {
            console.log('🔄 [CONFIG] Atualizando configurações da API externa no MultiCaixaManager');
            this.globalConfig = {
                EXDAPIURL: externalConfig.externalApi.url || this.globalConfig.EXDAPIURL,
                EXDUSERAPI: externalConfig.externalApi.username || this.globalConfig.EXDUSERAPI,
                EXDPASSAPI: externalConfig.externalApi.password || this.globalConfig.EXDPASSAPI
            };
            // Invalidar token para forçar novo login com novas credenciais
            this.token = null;
            console.log('✅ [CONFIG] Configurações da API externa atualizadas');
        }
    }

    // Função para enviar logs
    sendLog(message, caixaName = 'SISTEMA') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] [${caixaName}] ${message}`);
    }

    // Incrementar contador de requisições API
    incrementApiRequest(type) {
        this.apiRequestStats.total++;
        if (this.apiRequestStats[type] !== undefined) {
            this.apiRequestStats[type]++;
        }
    }

    // Obter estatísticas de requisições API
    getApiStats() {
        return {
            ...this.apiRequestStats,
            uptime: new Date() - this.apiRequestStats.lastReset
        };
    }

    // Resetar contador de requisições API
    resetApiStats() {
        this.apiRequestStats = {
            total: 0,
            login: 0,
            checkRequests: 0,
            sendPedidos: 0,
            updateStatus: 0,
            insertRequest: 0,
            lastReset: new Date()
        };
    }

    // Conectar a um caixa específico
    async connectToCaixa(caixaConfig) {
        try {
            this.sendLog(`Tentando conectar ao caixa ${caixaConfig.nome}...`, caixaConfig.nome);
            
            const connection = await oracledb.getConnection({
                user: caixaConfig.LCDBUSER,
                password: caixaConfig.LCDBPASS,
                connectString: `${caixaConfig.LCDBHOST}/${caixaConfig.LCDBNAME}`,
            });
            
            this.caixaConnections.set(caixaConfig.id, {
                connection,
                config: caixaConfig,
                isConnected: true
            });
            
            this.sendLog(`✅ Conectado ao caixa ${caixaConfig.nome} com sucesso!`, caixaConfig.nome);
            return true;
        } catch (error) {
            this.sendLog(`❌ Erro ao conectar ao caixa ${caixaConfig.nome}: ${error.message}`, caixaConfig.nome);
            return false;
        }
    }

    // Desconectar de um caixa específico
    async disconnectFromCaixa(caixaId) {
        const caixaData = this.caixaConnections.get(caixaId);
        if (caixaData && caixaData.connection) {
            try {
                await caixaData.connection.close();
                this.sendLog(`Desconectado do caixa ${caixaData.config.nome}`, caixaData.config.nome);
            } catch (error) {
                this.sendLog(`Erro ao desconectar do caixa ${caixaData.config.nome}: ${error.message}`, caixaData.config.nome);
            }
        }
        this.caixaConnections.delete(caixaId);
    }

    // Executar query em um caixa específico
    async executeQueryForCaixa(caixaId, query, params = {}, options = {}) {
        const caixaData = this.caixaConnections.get(caixaId);
        if (!caixaData || !caixaData.connection) {
            throw new Error(`Caixa ${caixaId} não está conectado`);
        }

        try {
            const result = await caixaData.connection.execute(query, params, {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                ...options
            });
            return result;
        } catch (error) {
            this.sendLog(`Erro na query do caixa ${caixaData.config.nome}: ${error.message}`, caixaData.config.nome);
            throw error;
        }
    }

    // Fazer login na API
    async loginToAPI() {
        try {
            this.sendLog(`🔄 Tentando login na API: ${this.globalConfig.EXDAPIURL}/login.php`);
            this.sendLog(`📧 Email: ${this.globalConfig.EXDUSERAPI}`);
            
            // Incrementar contador de requisições
            this.incrementApiRequest('login');
            
            const response = await axios.post(`${this.globalConfig.EXDAPIURL}/login.php`, {
                email: this.globalConfig.EXDUSERAPI,
                password: this.globalConfig.EXDPASSAPI
            });

            this.sendLog(`📊 Status da resposta: ${response.status}`);
            this.sendLog(`📋 Dados da resposta: ${JSON.stringify(response.data)}`);

            if (response.data && response.data.token) {
                this.token = response.data.token;
                this.sendLog('✅ Login na API realizado com sucesso!');
                return true;
            } else {
                this.sendLog('❌ Resposta de login inválida da API');
                this.sendLog(`❌ Estrutura da resposta: ${JSON.stringify(response.data)}`);
                return false;
            }
        } catch (error) {
            this.sendLog(`❌ Erro no login da API: ${error.message}`);
            if (error.response) {
                this.sendLog(`❌ Status do erro: ${error.response.status}`);
                this.sendLog(`❌ Dados do erro: ${JSON.stringify(error.response.data)}`);
            }
            return false;
        }
    }

    // Função para sanitizar dados (igual ao index.js original)
    sanitizeData(data) {
        return data === null || data === undefined ? null : data;
    }

    // Atualizar status de uma requisição na API
    async updateRequestStatus(requestId, status) {
        try {
            const authConfig = {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            };
            
            // Incrementar contador de requisições
            this.incrementApiRequest('updateStatus');
            
            const response = await axios.post(
                `${this.globalConfig.EXDAPIURL}/request_update.php`,
                {
                    id: requestId,
                    ...status
                },
                authConfig
            );
            
            this.sendLog(`Status da requisição ${requestId} atualizado: ${status.message}`);
            return response.data;
        } catch (error) {
            this.sendLog(`Erro ao atualizar status da requisição ${requestId}: ${error.message}`);
            throw error;
        }
    }

    // Inserir uma nova requisição na API
    async insertRequest(requestData) {
        try {
            const authConfig = {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            };
            
            // Incrementar contador de requisições
            this.incrementApiRequest('insertRequest');
            
            const response = await axios.post(
                `${this.globalConfig.EXDAPIURL}/request_initial.php`,
                requestData,
                authConfig
            );
            
            this.sendLog(`Nova requisição inserida: ${JSON.stringify(requestData)}`);
            return response.data;
        } catch (error) {
            this.sendLog(`Erro ao inserir requisição: ${error.message}`);
            throw error;
        }
    }

    // Verificar novas requisições para todos os caixas conectados
    async checkNewRequests() {
        for (const [caixaId, caixaData] of this.caixaConnections) {
            if (!caixaData.isConnected) continue;
            
            const { config } = caixaData;
            
            try {
                const data = {
                    filial: config.FILIAL,
                    caixa: config.CAIXA,
                };
                
                const authConfig = {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                    },
                };
                
                // Incrementar contador de requisições
                this.incrementApiRequest('checkRequests');
                
                const response = await axios.post(
                    `${this.globalConfig.EXDAPIURL}/request_index.php`,
                    data,
                    authConfig
                );
                
                const requests = response.data;
                if (requests.length > 0) {
                    this.sendLog(
                        `Encontradas ${requests.length} requisições para processar na filial ${config.FILIAL}, caixa ${config.CAIXA}.`,
                        config.nome
                    );
                    
                    // Processar todas as requisições encontradas para este caixa
                    for (const request of requests) {
                        await this.processRequest(request, caixaId);
                    }
                }
            } catch (error) {
                this.sendLog(`Erro ao verificar requisições para ${config.nome}: ${error.message}`, config.nome);
            }
        }
    }

    // Processar uma requisição específica para um caixa
    async processRequest(request, caixaId) {
        const { id, filial, caixa, datavendas } = request;
        const numFilial = Number(filial);
        const numCaixa = Number(caixa);
        
        const caixaData = this.caixaConnections.get(caixaId);
        if (!caixaData) {
            this.sendLog(`Caixa ${caixaId} não encontrado para processar requisição ${id}`);
            return;
        }
        
        const { config } = caixaData;
        
        try {
            this.sendLog(
                `Processando dados da requisição ID: ${id} FILIAL: ${filial} CAIXA: ${caixa}`,
                config.nome
            );
            
            // Verificar se a conexão está disponível
            if (!caixaData.isConnected) {
                this.sendLog('⚠️ Conexão Oracle não disponível para processar requisição.', config.nome);
                await this.updateRequestStatus(id, {
                    processando: false,
                    completed: false,
                    error: true,
                    message: 'Conexão Oracle não disponível. Tentando reconectar...',
                    nregistros: 0,
                });
                return;
            }
            
            // Atualizar status para "processando"
            await this.updateRequestStatus(id, {
                processando: true,
                completed: false,
                error: false,
                message: "Processando...",
                nregistros: 0,
            });
            
            // Converter data para o formato DD/MM/YYYY
            const formatDateToDDMMYYYY = (isoString) => {
                const date = new Date(isoString);
                const day = String(date.getUTCDate()).padStart(2, "0");
                const month = String(date.getUTCMonth() + 1).padStart(2, "0");
                const year = date.getUTCFullYear();
                return `${day}/${month}/${year}`;
            };
            
            const data_venda = formatDateToDDMMYYYY(datavendas);
            
            // Consultar Oracle (usando as mesmas queries do index.js)
            const queryPCPEDIECF = `
                SELECT i.*, c.CODCOB
                FROM PCPEDIECF i
                INNER JOIN PCPEDCECF c ON i.NUMPEDECF = c.NUMPEDECF
                WHERE i.DATA = TO_DATE(:data_venda, 'DD/MM/YYYY')
                AND i.CODFILIAL = :numFilial AND i.NUMCAIXA = :numCaixa
                ORDER BY i.DATA, i.NUMPEDECF DESC
            `;
            
            const queryPCPEDICANCECF = `
                SELECT *
                FROM PCPEDICANCECF
                WHERE DATA = TO_DATE(:data_venda, 'DD/MM/YYYY')
                AND CODFILIAL = :numFilial AND NUMCAIXA = :numCaixa
                ORDER BY DATA, NUMPEDECF DESC
            `;
            
            const resultVendas = await this.executeQueryForCaixa(
                caixaId,
                queryPCPEDIECF,
                {
                    data_venda: data_venda,
                    numFilial: numFilial,
                    numCaixa: numCaixa,
                }
            );
            
            const resultCancelados = await this.executeQueryForCaixa(
                caixaId,
                queryPCPEDICANCECF,
                {
                    data_venda: data_venda,
                    numFilial: numFilial,
                    numCaixa: numCaixa,
                }
            );
            
            // Estruturar pedidos (igual ao index.js)
            const pedidos = [];
            
            for (const row of resultVendas.rows) {
                const existingPedido = pedidos.find((p) => p.pedido === row.NUMPEDECF);
                
                const mappedItem = { ...row };
                
                if (existingPedido) {
                    existingPedido.items.push(mappedItem);
                } else {
                    pedidos.push({
                        pedido: this.sanitizeData(row.NUMPEDECF),
                        filial: this.sanitizeData(row.CODFILIAL),
                        caixa: this.sanitizeData(row.NUMCAIXA),
                        data: this.sanitizeData(row.DATA),
                        funccx: this.sanitizeData(row.CODFUNCCX),
                        items: [mappedItem],
                        cancelados: [],
                    });
                }
            }
            
            for (const row of resultCancelados.rows) {
                const existingPedido = pedidos.find((p) => p.pedido === row.NUMPEDECF);
                
                const mappedCancelado = { ...row };
                
                if (existingPedido) {
                    existingPedido.cancelados.push(mappedCancelado);
                } else {
                    pedidos.push({
                        pedido: this.sanitizeData(row.NUMPEDECF),
                        filial: this.sanitizeData(row.CODFILIAL),
                        caixa: this.sanitizeData(row.NUMCAIXA),
                        data: this.sanitizeData(row.DATA),
                        funccx: this.sanitizeData(row.CODFUNCCX),
                        items: [],
                        cancelados: [mappedCancelado],
                    });
                }
            }
            
            // Processar pedidos para adicionar totais e estrutura completa (igual ao index.js)
            const pedidosProcessados = [];
            
            for (const pedido of pedidos) {
                // Calcular total de itens e cancelados
                const totalItens = pedido.items.reduce((total, item) => {
                    const valor = parseFloat(item.PVENDA) || 0;
                    return total + valor;
                }, 0);
                
                const totalCancelados = pedido.cancelados.reduce((total, cancelado) => {
                    const valor = parseFloat(cancelado.PVENDA) || 0;
                    return total + valor;
                }, 0);
                
                // Preparar JSON de itens e cancelados
                const itensJSON = pedido.items.map((item) => ({
                    EXPORTADO: this.sanitizeData(item.EXPORTADO),
                    CODFILIAL: this.sanitizeData(item.CODFILIAL),
                    NUMPEDECF: this.sanitizeData(item.NUMPEDECF),
                    CODFUNCCX: this.sanitizeData(item.CODFUNCCX),
                    CODFUNCCANCELECF: null,
                    NUMCAIXA: this.sanitizeData(item.NUMCAIXA),
                    NUMSERIEEQUIP: this.sanitizeData(item.NUMSERIEEQUIP),
                    CODPROD: this.sanitizeData(item.CODPROD),
                    NUMSEQ: this.sanitizeData(item.NUMSEQ),
                    DATA: this.sanitizeData(item.DATA),
                    CODCLI: this.sanitizeData(item.CODCLI),
                    CODUSUR: this.sanitizeData(item.CODUSUR),
                    QT: this.sanitizeData(item.QT),
                    PVENDA: this.sanitizeData(item.PVENDA),
                    PTABELA: this.sanitizeData(item.PTABELA),
                    NUMCOO: this.sanitizeData(item.NUMCOO),
                    ST: this.sanitizeData(item.ST),
                    PERDESC: this.sanitizeData(item.PERDESC),
                    QTFALTA: this.sanitizeData(item.QTFALTA),
                    CODST: this.sanitizeData(item.CODST),
                    PORIGINAL: this.sanitizeData(item.PORIGINAL),
                    DTEXPORTACAO: this.sanitizeData(item.DTEXPORTACAO),
                    CODECF: this.sanitizeData(item.CODECF),
                    CODFISCAL: this.sanitizeData(item.CODFISCAL),
                    DESCRICAOPAF: this.sanitizeData(item.DESCRICAOPAF),
                    CODFORNEC: this.sanitizeData(item.CODFORNEC),
                    CODCOB: this.sanitizeData(item.CODCOB),
                }));
                
                const canceladosJSON = pedido.cancelados.map((cancelado) => ({
                    EXPORTADO: this.sanitizeData(cancelado.EXPORTADO),
                    CODFILIAL: this.sanitizeData(cancelado.CODFILIAL),
                    NUMPEDECF: this.sanitizeData(cancelado.NUMPEDECF),
                    CODFUNCCX: this.sanitizeData(cancelado.CODFUNCCX),
                    CODFUNCCANCELECF: this.sanitizeData(cancelado.CODFUNCCANCELECF),
                    NUMCAIXA: this.sanitizeData(cancelado.NUMCAIXA),
                    NUMSERIEEQUIP: this.sanitizeData(cancelado.NUMSERIEEQUIP),
                    CODPROD: this.sanitizeData(cancelado.CODPROD),
                    NUMSEQ: this.sanitizeData(cancelado.NUMSEQ),
                    DATA: this.sanitizeData(cancelado.DATA),
                    CODCLI: this.sanitizeData(cancelado.CODCLI),
                    CODUSUR: this.sanitizeData(cancelado.CODUSUR),
                    QT: this.sanitizeData(cancelado.QT),
                    PVENDA: this.sanitizeData(cancelado.PVENDA),
                    PTABELA: this.sanitizeData(cancelado.PTABELA),
                    NUMCOO: this.sanitizeData(cancelado.NUMCOO),
                    ST: this.sanitizeData(cancelado.ST),
                    PERDESC: this.sanitizeData(cancelado.PERDESC),
                    QTFALTA: this.sanitizeData(cancelado.QTFALTA),
                    CODST: this.sanitizeData(cancelado.CODST),
                    PORIGINAL: this.sanitizeData(cancelado.PORIGINAL),
                    DTEXPORTACAO: this.sanitizeData(cancelado.DTEXPORTACAO),
                    CODECF: this.sanitizeData(cancelado.CODECF),
                    CODFISCAL: this.sanitizeData(cancelado.CODFISCAL),
                    DESCRICAOPAF: this.sanitizeData(cancelado.DESCRICAOPAF),
                    CODFORNEC: this.sanitizeData(cancelado.CODFORNEC),
                    CODCOB: null,
                }));
                
                const dataJson = {
                    pedido: this.sanitizeData(pedido.pedido),
                    filial: this.sanitizeData(pedido.filial),
                    caixa: this.sanitizeData(pedido.caixa),
                    data: this.sanitizeData(pedido.data),
                    funccx: this.sanitizeData(pedido.funccx),
                    itens: itensJSON,
                    cancelados: canceladosJSON,
                    codcob: this.sanitizeData(
                        pedido.items.length ? pedido.items[0].CODCOB : null
                    ),
                    total_itens: totalItens,
                    total_cancelados: totalCancelados,
                    data_registro_produto: this.sanitizeData(
                        pedido.items.length
                            ? pedido.items[0].DTEXPORTACAO
                            : pedido.cancelados.length
                            ? pedido.cancelados[0].DTEXPORTACAO
                            : null
                    ),
                    vendedor: this.sanitizeData(
                        pedido.items.length
                            ? pedido.items[0].CODUSUR
                            : pedido.cancelados.length
                            ? pedido.cancelados[0].CODUSUR
                            : null
                    ),
                };
                
                pedidosProcessados.push(dataJson);
            }
            
            // Enviar dados para a API (reutilizando a função existente)
            if (pedidosProcessados.length > 0) {
                await this.sendPedidosToAPI(pedidosProcessados);
            }
            
            // Atualizar status para "concluído"
            await this.updateRequestStatus(id, {
                processando: false,
                completed: true,
                error: false,
                message: "Processamento concluído com sucesso.",
                nregistros: pedidosProcessados.length,
            });
            
            this.sendLog(
                `Dados da requisição ID: ${id} FILIAL: ${filial} CAIXA: ${caixa} Concluído com sucesso.`,
                config.nome
            );
        } catch (error) {
            this.sendLog(`Erro durante o processamento da requisição: ${error.message}`, config.nome);
            
            // Atualizar status para "erro"
            await this.updateRequestStatus(id, {
                processando: false,
                completed: false,
                error: true,
                message: `Erro: ${error.message}`,
                nregistros: 0,
            });
        }
    }

    // Buscar pedidos de um caixa específico
    async fetchPedidosFromCaixa(caixaId) {
        const caixaData = this.caixaConnections.get(caixaId);
        if (!caixaData) {
            throw new Error(`Caixa ${caixaId} não encontrado`);
        }

        const { config } = caixaData;
        
        try {
            // Obter data atual no formato DD/MM/YYYY
            const hoje = new Date();
            const dia = String(hoje.getDate()).padStart(2, '0');
            const mes = String(hoje.getMonth() + 1).padStart(2, '0');
            const ano = hoje.getFullYear();
            const dataVenda = `${dia}/${mes}/${ano}`;
            
            // Buscar itens normais (igual ao index.js original)
            const queryItens = `
                SELECT i.*, c.CODCOB
                FROM PCPEDIECF i
                INNER JOIN PCPEDCECF c ON i.NUMPEDECF = c.NUMPEDECF
                WHERE i.DATA = TO_DATE(:data_venda, 'DD/MM/YYYY')
                AND i.CODFILIAL = :numFilial AND i.NUMCAIXA = :numCaixa
                ORDER BY i.DATA, i.NUMPEDECF DESC
            `;
            
            // Buscar itens cancelados (igual ao index.js original)
            const queryCancelados = `
                SELECT *
                FROM PCPEDICANCECF
                WHERE DATA = TO_DATE(:data_venda, 'DD/MM/YYYY')
                AND CODFILIAL = :numFilial AND NUMCAIXA = :numCaixa
                ORDER BY DATA, NUMPEDECF DESC
            `;
            
            const [resultItens, resultCancelados] = await Promise.all([
                this.executeQueryForCaixa(caixaId, queryItens, {
                    data_venda: dataVenda,
                    numFilial: config.FILIAL,
                    numCaixa: config.CAIXA
                }),
                this.executeQueryForCaixa(caixaId, queryCancelados, {
                    data_venda: dataVenda,
                    numFilial: config.FILIAL,
                    numCaixa: config.CAIXA
                })
            ]);
            
            // Agrupar pedidos por NUMPEDECF
            const pedidosMap = new Map();
            
            // Processar itens normais
            if (resultItens && resultItens.rows) {
                for (const row of resultItens.rows) {
                    const pedidoId = row.NUMPEDECF;
                    
                    if (!pedidosMap.has(pedidoId)) {
                        pedidosMap.set(pedidoId, {
                            pedido: row.NUMPEDECF,
                            filial: row.CODFILIAL,
                            caixa: row.NUMCAIXA,
                            data: row.DATA,
                            funccx: row.CODFUNCCX,
                            items: [],
                            cancelados: []
                        });
                    }
                    
                    pedidosMap.get(pedidoId).items.push(row);
                }
            }
            
            // Processar itens cancelados
            if (resultCancelados && resultCancelados.rows) {
                for (const row of resultCancelados.rows) {
                    const pedidoId = row.NUMPEDECF;
                    
                    if (!pedidosMap.has(pedidoId)) {
                        pedidosMap.set(pedidoId, {
                            pedido: row.NUMPEDECF,
                            filial: row.CODFILIAL,
                            caixa: row.NUMCAIXA,
                            data: row.DATA,
                            funccx: row.CODFUNCCX,
                            items: [],
                            cancelados: []
                        });
                    }
                    
                    pedidosMap.get(pedidoId).cancelados.push(row);
                }
            }
            
            // Processar pedidos seguindo exatamente a estrutura do index.js original
            const pedidosProcessados = [];
            
            for (const [pedidoId, pedido] of pedidosMap) {
                // Calcular total de itens e cancelados
                const totalItens = pedido.items.reduce((total, item) => {
                    const valor = parseFloat(item.PVENDA) || 0;
                    return total + valor;
                }, 0);

                const totalCancelados = pedido.cancelados.reduce((total, cancelado) => {
                    const valor = parseFloat(cancelado.PVENDA) || 0;
                    return total + valor;
                }, 0);

                // Preparar JSON de itens e cancelados (igual ao index.js)
                const itensJSON = pedido.items.map((item) => ({
                    EXPORTADO: this.sanitizeData(item.EXPORTADO),
                    CODFILIAL: this.sanitizeData(item.CODFILIAL),
                    NUMPEDECF: this.sanitizeData(item.NUMPEDECF),
                    CODFUNCCX: this.sanitizeData(item.CODFUNCCX),
                    CODFUNCCANCELECF: null,
                    NUMCAIXA: this.sanitizeData(item.NUMCAIXA),
                    NUMSERIEEQUIP: this.sanitizeData(item.NUMSERIEEQUIP),
                    CODPROD: this.sanitizeData(item.CODPROD),
                    NUMSEQ: this.sanitizeData(item.NUMSEQ),
                    DATA: this.sanitizeData(item.DATA),
                    CODCLI: this.sanitizeData(item.CODCLI),
                    CODUSUR: this.sanitizeData(item.CODUSUR),
                    QT: this.sanitizeData(item.QT),
                    PVENDA: this.sanitizeData(item.PVENDA),
                    PTABELA: this.sanitizeData(item.PTABELA),
                    NUMCOO: this.sanitizeData(item.NUMCOO),
                    ST: this.sanitizeData(item.ST),
                    PERDESC: this.sanitizeData(item.PERDESC),
                    QTFALTA: this.sanitizeData(item.QTFALTA),
                    CODST: this.sanitizeData(item.CODST),
                    PORIGINAL: this.sanitizeData(item.PORIGINAL),
                    DTEXPORTACAO: this.sanitizeData(item.DTEXPORTACAO),
                    CODECF: this.sanitizeData(item.CODECF),
                    CODFISCAL: this.sanitizeData(item.CODFISCAL),
                    DESCRICAOPAF: this.sanitizeData(item.DESCRICAOPAF),
                    CODFORNEC: this.sanitizeData(item.CODFORNEC),
                    CODCOB: this.sanitizeData(item.CODCOB),
                }));

                const canceladosJSON = pedido.cancelados.map((cancelado) => ({
                    EXPORTADO: this.sanitizeData(cancelado.EXPORTADO),
                    CODFILIAL: this.sanitizeData(cancelado.CODFILIAL),
                    NUMPEDECF: this.sanitizeData(cancelado.NUMPEDECF),
                    CODFUNCCX: this.sanitizeData(cancelado.CODFUNCCX),
                    CODFUNCCANCELECF: this.sanitizeData(cancelado.CODFUNCCANCELECF),
                    NUMCAIXA: this.sanitizeData(cancelado.NUMCAIXA),
                    NUMSERIEEQUIP: this.sanitizeData(cancelado.NUMSERIEEQUIP),
                    CODPROD: this.sanitizeData(cancelado.CODPROD),
                    NUMSEQ: this.sanitizeData(cancelado.NUMSEQ),
                    DATA: this.sanitizeData(cancelado.DATA),
                    CODCLI: this.sanitizeData(cancelado.CODCLI),
                    CODUSUR: this.sanitizeData(cancelado.CODUSUR),
                    QT: this.sanitizeData(cancelado.QT),
                    PVENDA: this.sanitizeData(cancelado.PVENDA),
                    PTABELA: this.sanitizeData(cancelado.PTABELA),
                    NUMCOO: this.sanitizeData(cancelado.NUMCOO),
                    ST: this.sanitizeData(cancelado.ST),
                    PERDESC: this.sanitizeData(cancelado.PERDESC),
                    QTFALTA: this.sanitizeData(cancelado.QTFALTA),
                    CODST: this.sanitizeData(cancelado.CODST),
                    PORIGINAL: this.sanitizeData(cancelado.PORIGINAL),
                    DTEXPORTACAO: this.sanitizeData(cancelado.DTEXPORTACAO),
                    CODECF: this.sanitizeData(cancelado.CODECF),
                    CODFISCAL: this.sanitizeData(cancelado.CODFISCAL),
                    DESCRICAOPAF: this.sanitizeData(cancelado.DESCRICAOPAF),
                    CODFORNEC: this.sanitizeData(cancelado.CODFORNEC),
                    CODCOB: null,
                }));

                const dataJson = {
                    pedido: this.sanitizeData(pedido.pedido),
                    filial: this.sanitizeData(pedido.filial),
                    caixa: this.sanitizeData(pedido.caixa),
                    data: this.sanitizeData(pedido.data),
                    funccx: this.sanitizeData(pedido.funccx),
                    itens: itensJSON,
                    cancelados: canceladosJSON,
                    codcob: this.sanitizeData(
                        pedido.items.length ? pedido.items[0].CODCOB : null
                    ),
                    total_itens: totalItens,
                    total_cancelados: totalCancelados,
                    data_registro_produto: this.sanitizeData(
                        pedido.items.length
                            ? pedido.items[0].DTEXPORTACAO
                            : pedido.cancelados.length
                            ? pedido.cancelados[0].DTEXPORTACAO
                            : null
                    ),
                    vendedor: this.sanitizeData(
                        pedido.items.length
                            ? pedido.items[0].CODUSUR
                            : pedido.cancelados.length
                            ? pedido.cancelados[0].CODUSUR
                            : null
                    ),
                };

                pedidosProcessados.push(dataJson);
            }
            
            this.sendLog(`${pedidosProcessados.length} pedidos processados`, config.nome);
            return pedidosProcessados;
            
        } catch (error) {
            this.sendLog(`Erro ao buscar pedidos: ${error.message}`, config.nome);
            return [];
        }
    }

    // Monitorar requisições de sincronização
    async monitorRequests() {
        // Usar configuração do usuário, variável de ambiente ou 3000ms (3 segundos) como padrão
        let checkInterval = 3000; // Padrão de 3 segundos
        
        if (this.userGlobalConfig && this.userGlobalConfig.checkInterval) {
            checkInterval = this.userGlobalConfig.checkInterval * 1000; // Converter segundos para milissegundos
        } else if (process.env.CHECK_INTERVAL) {
            checkInterval = parseInt(process.env.CHECK_INTERVAL);
        }
        
        this.sendLog(`Configurando verificação de requisições a cada ${checkInterval/1000} segundos`);
        
        this.monitorInterval = setInterval(async () => {
            this.sendLog("Verificando novas requisições em: " + new Date().toISOString());
            await this.checkNewRequests();
        }, checkInterval);
        
        // Renovar o token a cada 10 minutos
        this.globalLoginInterval = setInterval(async () => {
            await this.loginToAPI();
        }, 60000 * 10);
        
        this.sendLog('🔄 Sistema de monitoramento de requisições iniciado');
    }

    // Parar monitoramento de requisições
    async stopMonitorRequests() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            this.sendLog('⏹️ Monitoramento de requisições parado');
        }
        
        if (this.globalLoginInterval) {
            clearInterval(this.globalLoginInterval);
            this.globalLoginInterval = null;
            this.sendLog('⏹️ Renovação automática de token parada');
        }
    }

    // Agregar pedidos de todos os caixas
    async aggregateAllPedidos() {
        const allPedidos = [];
        const promises = [];

        this.sendLog(`🔍 Verificando ${this.caixaConnections.size} caixas para coleta de pedidos...`);

        for (const [caixaId, caixaData] of this.caixaConnections) {
            this.sendLog(`📋 Verificando caixa ${caixaData.config.nome} (conectado: ${caixaData.isConnected})`, caixaData.config.nome);
            
            if (caixaData.isConnected) {
                promises.push(
                    this.fetchPedidosFromCaixa(caixaId)
                        .then(pedidos => {
                            this.sendLog(`📥 Coletados ${pedidos.length} pedidos do caixa ${caixaData.config.nome}`, caixaData.config.nome);
                            allPedidos.push(...pedidos);
                        })
                        .catch(error => {
                            this.sendLog(`❌ Erro ao buscar pedidos do caixa ${caixaData.config.nome}: ${error.message}`, caixaData.config.nome);
                        })
                );
            } else {
                this.sendLog(`⚠️ Caixa ${caixaData.config.nome} não está conectado`, caixaData.config.nome);
            }
        }

        await Promise.all(promises);
        
        this.sendLog(`📊 Total de ${allPedidos.length} pedidos agregados de ${this.caixaConnections.size} caixas`);
        return allPedidos;
    }

    // Enviar pedidos para a API
    async sendPedidosToAPI(pedidos) {
        if (!this.token) {
            const loginSuccess = await this.loginToAPI();
            if (!loginSuccess) {
                throw new Error('Falha no login da API');
            }
        }

        try {
            this.sendLog(`📤 Enviando ${pedidos.length} pedidos para: ${this.globalConfig.EXDAPIURL}/pedidos_register_batch.php`);
            this.sendLog(`🔑 Token: ${this.token ? 'Presente' : 'Ausente'}`);
            
            // Log detalhado do primeiro pedido para verificar estrutura
            if (pedidos.length > 0) {
                const primeiroPedido = pedidos[0];
                this.sendLog(`📋 Estrutura do primeiro pedido:`);
                this.sendLog(`   - pedido: ${primeiroPedido.pedido}`);
                this.sendLog(`   - data_registro_produto: ${primeiroPedido.data_registro_produto}`);
                this.sendLog(`   - vendedor: ${primeiroPedido.vendedor}`);
                this.sendLog(`   - codcob: ${primeiroPedido.codcob}`);
                this.sendLog(`   - total_itens: ${primeiroPedido.total_itens}`);
                this.sendLog(`   - total_cancelados: ${primeiroPedido.total_cancelados}`);
                this.sendLog(`   - itens count: ${primeiroPedido.itens?.length || 0}`);
                this.sendLog(`   - cancelados count: ${primeiroPedido.cancelados?.length || 0}`);
            }
            
            // Estrutura de dados igual ao index.js original
            const batchData = {
                pedidos: pedidos
            };
            
            const headers = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                timeout: 30000
            };
            
            // Incrementar contador de requisições
            this.incrementApiRequest('sendPedidos');
            
            const response = await axios.post(
                `${this.globalConfig.EXDAPIURL}/pedidos_register_batch.php`,
                batchData,
                headers
            );
            
            this.sendLog(`📊 Status da resposta API: ${response.status}`);
            this.sendLog(`✅ Lote de ${pedidos.length} pedidos inserido com sucesso.`);
            
            // Log individual dos pedidos processados (igual ao index.js)
            pedidos.forEach(pedido => {
                this.sendLog(
                    `Pedido ${pedido.pedido} da data: ${format(
                        pedido.data,
                        "dd'/'MM'/'yyyy"
                    )} inserido com sucesso. Total itens: ${pedido.total_itens}, Total cancelados: ${pedido.total_cancelados}`
                );
            });
            
            return true;
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this.sendLog('Token expirado, tentando fazer login novamente...');
                this.token = null;
                return await this.sendPedidosToAPI(pedidos);
            }
            
            this.sendLog(`❌ Erro ao enviar pedidos para API: ${error.message}`);
            if (error.response) {
                this.sendLog(`❌ Status do erro: ${error.response.status}`);
                this.sendLog(`❌ Dados do erro: ${JSON.stringify(error.response.data)}`);
                this.sendLog(`❌ Headers do erro: ${JSON.stringify(error.response.headers)}`);
            }
            return false;
        }
    }

    // Processar sincronização de todos os caixas
    async processSyncCycle() {
        try {
            this.sendLog('🔄 Iniciando ciclo de sincronização...');
            this.sendLog(`📊 Caixas conectados: ${this.caixaConnections.size}`);
            this.sendLog(`🔑 Token disponível: ${!!this.token}`);
            
            // Agregar pedidos de todos os caixas
            const allPedidos = await this.aggregateAllPedidos();
            
            if (allPedidos.length > 0) {
                this.sendLog(`📦 Enviando ${allPedidos.length} pedidos para a API...`);
                // Enviar todos os pedidos em lote para a API
                const success = await this.sendPedidosToAPI(allPedidos);
                if (success) {
                    this.sendLog('✅ Pedidos enviados com sucesso!');
                } else {
                    this.sendLog('❌ Falha ao enviar pedidos para a API');
                }
            } else {
                this.sendLog('ℹ️ Nenhum pedido encontrado para sincronizar');
            }
            
            // Salvar estado após cada ciclo de sincronização
            this.saveState();
            
            this.sendLog('🏁 Ciclo de sincronização concluído');
        } catch (error) {
            this.sendLog(`❌ Erro no ciclo de sincronização: ${error.message}`);
            console.error('Erro detalhado:', error);
        }
    }

    // Iniciar sincronização para múltiplos caixas
    async startSync(caixasConfigs, globalConfig = {}) {
        if (this.isRunning) {
            throw new Error('Sincronização já está em execução');
        }

        // Armazenar configuração global e caixas
        this.userGlobalConfig = globalConfig;
        this.currentCaixasConfigs = caixasConfigs;
        
        this.sendLog(`Iniciando sincronização para ${caixasConfigs.length} caixa(s)...`);
        
        // Conectar a todos os caixas
        const connectionPromises = caixasConfigs.map(config => this.connectToCaixa(config));
        const connectionResults = await Promise.all(connectionPromises);
        
        const connectedCount = connectionResults.filter(result => result).length;
        if (connectedCount === 0) {
            throw new Error('Nenhum caixa pôde ser conectado');
        }
        
        this.sendLog(`${connectedCount} de ${caixasConfigs.length} caixas conectados com sucesso`);
        
        // Fazer login inicial na API
        await this.loginToAPI();
        
        this.isRunning = true;
        
        // Configurar intervalo de sincronização (usar o menor intervalo entre os caixas)
        const minInterval = Math.min(...caixasConfigs.map(c => parseInt(c.SYNC_INTERVAL)));
        this.syncInterval = setInterval(() => {
            this.processSyncCycle();
        }, minInterval);
        
        // Configurar intervalo de login (renovar token a cada 30 minutos)
        this.loginInterval = setInterval(() => {
            this.loginToAPI();
        }, 30 * 60 * 1000);
        
        // Iniciar monitoramento de requisições
        await this.monitorRequests();
        
        // Executar primeira sincronização imediatamente
        setTimeout(() => this.processSyncCycle(), 1000);
        
        // Salvar estado da sincronização
        this.saveState();
        
        this.sendLog('✅ Sincronização iniciada com sucesso!');
    }

    // Parar sincronização
    async stopSync() {
        if (!this.isRunning) {
            return;
        }

        this.sendLog('Parando sincronização...');
        
        // Parar monitoramento de requisições
        await this.stopMonitorRequests();
        
        // Limpar intervalos
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        if (this.loginInterval) {
            clearInterval(this.loginInterval);
            this.loginInterval = null;
        }
        
        // Desconectar de todos os caixas
        const disconnectPromises = Array.from(this.caixaConnections.keys()).map(caixaId => 
            this.disconnectFromCaixa(caixaId)
        );
        await Promise.all(disconnectPromises);
        
        this.isRunning = false;
        this.token = null;
        
        // Limpar estado da sincronização
        this.clearState();
        
        this.sendLog('✅ Sincronização parada com sucesso!');
    }

    // Verificar status
    getStatus() {
        return {
            running: this.isRunning,
            connectedCaixas: this.caixaConnections.size,
            hasToken: !!this.token
        };
    }

    // Testar conexão com um caixa
    async testCaixaConnection(caixaConfig) {
        try {
            const connection = await oracledb.getConnection({
                user: caixaConfig.LCDBUSER,
                password: caixaConfig.LCDBPASS,
                connectString: `${caixaConfig.LCDBHOST}/${caixaConfig.LCDBNAME}`,
            });
            
            await connection.close();
            return { success: true, message: 'Conexão testada com sucesso!' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = MultiCaixaManager;