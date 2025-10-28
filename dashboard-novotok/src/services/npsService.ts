import api from './api';

export interface InstanciaWhatsApp {
  id?: number;
  nome: string;
  identificador: string;
  url_webhook: string;
  token_api: string;
  numero_whatsapp: string;
  status: 'ativa' | 'inativa' | 'manutencao';
  max_envios_por_minuto: number;
  timeout_conversa_minutos: number;
  data_cadastro?: string;
  data_atualizacao?: string;
}

export interface PerguntaNPS {
  id?: number;
  pergunta: string;
  tipo_resposta: 'nota_nps' | 'texto_livre' | 'multipla_escolha' | 'sim_nao' | 'numero';
  opcoes_resposta?: string[];
  validacao_regex?: string;
  mensagem_erro: string;
  obrigatoria: boolean;
  ordem: number;
  status: 'ativa' | 'inativa';
}

export interface CampanhaNPS {
  id?: number;
  instancia_id: number | null;
  nome: string;
  descricao?: string;
  pergunta_principal: string;
  mensagem_inicial: string;
  mensagem_final: string;
  dias_apos_compra: number;
  disparo_imediato?: boolean;
  status: 'ativa' | 'inativa' | 'pausada';
  data_inicio?: string;
  data_fim?: string;
  max_tentativas_envio: number;
  intervalo_reenvio_dias: number;
  horario_envio_inicio: string;
  horario_envio_fim: string;
  dias_semana_envio: string;
  filiais_ativas: number[];
  timeout_conversa_minutos: number;
  data_cadastro?: string;
  instancia_nome?: string;
  imagem?: string | null;
  imagem_tipo?: string | null;
  imagem_nome?: string | null;
  numero_whatsapp?: string;
  perguntas?: PerguntaNPS[];
}

export interface DashboardNPS {
  estatisticas: {
    total_envios: number;
    enviados: number;
    finalizados: number;
    cancelados: number;
    erros: number;
  };
  nps: {
    total_respostas: number;
    nota_media: number | null;
    promotores: number;
    neutros: number;
    detratores: number;
    score_nps: number;
  };
  por_filial: Array<{
    filial: number;
    total_envios: number;
    total_respostas: number;
    nota_media: number | null;
    promotores: number;
    detratores: number;
    score_nps: number;
  }>;
  por_campanha: Array<{
    campanha_id: number;
    campanha_nome: string;
    total_envios: number;
    total_respostas: number;
    nota_media: number | null;
    promotores: number;
    detratores: number;
    score_nps: number;
  }>;
  por_vendedor?: Array<{
    vendedor: string;
    nome_vendedor?: string;
    ranking: number;
    total_envios: number;
    total_respostas: number;
    taxa_resposta: number;
    nota_media: number | null;
    promotores: number;
    percentual_promotores?: number;
    neutros: number;
    percentual_neutros?: number;
    detratores: number;
    percentual_detratores?: number;
    score_nps: number;
    classificacao: string;
  }>;
}

export interface MetricaNPS {
  data: string;
  total_respostas: number;
  nota_media: number | null;
  promotores: number;
  neutros: number;
  detratores: number;
  score_nps: number;
}

export interface RespostaNPS {
  id: number;
  resposta_texto: string;
  nota_nps: number;
  classificacao_nps: 'promotor' | 'neutro' | 'detrator';
  data_resposta: string;
  nome_cliente: string;
  celular: string;
  filial: number;
  numero_pedido: string;
  campanha_nome: string;
}

export interface ConversaNPS {
  id: number;
  nome_cliente: string;
  celular: string;
  filial: number;
  status_envio: string;
  data_envio: string;
  data_cadastro: string;
  campanha_nome: string;
  aguardando_resposta: boolean;
  data_timeout: string;
  status_conversa: 'AGUARDANDO' | 'FINALIZADA' | 'EXPIRADA' | 'PROCESSANDO';
}

export interface FiltrosRelatorio {
  data_inicio?: string;
  data_fim?: string;
  filial?: number;
  campanha?: number;
  page?: number;
  limit?: number;
}

class NPSService {
  // Instâncias WhatsApp
  async listarInstancias(): Promise<InstanciaWhatsApp[]> {
    const response = await api.get('/nps_instancias.php');
    return response.data.data;
  }

  async criarInstancia(instancia: InstanciaWhatsApp): Promise<{ success: boolean; id: number }> {
    const response = await api.post('/nps_instancias.php', instancia);
    return response.data;
  }

  async atualizarInstancia(instancia: InstanciaWhatsApp): Promise<{ success: boolean }> {
    const response = await api.put('/nps_instancias.php', instancia);
    return response.data;
  }

  async deletarInstancia(id: number): Promise<{ success: boolean }> {
    const response = await api.delete('/nps_instancias.php', { data: { id } });
    return response.data;
  }

