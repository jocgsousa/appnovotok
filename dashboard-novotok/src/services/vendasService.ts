import api from './api';

// Interfaces
export interface VendaDiaria {
  id?: number;
  data: string;
  codusur: string;
  nome: string;
  media_itens: number;
  ticket_medio: number;
  vlcustofin: number;
  qtcliente: number;
  qtd_pedidos: number;
  via: number;
  vlvendadodia: number;
  vldevolucao: number;
  valor_total: number;
}

export interface VendaTotal {
  id?: number;
  codusur: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  total_qtd_pedidos: number;
  total_media_itens: number;
  total_ticket_medio: number;
  total_vlcustofin: number;
  total_qtcliente: number;
  total_via: number;
  total_vlvendadodia: number;
  total_vldevolucao: number;
  total_valor: number;
}

// Interfaces para metas
export interface MetaVendas {
  id?: number;
  vendedor_id: number;
  mes: number;
  ano: number;
  valor_meta: number;
  valor_realizado?: number;
  percentual_atingido?: number;
  status?: string;
  observacoes?: string;
  nome_vendedor?: string;
  rca_vendedor?: string;
  nome_mes?: string;
  periodo?: string;
  tipo_meta?: string;
}

export interface MetaCadastroClientes {
  id?: number;
  vendedor_id: number;
  mes: number;
  ano: number;
  quantidade_meta: number;
  quantidade_realizada?: number;
  percentual_atingido?: number;
  status?: string;
  observacoes?: string;
  nome_vendedor?: string;
  rca_vendedor?: string;
  nome_mes?: string;
  periodo?: string;
  tipo_meta?: string;
}

export interface ProgressoMeta {
  status: number;
  message: string;
  vendedor: {
    id: number;
    nome: string;
    rca: string;
  };
  meta: {
    id: number;
    mes: number;
    ano: number;
    nome_mes: string;
    periodo: string;
    tipo_meta: string;
    valor_meta: number;
    valor_realizado: number;
    observacoes: string;
  };
  dados: {
    total_vendas?: number;
    dias_com_venda?: number;
    ultima_venda?: string;
    total_cadastros?: number;
    ultimo_cadastro?: string;
  };
  progresso: {
    percentual: number;
    valor_faltante?: number;
    quantidade_faltante?: number;
    dias_uteis_totais?: number;
    dias_uteis_passados?: number;
    dias_uteis_restantes?: number;
    dias_restantes?: number;
    media_diaria_necessaria: number;
    status: string;
  };
}

export interface Departamento {
  id: number;
  rid: string;
  atualizainvgeral: string;
  codpto: number;
  descricao: string;
  margemprevista: number;
  referencia: string;
  tipomerc: string;
}

export interface Secao {
  id: number;
  rid: string;
  codpto: number;
  codsec: number;
  descricao: string;
  linha: string;
  qtmax: number | null;
  tipo: string;
  departamento_descricao?: string;
}

// Interface para histórico de atualizações de metas
export interface HistoricoMeta {
  id: number;
  meta_id: number;
  tipo_meta: string;
  vendedor_id: number;
  nome_vendedor?: string;
  rca_vendedor?: string;
  mes: number;
  ano: number;
  valor_anterior?: number;
  valor_novo?: number;
  quantidade_anterior?: number;
  quantidade_nova?: number;
  observacoes?: string;
  data_atualizacao: string;
  usuario: string;
  data_formatada?: string;
}

export interface HistoricoMetaResponse {
  status: number;
  message: string;
  historico: HistoricoMeta[];
  total_registros: number;
  total_paginas: number;
  pagina_atual: number;
  registros_por_pagina: number;
}

// Funções para vendas diárias
export const listarVendasDiarias = async (params: any) => {
  const response = await api.get('/listar_vendas_diarias.php', { params });
  return response.data;
};

export const atualizarVendaDiaria = async (vendaDiaria: VendaDiaria) => {
  const response = await api.post('/atualizar_venda_diaria.php', vendaDiaria);
  return response.data;
};

export const deletarVendaDiaria = async (id: number) => {
  const response = await api.post('/deletar_venda_diaria.php', { id });
  return response.data;
};

