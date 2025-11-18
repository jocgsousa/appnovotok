import api from './api';

export interface BijouConfigItem {
  filial_id: number;
  departamentos: string[]; // códigos de departamentos (ex: ["07","08","09"]) 
  secoes: string[];        // códigos de seções (ex: ["048","050"]) 
  ativo: boolean;
}

export interface BijouConfigResponse {
  success: boolean;
  data: BijouConfigItem[];
  message?: string;
}

export async function listarBijouConfig(): Promise<BijouConfigResponse> {
  const { data } = await api.get('/listar_bijou_filial_config.php');
  return data;
}

export async function salvarBijouConfig(items: BijouConfigItem[]): Promise<BijouConfigResponse> {
  const { data } = await api.post('/salvar_bijou_filial_config.php', { items });
  return data;
}