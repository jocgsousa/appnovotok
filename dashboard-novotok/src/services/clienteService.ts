import api from './api';

export interface Cliente {
  id?: number;
  codcli?: string;
  corporate: boolean;
  name: string;
  trade_name?: string;
  person_identification_number: string;
  person_identification_number_raw?: string;
  state_inscription?: string;
  commercial_address: string;
  commercial_address_number: string;
  business_district: string;
  commercial_zip_code?: string;
  billingPhone: string;
  email: string;
  email_nfe?: string;
  activity_id?: number;
  ramo_nome?: string;
  business_city: string;
  city_id?: number;
  cidade_nome?: string;
  uf?: string;
  filial?: number;
  rca?: string;
  data_nascimento?: string;
  created_at?: string;
  updated_at?: string;
  novo?: boolean;
  atualizado?: boolean;
  status?: 'novo' | 'atualizado';
  recused?: boolean;
  recused_msg?: string;
  registered?: boolean;
  authorized?: boolean;
}

export interface ClienteResponse {
  success: boolean;
  message?: string;
  total?: number;
  limit?: number;
  offset?: number;
  clientes?: Cliente[];
  cliente?: Cliente;
  id?: number;
}

export interface ClienteFiltros {
  busca?: string;
  rca?: string;
  filial?: number;
  limit?: number;
  offset?: number;
  novo?: boolean;
  atualizado?: boolean;
  recused?: boolean;
  data_inicio?: string;
  data_fim?: string;
}

export interface EstatisticasClientes {
  totalClientes: number;
  clientesPorStatus: {
    novos: number;
    atualizados: number;
    recusados: number;
    registrados: number;
    autorizados: number;
  };
  clientesPorTipo: {
    fisica: number;
    juridica: number;
  };
  clientesPorFilial: {
    id: number;
    nome: string;
    total: number;
  }[];
  clientesPorVendedor: {
    rca: string;
    nome: string;
    total: number;
  }[];
  clientesPorAtividade: {
    id: number;
    ramo: string;
    total: number;
  }[];
  clientesPorPeriodo: {
    periodo: string;
    total: number;
  }[];
}

export interface RelatorioFiltros {
  data_inicio?: string;
  data_fim?: string;
  filial?: number;
  rca?: string;
  agrupar_por?: 'dia' | 'semana' | 'mes' | 'ano';
}

// Listar clientes com filtros opcionais
export const listarClientes = async (filtros?: ClienteFiltros): Promise<ClienteResponse> => {
  try {
    const response = await api.get('/listar_clientes.php', { params: filtros });
    return response.data;
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    throw error;
  }
};

// Obter um cliente específico por ID
export const obterCliente = async (id: number): Promise<ClienteResponse> => {
  try {
    const response = await api.get(`/obter_cliente.php?id=${id}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao obter cliente:', error);
    throw error;
  }
};

// Cadastrar um novo cliente
export const cadastrarCliente = async (cliente: Cliente): Promise<ClienteResponse> => {
  try {
    const response = await api.post('/cadastrar_cliente.php', cliente);
    return response.data;
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    throw error;
  }
};

// Atualizar um cliente existente
export const atualizarCliente = async (cliente: Cliente): Promise<ClienteResponse> => {
  try {
    const response = await api.put('/atualizar_cliente.php', cliente);
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    throw error;
  }
};

// Excluir um cliente
export const deletarCliente = async (id: number): Promise<ClienteResponse> => {
  try {
    const response = await api.post('/deletar_cliente.php', { id });
    return response.data;
  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    throw error;
  }
};

// Listar ramos de atividade
export const listarRamosAtividade = async (): Promise<any> => {
  try {
    const response = await api.get('/listar_ativi.php');
    return response.data;
  } catch (error) {
    console.error('Erro ao listar ramos de atividade:', error);
    throw error;
  }
};

// Listar cidades
export const listarCidades = async (): Promise<any> => {
  try {
    const response = await api.get('/listar_cidades.php');
    return response.data;
  } catch (error) {
    console.error('Erro ao listar cidades:', error);
    throw error;
  }
};

// Obter estatísticas de clientes para relatórios
export const obterEstatisticasClientes = async (filtros?: RelatorioFiltros): Promise<{success: boolean, estatisticas?: EstatisticasClientes, message?: string}> => {
  try {
    const response = await api.get('/estatisticas_clientes.php', { params: filtros });
    return response.data;
  } catch (error) {
    console.error('Erro ao obter estatísticas de clientes:', error);
    throw error;
  }
};

// Exportar relatório de clientes para Excel
export const exportarRelatorioClientes = async (filtros?: RelatorioFiltros): Promise<Blob> => {
  try {
    const response = await api.get('/exportar_relatorio_clientes.php', { 
      params: filtros,
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
    console.error('Erro ao exportar relatório de clientes:', error);
    throw error;
  }
}; 