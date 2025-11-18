import api from './api';

export interface BijouVendedorSecoesConfigResponse {
  success: boolean;
  vendedor_id: number;
  ativo: number;
  departamentos: Array<{ codpto: number }>;
  secoes: Array<{ codsec: number }>;
  message?: string;
}

export const obterBijouVendedorSecoesConfig = async (vendedorId: number): Promise<BijouVendedorSecoesConfigResponse> => {
  const { data } = await api.get('/listar_bijou_secoes_vendedor_config.php', {
    params: { vendedor_id: vendedorId }
  });
  return data;
};

export const salvarBijouVendedorSecoesConfig = async (
  vendedorId: number,
  departamentos: number[],
  secoes: number[],
  ativo: boolean = true
) => {
  const { data } = await api.post('/salvar_bijou_secoes_vendedor_config.php', {
    vendedor_id: vendedorId,
    departamentos,
    secoes,
    ativo
  });
  return data;
};

const bijouVendedorSecoesConfigService = {
  obterBijouVendedorSecoesConfig,
  salvarBijouVendedorSecoesConfig,
};

export default bijouVendedorSecoesConfigService;