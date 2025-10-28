require('dotenv/config');
const axios = require('axios');
const { authManager } = require('./auth');

// Configuração da API
const API_BASE_URL = process.env.API_BASE_URL || 'http://192.168.10.112:8000';

// Criar instância do axios com configurações padrão
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor para autenticação automática
apiClient.interceptors.request.use(
    async (config) => {
        try {
            // Obter token válido antes de cada requisição
            const token = await authManager.getValidToken();
            config.headers.Authorization = `Bearer ${token}`;
            
            console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        } catch (error) {
            console.error('❌ Erro na autenticação:', error.message);
            return Promise.reject(error);
        }
    },
    (error) => {
        console.error('❌ API Request Error:', error.message);
        return Promise.reject(error);
    }
);

// Interceptor para log de respostas e tratamento de erros de autenticação
apiClient.interceptors.response.use(
    (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        return response;
    },
    async (error) => {
        const status = error.response?.status || 'No Response';
        const url = error.config?.url || 'Unknown URL';
        
        // Não exibir erro 409 (controle já cadastrado) como erro
        const isControleDuplicado = status === 409 && 
            (url.includes('controle_envio') || 
             (error.response?.data?.error && error.response.data.error.includes('já existe')));
        
        if (!isControleDuplicado) {
            console.error(`❌ API Error: ${status} ${url} - ${error.message}`);
            
            if (error.response?.data) {
                console.error('Error Details:', error.response.data);
            }
        }
        
        // Se erro 401 (não autorizado), tentar renovar token e repetir requisição
        if (status === 401 && !error.config._retry) {
            error.config._retry = true;
            
            try {
                console.log('🔄 Token expirado, tentando renovar...');
                await authManager.logout(); // Remove token inválido
                const newToken = await authManager.getValidToken(); // Obtém novo token
                
                // Atualizar cabeçalho da requisição original
                error.config.headers.Authorization = `Bearer ${newToken}`;
                
                // Repetir a requisição original
                return apiClient.request(error.config);
            } catch (authError) {
                console.error('❌ Falha na renovação do token:', authError.message);
                return Promise.reject(error);
            }
        }
        
        return Promise.reject(error);
    }
);

/**
 * Cliente para API de Instâncias WhatsApp
 */
class WhatsAppInstancesAPI {
    /**
     * Contar total de instâncias (teste de conexão)
     */
    async count() {
        try {
            const response = await apiClient.get('/whatsapp_instance_api_count.php');
            return response.data.total || 0;
        } catch (error) {
            throw new Error(`Erro ao contar instâncias: ${error.message}`);
        }
    }

    /**
     * Listar todas as instâncias
     */
    async list() {
        try {
            const response = await apiClient.get('/whatsapp_instance_api_list.php');
            return response.data.data || [];
        } catch (error) {
            throw new Error(`Erro ao listar instâncias: ${error.message}`);
        }
    }

    /**
     * Buscar instâncias por status
     */
    async getByStatus(status) {
        try {
            const response = await apiClient.get(`/whatsapp_instance_api_list.php?status=${status}`);
            return response.data.data || [];
        } catch (error) {
            throw new Error(`Erro ao buscar instâncias por status: ${error.message}`);
        }
    }

    /**
     * Buscar instância específica por ID
     */
    async getById(id) {
        try {
            const response = await apiClient.get(`/whatsapp_instance_api_get_by_id.php?id=${id}`);
            return response.data.data || null;
        } catch (error) {
            throw new Error(`Erro ao buscar instância ${id}: ${error.message}`);
        }
    }

    /**
     * Verificar quais IDs de instâncias existem
     */
    async checkExistingIds(ids) {
        try {
            const idsString = Array.isArray(ids) ? ids.join(',') : ids;
            const response = await apiClient.get(`/whatsapp_instance_api_list.php?ids=${idsString}`);
            return response.data.existing_ids || [];
        } catch (error) {
            throw new Error(`Erro ao verificar instâncias existentes: ${error.message}`);
        }
    }

    /**
     * Atualizar status de uma instância
     */
    async updateStatus(id, statusData) {
        try {
            const response = await apiClient.put(`/whatsapp_instance_api_update_status.php?id=${id}`, statusData);
            return response.data;
        } catch (error) {
            throw new Error(`Erro ao atualizar status da instância ${id}: ${error.message}`);
        }
    }
}

/**
 * Cliente para API de Sincronização NPS
 */
class NPSSyncAPI {
    /**
     * Buscar campanhas NPS ativas
     */
    async getCampanhasAtivas(disparoImediato = null) {
        try {
            let url = '/nps_sync_api_campanhas_ativas.php';
            if (disparoImediato !== null) {
                url += `?disparo_imediato=${disparoImediato ? 1 : 0}`;
            }
            const response = await apiClient.get(url);
            return response.data.data || [];
        } catch (error) {
            throw new Error(`Erro ao buscar campanhas ativas: ${error.message}`);
        }
    }

