require('dotenv/config');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const cors = require('cors');

// Importar cliente da API e função do sistema NPS
const { whatsappAPI } = require('./api-client');
const { processarRespostaWhatsApp } = require('./nps-sync');

// Configuração do servidor Express
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Aumentar limite para suportar imagens

// Armazenar instâncias ativas
const activeInstances = new Map();

// Cache local para validação de números WhatsApp
const whatsappNumberCache = new Map();
const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 horas em millisegundos

// Função para salvar resultado da validação no cache
function saveNumberValidationToCache(phoneNumber, validationResult) {
    const cacheKey = formatPhoneNumber(phoneNumber);
    const cacheEntry = {
        ...validationResult,
        timestamp: Date.now()
    };
    
    whatsappNumberCache.set(cacheKey, cacheEntry);
    console.log(`💾 Resultado da validação salvo no cache para: ${cacheKey}`);
}

// Função para verificar cache antes de validar no WhatsApp
function getNumberValidationFromCache(phoneNumber) {
    const cacheKey = formatPhoneNumber(phoneNumber);
    const cacheEntry = whatsappNumberCache.get(cacheKey);
    
    if (!cacheEntry) {
        console.log(`🔍 Número ${cacheKey} não encontrado no cache`);
        return null;
    }
    
    // Verificar se o cache não expirou
    const isExpired = (Date.now() - cacheEntry.timestamp) > CACHE_EXPIRY_TIME;
    
    if (isExpired) {
        console.log(`⏰ Cache expirado para número ${cacheKey}, removendo...`);
        whatsappNumberCache.delete(cacheKey);
        return null;
    }
    
    console.log(`✅ Resultado encontrado no cache para: ${cacheKey}`);
    return {
        hasWhatsApp: cacheEntry.hasWhatsApp,
        formattedNumber: cacheEntry.formattedNumber,
        numberId: cacheEntry.numberId,
        originalNumber: cacheEntry.originalNumber,
        fromCache: true
    };
}

// Limpeza periódica do cache (remover entradas expiradas)
setInterval(() => {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of whatsappNumberCache.entries()) {
        if ((now - entry.timestamp) > CACHE_EXPIRY_TIME) {
            whatsappNumberCache.delete(key);
            removedCount++;
        }
    }
    
    if (removedCount > 0) {
        console.log(`🧹 Limpeza do cache: ${removedCount} entradas expiradas removidas`);
    }
}, 60 * 60 * 1000); // Executar a cada 1 hora

