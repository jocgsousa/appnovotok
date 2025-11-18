import api from './api';

export interface BijouSecoesFilialConfigItem {
  filial_id: number;
  departamentos: (string | number)[];
  secoes: (string | number)[];
  ativo: boolean;
}

export interface BijouSecoesFilialConfigResponse {
  success: boolean;
  data: BijouSecoesFilialConfigItem[];
  message?: string;
}

export const listarBijouSecoesFilialConfig = async (params?: any): Promise<BijouSecoesFilialConfigResponse> => {
  const response = await api.get('/listar_bijou_secoes_filial_config.php', { params });
  return response.data;
};

export const salvarBijouSecoesFilialConfig = async (items: BijouSecoesFilialConfigItem[]) => {
  const response = await api.post('/salvar_bijou_secoes_filial_config.php', { items });
  return response.data;
};

const bijouSecoesFilialConfigService = {
  listarBijouSecoesFilialConfig,
  salvarBijouSecoesFilialConfig,
};

export default bijouSecoesFilialConfigService;