    /**
     * Buscar pedidos recentes para NPS
     */
    async getPedidosRecentes(options = {}) {
        try {
            const params = new URLSearchParams();
            if (options.minutos) params.append('minutos', options.minutos);
            if (options.filiais) params.append('filiais', options.filiais);
            if (options.limit) params.append('limit', options.limit);

            const response = await apiClient.get(`/nps_sync_api_pedidos_recentes.php?${params}`);
            return response.data.data || [];
        } catch (error) {
            throw new Error(`Erro ao buscar pedidos recentes: ${error.message}`);
        }
    }

    /**
     * Buscar conversa NPS ativa
     */
    async getConversaAtiva(numeros, instanciaId) {
        try {
            const numerosString = Array.isArray(numeros) ? numeros.join(',') : numeros;
            const response = await apiClient.get(`/nps_sync_api_conversa_ativa.php?numeros=${numerosString}&instancia_id=${instanciaId}`);
            return response.data.data || null;
        } catch (error) {
            throw new Error(`Erro ao buscar conversa ativa: ${error.message}`);
        }
    }

    /**
     * Buscar controle de envio por pedido
     */
    async buscarControleEnvio(pedidoId, campanhaId) {
        try {
            const response = await apiClient.get('/nps_sync_api_buscar_controle.php', {
                params: {
                    pedido_id: pedidoId,
                    campanha_id: campanhaId
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Erro ao buscar controle de envio: ${error.message}`);
        }
    }

    /**
     * Buscar controle de envio por ID
     */
    async buscarControleEnvioPorId(controleId) {
        try {
            const response = await apiClient.get('/nps_sync_api_buscar_controle.php', {
                params: {
                    controle_id: controleId
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Erro ao buscar controle de envio por ID: ${error.message}`);
        }
    }

    /**
     * Buscar envios NPS agendados
     */
    async getEnviosAgendados() {
        try {
            const response = await apiClient.get('/nps_sync_api_envios_agendados.php');
            return response.data.data || [];
        } catch (error) {
            throw new Error(`Erro ao buscar envios agendados: ${error.message}`);
        }
    }

    /**
     * Validar se um número possui conta WhatsApp
     */
    async validateWhatsAppNumber(instanceId, phoneNumber) {
        try {
            const response = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${instanceId}/validate-number`, {
                number: phoneNumber
            });
            return response.data;
        } catch (error) {
            console.error(`Erro ao validar número WhatsApp ${phoneNumber}:`, error.message);
            return {
                success: false,
                hasWhatsApp: false,
                error: error.message,
                number: phoneNumber
            };
        }
    }

    /**
     * Enviar mensagem NPS em formato de texto simples
     */
    async sendNPSMessage(instanceId, phoneNumber, message) {
        try {
            const response = await axios.post(`${process.env.API_LOCAL_WHATSAPP}/api/instances/${instanceId}/send-message`, {
                to: phoneNumber,
                message: message
            });
            return response.data;
        } catch (error) {
            console.error(`Erro ao enviar mensagem NPS para ${phoneNumber}:`, error.message);
            return {
                success: false,
                error: error.message,
                to: phoneNumber,
                instanceId: instanceId
            };
        }
    }

    /**
     * Buscar controles de envio que não têm estado de conversa correspondente
     */
    async getControlesSemEstado() {
        try {
            const response = await apiClient.get('/nps_sync_api_controles_sem_estado.php');
            return response.data;
        } catch (error) {
            throw new Error(`Erro ao buscar controles sem estado: ${error.message}`);
        }
    }

    /**
     * Criar controle de envio NPS
     */
    async createControleEnvio(controleData) {
        try {
            const response = await apiClient.post('/nps_sync_api_controle_envio.php', controleData);
            return response.data;
        } catch (error) {
            throw new Error(`Erro ao criar controle de envio: ${error.message}`);
        }
    }

    /**
     * Criar estado de conversa NPS
     */
    async createEstadoConversa(estadoData) {
        try {
            console.log(`🔗 Enviando requisição para criar estado de conversa:`);
            console.log(`   URL: ${process.env.API_BASE_URL}/nps_sync_api_estado_conversa.php`);
            console.log(`   Dados:`, JSON.stringify(estadoData, null, 2));
            
            const response = await apiClient.post('/nps_sync_api_estado_conversa.php', estadoData);
            
            console.log(`📥 Resposta recebida da API:`);
            console.log(`   Status: ${response.status}`);
            console.log(`   Data:`, JSON.stringify(response.data, null, 2));
            
            return response.data;
        } catch (error) {
            console.log(`❌ Erro na requisição de estado de conversa:`);
            console.log(`   Erro: ${error.message}`);
            console.log(`   Status: ${error.response?.status}`);
            console.log(`   Response data:`, JSON.stringify(error.response?.data, null, 2));
            
            // Preservar informações detalhadas do erro
            const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
            throw new Error(`Erro ao criar estado de conversa: ${errorMessage}`);
        }
    }

    /**
     * Salvar resposta NPS
     */
    async saveRespostaNPS(respostaData) {
        try {
            const response = await apiClient.post('/nps_sync_api_resposta_nps.php', respostaData);
            return response.data;
        } catch (error) {
            throw new Error(`Erro ao salvar resposta NPS: ${error.message}`);
        }
    }

    /**
     * Salvar resposta NPS (alias para compatibilidade)
     */
    async salvarRespostaNPS(respostaData) {
        return this.saveRespostaNPS(respostaData);
    }

    /**
     * Buscar respostas anteriores de um número
     */
    async buscarRespostasAnteriores(formatosBusca, instanciaId) {
        try {
            const numerosString = Array.isArray(formatosBusca) ? formatosBusca.join(',') : formatosBusca;
            const response = await apiClient.get(`/nps_sync_api_respostas_anteriores.php?numeros=${numerosString}&instancia_id=${instanciaId}`);
            return response.data.data || [];
        } catch (error) {
            throw new Error(`Erro ao buscar respostas anteriores: ${error.message}`);
        }
    }

    /**
     * Atualizar controle de envio
     */
    async updateControleEnvio(id, updateData) {
        try {
            const response = await apiClient.put('/nps_sync_api_controle_envio.php', { id, ...updateData });
            return response.data;
        } catch (error) {
            throw new Error(`Erro ao atualizar controle de envio: ${error.message}`);
        }
    }

    /**
     * Atualizar estado de conversa
     */
    async updateEstadoConversa(id, updateData) {
        try {
            const response = await apiClient.put('/nps_sync_api_estado_conversa.php', { id, ...updateData });
            return response.data;
        } catch (error) {
            throw new Error(`Erro ao atualizar estado de conversa: ${error.message}`);
        }
    }

    /**
     * Atualizar estado de conversa (alias para compatibilidade)
     */
    async atualizarEstadoConversa(id, updateData) {
        return this.updateEstadoConversa(id, updateData);
    }

    /**
     * Enviar mensagem NPS e atualizar controle
     */
    async enviarMensagemNPS(mensagemData) {
        try {
            const response = await apiClient.post('/nps_sync_api_enviar_mensagem.php', mensagemData);
            return response.data;
        } catch (error) {
            throw new Error(`Erro ao enviar mensagem NPS: ${error.message}`);
        }
    }

    /**
     * Buscar dados da campanha por ID
     */
    async getCampanhaPorId(campanhaId) {
        try {
            // Buscar dados completos da campanha diretamente da API de campanhas
            const response = await apiClient.get(`/nps_campanhas.php?id=${campanhaId}`);
            
            if (response.data.success && response.data.data) {
                return response.data.data;
            }
            
            return null;
        } catch (error) {
            // Se a API de campanhas falhar, tentar buscar via campanhas ativas (fallback)
            console.warn(`⚠️ Falha ao buscar campanha completa por ID ${campanhaId}, usando fallback: ${error.message}`);
            try {
                const campanhas = await this.getCampanhasAtivas();
                return campanhas.find(c => c.id === campanhaId) || null;
            } catch (fallbackError) {
                throw new Error(`Erro ao buscar campanha por ID: ${fallbackError.message}`);
            }
        }
    }
}

/**
 * Função para inicializar autenticação
 * Deve ser chamada antes de usar as APIs
 */
async function initializeAuth() {
    try {
        console.log('🔐 Inicializando autenticação...');
        const token = await authManager.getValidToken();
        console.log('✅ Autenticação inicializada com sucesso!');
        return token;
    } catch (error) {
        console.error('❌ Erro na inicialização da autenticação:', error.message);
        throw error;
    }
}

/**
 * Função para obter informações do token atual
 */
function getAuthInfo() {
    return authManager.getTokenInfo();
}

/**
 * Função para fazer logout
 */
async function logout() {
    return await authManager.logout();
}

// Instâncias dos clientes
const whatsappAPI = new WhatsAppInstancesAPI();
const npsAPI = new NPSSyncAPI();

module.exports = {
    apiClient,
    whatsappAPI,
    npsAPI,
    WhatsAppInstancesAPI,
    NPSSyncAPI,
    authManager,
    initializeAuth,
    getAuthInfo,
    logout
};
