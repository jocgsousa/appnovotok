require('dotenv/config');
const { Client, LocalAuth, Buttons } = require('whatsapp-web.js');
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
        const updateData = {
            status_conexao: status
        };

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

        await whatsappAPI.updateStatus(instanceId, updateData);
        
        // Status atualizado via API - dashboard fará polling para obter atualizações

        console.log(`Status da instância ${instanceId} atualizado para: ${status}`);
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
        
        if (fs.existsSync(sessionPath)) {
            console.log(`🧹 Limpando sessão bloqueada da instância ${instanceId}...`);
            
            // Tentar remover diretório de sessão com força
            try {
                fs.removeSync(sessionPath);
                console.log(`✅ Sessão da instância ${instanceId} removida com sucesso`);
            } catch (removeError) {
                console.log(`⚠️ Não foi possível remover sessão da instância ${instanceId}, tentando renomear...`);
                
                // Se não conseguir remover, tentar renomear para backup
                const backupPath = `${sessionPath}_backup_${Date.now()}`;
                try {
                    fs.moveSync(sessionPath, backupPath);
                    console.log(`✅ Sessão da instância ${instanceId} movida para backup`);
                } catch (moveError) {
                    console.log(`⚠️ Não foi possível mover sessão da instância ${instanceId}, continuando mesmo assim...`);
                }
            }
            
            // Aguardar um pouco para o sistema liberar os recursos
            await new Promise(resolve => setTimeout(resolve, 1000));
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
        console.log(`🏗️ Iniciando criação da instância ${identificador} (ID: ${id})`);
        
        // Criar diretório de sessão
        console.log(`📁 Criando diretório de sessão para instância ${id}...`);
        const sessionPath = createSessionDir(id);
        console.log(`✅ Diretório de sessão criado: ${sessionPath}`);
        
        // Atualizar caminho da sessão via API
        console.log(`🔄 Atualizando caminho da sessão via API para instância ${id}...`);
        await whatsappAPI.updateStatus(id, {
            session_path: sessionPath
        });
        console.log(`✅ Caminho da sessão atualizado via API`);

        // Configurar cliente WhatsApp
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `instance_${id}`,
                dataPath: sessionPath
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        // Event listeners
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

        // Inicializar cliente
        console.log(`🔄 Atualizando status para 'conectando' para instância ${id}...`);
        await updateInstanceStatus(id, 'conectando');
        console.log(`✅ Status atualizado para 'conectando'`);
        
        console.log(`🚀 Inicializando cliente WhatsApp para instância ${id}...`);
        await client.initialize();
        console.log(`✅ Cliente WhatsApp inicializado com sucesso para instância ${id}`);
        
        // Armazenar instância ativa
        console.log(`💾 Armazenando instância ${id} no cache...`);
        activeInstances.set(id, {
            client,
            instanceData,
            status: 'conectando'
        });
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

// Função para enviar botões interativos NPS (0 a 10)
async function sendNPSButtons(instanceId, to, message, title = 'Pesquisa de Satisfação', footer = 'Selecione sua nota abaixo') {
    console.log(`🔍 Verificando instância ${instanceId} para envio de botões NPS...`);
    
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
                throw new Error(`Instância ${instanceId} não está conectada. Estado: ${newState}`);
            }
        }
    } catch (stateError) {
        console.error(`❌ Erro ao verificar estado da instância ${instanceId}:`, stateError.message);
        throw new Error(`Falha na verificação do estado da instância: ${stateError.message}`);
    }

    // Formatar número de destino
    const formattedTo = formatPhoneNumber(to);
    console.log(`📱 Enviando botões NPS para: ${formattedTo}`);

    try {
        // Verificar se o número é válido
        const numberId = await instance.client.getNumberId(formattedTo);
        if (!numberId) {
            // Número inválido, não tentar fallback
            throw new Error(`Número ${formattedTo} não possui conta WhatsApp ativa`);
        }

        // Criar botões de 0 a 10 para NPS
        const npsButtons = [];
        for (let i = 0; i <= 10; i++) {
            npsButtons.push({ body: i.toString() });
        }

        // Criar objeto Buttons
        const buttons = new Buttons(
            message,
            npsButtons,
            title,
            footer
        );

        // Enviar botões
        const result = await instance.client.sendMessage(numberId._serialized, buttons);
        console.log(`✅ Botões NPS enviados com sucesso para ${formattedTo}`);
        console.log(`📄 ID da mensagem: ${result.id._serialized}`);
        
        return {
            success: true,
            messageId: result.id._serialized,
            to: formattedTo,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`❌ Erro ao enviar botões NPS para ${formattedTo}:`, error.message);
        
        // Se o erro for relacionado ao número inválido, não tentar fallback
        if (error.message.includes('não possui conta WhatsApp')) {
            throw error;
        }
        
        // Para outros erros, tentar método alternativo (mensagem de texto simples)
        console.log(`🔄 Tentando método alternativo (texto simples)...`);
        try {
            const fallbackMessage = `${message}\n\n` +
                'Por favor, responda com um número de 0 a 10:\n' +
                '0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟\n\n' +
                'Digite apenas o número (exemplo: 8)';
            
            const fallbackResult = await instance.client.sendMessage(formattedTo, fallbackMessage);
            console.log(`✅ Mensagem NPS alternativa enviada com sucesso para ${formattedTo}`);
            
            return {
                success: true,
                messageId: fallbackResult.id._serialized,
                to: formattedTo,
                timestamp: new Date().toISOString(),
                fallback: true
            };
        } catch (alternativeError) {
            console.error('Método alternativo de botões também falhou:', alternativeError);
            throw new Error(`Falha ao enviar botões NPS: ${error.message}`);
        }
    }
}