// Função para testar conectividade com a API (substitui conectDB)
async function testAPIConnection(retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Tentativa ${attempt}/${retries} - Testando conectividade com API...`);
            
            // Testar conexão fazendo uma requisição simples
            const result = await whatsappAPI.count();
            console.log('Conexão com API estabelecida com sucesso!');
            console.log('Teste de conectividade realizado com sucesso!');
            
            return true;
        } catch (error) {
            console.error(`Erro na tentativa ${attempt}/${retries}:`);
            console.error('Mensagem:', error.message);
            
            // Tratamento específico para erros comuns
            if (error.message.includes('ECONNREFUSED')) {
                console.error(' Conexão recusada - Verifique se a API está rodando');
            } else if (error.message.includes('timeout')) {
                console.error(' Timeout na conexão - Verifique conectividade de rede');
            } else if (error.message.includes('401') || error.message.includes('403')) {
                console.error(' Acesso negado - Verifique token de autenticação');
            }
            
            if (attempt === retries) {
                console.error(` Falha após ${retries} tentativas. Erro final:`, error.message);
                throw error;
            }
            
            // Aguardar antes da próxima tentativa
            console.log(` Aguardando 5 segundos antes da próxima tentativa...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Função para testar a conexão com a API
async function testDatabaseConnection() {
    try {
        console.log('\n=== TESTE DE CONEXÃO COM API ===');
        console.log('Configurações:');
        console.log('- API Base URL:', process.env.API_BASE_URL || 'http://192.168.10.112:8000');
        console.log('- API Token:', process.env.API_TOKEN ? '[DEFINIDO]' : '[VAZIO]');
        
        // Testar conectividade com a API
        await testAPIConnection(1);
        
        // Testar consulta na tabela de instâncias
        const result = await whatsappAPI.count();
        console.log(`Tabela instancias_whatsapp encontrada com ${result} registros.`);
        
        console.log('Teste de conexão concluído com sucesso!');
        console.log('===============================================\n');
        
        return true;
    } catch (error) {
        console.error('\n=== FALHA NO TESTE DE CONEXÃO ===');
        console.error('Erro:', error.message);
        console.error('================================\n');
        return false;
    }
}

// Função para atualizar status da instância via API
async function updateInstanceStatus(instanceId, status, qrcode = null, numero = null) {
    try {
        // Verificar existência da instância antes de atualizar status
        let exists = true;
        try {
            const inst = await whatsappAPI.getById(instanceId);
            exists = !!inst;
        } catch (_) {
            exists = false;
        }
        if (!exists) {
            console.warn(`⚠️ Instância ${instanceId} não encontrada. Status '${status}' não será atualizado.`);
            return;
        }

        const updateData = { status_conexao: status };

        if (qrcode !== null) {
            updateData.qrcode = qrcode;
        }

        if (numero !== null) {
            updateData.numero_whatsapp = numero;
        }

        // Atualizar ultima_conexao quando instância for conectada
        if (status === 'conectado') {
            updateData.ultima_conexao = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }

        try {
            await whatsappAPI.updateStatus(instanceId, updateData);
            
            // Status atualizado via API - dashboard fará polling para obter atualizações
            console.log(`Status da instância ${instanceId} atualizado para: ${status}`);
        } catch (apiErr) {
            const is404 = apiErr?.response?.status === 404 || /404/.test(apiErr?.message || '');
            if (is404) {
                console.warn(`⚠️ API retornou 404 ao atualizar status da instância ${instanceId}. Ignorando atualização.`);
                return;
            }
            throw apiErr;
        }
    } catch (error) {
        console.error('Erro ao atualizar status da instância:', error);
    }
}

// Função para criar diretório de sessão da instância
function createSessionDir(instanceId) {
    const sessionPath = path.join(__dirname, 'sessions', `instance_${instanceId}`);
    fs.ensureDirSync(sessionPath);
    return sessionPath;
}

// Função para limpar sessão bloqueada
async function cleanLockedSession(instanceId) {
    try {
        const sessionPath = path.join(__dirname, 'sessions', `instance_${instanceId}`);
        const nestedSessionPath = path.join(sessionPath, `session-instance_${instanceId}`);
        const defaultProfilePath = path.join(nestedSessionPath, 'Default');

        if (fs.existsSync(sessionPath)) {
            console.log(`🧹 Limpando sessão bloqueada da instância ${instanceId}...`);

            let cleaned = false;
            // Tentativa 1: remover toda a pasta de sessão
            try {
                fs.removeSync(sessionPath);
                cleaned = true;
                console.log(`✅ Sessão da instância ${instanceId} removida com sucesso`);
            } catch (removeError) {
                console.log(`⚠️ Remoção direta falhou (${removeError.message}). Tentando renomear pasta raiz...`);
                // Tentativa 2: renomear pasta raiz
                const backupPath = `${sessionPath}_backup_${Date.now()}`;
                try {
                    fs.moveSync(sessionPath, backupPath);
                    cleaned = true;
                    console.log(`✅ Pasta raiz movida para backup: ${backupPath}`);
                } catch (moveRootError) {
                    console.log(`⚠️ Não foi possível mover pasta raiz (${moveRootError.message}). Tentando renomear subpasta de sessão...`);
                    // Tentativa 3: renomear subpasta de sessão
                    if (fs.existsSync(nestedSessionPath)) {
                        const nestedBackup = `${nestedSessionPath}_backup_${Date.now()}`;
                        try {
                            fs.moveSync(nestedSessionPath, nestedBackup);
                            cleaned = true;
                            console.log(`✅ Subpasta de sessão movida para backup: ${nestedBackup}`);
                        } catch (moveNestedError) {
                            console.log(`⚠️ Não foi possível mover subpasta de sessão (${moveNestedError.message}). Tentando remover arquivos problemáticos...`);
                            // Tentativa 4: remover arquivos problemáticos específicos
                            const problematicFiles = ['Cookies', 'chrome_debug.log'];
                            for (const fname of problematicFiles) {
                                const fpath = path.join(defaultProfilePath, fname);
                                try {
                                    if (fs.existsSync(fpath)) {
                                        fs.removeSync(fpath);
                                        console.log(`🗑️ Arquivo problemático removido: ${fname}`);
                                    }
                                } catch (fileErr) {
                                    console.log(`⚠️ Falha ao remover ${fname}: ${fileErr.message}`);
                                }
                            }
                        }
                    }
                }
            }

            // Aguardar um pouco para o sistema liberar os recursos
            await new Promise(resolve => setTimeout(resolve, 1200));

            if (!cleaned) {
                console.log(`⚠️ Sessão não pôde ser totalmente limpa. Prosseguindo com recriação usando pasta fresca.`);
            }
        }
    } catch (error) {
        console.error(`Erro ao limpar sessão da instância ${instanceId}:`, error.message);
        // Não propagar o erro, apenas logar
    }
}

// Função para criar uma nova instância WhatsApp
async function createWhatsAppInstance(instanceData) {
    const { id, identificador, nome } = instanceData;
    
    try {
        // Evitar criação de chrome_debug.log que pode causar EBUSY no Windows
        if (process.platform === 'win32') {
            try { process.env.CHROME_LOG_FILE = 'NUL'; } catch (_) {}
        }
        console.log(`🏗️ Iniciando criação da instância ${identificador} (ID: ${id})`);
        
        // Criar diretório de sessão base
        console.log(`📁 Criando diretório de sessão para instância ${id}...`);
        const baseSessionPath = createSessionDir(id);
        console.log(`✅ Diretório de sessão criado: ${baseSessionPath}`);
        let currentSessionPath = baseSessionPath;
        
        // Atualizar caminho da sessão via API inicialmente
        console.log(`🔄 Atualizando caminho da sessão via API para instância ${id}...`);
        await whatsappAPI.updateStatus(id, {
            session_path: currentSessionPath
        });
        console.log(`✅ Caminho da sessão atualizado via API`);

        // Event listeners (serão associados ao client efetivo)
        const attachListeners = (client) => {
        client.on('qr', async (qr) => {
            console.log(`QR Code gerado para instância ${identificador}`);
            await updateInstanceStatus(id, 'qr_code', qr);
        });

        client.on('ready', async () => {
            console.log(`Instância ${identificador} conectada com sucesso!`);
            const info = client.info;
            await updateInstanceStatus(id, 'conectado', null, info.wid.user);
        });

        client.on('authenticated', async () => {
            console.log(`Instância ${identificador} autenticada`);
            await updateInstanceStatus(id, 'conectando');
        });

        client.on('auth_failure', async (msg) => {
            console.error(`Falha na autenticação da instância ${identificador}:`, msg);
            await updateInstanceStatus(id, 'erro');
        });

        client.on('disconnected', async (reason) => {
            console.log(`Instância ${identificador} desconectada:`, reason);
            await updateInstanceStatus(id, 'desconectado');
            activeInstances.delete(id);
        });

        // Listener para mensagens recebidas
        client.on('message', async (message) => {
            console.log(`Mensagem recebida na instância ${identificador}:`, message.body);
            // Aqui você pode implementar a lógica para processar mensagens NPS
            await processIncomingMessage(id, message);
        });

        // Listener para mensagens excluídas para todos <mcreference link="https://docs.wwebjs.dev/Client.js.html" index="3">3</mcreference>
        client.on('message_revoke_everyone', async (after, before) => {
            console.log(`Mensagem excluída para todos na instância ${identificador}`);
            await handleMessageRevoked(id, after, before);
        });
        };

        // Inicializar cliente
        console.log(`🔄 Atualizando status para 'conectando' para instância ${id}...`);
        await updateInstanceStatus(id, 'conectando');
        console.log(`✅ Status atualizado para 'conectando'`);
        
        console.log(`🚀 Inicializando cliente WhatsApp para instância ${id}...`);
        // Tentar inicializar com tolerância a bloqueios de arquivos (Windows EBUSY)
        let initAttempt = 0;
        let client;
        while (true) {
            // Criar um client novo a cada tentativa, permitindo mudar o dataPath se necessário
            client = new Client({
                authStrategy: new LocalAuth({
                    clientId: `instance_${id}`,
                    dataPath: currentSessionPath
                }),
                puppeteer: {
                    headless: 'new',
                    executablePath: (() => { try { return require('puppeteer').executablePath(); } catch (_) { return undefined; } })(),
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--use-gl=swiftshader',
                        '--start-maximized',
                        '--disable-background-timer-throttling',
                        '--disable-renderer-backgrounding',
                        '--disable-backgrounding-occluded-windows',
                        '--enable-logging=stderr'
                    ]
                }
            });
            attachListeners(client);

            try {
                await client.initialize();
                console.log(`✅ Cliente WhatsApp inicializado com sucesso para instância ${id}`);
                // Se o caminho de sessão foi modificado em relação ao base, atualizar API
                if (currentSessionPath !== baseSessionPath) {
                    console.log(`🔄 Atualizando caminho de sessão final na API: ${currentSessionPath}`);
                    await whatsappAPI.updateStatus(id, { session_path: currentSessionPath });
                    console.log(`✅ Caminho de sessão final atualizado na API`);
                }
                break;
            } catch (err) {
                const msg = err?.message || String(err);
                if ((msg.includes('EBUSY') || msg.includes('resource busy or locked')) && initAttempt < 2) {
                    initAttempt++;
                    console.warn(`⚠️ Inicialização falhou por arquivo bloqueado (tentativa ${initAttempt}). Limpando sessão e reintentando...`);
                    try { await cleanLockedSession(id); } catch (_) {}
                    // Em nova tentativa, usar uma pasta fresca para evitar arquivos remanescentes
                    currentSessionPath = path.join(__dirname, 'sessions', `instance_${id}_fresh_${Date.now()}`);
                    fs.ensureDirSync(currentSessionPath);
                    console.log(`📁 Usando pasta de sessão alternativa: ${currentSessionPath}`);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    // Tentar novamente com novo dataPath
                    continue;
                }
                // Tentar destruir client antes de propagar
                try { await client.destroy(); } catch (_) {}
                throw err;
            }
        }
        
        // Armazenar instância ativa
        console.log(`💾 Armazenando instância ${id} no cache...`);
        activeInstances.set(id, { client, instanceData, status: 'conectando', sessionPath: currentSessionPath });
        console.log(`✅ Instância ${id} armazenada no cache. Total no cache: ${activeInstances.size}`);

        return client;
    } catch (error) {
        console.error(`Erro ao criar instância ${identificador}:`, error);
        await updateInstanceStatus(id, 'erro');
        throw error;
    }
}

