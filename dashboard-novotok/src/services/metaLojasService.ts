import api from './api';

// Interfaces
export interface Filial {
  id: number;
  codigo: string;
  nome: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  funcao: string;
  cadastros: number;
  produtosDestaque: number;
  valorVendidoTotal: number;
  esmaltes: number;
  profissionalParceiras: number;
  percentualProfissional: number;
  valorVendidoMake: number;
  quantidadeMalka: number;
  valorMalka: number;
  bijouMakeBolsas: number;
  percentuais: {
    p008: number;
    p009: number;
    p010: number;
    p011: number;
    p012: number;
  };
}

export interface MetaLoja {
  id: string;
  filialId: number;
  filialNome: string;
  periodo: string;
  dataInicio: string;
  dataFim: string;
  valorVendaLojaTotal: number;
  funcionarios: Funcionario[];
  dataCriacao: string;
  status: 'ativa' | 'concluida' | 'cancelada';
}

export interface NovaMetaLoja {
  filialId: number;
  dataInicio: string;
  dataFim: string;
  valorVendaLojaTotal: number;
  funcionarios: Omit<Funcionario, 'id'>[];
}

export interface FiltrosMeta {
  filialId?: number;
  dataInicio?: string;
  dataFim?: string;
  status?: string;
}

class MetaLojasService {
  // Listar todas as metas com filtros
  async listarMetas(filtros?: FiltrosMeta): Promise<MetaLoja[]> {
    try {
      const params = new URLSearchParams();
      
      if (filtros?.filialId) {
        params.append('filial_id', filtros.filialId.toString());
      }
      if (filtros?.dataInicio) {
        params.append('data_inicio', filtros.dataInicio);
      }
      if (filtros?.dataFim) {
        params.append('data_fim', filtros.dataFim);
      }
      if (filtros?.status) {
        params.append('status', filtros.status);
      }

      const response = await api.get(`/meta-lojas?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao listar metas:', error);
      throw error;
    }
  }

  // Obter uma meta específica
  async obterMeta(id: string): Promise<MetaLoja> {
    try {
      const response = await api.get(`/meta-lojas/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao obter meta:', error);
      throw error;
    }
  }

  // Criar nova meta
  async criarMeta(novaMeta: NovaMetaLoja): Promise<MetaLoja> {
    try {
      const response = await api.post('/meta-lojas', novaMeta);
      return response.data;
    } catch (error) {
      console.error('Erro ao criar meta:', error);
      throw error;
    }
  }

  // Atualizar meta existente
  async atualizarMeta(id: string, meta: Partial<NovaMetaLoja>): Promise<MetaLoja> {
    try {
      const response = await api.put(`/meta-lojas/${id}`, meta);
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar meta:', error);
      throw error;
    }
  }

  // Deletar meta
  async deletarMeta(id: string): Promise<void> {
    try {
      await api.delete(`/meta-lojas/${id}`);
    } catch (error) {
      console.error('Erro ao deletar meta:', error);
      throw error;
    }
  }

  // Listar filiais disponíveis
  async listarFiliais(): Promise<Filial[]> {
    try {
      const response = await api.get('/filiais');
      return response.data;
    } catch (error) {
      console.error('Erro ao listar filiais:', error);
      throw error;
    }
  }

  // Atualizar status da meta
  async atualizarStatusMeta(id: string, status: 'ativa' | 'concluida' | 'cancelada'): Promise<MetaLoja> {
    try {
      const response = await api.patch(`/meta-lojas/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar status da meta:', error);
      throw error;
    }
  }

  // Adicionar funcionário a uma meta existente
  async adicionarFuncionario(metaId: string, funcionario: Omit<Funcionario, 'id'>): Promise<Funcionario> {
    try {
      const response = await api.post(`/meta-lojas/${metaId}/funcionarios`, funcionario);
      return response.data;
    } catch (error) {
      console.error('Erro ao adicionar funcionário:', error);
      throw error;
    }
  }

  // Atualizar funcionário de uma meta
  async atualizarFuncionario(metaId: string, funcionarioId: string, funcionario: Partial<Funcionario>): Promise<Funcionario> {
    try {
      const response = await api.put(`/meta-lojas/${metaId}/funcionarios/${funcionarioId}`, funcionario);
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar funcionário:', error);
      throw error;
    }
  }

  // Remover funcionário de uma meta
  async removerFuncionario(metaId: string, funcionarioId: string): Promise<void> {
    try {
      await api.delete(`/meta-lojas/${metaId}/funcionarios/${funcionarioId}`);
    } catch (error) {
      console.error('Erro ao remover funcionário:', error);
      throw error;
    }
  }

  // Gerar relatório de performance da meta
  async gerarRelatorioPerformance(metaId: string): Promise<any> {
    try {
      const response = await api.get(`/meta-lojas/${metaId}/relatorio-performance`);
      return response.data;
    } catch (error) {
      console.error('Erro ao gerar relatório de performance:', error);
      throw error;
    }
  }

  // Exportar dados da meta para Excel
  async exportarMeta(metaId: string): Promise<Blob> {
    try {
      const response = await api.get(`/meta-lojas/${metaId}/exportar`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao exportar meta:', error);
      throw error;
    }
  }
}

export default new MetaLojasService();