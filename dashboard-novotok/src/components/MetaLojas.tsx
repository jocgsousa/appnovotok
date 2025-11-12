import React, { useState, useEffect } from 'react';
import metasLojasApiService from '../services/metasLojasApiService';
import { listarVendedores } from '../services/funcionariosService';
import { listarFiliais } from '../services/filiaisService';
import { Container, Row, Col, Card, Button, Form, Table, Modal, Alert, Badge, Tabs, Tab, OverlayTrigger, Tooltip, ButtonGroup } from 'react-bootstrap';
import PageHeader from './PageHeader';
import { useAuth } from '../contexts/AuthContext';

// Interfaces
interface Filial {
  id: number;
  codigo: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
}

interface MetaProduto {
  id: string;
  nomeProdutoMarca: string;
  qtdMeta: number;
  qtdVendido: number;
  percentualSobreVenda: number;
  valorVendido: number;
  valorComissao: number; // Campo calculado automaticamente
}

interface GrupoMetaProduto {
  id: string;
  nome: string;
  descricao: string;
  metas: Omit<MetaProduto, 'qtdVendido' | 'valorVendido' | 'valorComissao'>[];
  dataCriacao: string;
  ativo: boolean;
}

interface OperadoraCaixa {
  id: string;
  nome: string;
  funcao: string;
  cadastrosPositivados: number;
  produtosDestaque: number;
  metasProdutos: MetaProduto[];
}

interface Vendedora {
  id: string;
  nome: string;
  funcao: string;
  valorVendidoTotal: number;
  esmaltes: number;
  profissionalParceiras: number;
  valorVendidoMake: number;
  quantidadeMalka: number;
  valorMalka: number;
  metasProdutos: MetaProduto[];
}

interface VendedoraBijou {
  id: string;
  nome: string;
  funcao: string;
  bijouMakeBolsas: number;
  percentualComissaoBijou?: number;
  valorComissaoBijou?: number;
  metasProdutos: MetaProduto[];
}

interface Gerente {
  id: string;
  nome: string;
  funcao: string;
  percentualMetaGeral: number;
}

interface Campanha {
  id: string;
  nome: string;
  quantidadeVendida: number;
  atingiuMeta: boolean;
}

// Interface legada para compatibilidade
interface Funcionario {
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
  comissoes: {
    esmaltes: number;
    profissionalParceiras: number;
    valorVendidoMake: number;
    quantidadeMalka: number;
    valorMalka: number;
    bijouMakeBolsas: number;
    valorVendidoTotal: number;
    cadastros: number;
    produtosDestaque: number;
  };
}

interface VendedorAPI {
  id: number;
  rca: string;
  nome: string;
  email: string;
  ativo: boolean;
  filial: {
    id: number;
    nome: string;
    codigo: string;
  } | null;
}

interface MetaLoja {
  id: string;
  filialId: number;
  filialNome: string;
  periodo: string;
  dataInicio: string;
  dataFim: string;
  valorVendaLojaTotal: number;
  grupoMetaId?: string;
  grupoMetaNome?: string;
  operadorasCaixa: OperadoraCaixa[];
  vendedoras: Vendedora[];
  vendedorasBijou: VendedoraBijou[];
  gerente: Gerente | null;
  campanhas: Campanha[];
  funcionarios: Funcionario[]; // Mantido para compatibilidade
  dataCriacao: string;
  status: 'ativa' | 'concluida' | 'cancelada';
}

