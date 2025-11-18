import api from './api';

export interface BijouVendedorSecoesTotal {
  vendedor_id?: number | null;
  codusur: string;
  mes: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
  valor_total: number;
  config_key?: string;
  departamentos?: string | null;
  secoes?: string | null;
}

export interface ListarTotaisVendedorSecoesResponse {
  success: boolean;
  message?: string;
  data?: BijouVendedorSecoesTotal[];
}

export interface ListarTotaisVendedorSecoesParams {
  rcas?: string[];
  vendedorIds?: number[];
  departamentos?: number[];
  secoes?: number[];
  mes?: number;
  ano?: number;
}

// Endpoint: /listar_bijou_vendedor_secoes_totais.php
export const listarTotaisBijouVendedorSecoes = async (
  params: ListarTotaisVendedorSecoesParams
): Promise<ListarTotaisVendedorSecoesResponse> => {
  try {
    const response = await api.get('/listar_bijou_vendedor_secoes_totais.php', {
      params: {
        rcas: (params.rcas || []).join(','),
        vendedor_ids: (params.vendedorIds || []).join(','),
        departamentos: (params.departamentos || []).join(','),
        secoes: (params.secoes || []).join(','),
        mes: params.mes,
        ano: params.ano
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao listar totais Bijou Seções por Vendedor:', error);
    return { success: false, message: 'Erro ao carregar totais Bijou Seções (Vendedor)', data: [] };
  }
};

const bijouVendedorSecoesService = {
  listarTotaisBijouVendedorSecoes,
};

export default bijouVendedorSecoesService;