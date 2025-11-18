import api from './api';

export interface BijouFilialSecoesTotal {
  filial_id?: number | null;
  codfilial: string;
  mes: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
  valor_total: number;
  config_key?: string;
  departamentos?: string | null;
  secoes?: string | null;
}

export interface ListarTotaisFilialSecoesResponse {
  success: boolean;
  message?: string;
  data?: BijouFilialSecoesTotal[];
}

export interface ListarTotaisFilialSecoesParams {
  filiais?: string[];
  departamentos?: number[];
  secoes?: number[];
  mes?: number;
  ano?: number;
}

// Endpoint: /listar_bijou_filial_secoes_totais.php
export const listarTotaisBijouFilialSecoes = async (
  params: ListarTotaisFilialSecoesParams
): Promise<ListarTotaisFilialSecoesResponse> => {
  try {
    const response = await api.get('/listar_bijou_filial_secoes_totais.php', {
      params: {
        filiais: (params.filiais || []).join(','),
        departamentos: (params.departamentos || []).join(','),
        secoes: (params.secoes || []).join(','),
        mes: params.mes,
        ano: params.ano
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao listar totais Bijou Seções por Filial:', error);
    return { success: false, message: 'Erro ao carregar totais Bijou Seções (Filial)', data: [] };
  }
};

const bijouFilialSecoesService = {
  listarTotaisBijouFilialSecoes,
};

export default bijouFilialSecoesService;