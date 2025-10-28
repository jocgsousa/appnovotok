import api from './api';

export interface ConfigCadastroClientes {
  id: number;
  timer: number;
  automatic: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ConfigResponse {
  success: boolean;
  config: ConfigCadastroClientes;
  message?: string;
}

/**
 * Serviço para gerenciar as configurações de cadastro de clientes
 */
const configCadastroClientesService = {
  /**
   * Obtém as configurações atuais de cadastro de clientes
   */
  obterConfig: async (): Promise<ConfigCadastroClientes> => {
    try {
      const response = await api.get<ConfigResponse>('/obter_config_cadastro_clientes.php');
      
      if (response.data.success) {
        return response.data.config;
      } else {
        throw new Error(response.data.message || 'Erro ao obter configurações');
      }
    } catch (error) {
      console.error('Erro ao obter configurações de cadastro de clientes:', error);
      throw error;
    }
  },

  /**
   * Atualiza as configurações de cadastro de clientes
   */
  atualizarConfig: async (config: Omit<ConfigCadastroClientes, 'id' | 'created_at' | 'updated_at'>): Promise<ConfigCadastroClientes> => {
    try {
      const response = await api.post<ConfigResponse>('/atualizar_config_cadastro_clientes.php', config);
      
      if (response.data.success) {
        return response.data.config;
      } else {
        throw new Error(response.data.message || 'Erro ao atualizar configurações');
      }
    } catch (error) {
      console.error('Erro ao atualizar configurações de cadastro de clientes:', error);
      throw error;
    }
  }
};

export default configCadastroClientesService; 