import api from './api';

// Interfaces para os dados das metas de lojas
export interface GrupoMetaProduto {
  id: string;
  nome: string;
  descricao: string;
  metas: MetaProdutoGrupo[];
  dataCriacao: string;
  ativo: boolean;
  totalMetas: number;
}

export interface MetaProdutoGrupo {
  id: string;
  nomeProdutoMarca: string;
  qtdMeta: number;
  percentualSobreVenda: number;
}

export interface MetaLoja {
  id: string;
  lojaId: string;
  nomeLoja: string;
  mes: number;
  ano: number;
  grupoMetaId: string;
  grupoMetaNome: string;
  grupoMetaDescricao: string;
  dataCriacao: string;
  ativo: boolean;
  totalMetasProdutos: number;
  nomeMes?: string;
  periodo?: string;
}

export interface OperadoraCaixa {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  dataCriacao: string;
  ativo: boolean;
}

export interface Vendedora {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  dataCriacao: string;
  ativo: boolean;
}

export interface VendedoraBijou {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  dataCriacao: string;
  ativo: boolean;
}

export interface Gerente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  dataCriacao: string;
  ativo: boolean;
}

export interface MetaProdutoFuncionario {
  id: string;
  funcionarioId: string;
  nomeFuncionario: string;
  tipoFuncionario: string;
  nomeTipoFuncionario: string;
  nomeProdutoMarca: string;
  qtdMeta: number;
  percentualSobreVenda: number;
  mes: number;
  ano: number;
  nomeMes: string;
  periodo: string;
  ativo: boolean;
}

export interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  mes: number;
  ano: number;
  nomeMes: string;
  periodo: string;
  ativo: boolean;
}

// Filtros para as consultas
export interface FiltrosMetaLoja {
  lojaId?: string;
  mes?: number;
  ano?: number;
  ativo?: boolean;
  busca?: string;
}

export interface FiltrosFuncionario {
  ativo?: boolean;
  busca?: string;
}

export interface FiltrosMetaProdutoFuncionario {
  funcionarioId?: string;
  tipoFuncionario?: 'operadora_caixa' | 'vendedora' | 'vendedora_bijou' | 'gerente';
  mes?: number;
  ano?: number;
  ativo?: boolean;
  busca?: string;
}

export interface FiltrosCampanha {
  ativo?: boolean;
  busca?: string;
  mes?: number;
  ano?: number;
}

class MetasLojasApiService {
  // ========== GRUPOS DE METAS ==========
  
