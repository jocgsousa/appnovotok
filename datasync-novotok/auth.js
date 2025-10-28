require('dotenv/config');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Configurações
const API_BASE_URL = process.env.API_BASE_URL || 'http://192.168.10.112:8000';
const USER_EMAIL = process.env.USER_EMAIL;
const USER_PASSWORD = process.env.USER_PASSWORD;
const TOKEN_FILE_PATH = path.join(__dirname, '.auth_token');

/**
 * Classe para gerenciar autenticação e tokens JWT
 */
class AuthManager {
    constructor() {
        this.token = null;
        this.tokenExpiry = null;
    }

    /**
     * Realiza login na API e obtém o token JWT
     */
    async login() {
        try {
            console.log('🔐 Realizando login na API...');
            
            if (!USER_EMAIL || !USER_PASSWORD) {
                throw new Error('Credenciais de login não configuradas no .env (USER_EMAIL e USER_PASSWORD)');
            }

            const loginData = {
                email: USER_EMAIL,
                password: USER_PASSWORD
            };

            const response = await axios.post(`${API_BASE_URL}/login.php`, loginData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (response.data.success) {
                this.token = response.data.token;
                
                // Calcular expiração do token (assumindo 24 horas)
                this.tokenExpiry = new Date();
                this.tokenExpiry.setHours(this.tokenExpiry.getHours() + 24);

                // Salvar token localmente
                await this.saveTokenToFile();

                console.log('✅ Login realizado com sucesso!');
                console.log(`👤 Usuário: ${response.data.usuario.nome} (${response.data.usuario.email})`);
                
                return {
                    success: true,
                    token: this.token,
                    usuario: response.data.usuario
                };
            } else {
                throw new Error(response.data.message || 'Falha no login');
            }
        } catch (error) {
            console.error('❌ Erro no login:', error.message);
            
            if (error.response?.data) {
                console.error('Detalhes do erro:', error.response.data);
            }
            
            throw new Error(`Falha na autenticação: ${error.message}`);
        }
    }

    /**
     * Salva o token em arquivo local
     */
    async saveTokenToFile() {
        try {
            const tokenData = {
                token: this.token,
                expiry: this.tokenExpiry.toISOString(),
                savedAt: new Date().toISOString()
            };

            await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(tokenData, null, 2));
            console.log('💾 Token salvo localmente');
        } catch (error) {
            console.error('⚠️ Erro ao salvar token:', error.message);
        }
    }

    /**
     * Carrega o token do arquivo local
     */
    async loadTokenFromFile() {
        try {
            const tokenData = await fs.readFile(TOKEN_FILE_PATH, 'utf8');
            const parsed = JSON.parse(tokenData);
            
            this.token = parsed.token;
            this.tokenExpiry = new Date(parsed.expiry);
            
            console.log('📂 Token carregado do arquivo local');
            return true;
        } catch (error) {
            console.log('ℹ️ Nenhum token salvo encontrado');
            return false;
        }
    }

    /**
     * Verifica se o token atual é válido
     */
    isTokenValid() {
        if (!this.token || !this.tokenExpiry) {
            return false;
        }

        const now = new Date();
        const timeUntilExpiry = this.tokenExpiry.getTime() - now.getTime();
        
        // Considerar inválido se expira em menos de 5 minutos
        return timeUntilExpiry > (5 * 60 * 1000);
    }

    /**
     * Obtém um token válido (carrega do arquivo ou faz novo login)
     */
    async getValidToken() {
        try {
            // Primeiro, tenta carregar token existente
            if (!this.token) {
                await this.loadTokenFromFile();
            }

            // Verifica se o token é válido
            if (this.isTokenValid()) {
                console.log('✅ Token válido encontrado');
                return this.token;
            }

            // Token inválido ou inexistente, fazer novo login
            console.log('🔄 Token inválido ou expirado, fazendo novo login...');
            const loginResult = await this.login();
            
            return loginResult.token;
        } catch (error) {
            console.error('❌ Erro ao obter token válido:', error.message);
            throw error;
        }
    }

    /**
     * Remove o token salvo (logout)
     */
    async logout() {
        try {
            this.token = null;
            this.tokenExpiry = null;
            
            await fs.unlink(TOKEN_FILE_PATH);
            console.log('🚪 Logout realizado - token removido');
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('⚠️ Erro ao remover token:', error.message);
            }
        }
    }

    /**
     * Obtém informações sobre o token atual
     */
    getTokenInfo() {
        if (!this.token || !this.tokenExpiry) {
            return {
                hasToken: false,
                isValid: false,
                expiresAt: null,
                timeUntilExpiry: null
            };
        }

        const now = new Date();
        const timeUntilExpiry = this.tokenExpiry.getTime() - now.getTime();
        
        return {
            hasToken: true,
            isValid: this.isTokenValid(),
            expiresAt: this.tokenExpiry.toISOString(),
            timeUntilExpiry: Math.max(0, Math.floor(timeUntilExpiry / 1000)) // em segundos
        };
    }
}

// Instância singleton do gerenciador de autenticação
const authManager = new AuthManager();

module.exports = {
    AuthManager,
    authManager
};