// Funções para vendas totais
export const listarVendasTotais = async (params: any) => {
  const response = await api.get('/listar_vendas_totais.php', { params });
  return response.data;
};

export const atualizarVendaTotal = async (vendaTotal: VendaTotal) => {
  const response = await api.post('/atualizar_venda_total.php', vendaTotal);
  return response.data;
};

export const deletarVendaTotal = async (id: number) => {
  const response = await api.post('/deletar_venda_total.php', { id });
  return response.data;
};

// Funções para metas
export const listarMetas = async (params?: any) => {
  const response = await api.get('/listar_metas.php', { params });
  return response.data;
};

export const listarMetasVendedor = async (vendedorId: number, params?: any) => {
  const response = await api.get(`/listar_metas_vendedor.php?vendedor_id=${vendedorId}`, { params });
  return response.data;
};

export const cadastrarMeta = async (meta: Partial<MetaVendas | MetaCadastroClientes>) => {
  const response = await api.post('/cadastrar_meta.php', meta);
  return response.data;
};

export const atualizarMeta = async (meta: MetaVendas | MetaCadastroClientes) => {
  const response = await api.put('/atualizar_meta.php', meta);
  return response.data;
};

export const deletarMeta = async (id: number, tipo_meta: string) => {
  const response = await api.delete('/deletar_meta.php', { 
    data: { id, tipo_meta } 
  });
  return response.data;
};

export const obterProgressoMeta = async (vendedorId: number, mes?: number, ano?: number, tipo_meta?: string) => {
  let url = `/progresso_metas_vendedor.php?vendedor_id=${vendedorId}`;
  if (mes) url += `&mes=${mes}`;
  if (ano) url += `&ano=${ano}`;
  if (tipo_meta) url += `&tipo_meta=${tipo_meta}`;
  
  const response = await api.get(url);
  return response.data;
};

export const listarHistoricoMetas = async (params?: any) => {
  const response = await api.get('/listar_historico_metas.php', { params });
  return response.data as HistoricoMetaResponse;
};

// Função para calcular totais de vendas diárias
export const calcularTotaisVendas = async (dataInicio: string, dataFim: string, codusur: string) => {
  const response = await api.post('/calcular_totais_vendas.php', {
    data_inicio: dataInicio,
    data_fim: dataFim,
    codusur: codusur
  });
  return response.data;
};