const MetaLojas: React.FC = () => {
  const { usuario } = useAuth();
  const isAdmin = usuario?.tipo_usuario === 'admin';

  // Função para aplicar máscara monetária
  const aplicarMascaraMonetaria = (valor: string): string => {
    // Remove tudo exceto números
    const apenasNumeros = valor.replace(/\D/g, '');
    
    if (!apenasNumeros) return '';
    
    // Converte para número e divide por 100 para ter centavos
    const numero = parseInt(apenasNumeros) / 100;
    
    // Formata como moeda brasileira
    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const salvarEdicaoMeta = async () => {
    if (!metaSelecionada) return;
    if (!novaMetaFilial || !novaMetaDataInicio || !novaMetaDataFim) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    const filialSelecionada = filiais.find(f => f.id.toString() === novaMetaFilial);
    if (!filialSelecionada) return;

    try {
      setLoading(true);
      setError(''); // Limpar erro antes de tentar salvar
      
      const payload = {
        lojaId: filialSelecionada.id.toString(),
        nomeLoja: filialSelecionada.nome_fantasia,
        // Evitar bugs de timezone: extrair mês/ano diretamente da string 'YYYY-MM-DD'
        mes: (() => {
          const parts = (novaMetaDataInicio || '').split('-');
          return parts.length >= 2 ? Number(parts[1]) : new Date(novaMetaDataInicio).getMonth() + 1;
        })(),
        ano: (() => {
          const parts = (novaMetaDataInicio || '').split('-');
          return parts.length >= 1 ? Number(parts[0]) : new Date(novaMetaDataInicio).getFullYear();
        })(),
        grupoMetaId: novaMetaGrupoId || metaSelecionada.grupoMetaId || gruposMetas[0]?.id || '1',
        ativo: metaSelecionada.status !== 'cancelada',
        // Incluir dados dos funcionários
        operadorasCaixa: operadorasCaixa,
        vendedoras: vendedoras,
        vendedorasBijou: vendedorasBijou,
        gerente: gerente,
        campanhas: campanhas,
        valorVendaLojaTotal: parseFloat(novaMetaValorTotal) || 0,
        // Manter compatibilidade com funcionários legados
        funcionarios: funcionarios
      };
      
      await metasLojasApiService.atualizarMetaLoja(metaSelecionada.id, payload);
      await carregarDados();
      
      // Fechar modal
      fecharTodosModais();
      setSuccess('Meta de loja atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar meta:', error);
      setError('Erro ao atualizar meta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Função para converter valor com máscara para número
  const converterMascaraParaNumero = (valor: string): number => {
    if (!valor) return 0;
    
    // Remove tudo exceto números e vírgula
    const numeroLimpo = valor.replace(/[^\d,]/g, '');
    
    // Se não há vírgula, trata como centavos
    if (!numeroLimpo.includes(',')) {
      return parseFloat(numeroLimpo) / 100 || 0;
    }
    
    // Se há vírgula, converte normalmente
    return parseFloat(numeroLimpo.replace(',', '.')) || 0;
  };

  

  // Função para formatar número para exibição
  const formatarNumeroParaExibicao = (numero: number): string => {
    if (!numero) return '';
    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Função para formatar datas 'YYYY-MM-DD' em 'DD/MM/YYYY' sem usar Date()
  const formatarDataBR = (dateStr: string): string => {
    if (!dateStr) return '-';
    if (dateStr.includes('-')) {
      const [ano, mes, dia] = dateStr.split('-');
      const d = (dia || '').padStart(2, '0');
      const m = (mes || '').padStart(2, '0');
      return `${d}/${m}/${ano}`;
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [dia, mes, ano] = parts;
        return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
      }
    }
    return dateStr;
  };

  // Função para lidar com mudanças nos campos monetários
  const handleInputMonetario = (valor: string, callback: (novoValor: string) => void) => {
    const valorFormatado = aplicarMascaraMonetaria(valor);
    callback(valorFormatado);
  };

  // Função para lidar com mudanças em campos monetários
  const handleValorMonetarioChange = (
    funcionarioId: string, 
    campo: string, 
    valorInput: string
  ) => {
    const valorFormatado = aplicarMascaraMonetaria(valorInput);
    const valorNumerico = converterMascaraParaNumero(valorFormatado);
    
    // Atualiza o funcionário com o valor numérico
    atualizarFuncionario(funcionarioId, campo, valorNumerico);
  };



  // Estados principais
  const [metas, setMetas] = useState<MetaLoja[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [vendedoresAPI, setVendedoresAPI] = useState<VendedorAPI[]>([]);
  const [filtroFilial, setFiltroFilial] = useState<string>('');
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<'ativa' | 'concluida' | 'todas'>('ativa');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [metaAdminDetalhes, setMetaAdminDetalhes] = useState<any | null>(null);
  const [modalModo, setModalModo] = useState<'criar' | 'editar'>('criar');
  const [metaSelecionada, setMetaSelecionada] = useState<MetaLoja | null>(null);

  // Estados para grupos de metas
  const [gruposMetas, setGruposMetas] = useState<GrupoMetaProduto[]>([]);
  const [showGrupoModal, setShowGrupoModal] = useState(false);
  const [grupoEditando, setGrupoEditando] = useState<GrupoMetaProduto | null>(null);
  const [abaAtivaGrupos, setAbaAtivaGrupos] = useState<string>('listar');
  const [novoGrupo, setNovoGrupo] = useState({
    nome: '',
    descricao: '',
    metas: [] as Omit<MetaProduto, 'qtdVendido' | 'valorVendido' | 'valorComissao'>[]
  });

  // Fechar e limpar estados de todos os modais
  const fecharTodosModais = () => {
    setShowModal(false);
    setShowViewModal(false);
    setShowGrupoModal(false);
    const body = document.body;
    body.classList.remove('modal-open');
    body.style.removeProperty('padding-right');
  };

  // Garantir limpeza de classes quando nenhum modal estiver aberto
  useEffect(() => {
    if (!showModal && !showViewModal && !showGrupoModal) {
      const body = document.body;
      body.classList.remove('modal-open');
      body.style.removeProperty('padding-right');
    }
    return () => {
      const body = document.body;
      body.classList.remove('modal-open');
      body.style.removeProperty('padding-right');
    };
  }, [showModal, showViewModal, showGrupoModal]);

  // Estados do formulário de nova meta
  const [novaMetaFilial, setNovaMetaFilial] = useState<string>('');
  const [novaMetaDataInicio, setNovaMetaDataInicio] = useState<string>(() => {
    const hoje = new Date();
    const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return primeiroDiaDoMes.toISOString().split('T')[0];
  });
  const [novaMetaDataFim, setNovaMetaDataFim] = useState<string>(() => {
    const hoje = new Date();
    const ultimoDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return ultimoDiaDoMes.toISOString().split('T')[0];
  });
  const [novaMetaValorTotal, setNovaMetaValorTotal] = useState<string>('');
  const [novaMetaGrupoId, setNovaMetaGrupoId] = useState<string>('');
  
  // Estados para os novos tipos de funcionários
  const [operadorasCaixa, setOperadorasCaixa] = useState<OperadoraCaixa[]>([]);
  const [vendedoras, setVendedoras] = useState<Vendedora[]>([]);
  const [vendedorasBijou, setVendedorasBijou] = useState<VendedoraBijou[]>([]);
  // Recalcular comissão bijou ao carregar dados ou alterar percentuais/valores
  useEffect(() => {
    let changed = false;
    const recalculado = vendedorasBijou.map(vb => {
      const bijou = (vb.bijouMakeBolsas ?? (vb as any).bijou_make_bolsas ?? 0) as number;
      const perc = (vb.percentualComissaoBijou ?? (vb as any).percentual_comissao_bijou ?? 0) as number;
      const atual = (vb.valorComissaoBijou ?? (vb as any).valor_comissao_bijou) as number | undefined;
      const somaMetas = (vb.metasProdutos ?? []).reduce((acc: number, m: any) => acc + (m?.valorComissao ?? 0), 0);
      const calc = ((bijou * perc) / 100) + somaMetas;
      if (!Number.isFinite(calc)) return vb;
      const diff = atual == null ? Math.abs(calc) : Math.abs(calc - atual);
      if (diff > 0.005) { changed = true; return { ...vb, valorComissaoBijou: calc }; }
      return vb;
    });
    if (changed) setVendedorasBijou(recalculado);
  }, [vendedorasBijou]);
  // Estado auxiliar para manter o texto mascarado do campo Bijou/Make/Bolsas por vendedora
  const [bijouInputValores, setBijouInputValores] = useState<Record<string, string>>({});
  const [gerente, setGerente] = useState<Gerente | null>(null);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  
  // Estado para controlar a aba ativa (deve corresponder ao eventKey dos Tabs)
  const [abaAtiva, setAbaAtiva] = useState<string>('operadoras');
  
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);

  // Carregar dados da API
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      // Carregar grupos de metas
      const gruposData = await metasLojasApiService.listarGruposMetas();
      setGruposMetas(gruposData);

      // Carregar metas de lojas
      const metasData = await metasLojasApiService.listarMetasLojas();
      
      // Converter os dados da API para o formato esperado pelo componente
      const metasFormatadas = metasData.map(meta => {
        const ultimoDiaDoMes = new Date(meta.ano, meta.mes, 0).getDate();
        return ({
          id: meta.id,
          filialId: parseInt(meta.lojaId) || 0,
          filialNome: meta.nomeLoja,
          periodo: `${meta.nomeMes || 'Mês'} ${meta.ano}`,
          dataInicio: `${meta.ano}-${meta.mes.toString().padStart(2, '0')}-01`,
          dataFim: `${meta.ano}-${meta.mes.toString().padStart(2, '0')}-${String(ultimoDiaDoMes).padStart(2, '0')}`,
          // Usar o valor total vindo da API; garantir número
          valorVendaLojaTotal: (meta as any).valorVendaLojaTotal ?? 0,
          grupoMetaId: meta.grupoMetaId,
          grupoMetaNome: meta.grupoMetaNome,
          // Mapear subseções retornadas pelo listar_metas_lojas.php
          operadorasCaixa: (meta as any).subsecoes?.operadorasCaixa ?? [],
          vendedoras: (meta as any).subsecoes?.vendedoras ?? [],
          vendedorasBijou: (meta as any).subsecoes?.vendedorasBijou ?? [],
          gerente: ((meta as any).subsecoes?.gerente && (meta as any).subsecoes?.gerente.length > 0)
            ? (meta as any).subsecoes.gerente[0]
            : null,
          campanhas: (meta as any).subsecoes?.campanhas ?? [],
          funcionarios: (meta as any).subsecoes?.funcionarios ?? [],
          dataCriacao: meta.dataCriacao,
          // Mapear inativo como concluida (finalizada)
          status: meta.ativo ? 'ativa' as const : 'concluida' as const
        });
      });

      setMetas(metasFormatadas);

      // Carregar vendedores da API
      const vendedoresData = await listarVendedores();
      setVendedoresAPI(vendedoresData);

      // Carregar filiais da API
      const filiaisResponse = await listarFiliais();
      if (filiaisResponse.success && filiaisResponse.filiais) {
        setFiliais(filiaisResponse.filiais);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      // Em caso de erro, manter dados vazios ou mostrar mensagem de erro
      setGruposMetas([]);
      setMetas([]);
    }
  };

  // Função para filtrar vendedores pela filial selecionada
  const getVendedoresFiltrados = () => {
    // Sem filial selecionada: listar todos ativos
    if (!novaMetaFilial) {
      return vendedoresAPI.filter(v => v.ativo);
    }
    // Com filial selecionada: aceitar match por id ou código, e ignorar vendedores sem filial
    return vendedoresAPI.filter(v => {
      if (!v.ativo) return false;
      if (!v.filial) return false;
      const filialIdMatch = v.filial.id?.toString() === novaMetaFilial;
      const filialCodigoMatch = v.filial.codigo?.toString() === novaMetaFilial;
      return filialIdMatch || filialCodigoMatch;
    });
  };

  // useEffect para calcular automaticamente o % Meta Geral do gerente baseado nas campanhas atingidas
  useEffect(() => {
    if (gerente) {
      const campanhasAtingidas = campanhas.filter(campanha => campanha.atingiuMeta).length;
      const percentualBase = 0.08; // 0,08% inicial
      const percentualAdicional = campanhasAtingidas * 0.01; // 0,01% para cada campanha atingida
      const novoPercentual = percentualBase + percentualAdicional;
      
      if (gerente.percentualMetaGeral !== novoPercentual) {
        setGerente(prevGerente => prevGerente ? {
          ...prevGerente,
          percentualMetaGeral: novoPercentual
        } : null);
      }
    }
  }, [campanhas]); // Removido 'gerente' das dependências para evitar loop infinito

  // Filtrar metas
  const metasFiltradas = metas.filter(meta => {
    const filtroFilialMatch = !filtroFilial || meta.filialId.toString() === filtroFilial;
    const filtroDataInicioMatch = !filtroDataInicio || meta.dataInicio >= filtroDataInicio;
    const filtroDataFimMatch = !filtroDataFim || meta.dataFim <= filtroDataFim;
    const filtroStatusMatch =
      filtroStatus === 'todas' ||
      (filtroStatus === 'ativa' && meta.status === 'ativa') ||
      (filtroStatus === 'concluida' && meta.status === 'concluida');
    
    return filtroFilialMatch && filtroDataInicioMatch && filtroDataFimMatch && filtroStatusMatch;
  });

  // Funções para Operadoras de Caixa
  const adicionarOperadoraCaixa = () => {
    const novaOperadora: OperadoraCaixa = {
      id: Date.now().toString(),
      nome: '',
      funcao: 'OPERADOR(A) DE CAIXA',
      cadastrosPositivados: 0,
      produtosDestaque: 0,
      metasProdutos: []
    };
    setOperadorasCaixa([...operadorasCaixa, novaOperadora]);
  };

  const removerOperadoraCaixa = (id: string) => {
    setOperadorasCaixa(operadorasCaixa.filter(op => op.id !== id));
  };

  const atualizarOperadoraCaixa = (id: string, campo: string, valor: any) => {
    setOperadorasCaixa(operadorasCaixa.map(op => 
      op.id === id ? { ...op, [campo]: valor } : op
    ));
  };

  // Funções para Vendedoras
  const adicionarVendedora = () => {
    const novaVendedora: Vendedora = {
      id: Date.now().toString(),
      nome: '',
      funcao: 'ATENDENTE DE LOJA',
      valorVendidoTotal: 0,
      esmaltes: 0,
      profissionalParceiras: 0,
      valorVendidoMake: 0,
      quantidadeMalka: 0,
      valorMalka: 0,
      metasProdutos: []
    };
    setVendedoras([...vendedoras, novaVendedora]);
  };

  const adicionarTodasVendedorasDaFilial = () => {
    if (!novaMetaFilial) {
      setError('Selecione a filial no início do formulário.');
      return;
    }
    const vendedoresFiltrados = getVendedoresFiltrados();
    const novasVendedoras: Vendedora[] = vendedoresFiltrados
      .filter(v => !vendedoras.some(existente => existente.nome === v.nome))
      .map(v => ({
        id: `${Date.now()}-${v.id}`,
        nome: v.nome,
        funcao: 'ATENDENTE DE LOJA',
        valorVendidoTotal: 0,
        esmaltes: 0,
        profissionalParceiras: 0,
        valorVendidoMake: 0,
        quantidadeMalka: 0,
        valorMalka: 0,
        metasProdutos: []
      }));

    if (novasVendedoras.length === 0) {
      setError('Nenhuma vendedora nova para adicionar desta filial.');
      return;
    }

    setVendedoras([...vendedoras, ...novasVendedoras]);
    setError('');
  };

  const removerVendedora = (id: string) => {
    setVendedoras(vendedoras.filter(v => v.id !== id));
  };

  const atualizarVendedora = (id: string, campo: string, valor: any) => {
    setVendedoras(vendedoras.map(v => 
      v.id === id ? { ...v, [campo]: valor } : v
    ));
  };

  // Funções para Vendedoras Bijou
  const adicionarVendedoraBijou = () => {
    const novaVendedoraBijou: VendedoraBijou = {
      id: Date.now().toString(),
      nome: '',
      funcao: 'VENDEDORA BIJOU/MAKE/BOLSAS',
      bijouMakeBolsas: 0,
      percentualComissaoBijou: 0,
      valorComissaoBijou: 0,
      metasProdutos: []
    };
    setVendedorasBijou([...vendedorasBijou, novaVendedoraBijou]);
    setBijouInputValores(prev => ({ ...prev, [novaVendedoraBijou.id]: aplicarMascaraMonetaria('0') }));
  };

  const removerVendedoraBijou = (id: string) => {
    setVendedorasBijou(vendedorasBijou.filter(vb => vb.id !== id));
    setBijouInputValores(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const atualizarVendedoraBijou = (id: string, campo: string, valor: any) => {
    setVendedorasBijou(vendedorasBijou.map(vb => {
      if (vb.id !== id) return vb;
      const atualizado = { ...vb, [campo]: valor } as VendedoraBijou & any;
      const bijouValor = (atualizado.bijouMakeBolsas ?? atualizado.bijou_make_bolsas ?? 0) as number;
      const perc = (atualizado.percentualComissaoBijou ?? atualizado.percentual_comissao_bijou ?? 0) as number;
      // Recalcular comissão total (bijou + metasProdutos) quando bijouMakeBolsas ou percentual mudar
      if (campo === 'bijouMakeBolsas' || campo === 'percentualComissaoBijou') {
        const somaMetas = (atualizado.metasProdutos ?? []).reduce((acc: number, m: any) => acc + (m?.valorComissao ?? 0), 0);
        atualizado.valorComissaoBijou = ((bijouValor * perc) / 100) + somaMetas;
      }
      return atualizado;
    }));
  };

  // Funções para Metas de Produtos
  const calcularValorComissaoBase = (valorVendido: number, percentualSobreVenda: number): number => {
    return (valorVendido * percentualSobreVenda) / 100;
  };

  const calcularValorComissaoMeta = (meta: MetaProduto): number => {
    if ((meta.qtdVendido || 0) >= (meta.qtdMeta || 0)) {
      return calcularValorComissaoBase(meta.valorVendido || 0, meta.percentualSobreVenda || 0);
    }
    return 0;
  };

  const somarComissoesMetas = (metas: MetaProduto[]): number => {
    return (metas || []).reduce((acc, m) => acc + (m.valorComissao || 0), 0);
  };

  const adicionarMetaProduto = (funcionarioId: string, tipoFuncionario: 'operadora' | 'vendedora' | 'vendedoraBijou') => {
    const novaMeta: MetaProduto = {
      id: Date.now().toString(),
      nomeProdutoMarca: '',
      qtdMeta: 0,
      qtdVendido: 0,
      percentualSobreVenda: 0,
      valorVendido: 0,
      valorComissao: 0
    };

    if (tipoFuncionario === 'operadora') {
      setOperadorasCaixa(operadorasCaixa.map(op => 
        op.id === funcionarioId ? { ...op, metasProdutos: [...op.metasProdutos, novaMeta] } : op
      ));
    } else if (tipoFuncionario === 'vendedora') {
      setVendedoras(vendedoras.map(v => {
        if (v.id === funcionarioId) {
          const metasAtualizadas = [...v.metasProdutos, novaMeta];
          const soma = somarComissoesMetas(metasAtualizadas);
          return { ...v, metasProdutos: metasAtualizadas, profissionalParceiras: soma };
        }
        return v;
      }));
    } else if (tipoFuncionario === 'vendedoraBijou') {
      setVendedorasBijou(vendedorasBijou.map(vb => {
        if (vb.id === funcionarioId) {
          const metasAtualizadas = [...vb.metasProdutos, novaMeta];
          const soma = somarComissoesMetas(metasAtualizadas);
          const bijouValor = (vb.bijouMakeBolsas ?? (vb as any).bijou_make_bolsas ?? 0) as number;
          const perc = (vb.percentualComissaoBijou ?? (vb as any).percentual_comissao_bijou ?? 0) as number;
          const comissaoBijou = (bijouValor * perc) / 100;
          return { 
            ...vb, 
            metasProdutos: metasAtualizadas, 
            valorComissaoBijou: comissaoBijou + soma 
          };
        }
        return vb;
      }));
    }
  };

  const removerMetaProduto = (funcionarioId: string, metaId: string, tipoFuncionario: 'operadora' | 'vendedora' | 'vendedoraBijou') => {
    if (tipoFuncionario === 'operadora') {
      setOperadorasCaixa(operadorasCaixa.map(op => 
        op.id === funcionarioId ? { ...op, metasProdutos: op.metasProdutos.filter(m => m.id !== metaId) } : op
      ));
    } else if (tipoFuncionario === 'vendedora') {
      setVendedoras(vendedoras.map(v => {
        if (v.id === funcionarioId) {
          const metasAtualizadas = v.metasProdutos.filter(m => m.id !== metaId);
          const soma = somarComissoesMetas(metasAtualizadas);
          return { ...v, metasProdutos: metasAtualizadas, profissionalParceiras: soma };
        }
        return v;
      }));
    } else if (tipoFuncionario === 'vendedoraBijou') {
      setVendedorasBijou(vendedorasBijou.map(vb => {
        if (vb.id === funcionarioId) {
          const metasAtualizadas = vb.metasProdutos.filter(m => m.id !== metaId);
          const soma = somarComissoesMetas(metasAtualizadas);
          const bijouValor = (vb.bijouMakeBolsas ?? (vb as any).bijou_make_bolsas ?? 0) as number;
          const perc = (vb.percentualComissaoBijou ?? (vb as any).percentual_comissao_bijou ?? 0) as number;
          const comissaoBijou = (bijouValor * perc) / 100;
          return { ...vb, metasProdutos: metasAtualizadas, valorComissaoBijou: comissaoBijou + soma };
        }
        return vb;
      }));
    }
  };

  const atualizarMetaProduto = (funcionarioId: string, metaId: string, campo: string, valor: any, tipoFuncionario: 'operadora' | 'vendedora' | 'vendedoraBijou') => {
    const atualizarMeta = (meta: MetaProduto) => {
      if (meta.id === metaId) {
        const metaAtualizada: MetaProduto = { ...meta, [campo]: valor } as MetaProduto;
        // Recalcular valor da comissão considerando a regra de Qtd Vendida ≥ Qtd Meta
        metaAtualizada.valorComissao = calcularValorComissaoMeta(metaAtualizada);
        return metaAtualizada;
      }
      return meta;
    };

    if (tipoFuncionario === 'operadora') {
      setOperadorasCaixa(operadorasCaixa.map(op => 
        op.id === funcionarioId ? { ...op, metasProdutos: op.metasProdutos.map(atualizarMeta) } : op
      ));
    } else if (tipoFuncionario === 'vendedora') {
      setVendedoras(vendedoras.map(v => {
        if (v.id === funcionarioId) {
          const metasAtualizadas = v.metasProdutos.map(atualizarMeta);
          const soma = somarComissoesMetas(metasAtualizadas);
          return { ...v, metasProdutos: metasAtualizadas, profissionalParceiras: soma };
        }
        return v;
      }));
    } else if (tipoFuncionario === 'vendedoraBijou') {
      setVendedorasBijou(vendedorasBijou.map(vb => {
        if (vb.id === funcionarioId) {
          const metasAtualizadas = vb.metasProdutos.map(atualizarMeta);
          const soma = somarComissoesMetas(metasAtualizadas);
          const bijouValor = (vb.bijouMakeBolsas ?? (vb as any).bijou_make_bolsas ?? 0) as number;
          const perc = (vb.percentualComissaoBijou ?? (vb as any).percentual_comissao_bijou ?? 0) as number;
          const comissaoBijou = (bijouValor * perc) / 100;
          return { ...vb, metasProdutos: metasAtualizadas, valorComissaoBijou: comissaoBijou + soma };
        }
        return vb;
      }));
    }
  };

  // Funções para Gerente
  const adicionarGerente = () => {
    if (!gerente) {
      const novoGerente: Gerente = {
        id: Date.now().toString(),
        nome: '',
        funcao: 'GERENTE',
        percentualMetaGeral: 0.08
      };
      setGerente(novoGerente);
    }
  };

  const removerGerente = () => {
    setGerente(null);
  };

  const atualizarGerente = (campo: string, valor: any) => {
    if (gerente) {
      setGerente({ ...gerente, [campo]: valor });
    }
  };

  // Funções para Campanhas
  const adicionarCampanha = () => {
    const novaCampanha: Campanha = {
      id: Date.now().toString(),
      nome: '',
      quantidadeVendida: 0,
      atingiuMeta: false
    };
    setCampanhas([...campanhas, novaCampanha]);
  };

  const removerCampanha = (id: string) => {
    setCampanhas(campanhas.filter(c => c.id !== id));
  };

  const atualizarCampanha = (id: string, campo: string, valor: any) => {
    setCampanhas(campanhas.map(c => {
      if (c.id === id) {
        const campanhaAtualizada = { ...c, [campo]: valor };
        return campanhaAtualizada;
      }
      return c;
    }));
    // O percentual do gerente será atualizado automaticamente pelo useEffect
  };

  // Função para adicionar funcionário (mantida para compatibilidade)
  const adicionarFuncionario = () => {
    const novoFuncionario: Funcionario = {
      id: Date.now().toString(),
      nome: '',
      funcao: '',
      cadastros: 0,
      produtosDestaque: 0,
      valorVendidoTotal: 0,
      esmaltes: 0,
      profissionalParceiras: 0,
      percentualProfissional: 2,
      valorVendidoMake: 0,
      quantidadeMalka: 0,
      valorMalka: 0,
      bijouMakeBolsas: 0,
      comissoes: { 
        esmaltes: 0,
        profissionalParceiras: 0,
        valorVendidoMake: 0,
        quantidadeMalka: 0,
        valorMalka: 0,
        bijouMakeBolsas: 0,
        valorVendidoTotal: 0,
        cadastros: 0,
        produtosDestaque: 0
      }
    };
    setFuncionarios([...funcionarios, novoFuncionario]);
  };

  // Função para remover funcionário (mantida para compatibilidade)
  const removerFuncionario = (id: string) => {
    setFuncionarios(funcionarios.filter(f => f.id !== id));
  };

  // Função para atualizar funcionário (mantida para compatibilidade)
  const atualizarFuncionario = (id: string, campo: string, valor: any) => {
    setFuncionarios(funcionarios.map(func => {
      if (func.id === id) {
        if (campo.startsWith('comissoes.')) {
          const comissaoTipo = campo.split('.')[1];
          return {
            ...func,
            comissoes: {
              ...func.comissoes,
              [comissaoTipo]: valor
            }
          };
        }
        return { ...func, [campo]: valor };
      }
      return func;
    }));
  };

  // Função para salvar nova meta
  const salvarNovaMeta = async () => {
    if (!novaMetaFilial || !novaMetaDataInicio || !novaMetaDataFim) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    const filialSelecionada = filiais.find(f => f.id.toString() === novaMetaFilial);
    if (!filialSelecionada) return;

    try {
      setLoading(true);
      
      const novaMetaData = {
        lojaId: filialSelecionada.id.toString(),
        nomeLoja: filialSelecionada.nome_fantasia,
        // Evitar bugs de timezone: extrair mês/ano diretamente da string 'YYYY-MM-DD'
        mes: (() => {
          const parts = (novaMetaDataInicio || '').split('-');
          return parts.length >= 2 ? Number(parts[1]) : new Date(novaMetaDataInicio).getMonth() + 1;
        })(),
        ano: (() => {
          const parts = (novaMetaDataInicio || '').split('-');
          return parts.length >= 1 ? Number(parts[0]) : new Date(novaMetaDataInicio).getFullYear();
        })(),
        grupoMetaId: novaMetaGrupoId || gruposMetas[0]?.id || '1',
        ativo: true,
        // Incluir dados das seções
        operadorasCaixa: operadorasCaixa,
        vendedoras: vendedoras,
        vendedorasBijou: vendedorasBijou,
        gerente: gerente,
        campanhas: campanhas,
        valorVendaLojaTotal: parseFloat(novaMetaValorTotal) || 0,
        // Manter compatibilidade com funcionários legados
        funcionarios: funcionarios
      };

      await metasLojasApiService.cadastrarMetaLoja(novaMetaData);
      
      // Recarregar dados após cadastro
      await carregarDados();
      
      fecharTodosModais();
      setError('');
      setSuccess('Meta de loja cadastrada com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      setError('Erro ao salvar meta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Funções para Grupos de Metas
  const criarGrupoMeta = async () => {
    if (!novoGrupo.nome.trim()) {
      setError('Nome do grupo é obrigatório');
      return;
    }

    try {
      setLoading(true);
      
      const grupoData = {
        nome: novoGrupo.nome,
        descricao: novoGrupo.descricao,
        metas: novoGrupo.metas,
        ativo: true
      };

      await metasLojasApiService.cadastrarGrupoMeta(grupoData);
      
      // Recarregar dados após cadastro
      await carregarDados();
      
      setShowGrupoModal(false);
      setNovoGrupo({ nome: '', descricao: '', metas: [] });
      setGrupoEditando(null);
      setError('');
      setSuccess('Grupo de meta criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar grupo de meta:', error);
      setError('Erro ao criar grupo de meta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const editarGrupoMeta = (grupo: GrupoMetaProduto) => {
    setGrupoEditando(grupo);
    setNovoGrupo({
      nome: grupo.nome,
      descricao: grupo.descricao,
      metas: grupo.metas
    });
    setAbaAtivaGrupos('criar'); // Muda automaticamente para a aba de edição
    setShowGrupoModal(true);
  };

  const fecharModalGrupos = () => {
    setShowGrupoModal(false);
    setAbaAtivaGrupos('listar'); // Reset para a aba de listagem
    setGrupoEditando(null);
    setNovoGrupo({
      nome: '',
      descricao: '',
      metas: []
    });
  };

  const salvarEdicaoGrupo = async () => {
    if (!grupoEditando || !novoGrupo.nome.trim()) {
      setError('Nome do grupo é obrigatório');
      return;
    }

    try {
      setLoading(true);
      
      const grupoData = {
        nome: novoGrupo.nome,
        descricao: novoGrupo.descricao,
        metas: novoGrupo.metas,
        ativo: grupoEditando.ativo
      };

      await metasLojasApiService.atualizarGrupoMeta(grupoEditando.id, grupoData);
      
      // Recarregar dados após atualização
      await carregarDados();
      
      setShowGrupoModal(false);
      setNovoGrupo({ nome: '', descricao: '', metas: [] });
      setGrupoEditando(null);
      setError('');
      setSuccess('Grupo de meta atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar grupo de meta:', error);
      setError('Erro ao atualizar grupo de meta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const removerGrupoMeta = async (id: string) => {
    try {
      setLoading(true);
      await metasLojasApiService.deletarGrupoMeta(id);
      
      // Recarregar dados após exclusão
      await carregarDados();
      setError('');
      setSuccess('Grupo de meta removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover grupo de meta:', error);
      setError('Erro ao remover grupo de meta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAtivoGrupo = async (id: string) => {
    try {
      setLoading(true);
      const grupo = gruposMetas.find(g => g.id === id);
      if (!grupo) return;
      
      const grupoData = {
        nome: grupo.nome,
        descricao: grupo.descricao,
        metas: grupo.metas,
        ativo: !grupo.ativo
      };

      await metasLojasApiService.atualizarGrupoMeta(id, grupoData);
      
      // Recarregar dados após atualização
      await carregarDados();
      setError('');
      setSuccess(`Grupo de meta ${!grupo.ativo ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (error) {
      console.error('Erro ao alterar status do grupo:', error);
      setError('Erro ao alterar status do grupo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const adicionarMetaAoGrupo = () => {
    const novaMeta = {
      id: Date.now().toString(),
      nomeProdutoMarca: '',
      qtdMeta: 0,
      percentualSobreVenda: 0
    };
    setNovoGrupo({
      ...novoGrupo,
      metas: [...novoGrupo.metas, novaMeta]
    });
  };

  const removerMetaDoGrupo = (metaId: string) => {
    setNovoGrupo({
      ...novoGrupo,
      metas: novoGrupo.metas.filter(m => m.id !== metaId)
    });
  };

  const atualizarMetaDoGrupo = (metaId: string, campo: string, valor: any) => {
    setNovoGrupo({
      ...novoGrupo,
      metas: novoGrupo.metas.map(m => 
        m.id === metaId ? { ...m, [campo]: valor } : m
      )
    });
  };

  const aplicarGrupoMeta = (funcionarioId: string, grupoId: string, tipoFuncionario: 'operadora' | 'vendedora' | 'vendedoraBijou') => {
    const grupo = gruposMetas.find(g => g.id === grupoId);
    if (!grupo) return;

    const metasCompletas: MetaProduto[] = grupo.metas.map(meta => ({
      ...meta,
      qtdVendido: 0,
      valorVendido: 0,
      valorComissao: 0
    }));

    if (tipoFuncionario === 'operadora') {
      setOperadorasCaixa(operadorasCaixa.map(op => 
        op.id === funcionarioId ? { ...op, metasProdutos: [...op.metasProdutos, ...metasCompletas] } : op
      ));
    } else if (tipoFuncionario === 'vendedora') {
      setVendedoras(vendedoras.map(v => {
        if (v.id === funcionarioId) {
          const metasAtualizadas = [...v.metasProdutos, ...metasCompletas];
          const soma = somarComissoesMetas(metasAtualizadas);
          return { ...v, metasProdutos: metasAtualizadas, profissionalParceiras: soma };
        }
        return v;
      }));
    } else if (tipoFuncionario === 'vendedoraBijou') {
      setVendedorasBijou(vendedorasBijou.map(vb => {
        if (vb.id === funcionarioId) {
          const metasAtualizadas = [...vb.metasProdutos, ...metasCompletas];
          const soma = somarComissoesMetas(metasAtualizadas);
          const bijouValor = (vb.bijouMakeBolsas ?? (vb as any).bijou_make_bolsas ?? 0) as number;
          const perc = (vb.percentualComissaoBijou ?? (vb as any).percentual_comissao_bijou ?? 0) as number;
          const comissaoBijou = (bijouValor * perc) / 100;
          return { ...vb, metasProdutos: metasAtualizadas, valorComissaoBijou: comissaoBijou + soma };
        }
        return vb;
      }));
    }
  };

  // Função para limpar formulário
  const limparFormulario = () => {
    const hoje = new Date();
    const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    setNovaMetaFilial('');
    setNovaMetaDataInicio(primeiroDiaDoMes.toISOString().split('T')[0]);
    setNovaMetaDataFim(ultimoDiaDoMes.toISOString().split('T')[0]);
    setNovaMetaValorTotal('');
    setNovaMetaGrupoId('');
    setOperadorasCaixa([]);
    setVendedoras([]);
    setVendedorasBijou([]);
    setGerente(null);
    setCampanhas([]);
    setFuncionarios([]);
    setAbaAtiva('operadoras');
    setMetaSelecionada(null);
    setModalModo('criar');
    setError('');
  };

  // Limpa o formulário somente após o modal principal ser fechado
  useEffect(() => {
    if (!showModal) {
      limparFormulario();
    }
  }, [showModal]);

  // Função para abrir modal (criar)
  const abrirModalCriar = () => {
    limparFormulario();
    setModalModo('criar');
    setShowModal(true);
  };

  const abrirModalEditar = async (meta: MetaLoja) => {
    try {
      setLoading(true);
      setModalModo('editar');
      setMetaSelecionada(meta);
      
      // Fazer requisição à API para obter dados completos da meta
      const metaCompleta = await metasLojasApiService.obterMetaLoja(meta.id);
      
      // Preencher campos básicos da meta
      setNovaMetaFilial(metaCompleta.loja_id);
      setNovaMetaValorTotal(metaCompleta.valor_venda_loja_total.toString());
      if (metaCompleta.grupo_meta_id) setNovaMetaGrupoId(metaCompleta.grupo_meta_id);
      
      // Gerar datas baseadas no mês e ano da meta
      const ano = metaCompleta.ano;
      const mes = metaCompleta.mes;
      const dataInicio = `${ano}-${mes.toString().padStart(2, '0')}-01`;
      const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
      const dataFim = `${ano}-${mes.toString().padStart(2, '0')}-${ultimoDiaDoMes}`;
      
      setNovaMetaDataInicio(dataInicio);
      setNovaMetaDataFim(dataFim);
      
      // Carregar dados dos funcionários da meta obtidos da API
      setOperadorasCaixa(metaCompleta.operadoras_caixa || []);
      setVendedoras(metaCompleta.vendedoras || []);
      setVendedorasBijou(metaCompleta.vendedoras_bijou || []);
      setGerente(metaCompleta.gerente);
      // Mapear campanhas para garantir camelCase e valores padrão
      const campanhasMapeadas = (metaCompleta.campanhas || []).map((c: any) => ({
        id: c.id,
        nome: c.nome ?? '',
        quantidadeVendida: c.quantidadeVendida ?? c.quantidade_vendida ?? 0,
        atingiuMeta: c.atingiuMeta ?? c.atingiu_meta ?? false,
      }));
      setCampanhas(campanhasMapeadas);
      setFuncionarios(metaCompleta.funcionarios || []);
      
      setShowModal(true);
    } catch (err) {
      console.error('Erro ao carregar dados da meta:', err);
      setError('Erro ao carregar dados da meta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalVisualizar = async (meta: MetaLoja) => {
    setMetaSelecionada(meta);
    setMetaAdminDetalhes(null);
    setShowViewModal(true);
    // Para admins, carregar detalhes completos para visualização estruturada
    if (isAdmin) {
      try {
        setLoading(true);
        const metaCompleta = await metasLojasApiService.obterMetaLoja(meta.id);
        setMetaAdminDetalhes(metaCompleta);
      } catch (err) {
        console.error('Erro ao carregar detalhes completos da meta:', err);
        setError('Erro ao carregar detalhes completos da meta. Tente novamente.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Exportar planilha (via API) — apenas para admins
  const baixarPlanilhaMeta = async (meta: MetaLoja) => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      const blob = await metasLojasApiService.exportarMetaLojaExcel(meta.id);

      if (!(blob instanceof Blob) || blob.size < 100) {
        throw new Error('O arquivo gerado parece estar corrompido ou vazio');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const loja = (meta.filialNome || '').toString().replace(/\s+/g, '_');
      const mes = new Date(meta.dataInicio).getMonth() + 1;
      const ano = new Date(meta.dataInicio).getFullYear();
      const fileName = `meta_loja_${loja}_${mes}_${ano}.xlsx`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccess('Planilha exportada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao exportar planilha da meta:', error);
      const msg = error?.message || 'Erro ao exportar planilha. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const excluirMeta = async (meta: MetaLoja) => {
    if (!window.confirm(`Excluir meta da loja ${meta.filialNome} (${meta.periodo})?`)) return;
    try {
      setLoading(true);
      await metasLojasApiService.deletarMetaLoja(meta.id);
      await carregarDados();
      setSuccess('Meta de loja excluída com sucesso!');
    } catch (err) {
      console.error('Erro ao excluir meta:', err);
      setError('Erro ao excluir meta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const finalizarMeta = async (meta: MetaLoja) => {
    if (!isAdmin) return;
    if (!window.confirm(`Finalizar meta da loja ${meta.filialNome} (${meta.periodo})?`)) return;
    try {
      setLoading(true);
      await metasLojasApiService.finalizarMetaLoja(meta.id);
      await carregarDados();
      setSuccess('Meta finalizada com sucesso!');
    } catch (err) {
      console.error('Erro ao finalizar meta:', err);
      setError('Erro ao finalizar meta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container fluid>
      <Row className="mb-3">
        <Col>
          <h2>Meta de Lojas</h2>
        </Col>
        <Col xs="auto">
          <Button 
            variant="outline-primary" 
            className="me-2"
            onClick={() => setShowGrupoModal(true)}
          >
            Gerenciar Grupos de Metas
          </Button>
          <Button 
            variant="primary"
            onClick={() => abrirModalCriar()}
          >
            Nova Meta
          </Button>
        </Col>
      </Row>

      {/* Alertas de erro e sucesso */}
      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onClose={() => setSuccess('')} dismissible>
          {success}
        </Alert>
      )}

      {/* Filtros */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Filtros</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Filial</Form.Label>
                <Form.Select 
                  value={filtroFilial}
                  onChange={(e) => setFiltroFilial(e.target.value)}
                >
                  <option value="">Todas as filiais</option>
                  {filiais.map(filial => (
                    <option key={filial.id} value={filial.id}>
                      {filial.codigo} - {filial.nome_fantasia}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Data Início</Form.Label>
                <Form.Control 
                  type="date" 
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Data Fim</Form.Label>
                <Form.Control 
                  type="date" 
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={4} className="mt-3">
              <Form.Group>
                <Form.Label>Status</Form.Label>
                <Form.Select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value as 'ativa' | 'concluida' | 'todas')}
                >
                  <option value="ativa">Ativa</option>
                  <option value="concluida">Concluída/Finalizada</option>
                  <option value="todas">Todas</option>
                </Form.Select>
              </Form.Group>
            </Col>

          </Row>
        </Card.Body>
      </Card>

      {/* Lista de Metas */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Metas Cadastradas</h5>
        </Card.Header>
        <Card.Body>
          {metasFiltradas.length === 0 ? (
            <Alert variant="info">
              Nenhuma meta encontrada com os filtros aplicados.
            </Alert>
          ) : (
            <Table responsive striped hover>
              <thead>
                <tr>
                  <th>Filial</th>
                  <th>Período</th>
                  <th>Data Início</th>
                  <th>Data Fim</th>
                  <th>Valor Total</th>
                  <th>Funcionários</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {metasFiltradas.map(meta => (
                  <tr key={meta.id}>
                    <td>{meta.filialNome}</td>
                    <td>{meta.periodo}</td>
                <td>{formatarDataBR(meta.dataInicio)}</td>
                <td>{formatarDataBR(meta.dataFim)}</td>
                    <td>R$ {meta.valorVendaLojaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td>{
                      (meta.operadorasCaixa?.length ?? 0)
                      + (meta.vendedoras?.length ?? 0)
                      + (meta.vendedorasBijou?.length ?? 0)
                      + (meta.funcionarios?.length ?? 0)
                      + (meta.gerente ? 1 : 0)
                    }</td>
                    <td>
                      <Badge bg={
                        meta.status === 'ativa' ? 'success' : 
                        meta.status === 'concluida' ? 'primary' : 'secondary'
                      }>
                        {meta.status.charAt(0).toUpperCase() + meta.status.slice(1)}
                      </Badge>
                    </td>
                    <td>
                      <ButtonGroup size="sm" className="gap-1">
                        <OverlayTrigger placement="top" overlay={<Tooltip>Visualizar</Tooltip>}>
                          <Button variant="primary" onClick={() => abrirModalVisualizar(meta)}>
                            <i className="bi bi-eye"></i>
                            <span className="ms-1">Visualizar</span>
                          </Button>
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip>Editar</Tooltip>}>
                          <Button variant="secondary" onClick={() => abrirModalEditar(meta)}>
                            <i className="bi bi-pencil"></i>
                            <span className="ms-1">Editar</span>
                          </Button>
                        </OverlayTrigger>
                        {isAdmin && (
                          <>
                            <OverlayTrigger placement="top" overlay={<Tooltip>Baixar Planilha</Tooltip>}>
                              <Button variant="success" onClick={() => baixarPlanilhaMeta(meta)}>
                                <i className="bi bi-download"></i>
                                <span className="ms-1">Baixar Planilha</span>
                              </Button>
                            </OverlayTrigger>
                            {meta.status === 'ativa' && (
                              <OverlayTrigger placement="top" overlay={<Tooltip>Finalizar Meta</Tooltip>}>
                                <Button variant="warning" onClick={() => finalizarMeta(meta)}>
                                  <i className="bi bi-check2-circle"></i>
                                  <span className="ms-1">Finalizar</span>
                                </Button>
                              </OverlayTrigger>
                            )}
                          </>
                        )}
                        <OverlayTrigger placement="top" overlay={<Tooltip>Excluir</Tooltip>}>
                          <Button variant="danger" onClick={() => excluirMeta(meta)}>
                            <i className="bi bi-trash"></i>
                            <span className="ms-1">Excluir</span>
                          </Button>
                        </OverlayTrigger>
                      </ButtonGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Modal de Nova/Editar Meta */}
      <Modal show={showModal} onHide={fecharTodosModais} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>{modalModo === 'criar' ? 'Nova Meta de Loja' : 'Editar Meta de Loja'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          {/* Dados da Meta */}
          <Card className="mb-4">
            <Card.Header>
              <h6 className="mb-0">Dados da Meta</h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Filial *</Form.Label>
                    <Form.Select 
                      value={novaMetaFilial} 
                      onChange={(e) => setNovaMetaFilial(e.target.value)}
                      required
                    >
                      <option value="">Selecione uma filial</option>
                      {filiais.map(filial => (
                        <option key={filial.id} value={filial.id}>
                          {filial.codigo} - {filial.nome_fantasia}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data Início *</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={novaMetaDataInicio}
                      onChange={(e) => setNovaMetaDataInicio(e.target.value)}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data Fim *</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={novaMetaDataFim}
                      onChange={(e) => setNovaMetaDataFim(e.target.value)}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Grupo de Metas *</Form.Label>
                    <Form.Select 
                      value={novaMetaGrupoId}
                      onChange={(e) => setNovaMetaGrupoId(e.target.value)}
                      required
                    >
                      <option value="">Selecione um grupo</option>
                      {gruposMetas.map(grupo => (
                        <option key={grupo.id} value={grupo.id}>
                          {grupo.nome}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Valor Venda Loja Total</Form.Label>
                    <Form.Control
                      type="text"
                      value={formatarNumeroParaExibicao(parseFloat(novaMetaValorTotal) || 0)}
                      onChange={(e) => {
                        handleInputMonetario(e.target.value, (valorFormatado) => {
                          const valorNumerico = converterMascaraParaNumero(valorFormatado);
                          setNovaMetaValorTotal(valorNumerico.toString());
                        });
                      }}
                      placeholder="R$ 0,00"
                    />
                    <Form.Text className="text-muted">
                      Digite ou cole valores no formato R$ 1.234,56
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Funcionários organizados por abas */}
          <Card className="mb-4">
            <Card.Header>
              <h6 className="mb-0">Funcionários</h6>
            </Card.Header>
            <Card.Body>
              <Tabs
                activeKey={abaAtiva}
                onSelect={(k) => setAbaAtiva(k || 'operadoras')}
                className="mb-3"
              >
                {/* Aba Operadoras de Caixa */}
                <Tab eventKey="operadoras" title="Operadoras de Caixa">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0">Operadoras de Caixa</h6>
                    <Button variant="success" size="sm" onClick={adicionarOperadoraCaixa}>
                      <i className="bi bi-plus-circle me-2"></i>
                      Adicionar Operadora
                    </Button>
                  </div>
                  
                  {operadorasCaixa.length === 0 ? (
                    <Alert variant="info">
                      Nenhuma operadora de caixa adicionada.
                    </Alert>
                  ) : (
                    operadorasCaixa.map((operadora, index) => (
                      <Card key={operadora.id} className="mb-3">
                        <Card.Header className="d-flex justify-content-between align-items-center">
                          <h6 className="mb-0">Operadora {index + 1}</h6>
                          <Button 
                            variant="outline-danger" 
                            size="sm" 
                            onClick={() => removerOperadoraCaixa(operadora.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </Card.Header>
                        <Card.Body>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Nome *</Form.Label>
                                <Form.Select 
                                  value={operadora.nome}
                                  onChange={(e) => atualizarOperadoraCaixa(operadora.id, 'nome', e.target.value)}
                                >
                                  <option value="">Selecione uma operadora</option>
                                  {getVendedoresFiltrados().map(vendedor => (
                                    <option key={vendedor.id} value={vendedor.nome}>
                                      {vendedor.nome} - {vendedor.rca}
                                    </option>
                                  ))}
                                </Form.Select>
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Função *</Form.Label>
                                <Form.Control 
                                  type="text" 
                                  value={operadora.funcao}
                                  onChange={(e) => atualizarOperadoraCaixa(operadora.id, 'funcao', e.target.value)}
                                  placeholder="Ex: Operadora de Caixa"
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Cadastros Positivados</Form.Label>
                                <Form.Control 
                                  type="number" 
                                  value={operadora.cadastrosPositivados}
                                  onChange={(e) => atualizarOperadoraCaixa(operadora.id, 'cadastrosPositivados', parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                />
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Produtos Destaque</Form.Label>
                                <Form.Control 
                                  type="number" 
                                  value={operadora.produtosDestaque}
                                  onChange={(e) => atualizarOperadoraCaixa(operadora.id, 'produtosDestaque', parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                          
                          {/* Componente de Metas de Produtos */}
                          <MetasProdutosComponent
                            metasProdutos={operadora.metasProdutos}
                            funcionarioId={operadora.id}
                            tipoFuncionario="operadora"
                            titulo="Metas de Produtos/Marcas"
                            onAdicionarMeta={adicionarMetaProduto}
                            onRemoverMeta={removerMetaProduto}
                            onAtualizarMeta={atualizarMetaProduto}
                            formatarNumeroParaExibicao={formatarNumeroParaExibicao}
                            aplicarMascaraMonetaria={aplicarMascaraMonetaria}
                            converterMascaraParaNumero={converterMascaraParaNumero}
                            gruposMetas={gruposMetas}
                            onAplicarGrupoMeta={aplicarGrupoMeta}
                          />
                        </Card.Body>
                      </Card>
                    ))
                  )}
                </Tab>

                {/* Aba Vendedoras */}
                <Tab eventKey="vendedoras" title="Vendedoras">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0">Vendedoras</h6>
                    <div>
                      <Button variant="success" size="sm" className="me-2" onClick={adicionarTodasVendedorasDaFilial}>
                        <i className="bi bi-people-fill me-2"></i>
                        Adicionar todos da filial
                      </Button>
                      <Button variant="success" size="sm" onClick={adicionarVendedora}>
                        <i className="bi bi-plus-circle me-2"></i>
                        Adicionar Vendedora
                      </Button>
                    </div>
                  </div>
                  
                  {vendedoras.length === 0 ? (
                    <Alert variant="info">
                      Nenhuma vendedora adicionada.
                    </Alert>
                  ) : (
                    vendedoras.map((vendedora, index) => (
                      <Card key={vendedora.id} className="mb-3">
                        <Card.Header className="d-flex justify-content-between align-items-center">
                          <h6 className="mb-0">Vendedora {index + 1}</h6>
                          <Button 
                            variant="outline-danger" 
                            size="sm" 
                            onClick={() => removerVendedora(vendedora.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </Card.Header>
                        <Card.Body>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Nome *</Form.Label>
                                <Form.Select 
                                  value={vendedora.nome}
                                  onChange={(e) => atualizarVendedora(vendedora.id, 'nome', e.target.value)}
                                >
                                  <option value="">Selecione uma vendedora</option>
                                  {getVendedoresFiltrados().map(vendedor => (
                                    <option key={vendedor.id} value={vendedor.nome}>
                                      {vendedor.nome} - {vendedor.rca}
                                    </option>
                                  ))}
                                </Form.Select>
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Função *</Form.Label>
                                <Form.Control 
                                  type="text" 
                                  value={vendedora.funcao}
                                  onChange={(e) => atualizarVendedora(vendedora.id, 'funcao', e.target.value)}
                                  placeholder="Ex: Vendedora"
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                          <Row>
                            <Col md={4}>
                              <Form.Group className="mb-3">
                                <Form.Label>Valor Vendido Total</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={formatarNumeroParaExibicao(vendedora.valorVendidoTotal)}
                                  onChange={(e) => handleInputMonetario(e.target.value, (valor) => atualizarVendedora(vendedora.id, 'valorVendidoTotal', valor))}
                                  placeholder="R$ 0,00"
                                />
                              </Form.Group>
                            </Col>
                            <Col md={4}>
                              <Form.Group className="mb-3">
                                <Form.Label>Esmaltes (R$)</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={formatarNumeroParaExibicao(vendedora.esmaltes)}
                                  onChange={(e) => handleInputMonetario(e.target.value, (valor) => atualizarVendedora(vendedora.id, 'esmaltes', valor))}
                                  placeholder="R$ 0,00"
                                />
                              </Form.Group>
                            </Col>
                            <Col md={4}>
                              <Form.Group className="mb-3">
                                <Form.Label>Profissional/Parceiras (R$)</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={formatarNumeroParaExibicao(vendedora.profissionalParceiras)}
                                  readOnly
                                  className="bg-light"
                                  placeholder="R$ 0,00"
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                          <Row>
                            <Col md={4}>
                              <Form.Group className="mb-3">
                                <Form.Label>Valor Vendido Make</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={formatarNumeroParaExibicao(vendedora.valorVendidoMake)}
                                  onChange={(e) => handleInputMonetario(e.target.value, (valor) => atualizarVendedora(vendedora.id, 'valorVendidoMake', valor))}
                                  placeholder="R$ 0,00"
                                />
                              </Form.Group>
                            </Col>
                            <Col md={4}>
                              <Form.Group className="mb-3">
                                <Form.Label>Quantidade Malka</Form.Label>
                                <Form.Control 
                                  type="number" 
                                  value={vendedora.quantidadeMalka}
                                  onChange={(e) => atualizarVendedora(vendedora.id, 'quantidadeMalka', parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                />
                              </Form.Group>
                            </Col>
                            <Col md={4}>
                              <Form.Group className="mb-3">
                                <Form.Label>Valor Malka</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={formatarNumeroParaExibicao(vendedora.valorMalka)}
                                  onChange={(e) => handleInputMonetario(e.target.value, (valor) => atualizarVendedora(vendedora.id, 'valorMalka', valor))}
                                  placeholder="R$ 0,00"
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                          
                          {/* Componente de Metas de Produtos */}
                          <MetasProdutosComponent
                            metasProdutos={vendedora.metasProdutos}
                            funcionarioId={vendedora.id}
                            tipoFuncionario="vendedora"
                            titulo="Metas de Produtos/Marcas"
                            onAdicionarMeta={adicionarMetaProduto}
                            onRemoverMeta={removerMetaProduto}
                            onAtualizarMeta={atualizarMetaProduto}
                            formatarNumeroParaExibicao={formatarNumeroParaExibicao}
                            aplicarMascaraMonetaria={aplicarMascaraMonetaria}
                            converterMascaraParaNumero={converterMascaraParaNumero}
                            gruposMetas={gruposMetas}
                            onAplicarGrupoMeta={aplicarGrupoMeta}
                          />
                        </Card.Body>
                      </Card>
                    ))
                  )}
                </Tab>

                {/* Aba Vendedoras Bijou, Make, Bolsas */}
                <Tab eventKey="vendedoras-bijou" title="Vendedoras Bijou/Make/Bolsas">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0">Vendedoras Bijou, Make, Bolsas</h6>
                    <Button variant="success" size="sm" onClick={adicionarVendedoraBijou}>
                      <i className="bi bi-plus-circle me-2"></i>
                      Adicionar Vendedora
                    </Button>
                  </div>
                  
                  {vendedorasBijou.length === 0 ? (
                    <Alert variant="info">
                      Nenhuma vendedora de bijou/make/bolsas adicionada.
                    </Alert>
                  ) : (
                    vendedorasBijou.map((vendedora, index) => (
                      <Card key={vendedora.id} className="mb-3">
                        <Card.Header className="d-flex justify-content-between align-items-center">
                          <h6 className="mb-0">Vendedora {index + 1}</h6>
                          <Button 
                            variant="outline-danger" 
                            size="sm" 
                            onClick={() => removerVendedoraBijou(vendedora.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </Card.Header>
                        <Card.Body>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Nome *</Form.Label>
                                <Form.Select 
                                  value={vendedora.nome}
                                  onChange={(e) => atualizarVendedoraBijou(vendedora.id, 'nome', e.target.value)}
                                >
                                  <option value="">Selecione uma vendedora</option>
                                  {getVendedoresFiltrados().map(vendedor => (
                                    <option key={vendedor.id} value={vendedor.nome}>
                                      {vendedor.nome} - {vendedor.rca}
                                    </option>
                                  ))}
                                </Form.Select>
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Função *</Form.Label>
                                <Form.Control 
                                  type="text" 
                                  value={vendedora.funcao}
                                  onChange={(e) => atualizarVendedoraBijou(vendedora.id, 'funcao', e.target.value)}
                                  placeholder="Ex: Vendedora Bijou/Make/Bolsas"
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                          <Row>
                            <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Bijou / Make / Bolsas (R$)</Form.Label>
                            <Form.Control
                              type="text"
                              value={bijouInputValores[vendedora.id] ?? formatarNumeroParaExibicao((vendedora.bijouMakeBolsas ?? (vendedora as any).bijou_make_bolsas ?? 0))}
                              onChange={(e) => {
                                const mascarado = aplicarMascaraMonetaria(e.target.value);
                                setBijouInputValores(prev => ({ ...prev, [vendedora.id]: mascarado }));
                                const valorNumerico = converterMascaraParaNumero(mascarado);
                                atualizarVendedoraBijou(vendedora.id, 'bijouMakeBolsas', valorNumerico);
                              }}
                              placeholder="R$ 0,00"
                            />
                          </Form.Group>
                            </Col>
                            <Col md={3}>
                              <Form.Group className="mb-3">
                                <Form.Label>% Comissão</Form.Label>
                                <Form.Control
                                  type="number"
                                  step="0.01"
                                  value={(vendedora.percentualComissaoBijou ?? (vendedora as any).percentual_comissao_bijou ?? 0)}
                                  onChange={(e) => {
                                    const perc = parseFloat(e.target.value) || 0;
                                    atualizarVendedoraBijou(vendedora.id, 'percentualComissaoBijou', perc);
                                  }}
                                  placeholder="0"
                                />
                              </Form.Group>
                            </Col>
                            <Col md={3}>
                              <Form.Group className="mb-3">
                                <Form.Label>Comissão (R$)</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={formatarNumeroParaExibicao((vendedora.valorComissaoBijou ?? (vendedora as any).valor_comissao_bijou ?? 0))}
                                  readOnly
                                  disabled
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                          
                          {/* Componente de Metas de Produtos */}
                          <MetasProdutosComponent
                            metasProdutos={vendedora.metasProdutos}
                            funcionarioId={vendedora.id}
                            tipoFuncionario="vendedoraBijou"
                            titulo="Metas de Produtos/Marcas"
                            onAdicionarMeta={adicionarMetaProduto}
                            onRemoverMeta={removerMetaProduto}
                            onAtualizarMeta={atualizarMetaProduto}
                            formatarNumeroParaExibicao={formatarNumeroParaExibicao}
                            aplicarMascaraMonetaria={aplicarMascaraMonetaria}
                            converterMascaraParaNumero={converterMascaraParaNumero}
                            gruposMetas={gruposMetas}
                            onAplicarGrupoMeta={aplicarGrupoMeta}
                          />
                        </Card.Body>
                      </Card>
                    ))
                  )}
                </Tab>

                {/* Aba Gerente */}
                <Tab eventKey="gerente" title="Gerente">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0">Gerente</h6>
                    {!gerente && (
                      <Button variant="success" size="sm" onClick={adicionarGerente}>
                        <i className="bi bi-plus-circle me-2"></i>
                        Adicionar Gerente
                      </Button>
                    )}
                  </div>
                  
                  {!gerente ? (
                    <Alert variant="info">
                      Nenhum gerente adicionado.
                    </Alert>
                  ) : (
                    <Card className="mb-3">
                      <Card.Header className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">Gerente</h6>
                        <Button 
                          variant="outline-danger" 
                          size="sm" 
                          onClick={() => removerGerente()}
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </Card.Header>
                      <Card.Body>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Nome *</Form.Label>
                              <Form.Select 
                                value={gerente.nome}
                                onChange={(e) => atualizarGerente('nome', e.target.value)}
                              >
                                <option value="">Selecione um gerente</option>
                                {getVendedoresFiltrados().map(vendedor => (
                                  <option key={vendedor.id} value={vendedor.nome}>
                                    {vendedor.nome} - {vendedor.rca}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>Função *</Form.Label>
                              <Form.Control 
                                type="text" 
                                value={gerente.funcao}
                                onChange={(e) => atualizarGerente('funcao', e.target.value)}
                                placeholder="Ex: Gerente"
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label>% Meta Geral</Form.Label>
                              <Form.Control 
                                type="number" 
                                step="0.01"
                                value={gerente.percentualMetaGeral}
                                onChange={(e) => atualizarGerente('percentualMetaGeral', parseFloat(e.target.value) || 0)}
                                placeholder="0.08"
                              />
                              <Form.Text className="text-muted">
                                Valor inicial: 0,08%. Aumenta 0,01% para cada campanha atingida.
                                {gerente && novaMetaValorTotal && (
                                  <div className="mt-1">
                                    <strong>Valor da comissão: R$ {(
                                      (parseFloat(novaMetaValorTotal) || 0) *
                                      (gerente.percentualMetaGeral / 100)
                                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                  </div>
                                )}
                              </Form.Text>
                            </Form.Group>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  )}
                </Tab>

                {/* Aba Campanhas */}
                <Tab eventKey="campanhas" title="Campanhas">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0">Campanhas</h6>
                    <Button variant="success" size="sm" onClick={adicionarCampanha}>
                      <i className="bi bi-plus-circle me-2"></i>
                      Adicionar Campanha
                    </Button>
                  </div>
                  
                  {campanhas.length === 0 ? (
                    <Alert variant="info">
                      Nenhuma campanha adicionada.
                    </Alert>
                  ) : (
                    campanhas.map((campanha, index) => (
                      <Card key={campanha.id} className="mb-3">
                        <Card.Header className="d-flex justify-content-between align-items-center">
                          <h6 className="mb-0">Campanha {index + 1}</h6>
                          <Button 
                            variant="outline-danger" 
                            size="sm" 
                            onClick={() => removerCampanha(campanha.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </Card.Header>
                        <Card.Body>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Nome *</Form.Label>
                                <Form.Control 
                                  type="text" 
                                  value={campanha.nome}
                                  onChange={(e) => atualizarCampanha(campanha.id, 'nome', e.target.value)}
                                  placeholder="Nome da campanha"
                                />
                              </Form.Group>
                            </Col>
                            <Col md={3}>
                              <Form.Group className="mb-3">
                                <Form.Label>Quantidade Vendida</Form.Label>
                                <Form.Control 
                                  type="number" 
                                  step="any"
                                  inputMode="decimal"
                                  value={campanha.quantidadeVendida}
                                  onChange={(e) => atualizarCampanha(campanha.id, 'quantidadeVendida', parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                />
                              </Form.Group>
                            </Col>
                            <Col md={3}>
                              <Form.Group className="mb-3">
                                <Form.Label>Atingiu Meta</Form.Label>
                                <Form.Select 
                                  value={campanha.atingiuMeta ? 'true' : 'false'}
                                  onChange={(e) => atualizarCampanha(campanha.id, 'atingiuMeta', e.target.value === 'true')}
                                >
                                  <option value="false">NÃO</option>
                                  <option value="true">SIM</option>
                                </Form.Select>
                              </Form.Group>
                            </Col>
                          </Row>
                        </Card.Body>
                      </Card>
                    ))
                  )}
                  
                  {campanhas.length > 0 && (
                    <Alert variant="info">
                      <strong>Campanhas atingidas:</strong> {campanhas.filter(c => c.atingiuMeta).length} de {campanhas.length}
                      <br />
                      <strong>Bônus no % Meta Geral:</strong> +{(campanhas.filter(c => c.atingiuMeta).length * 0.01).toFixed(2)}%
                    </Alert>
                  )}
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={fecharTodosModais}>
            Cancelar
          </Button>
          {modalModo === 'criar' ? (
            <Button variant="primary" onClick={salvarNovaMeta}>
              Salvar Meta
            </Button>
          ) : (
            <Button variant="primary" onClick={salvarEdicaoMeta}>
              Atualizar Meta
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Modal de Visualização */}
      <Modal show={showViewModal} onHide={fecharTodosModais} size={isAdmin ? 'xl' : undefined}>
        <Modal.Header closeButton>
          <Modal.Title>Detalhes da Meta</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {metaSelecionada ? (
            !isAdmin ? (
              <div>
                <p><strong>Filial:</strong> {metaSelecionada.filialNome}</p>
                <p><strong>Período:</strong> {metaSelecionada.periodo}</p>
                <p><strong>Data Início:</strong> {formatarDataBR(metaSelecionada.dataInicio)}</p>
                <p><strong>Data Fim:</strong> {formatarDataBR(metaSelecionada.dataFim)}</p>
                <p><strong>Grupo de Metas:</strong> {metaSelecionada.grupoMetaNome || '-'}</p>
                <p><strong>Status:</strong> {metaSelecionada.status}</p>
                <p><strong>Valor Total:</strong> R$ {metaSelecionada.valorVendaLojaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            ) : (
              <div>
                <Row className="mb-3">
                  <Col>
                    <Card>
                      <Card.Header>
                        <strong>Resumo da Meta</strong>
                      </Card.Header>
                      <Card.Body>
                        <Row>
                          <Col md={6}><strong>Loja:</strong> {metaAdminDetalhes?.nome_loja ?? metaSelecionada.filialNome}</Col>
                          <Col md={3}><strong>Mês:</strong> {(() => {
                            const ds = metaSelecionada.dataInicio || '';
                            if (ds.includes('-')) {
                              const parts = ds.split('-');
                              return Number(parts[1]);
                            }
                            return metaAdminDetalhes?.mes ?? '-';
                          })()}</Col>
                          <Col md={3}><strong>Ano:</strong> {(() => {
                            const ds = metaSelecionada.dataInicio || '';
                            if (ds.includes('-')) {
                              const parts = ds.split('-');
                              return Number(parts[0]);
                            }
                            return metaAdminDetalhes?.ano ?? '-';
                          })()}</Col>
                        </Row>
                        <Row className="mt-2">
                          <Col md={6}><strong>Grupo:</strong> {metaAdminDetalhes?.grupo_meta_nome ?? metaSelecionada.grupoMetaNome ?? '-'}</Col>
                          <Col md={6}><strong>Status:</strong> {(metaAdminDetalhes?.ativo ?? (metaSelecionada.status !== 'cancelada')) ? 'ativa' : 'cancelada'}</Col>
                        </Row>
                        <Row className="mt-2">
                          <Col md={12}><strong>Valor Total:</strong> R$ {(metaAdminDetalhes?.valor_venda_loja_total ?? metaSelecionada.valorVendaLojaTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {(() => {
                  // Alinhar Operadoras ao layout resumido de Vendedoras
                  const operadoras = (metaAdminDetalhes?.operadoras_caixa ?? []).filter((op: any) => (op?.metasProdutos ?? []).length > 0);
                  if (operadoras.length === 0) return null;
                  return (
                    <Row className="mb-3">
                      <Col>
                        <Card>
                          <Card.Header>
                            <strong>Operadoras de Caixa</strong>
                          </Card.Header>
                          <Card.Body>
                            <Table size="sm" responsive>
                              <thead>
                                <tr>
                                  <th>Nome</th>
                                  <th>Qtd Metas</th>
                                  <th>Total Comissão</th>
                                </tr>
                              </thead>
                              <tbody>
                                {operadoras.map((op: any) => {
                                  const total = (op?.metasProdutos ?? []).reduce((acc: number, mp: any) => {
                                    const qv = mp?.qtdVendido ?? 0; const qm = mp?.qtdMeta ?? 0; const vv = mp?.valorVendido ?? 0; const p = mp?.percentualSobreVenda ?? 0;
                                    const c = mp?.valorComissao != null ? mp.valorComissao : (qv >= qm ? (vv * p) / 100 : 0);
                                    return acc + c;
                                  }, 0);
                                  return (
                                    <tr key={op?.id || op?.nome}>
                                      <td>{op?.nome}</td>
                                      <td>{(op?.metasProdutos ?? []).length}</td>
                                      <td>R$ {Number(total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </Table>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  );
                })()}

                {(() => {
                  const vendedoras = (metaAdminDetalhes?.vendedoras ?? []).filter((v: any) => (v?.metasProdutos ?? []).length > 0);
                  if (vendedoras.length === 0) return null;
                  return (
                    <Row className="mb-3">
                      <Col>
                        <Card>
                          <Card.Header>
                            <strong>Vendedoras</strong>
                          </Card.Header>
                          <Card.Body>
                            <Table size="sm" responsive>
                              <thead>
                                <tr>
                                  <th>Nome</th>
                                  <th>Qtd Metas</th>
                                  <th>Total Comissão</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vendedoras.map((v: any) => {
                                  const total = (v?.metasProdutos ?? []).reduce((acc: number, mp: any) => {
                                    const qv = mp?.qtdVendido ?? 0; const qm = mp?.qtdMeta ?? 0; const vv = mp?.valorVendido ?? 0; const p = mp?.percentualSobreVenda ?? 0;
                                    const c = mp?.valorComissao != null ? mp.valorComissao : (qv >= qm ? (vv * p) / 100 : 0);
                                    return acc + c;
                                  }, 0);
                                  return (
                                    <tr key={v?.id || v?.nome}>
                                      <td>{v?.nome}</td>
                                      <td>{(v?.metasProdutos ?? []).length}</td>
                                      <td>R$ {Number(total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </Table>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  );
                })()}

                {(() => {
                  const vendedorasBijou = metaAdminDetalhes?.vendedoras_bijou ?? [];
                  if (vendedorasBijou.length === 0) return null;
                  return (
                    <Row className="mb-3">
                      <Col>
                        <Card>
                          <Card.Header>
                            <strong>Vendedoras Bijou / Make / Bolsas</strong>
                          </Card.Header>
                          <Card.Body>
                            <Table size="sm" responsive>
                              <thead>
                                <tr>
                                  <th>Nome</th>
                                  <th>Bijou / Make / Bolsas</th>
                                  <th>% Comissão</th>
                                  <th>Comissão (R$)</th>
                                  <th>Qtd Metas</th>
                                  <th>Total Comissão</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vendedorasBijou.map((vb: any) => {
                                  const metasTotal = (vb?.metasProdutos ?? []).reduce((acc: number, mp: any) => {
                                    const qv = mp?.qtdVendido ?? 0; const qm = mp?.qtdMeta ?? 0; const vv = mp?.valorVendido ?? 0; const p = mp?.percentualSobreVenda ?? 0;
                                    const c = mp?.valorComissao != null ? mp.valorComissao : (qv >= qm ? (vv * p) / 100 : 0);
                                    return acc + c;
                                  }, 0);
                                  const bijouValor = Number(vb?.bijouMakeBolsas ?? vb?.bijou_make_bolsas ?? 0);
                                  const perc = Number(vb?.percentualComissaoBijou ?? vb?.percentual_comissao_bijou ?? 0);
                                  const bijouComissao = (bijouValor * perc) / 100;
                                  const total = metasTotal + bijouComissao;
                                  return (
                                    <tr key={vb?.id || vb?.nome}>
                                      <td>{vb?.nome}</td>
                                      <td>R$ {Number(vb?.bijouMakeBolsas ?? vb?.bijou_make_bolsas ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                      <td>{Number(vb?.percentualComissaoBijou ?? vb?.percentual_comissao_bijou ?? 0)}%</td>
                                      <td>R$ {Number(vb?.valorComissaoBijou ?? vb?.valor_comissao_bijou ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                      <td>{(vb?.metasProdutos ?? []).length}</td>
                                      <td>R$ {Number(total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </Table>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  );
                })()}

                {(() => {
                  const g = metaAdminDetalhes?.gerente;
                  if (!g) return null;
                  return (
                    <Row className="mb-3">
                      <Col>
                        <Card>
                          <Card.Header>
                            <strong>Gerente</strong>
                          </Card.Header>
                          <Card.Body>
                            <Table size="sm" responsive>
                              <thead>
                                <tr>
                                  <th>Nome</th>
                                  <th>% Meta Geral</th>
                                  <th>Comissão</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>{g?.nome ?? '-'}</td>
                                  <td>{g?.percentualMetaGeral ?? 0}%</td>
                                  <td>
                                    {(() => {
                                      const valorTotal = Number(metaAdminDetalhes?.valor_venda_loja_total ?? metaSelecionada.valorVendaLojaTotal ?? 0);
                                      const percentual = Number(g?.percentualMetaGeral ?? 0);
                                      const comissao = valorTotal * (percentual / 100);
                                      return `R$ ${Number(comissao).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                    })()}
                                  </td>
                                </tr>
                              </tbody>
                            </Table>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  );
                })()}

                <Row>
                  <Col>
                    <Card>
                      <Card.Header>
                        <strong>Campanhas</strong>
                      </Card.Header>
                      <Card.Body>
                        {(metaAdminDetalhes?.campanhas ?? []).length === 0 ? (
                          <Alert variant="info">Nenhuma campanha cadastrada.</Alert>
                        ) : (
                          <Table size="sm" responsive>
                            <thead>
                              <tr>
                                <th>Nome</th>
                                <th>Quantidade Vendida</th>
                                <th>Atingiu Meta</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(metaAdminDetalhes?.campanhas ?? []).map((c: any) => (
                                <tr key={c?.id || c?.nome}>
                                  <td>{c?.nome ?? '-'}</td>
                                  <td>{c?.quantidadeVendida ?? c?.quantidade_vendida ?? 0}</td>
                                  <td>{(c?.atingiuMeta ?? c?.atingiu_meta) ? 'SIM' : 'NÃO'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </div>
            )
          ) : (
            <Alert variant="info">Nenhuma meta selecionada.</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={fecharTodosModais}>Fechar</Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para Gerenciar Grupos de Metas */}
      <Modal show={showGrupoModal} onHide={fecharModalGrupos} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Gerenciar Grupos de Metas</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs 
            activeKey={abaAtivaGrupos} 
            onSelect={(k) => setAbaAtivaGrupos(k || 'listar')} 
            id="grupos-metas-tabs"
          >
            <Tab eventKey="listar" title="Grupos Existentes">
              <div className="mt-3">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Descrição</th>
                      <th>Qtd. Metas</th>
                      <th>Status</th>
                      <th>Data Criação</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gruposMetas.map(grupo => (
                      <tr key={grupo.id}>
                        <td>{grupo.nome}</td>
                        <td>{grupo.descricao}</td>
                        <td>{grupo.metas.length}</td>
                        <td>
                          <Badge bg={grupo.ativo ? 'success' : 'secondary'}>
                            {grupo.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td>{new Date(grupo.dataCriacao).toLocaleDateString('pt-BR')}</td>
                        <td>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            className="me-2"
                            onClick={() => editarGrupoMeta(grupo)}
                          >
                            Editar
                          </Button>
                          <Button 
                            variant={grupo.ativo ? 'warning' : 'success'} 
                            size="sm" 
                            className="me-2"
                            onClick={() => toggleAtivoGrupo(grupo.id)}
                          >
                            {grupo.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button 
                            variant="danger" 
                            size="sm"
                            onClick={() => removerGrupoMeta(grupo.id)}
                          >
                            {`Excluir ${grupo.nome}`}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Tab>
            
            <Tab eventKey="criar" title={grupoEditando ? "Editar Grupo" : "Novo Grupo"}>
              <div className="mt-3">
                <Form>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nome do Grupo</Form.Label>
                        <Form.Control
                          type="text"
                          value={novoGrupo.nome}
                          onChange={(e) => setNovoGrupo({...novoGrupo, nome: e.target.value})}
                          placeholder="Ex: Metas Básicas"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Descrição</Form.Label>
                        <Form.Control
                          type="text"
                          value={novoGrupo.descricao}
                          onChange={(e) => setNovoGrupo({...novoGrupo, descricao: e.target.value})}
                          placeholder="Descrição do grupo de metas"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5>Metas do Grupo</h5>
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => adicionarMetaAoGrupo()}
                    >
                      Adicionar Meta
                    </Button>
                  </div>
                  
                  {novoGrupo.metas.length > 0 ? (
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          <th>Produto/Marca</th>
                          <th>Qtd. Meta</th>
                          <th>% Sobre Venda</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {novoGrupo.metas.map((meta, index) => (
                          <tr key={index}>
                            <td>
                              <Form.Control
                                type="text"
                                value={meta.nomeProdutoMarca}
                                onChange={(e) => atualizarMetaDoGrupo(meta.id, 'nomeProdutoMarca', e.target.value)}
                                placeholder="Nome do produto/marca"
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                value={meta.qtdMeta}
                                onChange={(e) => atualizarMetaDoGrupo(meta.id, 'qtdMeta', parseInt(e.target.value) || 0)}
                                placeholder="0"
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                step="0.1"
                                value={meta.percentualSobreVenda}
                                onChange={(e) => atualizarMetaDoGrupo(meta.id, 'percentualSobreVenda', parseFloat(e.target.value) || 0)}
                                placeholder="0.0"
                              />
                            </td>
                            <td>
                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={() => removerMetaDoGrupo(meta.id)}
                              >
                                Remover
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <Alert variant="info">
                      Nenhuma meta adicionada. Clique em "Adicionar Meta" para começar.
                    </Alert>
                  )}
                  
                  <div className="mt-3">
                    <Button 
                      variant="primary" 
                      onClick={grupoEditando ? salvarEdicaoGrupo : criarGrupoMeta}
                      disabled={!novoGrupo.nome.trim() || novoGrupo.metas.length === 0}
                    >
                      {grupoEditando ? 'Atualizar Grupo' : 'Salvar Grupo'}
                    </Button>
                    <Button 
                      variant="secondary" 
                      className="ms-2"
                      onClick={() => {
                        setGrupoEditando(null);
                        setNovoGrupo({
                          nome: '',
                          descricao: '',
                          metas: []
                        });
                        setAbaAtivaGrupos('listar'); // Volta para a aba de listagem
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </Form>
              </div>
            </Tab>
          </Tabs>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

  // Componente reutilizável para Metas de Produtos
  const MetasProdutosComponent: React.FC<{
    metasProdutos: MetaProduto[];
    funcionarioId: string;
    tipoFuncionario: 'operadora' | 'vendedora' | 'vendedoraBijou';
    titulo: string;
    onAdicionarMeta: (funcionarioId: string, tipo: 'operadora' | 'vendedora' | 'vendedoraBijou') => void;
    onRemoverMeta: (funcionarioId: string, metaId: string, tipo: 'operadora' | 'vendedora' | 'vendedoraBijou') => void;
    onAtualizarMeta: (funcionarioId: string, metaId: string, campo: string, valor: any, tipo: 'operadora' | 'vendedora' | 'vendedoraBijou') => void;
    formatarNumeroParaExibicao: (valor: number) => string;
    aplicarMascaraMonetaria: (valor: string) => string;
    converterMascaraParaNumero: (valor: string) => number;
    gruposMetas: GrupoMetaProduto[];
    onAplicarGrupoMeta: (funcionarioId: string, grupoId: string, tipo: 'operadora' | 'vendedora' | 'vendedoraBijou') => void;
  }> = ({ 
    metasProdutos, 
    funcionarioId, 
    tipoFuncionario, 
    titulo, 
    onAdicionarMeta, 
    onRemoverMeta, 
    onAtualizarMeta,
    formatarNumeroParaExibicao,
    aplicarMascaraMonetaria,
    converterMascaraParaNumero,
    gruposMetas,
    onAplicarGrupoMeta
  }) => {
    return (
      <div className="mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">{titulo}</h6>
          <div className="d-flex gap-2">
            <Form.Select 
              size="sm" 
              style={{ width: '200px' }}
              onChange={(e) => {
                if (e.target.value) {
                  onAplicarGrupoMeta(funcionarioId, e.target.value, tipoFuncionario);
                  e.target.value = ''; // Reset selection
                }
              }}
            >
              <option value="">Aplicar Grupo de Metas</option>
              {gruposMetas.filter(grupo => grupo.ativo).map(grupo => (
                <option key={grupo.id} value={grupo.id}>
                  {grupo.nome} ({grupo.metas.length} metas)
                </option>
              ))}
            </Form.Select>
            <Button 
              variant="success" 
              size="sm" 
              onClick={() => onAdicionarMeta(funcionarioId, tipoFuncionario)}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Adicionar Meta
            </Button>
          </div>
        </div>
        
        {metasProdutos.length === 0 ? (
          <Alert variant="info" className="mb-3">
            Nenhuma meta de produto/marca adicionada.
          </Alert>
        ) : (
          <div className="table-responsive">
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Nome Produto/Marca</th>
                  <th>Qtd Meta</th>
                  <th>Qtd Vendido</th>
                  <th>% Sobre Venda</th>
                  <th>Valor Vendido</th>
                  <th>Valor Comissão</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {metasProdutos.map((meta) => (
                  <tr key={meta.id}>
                    <td>
                      <Form.Control
                        type="text"
                        size="sm"
                        value={meta.nomeProdutoMarca}
                        onChange={(e) => onAtualizarMeta(funcionarioId, meta.id, 'nomeProdutoMarca', e.target.value, tipoFuncionario)}
                        placeholder="Nome do produto/marca"
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        size="sm"
                        value={meta.qtdMeta}
                        onChange={(e) => onAtualizarMeta(funcionarioId, meta.id, 'qtdMeta', parseInt(e.target.value) || 0, tipoFuncionario)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        size="sm"
                        value={meta.qtdVendido}
                        onChange={(e) => onAtualizarMeta(funcionarioId, meta.id, 'qtdVendido', parseInt(e.target.value) || 0, tipoFuncionario)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        size="sm"
                        value={meta.percentualSobreVenda}
                        onChange={(e) => onAtualizarMeta(funcionarioId, meta.id, 'percentualSobreVenda', parseFloat(e.target.value) || 0, tipoFuncionario)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="text"
                        size="sm"
                        value={formatarNumeroParaExibicao(meta.valorVendido)}
                        onChange={(e) => {
                          const valorFormatado = aplicarMascaraMonetaria(e.target.value);
                          const valorNumerico = converterMascaraParaNumero(valorFormatado);
                          onAtualizarMeta(funcionarioId, meta.id, 'valorVendido', valorNumerico, tipoFuncionario);
                        }}
                        placeholder="R$ 0,00"
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="text"
                        size="sm"
                        value={formatarNumeroParaExibicao(meta.valorComissao)}
                        readOnly
                        className="bg-light"
                      />
                    </td>
                    <td>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onRemoverMeta(funcionarioId, meta.id, tipoFuncionario)}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    );
  };

export default MetaLojas;