  // Campanhas NPS
  async listarCampanhas(): Promise<CampanhaNPS[]> {
    const response = await api.get('/nps_campanhas.php');
    return response.data.data;
  }

  async obterCampanha(id: number): Promise<CampanhaNPS> {
    const response = await api.get(`/nps_campanhas.php?id=${id}`);
    return response.data.data;
  }

  async criarCampanha(campanha: CampanhaNPS): Promise<{ success: boolean; id: number }> {
    const response = await api.post('/nps_campanhas.php', campanha);
    return response.data;
  }

  async atualizarCampanha(campanha: CampanhaNPS): Promise<{ success: boolean }> {
    const response = await api.put('/nps_campanhas.php', campanha);
    return response.data;
  }

  async deletarCampanha(id: number): Promise<{ success: boolean }> {
    const response = await api.delete('/nps_campanhas.php', { data: { id } });
    return response.data;
  }

  // Relatórios e Dashboard
  async obterDashboard(filtros: FiltrosRelatorio = {}): Promise<DashboardNPS> {
    const params = new URLSearchParams();
    params.append('action', 'dashboard');
    
    if (filtros.data_inicio) params.append('data_inicio', filtros.data_inicio);
    if (filtros.data_fim) params.append('data_fim', filtros.data_fim);
    if (filtros.filial) params.append('filial', filtros.filial.toString());
    if (filtros.campanha) params.append('campanha', filtros.campanha.toString());

    const response = await api.get(`/nps_relatorios.php?${params.toString()}`);
    return response.data.data;
  }

  async obterMetricas(filtros: FiltrosRelatorio = {}): Promise<MetricaNPS[]> {
    const params = new URLSearchParams();
    params.append('action', 'metricas');
    
    if (filtros.data_inicio) params.append('data_inicio', filtros.data_inicio);
    if (filtros.data_fim) params.append('data_fim', filtros.data_fim);
    if (filtros.filial) params.append('filial', filtros.filial.toString());
    if (filtros.campanha) params.append('campanha', filtros.campanha.toString());

    const response = await api.get(`/nps_relatorios.php?${params.toString()}`);
    return response.data.data;
  }

  async obterRespostas(filtros: FiltrosRelatorio = {}): Promise<{
    data: RespostaNPS[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const params = new URLSearchParams();
    params.append('action', 'respostas');
    
    if (filtros.data_inicio) params.append('data_inicio', filtros.data_inicio);
    if (filtros.data_fim) params.append('data_fim', filtros.data_fim);
    if (filtros.filial) params.append('filial', filtros.filial.toString());
    if (filtros.campanha) params.append('campanha', filtros.campanha.toString());
    if (filtros.page) params.append('page', filtros.page.toString());
    if (filtros.limit) params.append('limit', filtros.limit.toString());

    const response = await api.get(`/nps_relatorios.php?${params.toString()}`);
    return response.data;
  }

  async obterConversas(status: string = 'todas', page: number = 1, limit: number = 50): Promise<ConversaNPS[]> {
    const params = new URLSearchParams();
    params.append('action', 'conversas');
    params.append('status', status);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await api.get(`/nps_relatorios.php?${params.toString()}`);
    return response.data.data;
  }

  // Exportar relatório NPS para Excel
  async exportarRelatorio(filtros: FiltrosRelatorio = {}): Promise<Blob> {
    try {
      const params = { ...filtros };
      const response = await api.get('/exportar_relatorio_nps.php', {
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
      console.error('Erro ao exportar relatório NPS:', error);
      throw error;
    }
  }

  // Utilitários
  formatarTelefone(numero: string): string {
    const numeroLimpo = numero.replace(/\D/g, '');
    
    if (numeroLimpo.length === 11) {
      return `(${numeroLimpo.slice(0, 2)}) ${numeroLimpo.slice(2, 7)}-${numeroLimpo.slice(7)}`;
    } else if (numeroLimpo.length === 13 && numeroLimpo.startsWith('55')) {
      const semCodigo = numeroLimpo.slice(2);
      return `(${semCodigo.slice(0, 2)}) ${semCodigo.slice(2, 7)}-${semCodigo.slice(7)}`;
    }
    
    return numero;
  }

  obterCorNPS(score: number): string {
    if (score >= 70) return '#4CAF50'; // Verde
    if (score >= 50) return '#FF9800'; // Laranja
    if (score >= 0) return '#FFC107';  // Amarelo
    return '#F44336'; // Vermelho
  }

  obterClassificacaoNPS(score: number): string {
    if (score >= 70) return 'Excelente';
    if (score >= 50) return 'Muito Bom';
    if (score >= 0) return 'Razoável';
    return 'Crítico';
  }

  formatarPorcentagem(valor: number, total: number): string {
    if (total === 0) return '0%';
    return `${((valor / total) * 100).toFixed(1)}%`;
  }
}

export default new NPSService();