// Função para depurar vendas
export const debugVendas = async (tipo: string): Promise<any> => {
  try {
    const response = await api.get(`/debug_vendas.php?tipo=${tipo}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao depurar vendas:', error);
    throw error;
  }
};

// Funções para departamentos
export const listarDepartamentos = async () => {
  const response = await api.get('/listar_departamentos.php');
  return response.data;
};

export const cadastrarDepartamento = async (departamento: Partial<Departamento>) => {
  const response = await api.post('/cadastrar_departamento.php', departamento);
  return response.data;
};

export const atualizarDepartamento = async (departamento: Departamento) => {
  const response = await api.post('/atualizar_departamento.php', departamento);
  return response.data;
};

export const deletarDepartamento = async (id: number) => {
  const response = await api.post('/deletar_departamento.php', { id });
  return response.data;
};

// Funções para seções
export const listarSecoes = async (params?: any) => {
  const response = await api.get('/listar_secoes.php', { params });
  return response.data;
};

export const cadastrarSecao = async (secao: Partial<Secao>) => {
  const response = await api.post('/cadastrar_secao.php', secao);
  return response.data;
};

export const atualizarSecao = async (secao: Secao) => {
  const response = await api.post('/atualizar_secao.php', secao);
  return response.data;
};

export const deletarSecao = async (id: number) => {
  const response = await api.post('/deletar_secao.php', { id });
  return response.data;
};

// Funções para filtros de vendedor
export const obterFiltrosVendedor = async (vendedorId: number) => {
  const response = await api.get(`/obter_filtros_vendedor.php?vendedor_id=${vendedorId}`);
  return response.data;
};

export const salvarFiltrosVendedor = async (
  vendedorId: number, 
  departamentos: number[], 
  secoes: number[]
) => {
  const response = await api.post('/salvar_filtros_vendedor.php', {
    vendedor_id: vendedorId,
    departamentos,
    secoes
  });
  return response.data;
};

// Interface para itens do pedido
export interface PedidoItem {
  EXPORTADO: string;
  CODFILIAL: string;
  NUMPEDECF: number;
  CODFUNCCX: number;
  CODFUNCCANCELECF: number | null;
  NUMCAIXA: number;
  NUMSERIEEQUIP: string;
  CODPROD: number;
  NUMSEQ: number;
  DATA: string;
  CODCLI: number;
  CODUSUR: number;
  QT: number;
  PVENDA: number;
  PTABELA: number;
  NUMCOO: number;
  ST: number;
  PERDESC: number;
  QTFALTA: number;
  CODST: number;
  PORIGINAL: number;
  DTEXPORTACAO: string;
  CODECF: string;
  CODFISCAL: number;
  DESCRICAOPAF: string;
  CODFORNEC: number;
  CODCOB: string;
}

// Interface para pedidos
export interface Pedido {
  pedido: number;
  filial: number;
  caixa: number;
  data: string;
  funccx?: number;
  itens: PedidoItem[];
  cancelados: PedidoItem[];
  codcob?: string;
  total_itens: string | number;
  total_cancelados: string | number;
  data_registro_produto?: string;
}

// Interface para requisições de sincronização
export interface Requisicao {
  id: number;
  filial: number;
  caixa: number;
  datavendas: string;
  nregistros?: number;
  completed: boolean;
  processando: boolean;
  error: boolean;
  initial: boolean;
  message?: string;
  created_at: string;
}

// Interface para filtros de pedidos
export interface PedidoFiltros {
  filial?: number;
  caixa?: number;
  data_inicio?: string;
  data_fim?: string;
  pedido?: number;
  vendedor?: number;
  status_cancelamento?: 'todos' | 'com_cancelados' | 'sem_cancelados' | 'apenas_cancelados';
  page?: number;
  per_page?: number;
}

// Interface para filtros de requisições
export interface RequisicaoFiltros {
  filial?: number;
  caixa?: number;
  data_inicio?: string;
  data_fim?: string;
  status?: 'completed' | 'pending' | 'processing' | 'error' | 'initial';
  page?: number;
  per_page?: number;
}

// Interface para filtros de relatório
export interface RelatorioFiltros {
  filial?: number;
  caixa?: number;
  data_inicio?: string;
  data_fim?: string;
  vendedor?: number;
}

// Interface para dados do relatório
export interface RelatorioVendas {
  sem_cancelados: {
    quantidade: number;
    valor_total: number;
  };
  com_cancelados: {
    quantidade: number;
    valor_total: number;
    valor_cancelado: number;
  };
  apenas_cancelados: {
    quantidade: number;
    valor_cancelado: number;
  };
  totais: {
    total_pedidos: number;
    valor_total_geral: number;
    valor_cancelado_geral: number;
  };
  percentuais: {
    sem_cancelados: number;
    com_cancelados: number;
    apenas_cancelados: number;
  };
  por_periodo: Array<{
    data_venda: string;
    total_pedidos: number;
    sem_cancelados: number;
    com_cancelados: number;
    apenas_cancelados: number;
    valor_total: number;
    valor_cancelado: number;
  }>;
  por_filial?: Array<{
    filial: number;
    total_pedidos: number;
    sem_cancelados: number;
    com_cancelados: number;
    apenas_cancelados: number;
    valor_total: number;
    valor_cancelado: number;
  }>;
}

// Interface para resposta paginada
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total_records: number;
    total_pages: number;
    current_page: number;
    per_page: number;
  };
}

// Função para listar pedidos com filtros e paginação
export const listarPedidos = async (filtros: PedidoFiltros = {}): Promise<PaginatedResponse<Pedido>> => {
  try {
    const { page = 1, per_page = 10, ...rest } = filtros;
    const params = { page, per_page, ...rest };
    
    const response = await api.get('/consultar_pedidos.php', { params });
    return response.data;
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    throw error;
  }
};

// Função para listar requisições de sincronização com filtros e paginação
export const listarRequisicoes = async (filtros: RequisicaoFiltros = {}): Promise<PaginatedResponse<Requisicao>> => {
  try {
    const { page = 1, per_page = 10, ...rest } = filtros;
    const params = { page, per_page, ...rest };
    
    const response = await api.get('/consultar_requisicoes.php', { params });
    return response.data;
  } catch (error) {
    console.error('Erro ao listar requisições:', error);
    throw error;
  }
};

// Função para cadastrar uma nova requisição de sincronização
export const cadastrarRequisicao = async (dados: Omit<Requisicao, 'id' | 'completed' | 'processando' | 'error' | 'created_at'>): Promise<{ id: number; message: string }> => {
  try {
    const response = await api.post('/cadastrar_requisicao.php', dados);
    return response.data;
  } catch (error) {
    console.error('Erro ao cadastrar requisição:', error);
    throw error;
  }
};

// Função para atualizar uma requisição de sincronização
export const atualizarRequisicao = async (id: number, dados: Partial<Requisicao>): Promise<{ id: number; message: string }> => {
  try {
    const response = await api.put('/atualizar_requisicao.php', { id, ...dados });
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar requisição:', error);
    throw error;
  }
};

// Função para excluir uma requisição de sincronização
export const deletarRequisicao = async (id: number): Promise<{ id: number; message: string }> => {
  try {
    const response = await api.delete('/deletar_requisicao.php', {
      data: { id }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao excluir requisição:', error);
    throw error;
  }
};

// Função para gerar relatório de vendas
export const gerarRelatorioVendas = async (filtros: RelatorioFiltros = {}): Promise<{ success: boolean; data: RelatorioVendas }> => {
  try {
    const params = { ...filtros };
    const response = await api.get('/relatorio_vendas.php', { params });
    return response.data;
  } catch (error) {
    console.error('Erro ao gerar relatório de vendas:', error);
    throw error;
  }
};

// Função para exportar relatório de vendas para Excel
export const exportarRelatorioVendasExcel = async (filtros: RelatorioFiltros = {}): Promise<Blob> => {
  try {
    const params = { ...filtros };
    const response = await api.get('/exportar_relatorio_vendas.php', {
      params,
      responseType: 'blob',
      timeout: 120000 // Aumentar timeout para 2 minutos
    });
    
    // Verificar se a resposta é um blob válido
    if (response.data instanceof Blob) {
      // Verificar se o tipo de conteúdo é o esperado para um arquivo Excel
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('json')) {
        // Se o servidor retornou JSON em vez de um arquivo Excel
        const reader = new FileReader();
        const textPromise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
        });
        reader.readAsText(response.data);
        
        const text = await textPromise;
        try {
          const errorData = JSON.parse(text);
          if (!errorData.success && errorData.message) {
            throw new Error(errorData.message);
          }
        } catch (e) {
          // Se não conseguir fazer parse do JSON, verifica o tamanho do blob
          if (response.data.size < 100) {
            throw new Error('O arquivo gerado está corrompido ou vazio');
          }
        }
      }
      
      // Verificar tamanho mínimo para um arquivo Excel válido
      if (response.data.size < 100) {
        throw new Error('O arquivo gerado está corrompido ou vazio');
      }
      
      // Se chegou aqui, é um blob válido
      return response.data;
    } else {
      throw new Error('Formato de resposta inválido');
    }
  } catch (error) {
    console.error('Erro ao exportar relatório de vendas:', error);
    throw error;
  }
};

const vendasService = {
  listarVendasDiarias,
  atualizarVendaDiaria,
  deletarVendaDiaria,
  listarVendasTotais,
  atualizarVendaTotal,
  deletarVendaTotal,
  listarMetas,
  listarMetasVendedor,
  cadastrarMeta,
  atualizarMeta,
  deletarMeta,
  obterProgressoMeta,
  calcularTotaisVendas,
  debugVendas,
  listarDepartamentos,
  cadastrarDepartamento,
  atualizarDepartamento,
  deletarDepartamento,
  listarSecoes,
  cadastrarSecao,
  atualizarSecao,
  deletarSecao,
  obterFiltrosVendedor,
  salvarFiltrosVendedor,
  listarHistoricoMetas,
  listarPedidos,
  listarRequisicoes,
  cadastrarRequisicao,
  atualizarRequisicao,
  deletarRequisicao,
  gerarRelatorioVendas,
  exportarRelatorioVendasExcel
};

export default vendasService; 