// Cache para evitar processamento de mensagens duplicadas
const processedMessages = new Map();

// Idempotency cache for outgoing sends (prevents duplicate sending)
const outgoingIdempotency = new Map(); // key -> { timestamp, response }
const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

// Cleanup expired idempotency entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of outgoingIdempotency.entries()) {
        if (!entry || !entry.timestamp || (now - entry.timestamp) > IDEMPOTENCY_TTL_MS) {
            outgoingIdempotency.delete(key);
        }
    }
}, 30 * 60 * 1000); // every 30 minutes

// Função para lidar com mensagens excluídas
async function handleMessageRevoked(instanceId, after, before) {
    try {
        // Verificar se a mensagem excluída não foi enviada por nós mesmos
        if (before && before.fromMe) {
            console.log(`Mensagem excluída era nossa, ignorando...`);
            return;
        }

        // Verificar se a mensagem excluída estava vazia ou nula
        const mensagemAntes = before ? before.body : null;
        
        if (!mensagemAntes || mensagemAntes.trim() === '') {
            console.log(`ℹ️ Mensagem excluída estava vazia, não enviando resposta automática`);
            return;
        }

        // Obter o número do destinatário (quem enviou a mensagem original)
        const destinatario = before ? before.from : after.from;
        
        if (!destinatario) {
            console.log(`Não foi possível identificar o destinatário da mensagem excluída`);
            return;
        }

        console.log(`📤 Enviando mensagem automática para ${destinatario} após exclusão de mensagem`);
        
        // Verificar se o destinatário já respondeu anteriormente
        const jaRespondeu = await verificarSeJaRespondeu(destinatario, instanceId);
        
        if (jaRespondeu) {
            console.log(`✅ Destinatário ${destinatario} já respondeu anteriormente, enviando mensagem mesmo assim conforme solicitado`);
        }
        
        // Mensagem automática com números de 0 a 10
        const mensagemAutomatica = "A resposta deve conter apenas números (0 a 10).";
        
        // Enviar mensagem usando a função existente
        await sendMessage(instanceId, destinatario, mensagemAutomatica);
        
        console.log(`✅ Mensagem automática enviada para ${destinatario} após exclusão`);
        
    } catch (error) {
        console.error(`❌ Erro ao processar mensagem excluída na instância ${instanceId}:`, error.message);
    }
}

// Função para verificar se o destinatário já respondeu anteriormente
async function verificarSeJaRespondeu(numeroDestinatario, instanceId) {
    try {
        // Importar função de verificação do nps-sync.js
        const { verificarRespostaAnterior } = require('./nps-sync.js');
        
        // Verificar se existe resposta anterior para este número
        const jaRespondeu = await verificarRespostaAnterior(numeroDestinatario, instanceId);
        
        return jaRespondeu;
        
    } catch (error) {
        console.error(`Erro ao verificar resposta anterior para ${numeroDestinatario}:`, error.message);
        // Em caso de erro, assumir que não respondeu para garantir o envio
        return false;
    }
}

// Limpeza periódica do cache de mensagens (a cada 1 hora)
setInterval(() => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000); // 1 hora em ms
    
    for (const [key, timestamp] of processedMessages.entries()) {
        if (timestamp < oneHourAgo) {
            processedMessages.delete(key);
        }
    }
    
    if (processedMessages.size > 0) {
        console.log(`🧹 Cache de mensagens limpo. Mensagens ativas: ${processedMessages.size}`);
    }
}, 60 * 60 * 1000); // 1 hora

// Função para processar mensagens recebidas e integrar com sistema NPS
async function processIncomingMessage(instanceId, message) {
    try {
        // Verificar se não é mensagem enviada por nós mesmos
        if (message.fromMe) {
            return;
        }
        
        // Verificar se a mensagem já foi processada (evitar duplicatas)
        const messageKey = `${instanceId}_${message.id._serialized}`;
        if (processedMessages.has(messageKey)) {
            return;
        }
        
        // Marcar mensagem como processada (manter apenas últimas 1000)
        processedMessages.set(messageKey, Date.now());
        if (processedMessages.size > 1000) {
            const oldestKey = processedMessages.keys().next().value;
            processedMessages.delete(oldestKey);
        }
        
        console.log(`📨 Mensagem recebida na instância ${instanceId}: ${message.body}`);
        
        // NOVA ABORDAGEM: Manter formato completo do WhatsApp (com @c.us)
        const numeroRemetente = message.from; // Manter formato: 5594981413567@c.us
        
        // Importar e chamar função de processamento NPS
        const { processarRespostaWhatsApp } = require('./nps-sync.js');
        
        const resultado = await processarRespostaWhatsApp(
            numeroRemetente,
            instanceId,
            message.body,
            message.id._serialized
        );
        
        if (resultado && resultado.success) {
            console.log(`✅ Resposta NPS processada: ${resultado.message}`);
        } else {
            console.log(`ℹ️  Mensagem processada: ${resultado?.message || 'Conversa não encontrada'}`);
        }
        
    } catch (error) {
        console.error(`❌ Erro ao processar mensagem da instância ${instanceId}:`, error.message);
    }
}

// Função para formatar número de telefone - PADRONIZADA (consistente com nps-sync.js)
function formatPhoneNumber(phoneNumber) {
    // Se já tem @c.us, retornar como está
    if (phoneNumber.includes('@c.us')) {
        return phoneNumber;
    }
    
    // Remove todos os caracteres não numéricos
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Garantir que tem código do país (55) se necessário
    if (!cleaned.startsWith('55')) {
        // Se tem 11 dígitos (ex: 94981413567), adicionar 55
        if (cleaned.length === 11) {
            cleaned = '55' + cleaned;
        }
        // Se tem 10 dígitos (ex: 4981413567), adicionar 55 + 9
        else if (cleaned.length === 10) {
            cleaned = '559' + cleaned;
        }
    }
    
    // Adicionar @c.us
    return cleaned + '@c.us';
}

