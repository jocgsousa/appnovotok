import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, StackActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Definir o tipo para as rotas
type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  // Adicione outras rotas conforme necessário
};

// Usar o tipo StackNavigationProp para o navigation
type MetasScreenNavigationProp = StackNavigationProp<RootStackParamList>;

// Tipos de dados
type Meta = {
  id: number;
  vendedor_id: number;
  mes: number;
  ano: number;
  nome_mes: string;
  periodo: string;
  tipo_meta: string;
  valor_meta?: number;
  valor_realizado?: number;
  quantidade_meta?: number;
  quantidade_realizada?: number;
  percentual_atingido: number;
  status: 'pendente' | 'em_andamento' | 'concluida';
  observacoes?: string;
};

type Progresso = {
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

type VendasInfo = {
  total_vendas?: number;
  total_novos_cadastros?: number;
  total_clientes_atualizados?: number;
  dias_com_venda?: number;
  ultima_venda?: string;
  ultimo_cadastro?: string;
};

const MetasScreen = () => {
  const { apiUrl, user, signOut } = useAuth();
  // Usar o tipo correto para navigation
  const navigation = useNavigation<MetasScreenNavigationProp>();
  
  // Estados
  const [metasVendas, setMetasVendas] = useState<Meta[]>([]);
  const [metasCadastro, setMetasCadastro] = useState<Meta[]>([]);
  const [metaSelecionada, setMetaSelecionada] = useState<Meta | null>(null);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [vendasInfo, setVendasInfo] = useState<VendasInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tipoMetaAtiva, setTipoMetaAtiva] = useState<'vendas' | 'cadastro_clientes'>('vendas');
  
  // Verificar e lidar com erros de autenticação
  const handleAuthError = async (error: any) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.log('[MetasScreen] Erro de autenticação detectado. Redirecionando para login...');
      
      // Mostrar mensagem e redirecionar para login
      Alert.alert(
        'Sessão Expirada', 
        'Sua sessão expirou. Por favor, faça login novamente.',
        [{ text: 'OK', onPress: () => redirecionarParaLogin() }]
      );
      return true;
    }
    return false;
  };
  
  // Função para redirecionar para tela de login
  const redirecionarParaLogin = async () => {
    try {
      await signOut();
      // Navegação tipada corretamente agora
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('[MetasScreen] Erro ao redirecionar para login:', error);
    }
  };
  
  // Carregar metas do vendedor
  const carregarMetas = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      console.log(`[MetasScreen] Iniciando requisição de metas para vendedor ID: ${user.id}`);
      console.log(`[MetasScreen] URL da requisição: ${apiUrl}/listar_metas_vendedor.php`);
      console.log(`[MetasScreen] Token: ${user.token.substring(0, 20)}...`); // Mostra apenas o início do token por segurança
      
      // Garantir que o token está sendo enviado corretamente
      const headers = {
        'Authorization': `Bearer ${user.token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      
      console.log('[MetasScreen] Headers da requisição:', JSON.stringify(headers));
      
      const response = await axios.get(`${apiUrl}/listar_metas_vendedor.php`, {
        params: { vendedor_id: user.id },
        headers: headers
      });
      
      console.log(`[MetasScreen] Status da resposta: ${response.status}`);
      console.log(`[MetasScreen] Status da API: ${response.data.status}`);
      
      if (response.data.status === 1) {
        console.log(`[MetasScreen] Metas de vendas recebidas: ${response.data.metas_vendas?.length || 0}`);
        console.log(`[MetasScreen] Metas de cadastro recebidas: ${response.data.metas_cadastro_clientes?.length || 0}`);
        
        const novasMetasVendas = response.data.metas_vendas || [];
        const novasMetasCadastro = response.data.metas_cadastro_clientes || [];
        
        setMetasVendas(novasMetasVendas);
        setMetasCadastro(novasMetasCadastro);
        
        // Verificar se há uma meta selecionada e se ela ainda existe nas novas metas
        if (metaSelecionada) {
          const tipoAtual = metaSelecionada.tipo_meta;
          const metasAtuais = tipoAtual === 'vendas' ? novasMetasVendas : novasMetasCadastro;
          
          // Procurar a meta atual pelo ID
          const metaAtualizada = metasAtuais.find((m: Meta) => m.id === metaSelecionada.id);
          
          if (metaAtualizada) {
            // Se a meta ainda existe, atualizar a seleção e carregar progresso
            setMetaSelecionada(metaAtualizada);
            carregarProgressoMeta(metaAtualizada.id, metaAtualizada.tipo_meta, metaAtualizada.mes, metaAtualizada.ano);
            return;
          }
        }
        
        // Caso não tenha meta selecionada ou ela não exista mais, selecionar a primeira meta
        if (tipoMetaAtiva === 'vendas' && novasMetasVendas.length > 0) {
          const metaMaisRecente = novasMetasVendas[0];
          setMetaSelecionada(metaMaisRecente);
          carregarProgressoMeta(metaMaisRecente.id, 'vendas', metaMaisRecente.mes, metaMaisRecente.ano);
        } else if (tipoMetaAtiva === 'cadastro_clientes' && novasMetasCadastro.length > 0) {
          const metaMaisRecente = novasMetasCadastro[0];
          setMetaSelecionada(metaMaisRecente);
          carregarProgressoMeta(metaMaisRecente.id, 'cadastro_clientes', metaMaisRecente.mes, metaMaisRecente.ano);
        } else if (novasMetasVendas.length > 0) {
          // Caso o tipo ativo não tenha metas, mas existam metas de vendas
          const metaMaisRecente = novasMetasVendas[0];
          setMetaSelecionada(metaMaisRecente);
          setTipoMetaAtiva('vendas');
          carregarProgressoMeta(metaMaisRecente.id, 'vendas', metaMaisRecente.mes, metaMaisRecente.ano);
        } else if (novasMetasCadastro.length > 0) {
          // Caso o tipo ativo não tenha metas, mas existam metas de cadastro
          const metaMaisRecente = novasMetasCadastro[0];
          setMetaSelecionada(metaMaisRecente);
          setTipoMetaAtiva('cadastro_clientes');
          carregarProgressoMeta(metaMaisRecente.id, 'cadastro_clientes', metaMaisRecente.mes, metaMaisRecente.ano);
        } else {
          // Não há metas disponíveis
          setMetaSelecionada(null);
          setProgresso(null);
          setVendasInfo(null);
        }
      } else {
        console.error(`[MetasScreen] Erro na API: ${response.data.message || 'Mensagem de erro não disponível'}`);
        console.error('[MetasScreen] Resposta completa:', JSON.stringify(response.data));
        Alert.alert('Erro', 'Não foi possível carregar as metas.');
      }
    } catch (error) {
      console.error('[MetasScreen] Erro ao carregar metas:', error);
      
      // Tenta tratar erro de autenticação
      const tratado = await handleAuthError(error);
      if (tratado) return; // Se o erro foi tratado com sucesso, não continua
      
      if (axios.isAxiosError(error)) {
        console.error('[MetasScreen] Detalhes do erro Axios:');
        console.error(`[MetasScreen] Status: ${error.response?.status}`);
        console.error(`[MetasScreen] Dados: ${JSON.stringify(error.response?.data)}`);
        console.error(`[MetasScreen] Headers: ${JSON.stringify(error.response?.headers)}`);
        console.error(`[MetasScreen] Config: ${JSON.stringify(error.config)}`);
      }
      
      // Se não for erro de autenticação ou já foi tratado, mostra mensagem genérica
      Alert.alert('Erro', 'Ocorreu um erro ao carregar as metas. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Carregar progresso de uma meta específica
  const carregarProgressoMeta = async (metaId: number, tipoMeta: string, mes: number, ano: number) => {
    if (!user) return;
    
    try {
      console.log(`[MetasScreen] Carregando progresso da meta ID: ${metaId}, Tipo: ${tipoMeta}, Mês: ${mes}, Ano: ${ano}`);
      
      // Usar o mesmo formato de headers para consistência
      const headers = {
        'Authorization': `Bearer ${user.token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      
      const response = await axios.get(`${apiUrl}/progresso_metas_vendedor.php`, {
        params: { 
          vendedor_id: user.id,
          tipo_meta: tipoMeta,
          meta_id: metaId // Enviar o ID da meta específica
        },
        headers: headers
      });
      
      console.log(`[MetasScreen] Status da resposta de progresso: ${response.status}`);
      
      if (response.data.status === 1) {
        console.log('[MetasScreen] Progresso carregado com sucesso');
        setProgresso(response.data.progresso);
        setVendasInfo(response.data.vendas_info);
      } else {
        console.error(`[MetasScreen] Erro ao carregar progresso: ${response.data.message}`);
        console.error('[MetasScreen] Resposta completa do progresso:', JSON.stringify(response.data));
      }
    } catch (error) {
      console.error('[MetasScreen] Erro ao carregar progresso da meta:', error);
      
      // Tenta tratar erro de autenticação
      const tratado = await handleAuthError(error);
      if (tratado) return; // Se o erro foi tratado com sucesso, não continua
      
      if (axios.isAxiosError(error)) {
        console.error('[MetasScreen] Detalhes do erro Axios no progresso:');
        console.error(`[MetasScreen] Status: ${error.response?.status}`);
        console.error(`[MetasScreen] Dados: ${JSON.stringify(error.response?.data)}`);
      }
    }
  };
  
  // Selecionar uma meta para visualizar detalhes
  const selecionarMeta = (meta: Meta) => {
    setMetaSelecionada(meta);
    carregarProgressoMeta(meta.id, meta.tipo_meta, meta.mes, meta.ano);
  };
  
  // Alternar entre metas de vendas e cadastro
  const alternarTipoMeta = (tipo: 'vendas' | 'cadastro_clientes') => {
    setTipoMetaAtiva(tipo);
    
    // Selecionar a primeira meta do tipo escolhido
    const metas = tipo === 'vendas' ? metasVendas : metasCadastro;
    if (metas.length > 0) {
      setMetaSelecionada(metas[0]);
      carregarProgressoMeta(metas[0].id, tipo, metas[0].mes, metas[0].ano);
    } else {
      setMetaSelecionada(null);
      setProgresso(null);
      setVendasInfo(null);
    }
  };
  
  // Atualizar dados ao puxar para baixo
  const onRefresh = () => {
    setRefreshing(true);
    carregarMetas();
  };
  
  // Efeito para carregar dados ao iniciar
  useEffect(() => {
    carregarMetas();
  }, [user]);
  
  // Formatar valores monetários
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };
  
  // Formatar data
  const formatarData = (dataString: string) => {
    if (!dataString) return '-';
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
  };
  
  // Renderizar cor do status
  const getCorStatus = (status: string) => {
    switch (status) {
      case 'concluida':
        return '#4CAF50'; // Verde
      case 'em_andamento':
        return '#FFA000'; // Laranja
      default:
        return '#F44336'; // Vermelho
    }
  };
  
  // Renderizar texto do status
  const getTextoStatus = (status: string) => {
    switch (status) {
      case 'concluida':
        return 'Concluída';
      case 'em_andamento':
        return 'Em andamento';
      default:
        return 'Pendente';
    }
  };
  
  // Renderizar ícone do tipo de meta
  const renderIconeTipoMeta = (tipo: string) => {
    if (tipo === 'vendas') {
      return <MaterialIcons name="attach-money" size={18} color="#4CAF50" />;
    } else {
      return <MaterialIcons name="person-add" size={18} color="#2196F3" />;
    }
  };
  
  // Renderizar detalhes da meta selecionada
  const renderDetalhesMeta = () => {
    if (!metaSelecionada || !progresso) {
      return (
        <View style={styles.semMetaContainer}>
          <MaterialCommunityIcons name="target" size={60} color="#ccc" />
          <Text style={styles.semMetaTexto}>Nenhuma meta selecionada</Text>
        </View>
      );
    }
    
    const isTipoVendas = metaSelecionada.tipo_meta === 'vendas';
    
    return (
      <View style={styles.detalhesContainer}>
        <View style={styles.headerMeta}>
          <View style={styles.headerMetaInfo}>
            <Text style={styles.periodoMeta}>{metaSelecionada.periodo}</Text>
            <Text style={styles.tipoMeta}>
              {renderIconeTipoMeta(metaSelecionada.tipo_meta)}
              {isTipoVendas ? ' Meta de Vendas' : ' Meta de Cadastros'}
            </Text>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: getCorStatus(metaSelecionada.status) }]}>
            <Text style={styles.statusText}>{getTextoStatus(metaSelecionada.status)}</Text>
          </View>
        </View>
        
        <View style={styles.progressoContainer}>
          <View style={styles.progressoBarContainer}>
            <View 
              style={[
                styles.progressoBar, 
                { width: `${Math.min(progresso.percentual, 100)}%` },
                progresso.percentual >= 100 ? styles.progressoCompleto : {}
              ]} 
            />
          </View>
          <Text style={styles.progressoTexto}>{progresso.percentual.toFixed(1)}%</Text>
        </View>
        
        <View style={styles.metricasContainer}>
          {isTipoVendas ? (
            <>
              {/* Meta de vendas: Meta e Realizado na primeira linha */}
              <View style={styles.metricaRow}>
                <View style={styles.metricaItem}>
                  <Text style={styles.metricaLabel}>Meta</Text>
                  <Text style={styles.metricaValor}>{formatarMoeda(metaSelecionada.valor_meta || 0)}</Text>
                </View>
                <View style={styles.metricaItem}>
                  <Text style={styles.metricaLabel}>Realizado</Text>
                  <Text style={styles.metricaValor}>{formatarMoeda(metaSelecionada.valor_realizado || 0)}</Text>
                </View>
              </View>
              
              {/* Faltante na segunda linha */}
              <View style={styles.metricaRow}>
                <View style={styles.metricaItem}>
                  <Text style={styles.metricaLabel}>Faltante</Text>
                  <Text style={styles.metricaValor}>{formatarMoeda(progresso.valor_faltante || 0)}</Text>
                </View>
                <View style={styles.metricaItem}>
                  {/* Item vazio para manter o layout */}
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Meta de cadastros: Meta e Novos na primeira linha */}
              <View style={styles.metricaRow}>
                <View style={styles.metricaItem}>
                  <Text style={styles.metricaLabel}>Meta</Text>
                  <Text style={styles.metricaValor}>{metaSelecionada.quantidade_meta || 0}</Text>
                </View>
                <View style={styles.metricaItem}>
                  <Text style={styles.metricaLabel}>Novos</Text>
                  <Text style={styles.metricaValor}>{metaSelecionada.quantidade_realizada || 0}</Text>
                </View>
              </View>
              
              {/* Atualizados e Faltante na segunda linha */}
              <View style={styles.metricaRow}>
                <View style={styles.metricaItem}>
                  <Text style={styles.metricaLabel}>Atualizados</Text>
                  <Text style={styles.metricaValor}>{vendasInfo?.total_clientes_atualizados || 0}</Text>
                </View>
                <View style={styles.metricaItem}>
                  <Text style={styles.metricaLabel}>Faltante</Text>
                  <Text style={styles.metricaValor}>{progresso.quantidade_faltante || 0}</Text>
                </View>
              </View>
            </>
          )}
        </View>
        
        {!isTipoVendas && vendasInfo && (
          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <MaterialIcons name="event" size={18} color="#555" />
              <Text style={styles.infoTexto}>
                Último cadastro: {vendasInfo.ultimo_cadastro ? formatarData(vendasInfo.ultimo_cadastro) : '-'}
              </Text>
            </View>
          </View>
        )}
        
        {metaSelecionada.observacoes && (
          <View style={styles.observacoesContainer}>
            <Text style={styles.observacoesLabel}>Observações:</Text>
            <Text style={styles.observacoesTexto}>{metaSelecionada.observacoes}</Text>
          </View>
        )}
      </View>
    );
  };
  
  // Renderizar lista de metas
  const renderListaMetas = () => {
    const metas = tipoMetaAtiva === 'vendas' ? metasVendas : metasCadastro;
    
    if (metas.length === 0) {
      return (
        <View style={styles.semMetasContainer}>
          <Text style={styles.semMetasTexto}>
            Nenhuma meta de {tipoMetaAtiva === 'vendas' ? 'vendas' : 'cadastro'} encontrada
          </Text>
        </View>
      );
    }
    
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metasListaContainer}
      >
        {metas.map((meta) => {
          // Calcular percentual corretamente
          let percentual = 0;
          if (tipoMetaAtiva === 'vendas') {
            const valorMeta = meta.valor_meta || 0;
            if (valorMeta > 0) {
              percentual = ((meta.valor_realizado || 0) / valorMeta) * 100;
            }
          } else if (tipoMetaAtiva === 'cadastro_clientes') {
            const quantidadeMeta = meta.quantidade_meta || 0;
            if (quantidadeMeta > 0) {
              percentual = ((meta.quantidade_realizada || 0) / quantidadeMeta) * 100;
            }
          }
          
          return (
            <TouchableOpacity
              key={meta.id}
              style={[
                styles.metaCard,
                metaSelecionada?.id === meta.id ? styles.metaCardSelecionada : {}
              ]}
              onPress={() => selecionarMeta(meta)}
            >
              <Text style={styles.metaPeriodo}>{meta.periodo}</Text>
              <View style={[styles.metaStatusIndicator, { backgroundColor: getCorStatus(meta.status) }]} />
              <Text style={styles.metaPercentual}>
                {percentual.toFixed(1)}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // Voltar para a tela inicial
  const goBack = () => {
    navigation.goBack();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#f12b00" />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={goBack}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minhas Metas</Text>
      </View>
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f12b00']} />
        }
      >
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tipoMetaAtiva === 'vendas' ? styles.tabAtiva : {}]}
            onPress={() => alternarTipoMeta('vendas')}
          >
            <MaterialIcons 
              name="attach-money" 
              size={20} 
              color={tipoMetaAtiva === 'vendas' ? '#f12b00' : '#555'} 
            />
            <Text style={[styles.tabText, tipoMetaAtiva === 'vendas' ? styles.tabTextAtivo : {}]}>
              Vendas
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, tipoMetaAtiva === 'cadastro_clientes' ? styles.tabAtiva : {}]}
            onPress={() => alternarTipoMeta('cadastro_clientes')}
          >
            <MaterialIcons 
              name="person-add" 
              size={20} 
              color={tipoMetaAtiva === 'cadastro_clientes' ? '#f12b00' : '#555'} 
            />
            <Text style={[styles.tabText, tipoMetaAtiva === 'cadastro_clientes' ? styles.tabTextAtivo : {}]}>
              Cadastros
            </Text>
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f12b00" />
            <Text style={styles.loadingText}>Carregando dados...</Text>
          </View>
        ) : (
          <>
            {renderListaMetas()}
            {renderDetalhesMeta()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#f12b00',
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // Compensar o botão voltar
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  tabAtiva: {
    backgroundColor: '#fff5f2',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  tabTextAtivo: {
    color: '#f12b00',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
  },
  metasListaContainer: {
    paddingBottom: 8,
  },
  metaCard: {
    width: width * 0.28,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    alignItems: 'center',
  },
  metaCardSelecionada: {
    borderWidth: 2,
    borderColor: '#f12b00',
  },
  metaPeriodo: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  metaStatusIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginVertical: 4,
  },
  metaPercentual: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  semMetasContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  semMetasTexto: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
  },
  detalhesContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerMetaInfo: {
    flex: 1,
  },
  periodoMeta: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tipoMeta: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  progressoContainer: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressoBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressoBar: {
    height: '100%',
    backgroundColor: '#FFA000',
    borderRadius: 5,
  },
  progressoCompleto: {
    backgroundColor: '#4CAF50',
  },
  progressoTexto: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    width: 60,
    textAlign: 'right',
  },
  metricasContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  metricaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  metricaItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  metricaLabel: {
    fontSize: 12,
    color: '#777',
    marginBottom: 4,
  },
  metricaValor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  infoContainer: {
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTexto: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
  },
  observacoesContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  observacoesLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 4,
  },
  observacoesTexto: {
    fontSize: 14,
    color: '#555',
  },
  semMetaContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  semMetaTexto: {
    fontSize: 16,
    color: '#777',
    marginTop: 10,
  },
});

export default MetasScreen; 