import api from './api';

export interface BijouFilialTotal {
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

export interface ListarTotaisResponse {
  success: boolean;
  message?: string;
  data?: BijouFilialTotal[];
}

export interface ListarTotaisParams {
  filiais?: string[];
  departamentos?: number[];
  secoes?: number[];
  mes?: number;
  ano?: number;
}

// Endpoint esperado: /listar_bijou_filial_totais.php
// Este serviço usa a API existente; o backend deverá prover o endpoint.
export const listarTotaisBijouFilial = async (params: ListarTotaisParams): Promise<ListarTotaisResponse> => {
  try {
    const response = await api.get('/listar_bijou_filial_totais.php', {
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
    console.error('Erro ao listar totais Bijou/Make/Bolsas por filial:', error);
    return { success: false, message: 'Erro ao carregar totais Bijou Filial', data: [] };
  }
};

const bijouFilialService = {
  listarTotaisBijouFilial,
};

export default bijouFilialService;