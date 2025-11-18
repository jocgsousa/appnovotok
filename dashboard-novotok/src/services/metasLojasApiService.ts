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

// Interfaces específicas removidas - agora usamos a interface Vendedor do funcionariosService

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

// Interface FiltrosFuncionario removida - não é mais necessária

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

  // Finalizar meta de loja (marcar como inativa)
  async finalizarMetaLoja(id: string): Promise<void> {
    try {
      await api.patch('/finalizar_meta_loja.php', { id });
    } catch (error) {
      console.error('Erro ao finalizar meta de loja:', error);
      throw error;
    }
  }

  // Reativar meta de loja (somente admin)
  async reativarMetaLoja(id: string): Promise<void> {
    try {
      await api.patch('/reativar_meta_loja.php', { id });
    } catch (error) {
      console.error('Erro ao reativar meta de loja:', error);
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
    operadorasCaixa?: any[];
    vendedoras?: any[];
    vendedorasBijou?: any[];
    gerente?: any;
    campanhas?: any[];
    valorVendaLojaTotal?: number;
    funcionarios?: any[];
  }): Promise<MetaLoja> {
    try {
      const mapVendedoraBijou = (vb: any) => ({
        id: vb.id,
        nome: vb.nome,
        funcao: vb.funcao ?? 'VENDEDORA BIJOU/MAKE/BOLSAS',
        bijou_make_bolsas: vb.bijouMakeBolsas ?? vb.bijou_make_bolsas ?? 0,
        valor_total_bijou_filial: vb.valorTotalBijouFilial ?? vb.valor_total_bijou_filial ?? 0,
        bijou_make_bolsas_secoes: vb.bijouMakeBolsasSecoes ?? vb.bijou_make_bolsas_secoes ?? 0,
        valor_total_bijou_filial_secoes: vb.valorTotalBijouFilialSecoes ?? vb.valor_total_bijou_filial_secoes ?? 0,
        percentual_comissao_bijou: vb.percentualComissaoBijou ?? vb.percentual_comissao_bijou ?? 0,
        valor_comissao_bijou: vb.valorComissaoBijou ?? vb.valor_comissao_bijou ?? 0,
        metasProdutos: vb.metasProdutos || []
      });

      const response = await api.post('/cadastrar_meta_loja.php', {
        loja_id: meta.lojaId,
        nome_loja: meta.nomeLoja,
        mes: meta.mes,
        ano: meta.ano,
        grupo_meta_id: meta.grupoMetaId,
        ativo: meta.ativo ?? true,
        operadoras_caixa: meta.operadorasCaixa || [],
        vendedoras: meta.vendedoras || [],
        vendedoras_bijou: (meta.vendedorasBijou || []).map(mapVendedoraBijou),
        gerente: meta.gerente || null,
        campanhas: meta.campanhas || [],
        valor_venda_loja_total: meta.valorVendaLojaTotal || 0,
        funcionarios: meta.funcionarios || []
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
    operadorasCaixa?: any[];
    vendedoras?: any[];
    vendedorasBijou?: any[];
    gerente?: any;
    campanhas?: any[];
    valorVendaLojaTotal?: number;
    funcionarios?: any[];
  }): Promise<MetaLoja> {
    try {
      const mapVendedoraBijou = (vb: any) => ({
        id: vb.id,
        nome: vb.nome,
        funcao: vb.funcao ?? 'VENDEDORA BIJOU/MAKE/BOLSAS',
        bijou_make_bolsas: vb.bijouMakeBolsas ?? vb.bijou_make_bolsas ?? 0,
        valor_total_bijou_filial: vb.valorTotalBijouFilial ?? vb.valor_total_bijou_filial ?? 0,
        bijou_make_bolsas_secoes: vb.bijouMakeBolsasSecoes ?? vb.bijou_make_bolsas_secoes ?? 0,
        valor_total_bijou_filial_secoes: vb.valorTotalBijouFilialSecoes ?? vb.valor_total_bijou_filial_secoes ?? 0,
        percentual_comissao_bijou: vb.percentualComissaoBijou ?? vb.percentual_comissao_bijou ?? 0,
        valor_comissao_bijou: vb.valorComissaoBijou ?? vb.valor_comissao_bijou ?? 0,
        metasProdutos: vb.metasProdutos || []
      });

      const response = await api.put('/atualizar_meta_loja.php', {
        id,
        loja_id: meta.lojaId,
        nome_loja: meta.nomeLoja,
        mes: meta.mes,
        ano: meta.ano,
        grupo_meta_id: meta.grupoMetaId,
        ativo: meta.ativo ?? true,
        operadoras_caixa: meta.operadorasCaixa || [],
        vendedoras: meta.vendedoras || [],
        vendedoras_bijou: (meta.vendedorasBijou || []).map(mapVendedoraBijou),
        gerente: meta.gerente || null,
        campanhas: meta.campanhas || [],
        valor_venda_loja_total: meta.valorVendaLojaTotal || 0,
        funcionarios: meta.funcionarios || []
      });
      return response.data.data;
    } catch (error) {
      console.error('Erro ao atualizar meta de loja:', error);
      throw error;
    }
  }

  async obterMetaLoja(id: string): Promise<any> {
    try {
      const response = await api.get(`/obter_meta_loja.php?id=${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Erro ao obter meta de loja:', error);
      throw error;
    }
  }

  // ========== EXPORTAÇÃO ==========
  async exportarMetaLojaExcel(id: string): Promise<Blob> {
    try {
      const response = await api.get(`/exportar_meta_loja.php`, {
        params: { id },
        responseType: 'blob',
        timeout: 120000
      });

      // Verificar se retornou um blob válido ou um JSON de erro
      if (response.data instanceof Blob) {
        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('json')) {
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
            if (response.data.size < 100) {
              throw new Error('O arquivo gerado está corrompido ou vazio');
            }
          }
        }
        return response.data as Blob;
      } else {
        throw new Error('Resposta inválida da API de exportação');
      }
    } catch (error) {
      console.error('Erro ao exportar meta da loja:', error);
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
  // Métodos específicos removidos - agora usamos listarVendedores() do funcionariosService

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