// Função para enviar mensagem
async function sendMessage(instanceId, to, message) {
    console.log(`🔍 Verificando instância ${instanceId} para envio de mensagem...`);
    
    let instance = activeInstances.get(instanceId);
    
    // Se a instância não existe, tentar carregá-la
    if (!instance || !instance.client) {
        console.log(`⚠️ Instância ${instanceId} não encontrada no cache. Tentando carregar...`);
        
        try {
            // Buscar dados da instância na API
            const instanceData = await whatsappAPI.getById(instanceId);
            
            if (!instanceData) {
                throw new Error(`Instância ${instanceId} não encontrada na base de dados`);
            }
            
            if (instanceData.status_conexao !== 'ativa') {
                throw new Error(`Instância ${instanceId} não está ativa. Status: ${instanceData.status_conexao}`);
            }
            
            // Tentar criar/carregar a instância
            console.log(`🔄 Carregando instância ${instanceId}...`);
            await createWhatsAppInstance(instanceData);
            
            // Aguardar um momento para a instância inicializar
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Tentar novamente obter a instância
            instance = activeInstances.get(instanceId);
            
            if (!instance || !instance.client) {
                throw new Error(`Falha ao carregar instância ${instanceId}`);
            }
        } catch (loadError) {
            console.error(`❌ Erro ao carregar instância ${instanceId}:`, loadError.message);
            throw new Error(`Instância ${instanceId} não encontrada ou não pôde ser carregada: ${loadError.message}`);
        }
    }

    // Verificar se a instância está realmente conectada
    try {
        const state = await instance.client.getState();
        console.log(`📊 Status da instância ${instanceId}: ${state}`);
        
        if (state !== 'CONNECTED') {
            // Se não está conectada, aguardar um pouco e tentar novamente
            console.log(`⏳ Instância não conectada, aguardando conexão...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const newState = await instance.client.getState();
            if (newState !== 'CONNECTED') {
                throw new Error(`Instância ${instanceId} não está conectada. Status atual: ${newState}`);
            }
        }
    } catch (stateError) {
        console.error(`❌ Erro ao verificar estado da instância ${instanceId}:`, stateError.message);
        throw new Error(`Erro ao verificar estado da instância ${instanceId}: ${stateError.message}`);
    }

    try {
        // Formatar número de telefone
        const formattedNumber = formatPhoneNumber(to);
        console.log(`Tentando enviar mensagem para: ${formattedNumber}`);
        
        // Verificar se o número é válido
        const numberId = await instance.client.getNumberId(formattedNumber);
        if (!numberId) {
            throw new Error(`Número ${formattedNumber} não é válido ou não está no WhatsApp`);
        }
        
        // Enviar mensagem
        const result = await instance.client.sendMessage(numberId._serialized, message);
        console.log(`📤 Mensagem enviada pela instância ${instanceId} para ${formattedNumber}`);
        return result;
    } catch (error) {
        console.error(`Erro ao enviar mensagem pela instância ${instanceId}:`, error);
        
        // Se o erro é por número inválido/sem WhatsApp, não tentar fallback
        if (error.message.includes('não é válido ou não está no WhatsApp')) {
            console.log('❌ Número não possui conta WhatsApp - não tentando método alternativo');
            throw error;
        }
        
        // Tentar uma abordagem alternativa apenas para outros tipos de erro
        try {
            console.log('Tentando método alternativo de envio...');
            const formattedNumber = formatPhoneNumber(to);
            const result = await instance.client.sendMessage(formattedNumber, message);
            console.log(`📤 Mensagem enviada (alternativo) pela instância ${instanceId}`);
            return result;
        } catch (alternativeError) {
            console.error('Método alternativo também falhou:', alternativeError);
            throw new Error(`Falha ao enviar mensagem: ${error.message}`);
        }
    }
}

// Função para enviar mensagem com mídia (imagem)
async function sendMediaMessage(instanceId, to, message, media) {
    console.log(`🔍 Verificando instância ${instanceId} para envio de mídia...`);
    
    let instance = activeInstances.get(instanceId);
    
    // Se a instância não existe, tentar carregá-la
    if (!instance || !instance.client) {
        console.log(`⚠️ Instância ${instanceId} não encontrada no cache. Tentando carregar...`);
        
        try {
            // Buscar dados da instância na API
            const instanceData = await whatsappAPI.getById(instanceId);
            
            if (!instanceData) {
                throw new Error(`Instância ${instanceId} não encontrada na base de dados`);
            }
            
            if (instanceData.status_conexao !== 'ativa') {
                throw new Error(`Instância ${instanceId} não está ativa. Status: ${instanceData.status_conexao}`);
            }
            
            // Tentar criar/carregar a instância
            console.log(`🔄 Carregando instância ${instanceId}...`);
            await createWhatsAppInstance(instanceData);
            
            // Aguardar um momento para a instância inicializar
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Tentar novamente obter a instância
            instance = activeInstances.get(instanceId);
            
            if (!instance || !instance.client) {
                throw new Error(`Falha ao carregar instância ${instanceId}`);
            }
        } catch (loadError) {
            console.error(`❌ Erro ao carregar instância ${instanceId}:`, loadError.message);
            throw new Error(`Instância ${instanceId} não encontrada ou não pôde ser carregada: ${loadError.message}`);
        }
    }

    // Verificar se a instância está realmente conectada
    try {
        const state = await instance.client.getState();
        console.log(`📊 Status da instância ${instanceId}: ${state}`);
        
        if (state !== 'CONNECTED') {
            // Se não está conectada, aguardar um pouco e tentar novamente
            console.log(`⏳ Instância não conectada, aguardando conexão...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const newState = await instance.client.getState();
            if (newState !== 'CONNECTED') {
                throw new Error(`Instância ${instanceId} não está conectada. Status atual: ${newState}`);
            }
        }
    } catch (stateError) {
        console.error(`❌ Erro ao verificar estado da instância ${instanceId}:`, stateError.message);
        throw new Error(`Erro ao verificar estado da instância ${instanceId}: ${stateError.message}`);
    }

    try {
        // Formatar número de telefone
        const formattedNumber = formatPhoneNumber(to);
        console.log(`Tentando enviar mídia para: ${formattedNumber}`);
        
        // Verificar se o número é válido
        const numberId = await instance.client.getNumberId(formattedNumber);
        if (!numberId) {
            throw new Error(`Número ${formattedNumber} não é válido ou não está no WhatsApp`);
        }
        
        // Preparar objeto de mídia para whatsapp-web.js
        const { MessageMedia } = require('whatsapp-web.js');
        const mediaObject = new MessageMedia(media.mimetype, media.data, media.filename || 'image');
        
        // Enviar mídia com mensagem (caption)
        const result = await instance.client.sendMessage(numberId._serialized, mediaObject, { caption: message || '' });
        console.log(`📤 Mídia enviada pela instância ${instanceId} para ${formattedNumber}`);
        return result;
    } catch (error) {
        console.error(`Erro ao enviar mídia pela instância ${instanceId}:`, error);
        
        // Se o erro é por número inválido/sem WhatsApp, não tentar fallback
        if (error.message.includes('não é válido ou não está no WhatsApp')) {
            console.log('❌ Número não possui conta WhatsApp - não tentando método alternativo');
            throw error;
        }
        
        // Tentar uma abordagem alternativa apenas para outros tipos de erro
        try {
            console.log('Tentando método alternativo de envio de mídia...');
            const formattedNumber = formatPhoneNumber(to);
            const { MessageMedia } = require('whatsapp-web.js');
            const mediaObject = new MessageMedia(media.mimetype, media.data, media.filename || 'image');
            const result = await instance.client.sendMessage(formattedNumber, mediaObject, { caption: message || '' });
            console.log(`📤 Mídia enviada (alternativo) pela instância ${instanceId}`);
            return result;
        } catch (alternativeError) {
            console.error('Método alternativo de mídia também falhou:', alternativeError);
            throw new Error(`Falha ao enviar mídia: ${error.message}`);
        }
    }
}


// Função para limpar pasta de sessão de uma instância
async function cleanupInstanceSession(instanceId) {
    try {
        // Preferir caminho atual da instância no cache (suporta pastas alternativas fresh_*)
        const cached = activeInstances.get(instanceId);
        const cachedPath = cached?.instanceData?.session_path || cached?.sessionPath;
        const defaultPath = path.join(__dirname, 'sessions', `instance_${instanceId}`);
        const pathsToTry = Array.from(new Set([cachedPath, defaultPath].filter(Boolean)));

        for (const p of pathsToTry) {
            try {
                if (await fs.pathExists(p)) {
                    await fs.remove(p);
                    console.log(`Pasta de sessão removida: ${p}`);
                }
            } catch (innerErr) {
                console.warn(`Falha ao remover pasta ${p}: ${innerErr.message}`);
            }
        }
    } catch (error) {
        console.error(`Erro ao remover pasta da instância ${instanceId}:`, error);
    }
}

// Helper para destruir cliente de forma segura (evita falhas "Target closed")
async function safeDestroyClient(client) {
    if (!client) return;
    try {
        const page = client.pupPage;
        // Se a página já estiver fechada, evite chamar destroy() que pode avaliar no contexto
        const isClosed = !!(page && typeof page.isClosed === 'function' && page.isClosed());
        if (isClosed) {
            try {
                const browser = client.pupBrowser || (typeof client.pupBrowser === 'function' ? client.pupBrowser() : null);
                if (browser && typeof browser.close === 'function') {
                    await browser.close().catch(() => {});
                }
            } catch (_) {}
            try { client.removeAllListeners && client.removeAllListeners(); } catch (_) {}
            await new Promise(r => setTimeout(r, 200));
            return;
        }

        await client.destroy();
    } catch (error) {
        const msg = error?.message || String(error);
        // Erros esperados quando o alvo/aba já foi fechado
        const expected = (
            msg.includes('Target closed') ||
            msg.includes('Protocol error (Runtime.callFunctionOn)') ||
            msg.includes('Session closed') ||
            msg.includes('Target not found') ||
            msg.includes('Browser has been closed') ||
            msg.includes('Connection closed')
        );
        if (expected) {
            console.warn(`safeDestroyClient: ignorando erro esperado ao destruir cliente: ${msg}`);
        } else {
            console.warn(`safeDestroyClient: erro ao destruir cliente: ${msg}`);
        }
        try {
            const browser = client.pupBrowser || (typeof client.pupBrowser === 'function' ? client.pupBrowser() : null);
            if (browser && typeof browser.close === 'function') {
                await browser.close().catch(() => {});
            }
        } catch (_) {}
    }
    try { client.removeAllListeners && client.removeAllListeners(); } catch (_) {}
    await new Promise(r => setTimeout(r, 200));
}

// Função para parar e limpar uma instância
async function stopAndCleanInstance(instanceId) {
    try {
        // Parar instância se estiver ativa
        const instance = activeInstances.get(instanceId);
        if (instance) {
            console.log(`Parando instância ${instanceId}...`);
            await safeDestroyClient(instance.client);
            activeInstances.delete(instanceId);
        }
        
        // Limpar pasta de sessão
        await cleanupInstanceSession(instanceId);
        
        console.log(`Instância ${instanceId} parada e limpa com sucesso`);
    } catch (error) {
        console.error(`Erro ao parar e limpar instância ${instanceId}:`, error);
    }
}

// Função para verificar instâncias removidas via API
async function checkRemovedInstances() {
    try {
        // Obter IDs das instâncias ativas no sistema
        const activeInstanceIds = Array.from(activeInstances.keys());
        
        if (activeInstanceIds.length === 0) {
            return;
        }
        
        // Verificar quais instâncias ainda existem via API
        const existingIds = await whatsappAPI.checkExistingIds(activeInstanceIds);
        const removedIds = activeInstanceIds.filter(id => !existingIds.includes(id));
        
        // Parar e limpar instâncias removidas
        for (const instanceId of removedIds) {
            console.log(`Detectada instância removida do banco: ${instanceId}`);
            await stopAndCleanInstance(instanceId);
        }
        
    } catch (error) {
        console.error('Erro ao verificar instâncias removidas:', error);
    }
}

/**
 * SISTEMA DE VERIFICAÇÃO PERIÓDICA DE INSTÂNCIAS
 * 
 * Este sistema implementa duas verificações automáticas:
 * 
 * 1. checkRemovedInstances() - A cada 30 segundos
 *    - Verifica se instâncias ativas no cache foram removidas do banco
 *    - Para e limpa instâncias que não existem mais
 *    - Evita instâncias órfãs no sistema
 * 
 * 2. checkNewInstances() - A cada 45 segundos  
 *    - Verifica se existem novas instâncias ativas no banco
 *    - Carrega automaticamente instâncias que ainda não estão no cache
 *    - Permite detecção automática de instâncias criadas via dashboard
 * 
 * Os intervalos são diferentes para evitar conflitos e distribuir a carga.
 * Ambas as verificações são não-bloqueantes e têm tratamento de erro robusto.
 */

// Função para verificar e carregar novas instâncias
async function checkNewInstances() {
    try {
        // Obter todas as instâncias ativas do banco
        const allInstances = await whatsappAPI.getByStatus('ativa');
        
        // Obter IDs das instâncias que já estão no cache (independente do status)
        const activeInstanceIds = Array.from(activeInstances.keys());
        const newInstances = [];
        
        for (const instance of allInstances) {
            const isInCache = activeInstanceIds.includes(instance.id);
            
            // Carregar apenas instâncias que não estão no cache
            if (!isInCache) {
                newInstances.push(instance);
            }
        }
        
        // Carregar apenas instâncias que realmente não estão no cache e não estão conectando
        if (newInstances.length > 0) {
            console.log(`🆕 Detectadas ${newInstances.length} nova(s) instância(s): ${newInstances.map(i => `${i.identificador} (ID: ${i.id})`).join(', ')}`);
            
            for (const instance of newInstances) {
                // Verificar novamente se a instância já não foi adicionada ao cache
                // (proteção adicional contra condições de corrida)
                if (activeInstances.has(instance.id)) {
                    console.log(`⚠️ Instância ${instance.identificador} (ID: ${instance.id}) já está no cache, pulando...`);
                    continue;
                }
                
                try {
                    console.log(`🔄 Inicializando nova instância ${instance.identificador} (ID: ${instance.id})...`);
                    
                    // Confirmar que a instância ainda existe no banco (evita 404 intermitente)
                    const existsNow = await whatsappAPI.getById(instance.id).catch(() => null);
                    if (!existsNow) {
                        console.log(`⚠️ Instância ${instance.identificador} (ID: ${instance.id}) não encontrada na API. Pulando inicialização.`);
                        continue;
                    }
                    
                    await createWhatsAppInstance(instance);
                    
                    // Aguardar um pouco entre as inicializações para evitar sobrecarga
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Validar se a instância foi carregada corretamente
                    const validation = await validateInstanceForSending(instance.id);
                    if (validation.ready) {
                        console.log(`✅ Nova instância ${instance.identificador} (ID: ${instance.id}) carregada e pronta`);
                    } else {
                        console.log(`⚠️ Nova instância ${instance.identificador} (ID: ${instance.id}) carregada mas não pronta: ${validation.reason}`);
                    }
                } catch (error) {
                    console.error(`❌ Erro ao carregar nova instância ${instance.identificador} (ID: ${instance.id}):`, error.message);
                    
                    // Se houve erro, limpar a instância do cache para permitir nova tentativa
                    activeInstances.delete(instance.id);
                    await updateInstanceStatus(instance.id, 'erro');
                }
            }
            
            console.log(`📊 Resumo após carregar novas instâncias: ${activeInstances.size} instâncias ativas no cache`);
        }
        
    } catch (error) {
        console.error('Erro ao verificar novas instâncias:', error);
    }
}

// Função para validar se uma instância está pronta para envio
async function validateInstanceForSending(instanceId) {
    try {
        const instance = activeInstances.get(instanceId);
        
        if (!instance || !instance.client) {
            return { ready: false, reason: 'Instância não encontrada no cache' };
        }
        
        const state = await instance.client.getState();
        
        if (state !== 'CONNECTED') {
            return { ready: false, reason: `Status: ${state}` };
        }
        
        return { ready: true, reason: 'Conectada' };
    } catch (error) {
        return { ready: false, reason: `Erro: ${error.message}` };
    }
}

// Função para validar se um número possui conta WhatsApp
async function validateWhatsAppNumber(instanceId, phoneNumber) {
    console.log(`🔍 Validando número WhatsApp: ${phoneNumber} via instância ${instanceId}`);
    
    // Primeiro, verificar se o resultado já está no cache
    const cachedResult = getNumberValidationFromCache(phoneNumber);
    if (cachedResult) {
        console.log(`📋 Usando resultado do cache para: ${phoneNumber}`);
        return cachedResult;
    }
    
    let instance = activeInstances.get(instanceId);
    
    // Se a instância não existe, tentar carregá-la
    if (!instance || !instance.client) {
        console.log(`⚠️ Instância ${instanceId} não encontrada no cache. Tentando carregar...`);
        
        try {
            // Buscar dados da instância na API
            const instanceData = await whatsappAPI.getById(instanceId);
            
            if (!instanceData) {
                throw new Error(`Instância ${instanceId} não encontrada na base de dados`);
            }
            
            if (instanceData.status_conexao !== 'ativa') {
                throw new Error(`Instância ${instanceId} não está ativa. Status: ${instanceData.status_conexao}`);
            }
            
            // Tentar criar/carregar a instância
            console.log(`🔄 Carregando instância ${instanceId}...`);
            await createWhatsAppInstance(instanceData);
            
            // Aguardar um momento para a instância inicializar
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Tentar novamente obter a instância
            instance = activeInstances.get(instanceId);
            
            if (!instance || !instance.client) {
                throw new Error(`Falha ao carregar instância ${instanceId}`);
            }
        } catch (loadError) {
            console.error(`❌ Erro ao carregar instância ${instanceId}:`, loadError.message);
            throw new Error(`Instância ${instanceId} não encontrada ou não pôde ser carregada: ${loadError.message}`);
        }
    }

    // Verificar se a instância está realmente conectada
    try {
        const state = await instance.client.getState();
        console.log(`📊 Status da instância ${instanceId}: ${state}`);
        
        if (state !== 'CONNECTED') {
            // Se não está conectada, aguardar um pouco e tentar novamente
            console.log(`⏳ Instância não conectada, aguardando conexão...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const newState = await instance.client.getState();
            if (newState !== 'CONNECTED') {
                throw new Error(`Instância ${instanceId} não está conectada. Status atual: ${newState}`);
            }
        }
    } catch (stateError) {
        console.error(`❌ Erro ao verificar estado da instância ${instanceId}:`, stateError.message);
        throw new Error(`Erro ao verificar estado da instância ${instanceId}: ${stateError.message}`);
    }

    try {
        // Formatar número de telefone
        const formattedNumber = formatPhoneNumber(phoneNumber);
        console.log(`🔍 Verificando número formatado: ${formattedNumber}`);
        
        // Verificar se o número possui conta WhatsApp
        const numberId = await instance.client.getNumberId(formattedNumber);
        
        if (numberId) {
            console.log(`✅ Número ${formattedNumber} possui conta WhatsApp`);
            console.log(`   ID serializado: ${numberId._serialized}`);
            
            const result = {
                hasWhatsApp: true,
                formattedNumber: formattedNumber,
                numberId: numberId._serialized,
                originalNumber: phoneNumber
            };
            
            // Salvar resultado no cache
            saveNumberValidationToCache(phoneNumber, result);
            
            return result;
        } else {
            console.log(`❌ Número ${formattedNumber} NÃO possui conta WhatsApp`);
            
            const result = {
                hasWhatsApp: false,
                formattedNumber: formattedNumber,
                numberId: null,
                originalNumber: phoneNumber
            };
            
            // Salvar resultado no cache
            saveNumberValidationToCache(phoneNumber, result);
            
            return result;
        }
        
    } catch (error) {
        console.error(`❌ Erro ao validar número ${phoneNumber}:`, error.message);
        
        // Se houve erro na validação, assumir que não tem WhatsApp
        const result = {
            hasWhatsApp: false,
            formattedNumber: formatPhoneNumber(phoneNumber),
            numberId: null,
            originalNumber: phoneNumber,
            error: error.message
        };
        
        // Salvar resultado no cache (mesmo com erro, para evitar tentativas repetidas)
        saveNumberValidationToCache(phoneNumber, result);
        
        return result;
    }
}

// Função para carregar e inicializar todas as instâncias via API
async function loadAllInstances() {
    try {
        const instances = await whatsappAPI.getByStatus('ativa');

        console.log(`Carregando ${instances.length} instâncias ativas...`);
        
        for (const instance of instances) {
            try {
                console.log(`🔄 Inicializando instância ${instance.identificador} (reutilizando sessão quando disponível)...`);
                await createWhatsAppInstance(instance);
                
                // Aguardar um pouco entre as inicializações para evitar sobrecarga
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Validar se a instância foi carregada corretamente (usa ID numérico)
                const validation = await validateInstanceForSending(instance.id);
                if (validation.ready) {
                    console.log(`✅ Instância ${instance.identificador} carregada e pronta`);
                } else {
                    console.log(`⚠️ Instância ${instance.identificador} carregada mas não pronta: ${validation.reason}`);
                }
            } catch (error) {
                console.error(`❌ Erro ao carregar instância ${instance.identificador}:`, error.message);
            }
        }
        
        console.log(`📊 Resumo: ${activeInstances.size} instâncias carregadas no cache`);
    } catch (error) {
        console.error('Erro ao carregar instâncias:', error);
    }
}

// Rotas da API
app.get('/api/instances', async (req, res) => {
    try {
        const instances = await whatsappAPI.list();
        res.json(instances);
    } catch (error) {
        console.error('Erro ao buscar instâncias:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/instances/:id/restart', async (req, res) => {
    try {
        const instanceId = parseInt(req.params.id);
        
        console.log(`🔄 Iniciando reinicialização da instância ${instanceId}...`);
        
        // Parar instância atual se existir
        const existingInstance = activeInstances.get(instanceId);
        if (existingInstance) {
            console.log(`⏹️ Parando instância ${instanceId} existente...`);
            console.log(`🔧 Destruindo cliente da instância ${instanceId} (safe)...`);
            await safeDestroyClient(existingInstance.client);
            console.log(`🗑️ Cliente da instância ${instanceId} destruído com sucesso (safe)`);
            
            activeInstances.delete(instanceId);
            console.log(`✅ Instância ${instanceId} removida do cache`);
            
            // Aguardar um pouco para garantir limpeza completa
            console.log(`⏳ Aguardando 2 segundos para limpeza completa...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
            console.log(`📝 Instância ${instanceId} não estava no cache, prosseguindo com reinicialização...`);
        }

        // Buscar dados da instância via API
        console.log(`🔍 Buscando dados da instância ${instanceId} via API...`);
        const instance = await whatsappAPI.getById(instanceId);
        console.log(`📊 Dados da instância ${instanceId} (${instance.identificador}) obtidos:`, {
            id: instance.id,
            identificador: instance.identificador,
            nome: instance.nome,
            status: instance.status
        });

        // Reiniciar instância
        console.log(`🚀 Criando nova instância WhatsApp ${instanceId} (${instance.identificador})...`);
        
        try {
            // Limpar sessão possivelmente bloqueada antes de recriar
            await cleanLockedSession(instanceId);
            const newClient = await createWhatsAppInstance(instance);
            console.log(`✨ Instância ${instanceId} (${instance.identificador}) reiniciada com sucesso!`);
            console.log(`📊 Status final no cache:`, activeInstances.has(instanceId) ? 'PRESENTE' : 'AUSENTE');
        } catch (createError) {
            console.error(`❌ Erro ao criar instância ${instanceId}:`, createError);
            throw createError;
        }
        
        res.json({ 
            message: 'Instância reiniciada com sucesso',
            instanceId: instanceId,
            identificador: instance.identificador,
            inCache: activeInstances.has(instanceId)
        });
    } catch (error) {
        console.error('Erro ao reiniciar instância:', error);
        if (error.message.includes('não encontrada')) {
            res.status(404).json({ error: 'Instância não encontrada' });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
});

// Endpoint para verificar status de uma instância
app.get('/api/instances/:id/status', async (req, res) => {
    try {
        const instanceId = parseInt(req.params.id);
        
        const validation = await validateInstanceForSending(instanceId);
        
        res.json({
            instanceId: instanceId,
            ready: validation.ready,
            reason: validation.reason,
            inCache: activeInstances.has(instanceId)
        });
    } catch (error) {
        console.error('Erro ao verificar status da instância:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para validar se um número possui conta WhatsApp
app.post('/api/instances/:id/validate-number', async (req, res) => {
    try {
        const instanceId = parseInt(req.params.id);
        const { number } = req.body;

        if (!number) {
            return res.status(400).json({ error: 'Parâmetro "number" é obrigatório' });
        }
        
        // Validar instância antes de verificar número
        console.log(`📋 Validando instância ${instanceId} para verificação de número...`);
        const validation = await validateInstanceForSending(instanceId);
        
        if (!validation.ready) {
            console.log(`⚠️ Instância ${instanceId} não está pronta: ${validation.reason}`);
            return res.status(400).json({ 
                error: `Instância não está pronta: ${validation.reason}`,
                instanceId: instanceId,
                ready: false
            });
        }
        
        const result = await validateWhatsAppNumber(instanceId, number);
        
        res.json({
            success: true,
            number: number,
            hasWhatsApp: result.hasWhatsApp,
            formattedNumber: result.formattedNumber,
            numberId: result.numberId,
            instanceId: instanceId
        });
        
    } catch (error) {
        console.error('Erro ao validar número WhatsApp:', error);
        
        // Determinar código de status baseado no tipo de erro
        let statusCode = 500;
        if (error.message.includes('não encontrada') || error.message.includes('não está ativa')) {
            statusCode = 404;
        } else if (error.message.includes('não está conectada') || error.message.includes('não pôde ser carregada')) {
            statusCode = 503; // Service Unavailable
        }
        
        res.status(statusCode).json({ 
            success: false,
            error: error.message,
            hasWhatsApp: false
        });
    }
});

app.post('/api/instances/:id/send-message', async (req, res) => {
    try {
        const instanceId = parseInt(req.params.id);
        const { to, message, idempotencyKey } = req.body;

        if (!to || !message) {
            return res.status(400).json({ error: 'Parâmetros "to" e "message" são obrigatórios' });
        }
        
        // Idempotency: return cached response if present and fresh
        if (idempotencyKey) {
            const cached = outgoingIdempotency.get(idempotencyKey);
            if (cached && cached.response && (Date.now() - cached.timestamp) <= IDEMPOTENCY_TTL_MS) {
                return res.json(cached.response);
            }
        }
        
        // Validar instância antes de tentar enviar
        console.log(`📋 Validando instância ${instanceId} antes do envio...`);
        const validation = await validateInstanceForSending(instanceId);
        
        if (!validation.ready) {
            console.log(`⚠️ Instância ${instanceId} não está pronta: ${validation.reason}`);
            return res.status(400).json({ 
                error: `Instância não está pronta para envio: ${validation.reason}`,
                instanceId: instanceId,
                ready: false
            });
        }
        
        console.log(`✅ Instância ${instanceId} validada, enviando mensagem...`);
        const result = await sendMessage(instanceId, to, message);
        const responsePayload = { 
            success: true, 
            messageId: result.id._serialized,
            instanceId: instanceId
        };
        // Cache successful response for idempotency
        if (idempotencyKey) {
            outgoingIdempotency.set(idempotencyKey, { timestamp: Date.now(), response: responsePayload });
        }
        res.json(responsePayload);
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        
        // Determinar código de status baseado no tipo de erro
        let statusCode = 500;
        if (error.message.includes('não encontrada') || error.message.includes('não está ativa')) {
            statusCode = 404;
        } else if (error.message.includes('não está conectada') || error.message.includes('não pôde ser carregada')) {
            statusCode = 503; // Service Unavailable
        }
        
        res.status(statusCode).json({ error: error.message });
    }
});

// Endpoint para enviar mensagem com mídia (imagem)
app.post('/api/instances/:id/send-media', async (req, res) => {
    try {
        const instanceId = parseInt(req.params.id);
        const { to, message, media, idempotencyKey } = req.body;

        if (!to) {
            return res.status(400).json({ error: 'Parâmetro "to" é obrigatório' });
        }
        
        if (!media || !media.data || !media.mimetype) {
            return res.status(400).json({ error: 'Parâmetros "media.data" e "media.mimetype" são obrigatórios' });
        }
        
        // Idempotency: return cached response if present and fresh
        if (idempotencyKey) {
            const cached = outgoingIdempotency.get(idempotencyKey);
            if (cached && cached.response && (Date.now() - cached.timestamp) <= IDEMPOTENCY_TTL_MS) {
                return res.json(cached.response);
            }
        }
        
        // Validar instância antes de tentar enviar
        console.log(`📋 Validando instância ${instanceId} antes do envio de mídia...`);
        const validation = await validateInstanceForSending(instanceId);
        
        if (!validation.ready) {
            console.log(`⚠️ Instância ${instanceId} não está pronta: ${validation.reason}`);
            return res.status(400).json({ 
                error: `Instância não está pronta para envio: ${validation.reason}`,
                instanceId: instanceId,
                ready: false
            });
        }
        
        console.log(`✅ Instância ${instanceId} validada, enviando mídia...`);
        const result = await sendMediaMessage(instanceId, to, message, media);
        const responsePayload = { 
            success: true, 
            messageId: result.id._serialized,
            instanceId: instanceId
        };
        // Cache successful response for idempotency
        if (idempotencyKey) {
            outgoingIdempotency.set(idempotencyKey, { timestamp: Date.now(), response: responsePayload });
        }
        res.json(responsePayload);
    } catch (error) {
        console.error('Erro ao enviar mídia:', error);
        
        // Determinar código de status baseado no tipo de erro
        let statusCode = 500;
        if (error.message.includes('não encontrada') || error.message.includes('não está ativa')) {
            statusCode = 404;
        } else if (error.message.includes('não está conectada') || error.message.includes('não pôde ser carregada')) {
            statusCode = 503; // Service Unavailable
        }
        
        res.status(statusCode).json({ error: error.message });
    }
});

// Endpoint para enviar botões interativos NPS

// Endpoint para parar uma instância específica
app.delete('/api/instances/:id/stop', async (req, res) => {
    try {
        const instanceId = parseInt(req.params.id);
        
        await stopAndCleanInstance(instanceId);
        
        res.json({ 
            success: true, 
            message: `Instância ${instanceId} parada e limpa com sucesso` 
        });
    } catch (error) {
        console.error('Erro ao parar instância:', error);
        res.status(500).json({ error: error.message });
    }
});

// WebSocket removido - dashboard usa polling HTTP para atualizações

// Inicialização do servidor
async function startServer() {
    const PORT = process.env.WHATSAPP_PORT || 3232;
    
    try {
        console.log('\n=== INICIANDO WHATSAPP MANAGER ===');
        
        // Primeiro, testar conexão com a API
        console.log('1. Testando conexão com a API...');
        const apiConnected = await testDatabaseConnection();
        
        if (!apiConnected) {
            console.error('ERRO CRÍTICO: Não foi possível conectar à API!');
            console.error('Verifique as configurações no arquivo .env:');
            console.error('- API_BASE_URL (URL da API)');
            console.error('- API_TOKEN (Token de autenticação)');
            process.exit(1);
        }
        
        // Carregar todas as instâncias
        console.log('2. Carregando instâncias WhatsApp...');
        await loadAllInstances();
        
        // Configurar verificação periódica de instâncias removidas (a cada 30 segundos)
        setInterval(checkRemovedInstances, 30000);
        console.log('3. Verificação periódica de instâncias removidas configurada (30s)');
        
        // Configurar verificação periódica de novas instâncias (a cada 45 segundos)
        setInterval(checkNewInstances, 10000);
        console.log('4. Verificação periódica de novas instâncias configurada (10s)');
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`\n✓ Servidor WhatsApp Manager rodando na porta ${PORT}`);
            console.log(`✓ API REST disponível para controle de instâncias`);
            console.log(`✓ Endpoints disponíveis:`);
            console.log(`  - GET /api/instances - Listar instâncias`);
            console.log(`  - POST /api/instances/:id/restart - Reiniciar instância`);
            console.log(`  - DELETE /api/instances/:id/stop - Parar instância`);
            console.log(`  - POST /api/instances/:id/send - Enviar mensagem`);
            console.log('=====================================\n');
        });
    } catch (error) {
        console.error('\n=== ERRO AO INICIAR SERVIDOR ===');
        console.error('Erro:', error.message);
        console.error('Stack:', error.stack);
        console.error('===============================\n');
        process.exit(1);
    }
}

// Tratamento de sinais para encerramento gracioso
process.on('SIGINT', async () => {
    console.log('Encerrando aplicação...');
    
    // Fechar todas as instâncias
    for (const [instanceId, instance] of activeInstances) {
        try {
            await safeDestroyClient(instance.client);
            console.log(`Instância ${instanceId} encerrada`);
        } catch (error) {
            console.error(`Erro ao encerrar instância ${instanceId}:`, error);
        }
    }
    
    process.exit(0);
});

// Iniciar aplicação
if (require.main === module) {
    startServer();
}

module.exports = {
    createWhatsAppInstance,
    sendMessage,
    stopAndCleanInstance,
    checkRemovedInstances,
    checkNewInstances,
    activeInstances
};
