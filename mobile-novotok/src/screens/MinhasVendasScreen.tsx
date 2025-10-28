import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

// Tipos de dados para as vendas
type DadosVendaDia = {
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
};

type DadosVendas = {
  codUsuario: string;
  nome: string;
  diasVendas: DadosVendaDia[];
  total_qtd_pedidos: number;
  total_media_itens: number;
  total_ticket_medio: number;
  total_vlcustofin: number;
  total_qtcliente: number;
  total_via: number;
  total_vlvendadodia: number;
  total_vldevolucao: number;
  total_valor: number;
};

const MinhasVendasScreen = () => {
  const { apiUrl, user, signIn } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dadosVendas, setDadosVendas] = useState<DadosVendas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativas, setTentativas] = useState(0);

  // Estados para seleção de data
  const hoje = new Date();
  const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  
  // Função para formatar data para DD/MM/YYYY
  const formatarDataParaExibicao = (data: Date): string => {
    const dia = data.getDate().toString().padStart(2, '0');
    const mes = (data.getMonth() + 1).toString().padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };
  
  // Função para formatar data para YYYY-MM-DD (API)
  const formatarDataParaAPI = (data: Date): string => {
    return data.toISOString().split('T')[0];
  };
  
  // Função para converter DD/MM/YYYY para Date
  const converterStringParaData = (dataStr: string): Date | null => {
    const partes = dataStr.split('/');
    if (partes.length === 3) {
      const dia = parseInt(partes[0]);
      const mes = parseInt(partes[1]) - 1; // Mês é 0-indexado
      const ano = parseInt(partes[2]);
      if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
        return new Date(ano, mes, dia);
      }
    }
    return null;
  };
  
  const [dataInicio, setDataInicio] = useState(formatarDataParaExibicao(primeiroDiaDoMes));
  const [dataFim, setDataFim] = useState(formatarDataParaExibicao(hoje));

  useEffect(() => {
    carregarDadosVendas();
  }, []);

  // Voltar para a tela inicial
  const goBack = () => {
    navigation.goBack();
  };

  const carregarDadosVendas = async () => {
    try {
      setLoading(true);
      setErro(null);
      setTentativas(prev => prev + 1);

      if (!user?.rca) {
        throw new Error('Código do vendedor não encontrado');
      }

      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        throw new Error('Sem conexão com a internet');
      }

      const headers = {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      };

      // Converter datas para o formato da API (YYYY-MM-DD)
      const dataInicioObj = converterStringParaData(dataInicio);
      const dataFimObj = converterStringParaData(dataFim);
      
      if (!dataInicioObj || !dataFimObj) {
        throw new Error('Formato de data inválido. Use DD/MM/YYYY');
      }
      
      const dataInicioStr = formatarDataParaAPI(dataInicioObj);
      const dataFimStr = formatarDataParaAPI(dataFimObj);

      console.log(`Carregando dados de vendas para RCA ${user.rca} de ${dataInicioStr} até ${dataFimStr}`);

      const response = await axios.get(
        `${apiUrl}/vendedor_listar_vendas_diarias.php?codusur=${user.rca}&data_inicio=${dataInicioStr}&data_fim=${dataFimStr}`,
        { headers, timeout: 10000 }
      );

      if (response.data.success) {
        console.log('Dados recebidos da API:', response.data);
        setDadosVendas({
          codUsuario: response.data.codUsuario,
          nome: response.data.nome,
          diasVendas: response.data.diasVendas || [],
          total_qtd_pedidos: response.data.total_qtd_pedidos || 0,
          total_media_itens: response.data.total_media_itens || 0,
          total_ticket_medio: response.data.total_ticket_medio || 0,
          total_vlcustofin: response.data.total_vlcustofin || 0,
          total_qtcliente: response.data.total_qtcliente || 0,
          total_via: response.data.total_via || 0,
          total_vlvendadodia: response.data.total_vlvendadodia || 0,
          total_vldevolucao: response.data.total_vldevolucao || 0,
          total_valor: response.data.total_valor || 0
        });
        setTentativas(0); // Resetar contador de tentativas após sucesso
      } else {
        setErro(response.data.message || 'Erro ao carregar dados de vendas.');
      }
    } catch (error) {
      console.error('Erro ao carregar dados de vendas:', error);
      
      // Verificar se é um erro de autenticação
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setErro('Sessão expirada. Por favor, faça login novamente.');
      } else if (tentativas < 2) {
        // Tentar novamente se for outro tipo de erro (pode ser problema de rede)
        console.log(`Tentativa ${tentativas + 1} de 3...`);
        setTimeout(() => {
          carregarDadosVendas();
        }, 2000);
        return;
      } else if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        setErro('A requisição excedeu o tempo limite. Verifique sua conexão e tente novamente.');
      } else {
        setErro('Não foi possível carregar os dados de vendas. Tente novamente mais tarde.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarDadosVendas();
  };

  // Função para buscar vendas com base no período selecionado
  const buscarVendas = () => {
    // Validar formato das datas
    const dataInicioObj = converterStringParaData(dataInicio);
    const dataFimObj = converterStringParaData(dataFim);
    
    if (!dataInicioObj || !dataFimObj) {
      Alert.alert('Erro', 'Formato de data inválido. Use DD/MM/YYYY');
      return;
    }
    
    // Validar se data início não é posterior à data fim
    if (dataInicioObj > dataFimObj) {
      Alert.alert('Erro', 'A data de início não pode ser posterior à data de fim.');
      return;
    }
    
    carregarDadosVendas();
  };

  // Função para aplicar máscara de data DD/MM/YYYY
  const aplicarMascaraData = (valor: string): string => {
    // Remove tudo que não é número
    const apenasNumeros = valor.replace(/\D/g, '');
    
    // Aplica a máscara DD/MM/YYYY
    if (apenasNumeros.length <= 2) {
      return apenasNumeros;
    } else if (apenasNumeros.length <= 4) {
      return `${apenasNumeros.slice(0, 2)}/${apenasNumeros.slice(2)}`;
    } else {
      return `${apenasNumeros.slice(0, 2)}/${apenasNumeros.slice(2, 4)}/${apenasNumeros.slice(4, 8)}`;
    }
  };

  const formatarMoeda = (valor: number) => {
    if (valor === undefined || valor === null) {
      valor = 0;
    }
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatarNumero = (valor: number) => {
    if (valor === undefined || valor === null) {
      valor = 0;
    }
    return valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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
        <Text style={styles.headerTitle}>Minhas Vendas</Text>
      </View>
      
      {/* Filtro de Data */}
      <View style={styles.filtroContainer}>
        <View style={styles.filtroHeader}>
          <MaterialIcons name="date-range" size={20} color="#f12b00" />
          <Text style={styles.filtroTitle}>Período de Consulta</Text>
        </View>
        
        <View style={styles.dateRangeContainer}>
          <View style={styles.dateInputContainer}>
            <Text style={styles.dateLabel}>Data Início</Text>
            <TextInput
              style={styles.dateInput}
              value={dataInicio}
              onChangeText={(text) => setDataInicio(aplicarMascaraData(text))}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#999"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
          
          <View style={styles.dateInputContainer}>
            <Text style={styles.dateLabel}>Data Fim</Text>
            <TextInput
              style={styles.dateInput}
              value={dataFim}
              onChangeText={(text) => setDataFim(aplicarMascaraData(text))}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#999"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>
        
        <TouchableOpacity style={styles.buscarButton} onPress={buscarVendas}>
          <MaterialIcons name="search" size={20} color="#fff" />
          <Text style={styles.buscarButtonText}>Buscar Vendas</Text>
        </TouchableOpacity>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f12b00" />
          <Text style={styles.loadingText}>Carregando dados de vendas...</Text>
        </View>
      ) : erro ? (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#f12b00" />
          <Text style={styles.errorText}>{erro}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={carregarDadosVendas}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {dadosVendas && (
            <View style={styles.vendedorHeaderContainer}>
              <View style={styles.vendedorInfo}>
                <View style={styles.vendedorDetails}>
                  <Text style={styles.vendedorNome}>{dadosVendas.nome}</Text>
                  <Text style={styles.vendedorCodigo}>Código RCA: {dadosVendas.codUsuario}</Text>
                </View>
                <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                  <MaterialIcons name="refresh" size={24} color="#f12b00" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <ScrollView
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f12b00']} />
            }
            horizontal={true}
          >
            {dadosVendas && (
              <ScrollView style={styles.scrollViewVertical}>
                <View style={styles.tabelaContainer}>
                  <View style={styles.tabelaHeader}>
                    <Text style={[styles.headerCell, styles.dataCell]}>Data</Text>
                    {/* <Text style={[styles.headerCell, styles.numericCell]}>Cód.</Text> */}
                    {/* <Text style={[styles.headerCell, styles.nomeCell]}>Nome</Text> */}
                    <Text style={[styles.headerCell, styles.numericCell]}>Média Itens</Text>
                    <Text style={[styles.headerCell, styles.numericCell]}>Ticket Médio</Text>
                    {/* <Text style={[styles.headerCell, styles.numericCell]}>Custo</Text> */}
                    <Text style={[styles.headerCell, styles.numericCell]}>Clientes</Text>
                    <Text style={[styles.headerCell, styles.numericCell]}>Pedidos</Text>
                    <Text style={[styles.headerCell, styles.numericCell]}>VIA</Text>
                    <Text style={[styles.headerCell, styles.numericCell]}>Venda</Text>
                    <Text style={[styles.headerCell, styles.numericCell]}>Devolução</Text>
                    <Text style={[styles.headerCell, styles.numericCell]}>Final</Text>
                  </View>
                  
                  {dadosVendas.diasVendas.map((dia, index) => (
                    <View 
                      key={dia.id || index} 
                      style={[
                        styles.tabelaRow, 
                        index % 2 === 0 ? styles.rowEven : styles.rowOdd
                      ]}
                    >
                      <Text style={[styles.rowCell, styles.dataCell]}>{dia.data}</Text>
                      {/* <Text style={[styles.rowCell, styles.numericCell]}>{dia.codusur}</Text> */}
                      {/* <Text style={[styles.rowCell, styles.nomeCell]} numberOfLines={1} ellipsizeMode="tail">{dia.nome}</Text> */}
                      <Text style={[styles.rowCell, styles.numericCell]}>{formatarNumero(dia.media_itens)}</Text>
                      <Text style={[styles.rowCell, styles.numericCell]}>{formatarNumero(dia.ticket_medio)}</Text>
                      {/* <Text style={[styles.rowCell, styles.numericCell]}>{formatarMoeda(dia.vlcustofin)}</Text> */}
                      <Text style={[styles.rowCell, styles.numericCell]}>{dia.qtcliente}</Text>
                      <Text style={[styles.rowCell, styles.numericCell]}>{dia.qtd_pedidos}</Text>
                      <Text style={[styles.rowCell, styles.numericCell]}>{formatarNumero(dia.via)}</Text>
                      <Text style={[styles.rowCell, styles.numericCell]}>{formatarMoeda(dia.vlvendadodia)}</Text>
                      <Text style={[styles.rowCell, styles.numericCell]}>{formatarMoeda(dia.vldevolucao)}</Text>
                      <Text style={[styles.rowCell, styles.numericCell]}>{formatarMoeda(dia.valor_total)}</Text>
                    </View>
                  ))}
                  
                  <View style={styles.tabelaFooter}>
                    <Text style={[styles.footerCell, styles.dataCell]}>TOTAL</Text>
                    {/* <Text style={[styles.footerCell, styles.numericCell]}></Text> */}
                    {/* <Text style={[styles.footerCell, styles.nomeCell]}></Text> */}
                    <Text style={[styles.footerCell, styles.numericCell]}>{formatarNumero(dadosVendas.total_media_itens)}</Text>
                    <Text style={[styles.footerCell, styles.numericCell]}>{formatarNumero(dadosVendas.total_ticket_medio)}</Text>
                    {/* <Text style={[styles.footerCell, styles.numericCell]}>{formatarMoeda(dadosVendas.total_vlcustofin)}</Text> */}
                    <Text style={[styles.footerCell, styles.numericCell]}>{dadosVendas.total_qtcliente}</Text>
                    <Text style={[styles.footerCell, styles.numericCell]}>{dadosVendas.total_qtd_pedidos}</Text>
                    <Text style={[styles.footerCell, styles.numericCell]}>{formatarNumero(dadosVendas.total_via)}</Text>
                    <Text style={[styles.footerCell, styles.numericCell]}>{formatarMoeda(dadosVendas.total_vlvendadodia)}</Text>
                    <Text style={[styles.footerCell, styles.numericCell]}>{formatarMoeda(dadosVendas.total_vldevolucao)}</Text>
                    <Text style={[styles.footerCell, styles.numericCell]}>{formatarMoeda(dadosVendas.total_valor)}</Text>
                  </View>
                </View>
                
                <View style={styles.infoContainer}>
                  <Text style={styles.infoText}>
                    * VIA: Valor médio de itens por pedido
                  </Text>
                  <Text style={styles.infoText}>
                    * Dados atualizados em: {new Date().toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </ScrollView>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
};

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
  vendedorHeaderContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  vendedorInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vendedorDetails: {
    flex: 1,
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#f12b00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  filtroContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filtroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filtroTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateInputContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  dateDisplay: {
    fontSize: 12,
    color: '#f12b00',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  buscarButton: {
    backgroundColor: '#f12b00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buscarButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewVertical: {
    flex: 1,
  },
  vendedorNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  vendedorCodigo: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  tabelaContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    width: 'auto', // Largura fixa para acomodar todas as colunas
  },
  tabelaHeader: {
    flexDirection: 'row',
    backgroundColor: '#f12b00',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  headerCell: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  dataCell: {
    width: 80,
    paddingHorizontal: 4,
  },
  numericCell: {
    width: 90,
    paddingHorizontal: 2,
  },
  nomeCell: {
    width: 200,
    paddingHorizontal: 4,
  },
  tabelaRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowEven: {
    backgroundColor: '#fff',
  },
  rowOdd: {
    backgroundColor: '#f9f9f9',
  },
  rowCell: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  tabelaFooter: {
    flexDirection: 'row',
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  footerCell: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  infoContainer: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
});

export default MinhasVendasScreen; 