  async listarGruposMetas(ativo?: boolean, busca?: string): Promise<GrupoMetaProduto[]> {
    try {
      const params = new URLSearchParams();
      if (ativo !== undefined) params.append('ativo', ativo.toString());
      if (busca) params.append('busca', busca);

      const response = await api.get(`/listar_grupos_metas.php?${params.toString()}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao listar grupos de metas:', error);
      throw error;
    }
  }

  async cadastrarGrupoMeta(grupo: {
    nome: string;
    descricao: string;
    metas: Omit<MetaProdutoGrupo, 'id'>[];
    ativo?: boolean;
  }): Promise<GrupoMetaProduto> {
    try {
      const response = await api.post('/cadastrar_grupo_meta.php', grupo);
      return response.data.data;
    } catch (error) {
      console.error('Erro ao cadastrar grupo de meta:', error);
      throw error;
    }
  }

  async atualizarGrupoMeta(id: string, grupo: {
    nome: string;
    descricao: string;
    metas: MetaProdutoGrupo[];
    ativo?: boolean;
  }): Promise<GrupoMetaProduto> {
    try {
      const response = await api.put('/atualizar_grupo_meta.php', { id, ...grupo });
      return response.data.data;
    } catch (error) {
      console.error('Erro ao atualizar grupo de meta:', error);
      throw error;
    }
  }

  async deletarGrupoMeta(id: string): Promise<void> {
    try {
      await api.delete(`/deletar_grupo_meta.php?id=${id}`);
    } catch (error) {
      console.error('Erro ao deletar grupo de meta:', error);
      throw error;
    }
  }

  // ========== METAS DE LOJAS ==========
  
  async listarMetasLojas(filtros?: FiltrosMetaLoja): Promise<MetaLoja[]> {
    try {
      const params = new URLSearchParams();
      if (filtros?.lojaId) params.append('loja_id', filtros.lojaId);
      if (filtros?.mes) params.append('mes', filtros.mes.toString());
      if (filtros?.ano) params.append('ano', filtros.ano.toString());
      if (filtros?.ativo !== undefined) params.append('ativo', filtros.ativo.toString());
      if (filtros?.busca) params.append('busca', filtros.busca);

      const response = await api.get(`/listar_metas_lojas.php?${params.toString()}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao listar metas de lojas:', error);
      throw error;
    }
  }

  async cadastrarMetaLoja(meta: {
    lojaId: string;
    nomeLoja: string;
    mes: number;
    ano: number;
    grupoMetaId: string;
    ativo?: boolean;
  }): Promise<MetaLoja> {
    try {
      const response = await api.post('/cadastrar_meta_loja.php', {
        loja_id: meta.lojaId,
        nome_loja: meta.nomeLoja,
        mes: meta.mes,
        ano: meta.ano,
        grupo_meta_id: meta.grupoMetaId,
        ativo: meta.ativo ?? true
      });
      return response.data.data;
    } catch (error) {
      console.error('Erro ao cadastrar meta de loja:', error);
      throw error;
    }
  }

  async atualizarMetaLoja(id: string, meta: {
    lojaId: string;
    nomeLoja: string;
    mes: number;
    ano: number;
    grupoMetaId: string;
    ativo?: boolean;
  }): Promise<MetaLoja> {
    try {
      const response = await api.put('/atualizar_meta_loja.php', {
        id,
        loja_id: meta.lojaId,
        nome_loja: meta.nomeLoja,
        mes: meta.mes,
        ano: meta.ano,
        grupo_meta_id: meta.grupoMetaId,
        ativo: meta.ativo ?? true
      });
      return response.data.data;
    } catch (error) {
      console.error('Erro ao atualizar meta de loja:', error);
      throw error;
    }
  }

  async deletarMetaLoja(id: string): Promise<void> {
    try {
      await api.delete(`/deletar_meta_loja.php?id=${id}`);
    } catch (error) {
      console.error('Erro ao deletar meta de loja:', error);
      throw error;
    }
  }

  // ========== FUNCIONÁRIOS ==========
  
  async listarOperadorasCaixa(filtros?: FiltrosFuncionario): Promise<OperadoraCaixa[]> {
    try {
      const params = new URLSearchParams();
      if (filtros?.ativo !== undefined) params.append('ativo', filtros.ativo.toString());
      if (filtros?.busca) params.append('busca', filtros.busca);

      const response = await api.get(`/listar_operadoras_caixa.php?${params.toString()}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao listar operadoras de caixa:', error);
      throw error;
    }
  }

  async listarVendedoras(filtros?: FiltrosFuncionario): Promise<Vendedora[]> {
    try {
      const params = new URLSearchParams();
      if (filtros?.ativo !== undefined) params.append('ativo', filtros.ativo.toString());
      if (filtros?.busca) params.append('busca', filtros.busca);

      const response = await api.get(`/listar_vendedoras.php?${params.toString()}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao listar vendedoras:', error);
      throw error;
    }
  }

  async listarVendedorasBijou(filtros?: FiltrosFuncionario): Promise<VendedoraBijou[]> {
    try {
      const params = new URLSearchParams();
      if (filtros?.ativo !== undefined) params.append('ativo', filtros.ativo.toString());
      if (filtros?.busca) params.append('busca', filtros.busca);

      const response = await api.get(`/listar_vendedoras_bijou.php?${params.toString()}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao listar vendedoras bijou:', error);
      throw error;
    }
  }

  async listarGerentes(filtros?: FiltrosFuncionario): Promise<Gerente[]> {
    try {
      const params = new URLSearchParams();
      if (filtros?.ativo !== undefined) params.append('ativo', filtros.ativo.toString());
      if (filtros?.busca) params.append('busca', filtros.busca);

      const response = await api.get(`/listar_gerentes.php?${params.toString()}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao listar gerentes:', error);
      throw error;
    }
  }

  // ========== METAS DE PRODUTOS INDIVIDUAIS ==========
  
  async listarMetasProdutosFuncionarios(filtros?: FiltrosMetaProdutoFuncionario): Promise<MetaProdutoFuncionario[]> {
    try {
      const params = new URLSearchParams();
      if (filtros?.funcionarioId) params.append('funcionario_id', filtros.funcionarioId);
      if (filtros?.tipoFuncionario) params.append('tipo_funcionario', filtros.tipoFuncionario);
      if (filtros?.mes) params.append('mes', filtros.mes.toString());
      if (filtros?.ano) params.append('ano', filtros.ano.toString());
      if (filtros?.ativo !== undefined) params.append('ativo', filtros.ativo.toString());
      if (filtros?.busca) params.append('busca', filtros.busca);

      const response = await api.get(`/listar_metas_produtos_funcionarios.php?${params.toString()}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao listar metas de produtos de funcionários:', error);
      throw error;
    }
  }

  // ========== CAMPANHAS ==========
  
  async listarCampanhas(filtros?: FiltrosCampanha): Promise<Campanha[]> {
    try {
      const params = new URLSearchParams();
      if (filtros?.ativo !== undefined) params.append('ativo', filtros.ativo.toString());
      if (filtros?.busca) params.append('busca', filtros.busca);
      if (filtros?.mes) params.append('mes', filtros.mes.toString());
      if (filtros?.ano) params.append('ano', filtros.ano.toString());

      const response = await api.get(`/listar_campanhas.php?${params.toString()}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao listar campanhas:', error);
      throw error;
    }
  }
}

// Exportar uma instância do serviço
const metasLojasApiService = new MetasLojasApiService();
export default metasLojasApiService;