// Função para limpar pasta de sessão de uma instância
async function cleanupInstanceSession(instanceId) {
    try {
        const sessionPath = path.join(__dirname, 'sessions', `instance_${instanceId}`);
        if (await fs.pathExists(sessionPath)) {
            await fs.remove(sessionPath);
            console.log(`Pasta de sessão removida: ${sessionPath}`);
        }
    } catch (error) {
        console.error(`Erro ao remover pasta da instância ${instanceId}:`, error);
    }
}

// Função para parar e limpar uma instância
async function stopAndCleanInstance(instanceId) {
    try {
        // Parar instância se estiver ativa
        const instance = activeInstances.get(instanceId);
        if (instance) {
            console.log(`Parando instância ${instanceId}...`);
            await instance.client.destroy();
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
        
        // Verificar instâncias que precisam ser reiniciadas (status 'conectando' no banco)
        const instancesToRestart = [];
        const newInstances = [];
        
        for (const instance of allInstances) {
            const isInCache = activeInstanceIds.includes(instance.id);
            
            // CASO 1: Instância com status 'conectando' no banco (restart solicitado)
            if (instance.status_conexao === 'conectando') {
                if (isInCache) {
                    // Instância está no cache mas banco pede restart
                    console.log(`🔄 RESTART DETECTADO: Instância ${instance.identificador} (ID: ${instance.id}) precisa ser reiniciada`);
                    instancesToRestart.push(instance);
                } else {
                    // Instância não está no cache e tem status 'conectando'
                    console.log(`🔄 Instância ${instance.identificador} (ID: ${instance.id}) com status 'conectando' não está no cache - será inicializada`);
                    newInstances.push(instance);
                }
            }
            // CASO 2: Instância nova (não está no cache)
            else if (!isInCache) {
                newInstances.push(instance);
            }
        }
        
        // PRIMEIRO: Processar restarts (instâncias que estão no cache mas precisam reiniciar)
        for (const instance of instancesToRestart) {
            try {
                console.log(`🔄 Executando restart da instância ${instance.identificador} (ID: ${instance.id})...`);
                
                // Parar instância atual
                const existingInstance = activeInstances.get(instance.id);
                if (existingInstance) {
                    console.log(`⏹️ Parando instância ${instance.id} para restart...`);
                    try {
                        await existingInstance.client.destroy();
                        console.log(`🗑️ Cliente da instância ${instance.id} destruído`);
                    } catch (destroyError) {
                        console.warn(`⚠️ Erro ao destruir cliente da instância ${instance.id}:`, destroyError.message);
                    }
                    activeInstances.delete(instance.id);
                }
                
                // Aguardar limpeza
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Limpar sessão bloqueada
                await cleanLockedSession(instance.id);
                
                // Recriar instância
                console.log(`🚀 Recriando instância ${instance.identificador} (ID: ${instance.id})...`);
                await createWhatsAppInstance(instance);
                console.log(`✨ Restart da instância ${instance.identificador} (ID: ${instance.id}) concluído!`);
                
            } catch (error) {
                console.error(`❌ Erro no restart da instância ${instance.identificador} (ID: ${instance.id}):`, error.message);
                await updateInstanceStatus(instance.id, 'erro');
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
                    
                    // Limpar sessão bloqueada se existir
                    await cleanLockedSession(instance.id);
                    
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
                console.log(`🔄 Inicializando instância ${instance.identificador}...`);
                await createWhatsAppInstance(instance);
                
                // Aguardar um pouco entre as inicializações para evitar sobrecarga
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Validar se a instância foi carregada corretamente
                const validation = await validateInstanceForSending(instance.identificador);
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
            try {
                console.log(`🔧 Destruindo cliente da instância ${instanceId}...`);
                await existingInstance.client.destroy();
                console.log(`🗑️ Cliente da instância ${instanceId} destruído com sucesso`);
            } catch (destroyError) {
                console.warn(`⚠️ Erro ao destruir cliente da instância ${instanceId}:`, destroyError.message);
                // Continuar mesmo com erro na destruição
            }
            
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
        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({ error: 'Parâmetros "to" e "message" são obrigatórios' });
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
        
        res.json({ 
            success: true, 
            messageId: result.id._serialized,
            instanceId: instanceId
        });
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
        const { to, message, media } = req.body;

        if (!to) {
            return res.status(400).json({ error: 'Parâmetro "to" é obrigatório' });
        }
        
        if (!media || !media.data || !media.mimetype) {
            return res.status(400).json({ error: 'Parâmetros "media.data" e "media.mimetype" são obrigatórios' });
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
        
        res.json({ 
            success: true, 
            messageId: result.id._serialized,
            instanceId: instanceId
        });
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
app.post('/api/instances/:id/send-nps-buttons', async (req, res) => {
    try {
        const instanceId = parseInt(req.params.id);
        const { to, message, title, footer } = req.body;

        if (!to || !message) {
            return res.status(400).json({ error: 'Parâmetros "to" e "message" são obrigatórios' });
        }
        
        // Validar instância antes de tentar enviar
        console.log(`📋 Validando instância ${instanceId} antes do envio de botões NPS...`);
        const validation = await validateInstanceForSending(instanceId);
        
        if (!validation.ready) {
            console.log(`⚠️ Instância ${instanceId} não está pronta: ${validation.reason}`);
            return res.status(400).json({ 
                error: `Instância não está pronta para envio: ${validation.reason}`,
                instanceId: instanceId,
                ready: false
            });
        }
        
        console.log(`✅ Instância ${instanceId} validada, enviando botões NPS...`);
        const result = await sendNPSButtons(instanceId, to, message, title, footer);
        
        res.json({ 
            success: true, 
            messageId: result.messageId,
            to: result.to,
            timestamp: result.timestamp,
            fallback: result.fallback || false,
            instanceId: instanceId
        });
    } catch (error) {
        console.error('Erro ao enviar botões NPS:', error);
        
        // Determinar código de status baseado no tipo de erro
        let statusCode = 500;
        if (error.message.includes('não encontrada') || error.message.includes('não está ativa')) {
            statusCode = 404;
        } else if (error.message.includes('não está conectada') || error.message.includes('não pôde ser carregada')) {
            statusCode = 503; // Service Unavailable
        } else if (error.message.includes('não possui conta WhatsApp')) {
            statusCode = 400; // Bad Request - número inválido
        }
        
        res.status(statusCode).json({ 
            success: false,
            error: error.message,
            instanceId: instanceId
        });
    }
});

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
            await instance.client.destroy();
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
