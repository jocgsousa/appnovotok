import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

// Tipo para os produtos e orçamento
type Produto = {
  id: string;
  codprod: number;
  codauxiliar: string;
  descricao: string;
  pvenda: number;
  descontofidelidade: number;
  pvendafidelidade: number;
  quantidade: number;
  oferta: boolean;
  preco_oferta: number;
};

type RespostaProduto = {
  success: boolean;
  message: string;
  produtos: {
    id: number;
    codprod: number;
    codauxiliar: string;
    descricao: string;
    pvenda: number;
    descontofidelidade: number;
    pvendafidelidade: number;
    dtfinalfidelidade: string;
    oferta_filial_2: number;
    oferta_filial_3: number;
    oferta_filial_4: number;
    oferta_filial_5: number;
    oferta_filial_6: number;
    oferta_filial_7: number;
    oferta_filiais_offers: number;
  }[];
};

type RootStackParamList = {
  EditarOrcamento: { orcamento: Orcamento };
};

type Orcamento = {
  id: string;
  data: string;
  produtos: Produto[];
  total: number;
  totalFidelidade: number;
  totalOferta: number;
  nome: string;
};

const NovoOrcamentoScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'EditarOrcamento'>>();
  const { apiUrl, getDeviceId } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nomeOrcamento, setNomeOrcamento] = useState('');
  const [codBarras, setCodBarras] = useState('');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [offline, setOffline] = useState(false);
  const [produtosOffline, setProdutosOffline] = useState<any[]>([]);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [orcamentoModificado, setOrcamentoModificado] = useState(false);

  useEffect(() => {
    checkConnectivity();
    carregarProdutosOffline();
    
    // Verifica se está no modo de edição
    if (route.params?.orcamento) {
      const orcamentoParaEditar = route.params.orcamento;
      setModoEdicao(true);
      setOrcamentoId(orcamentoParaEditar.id);
      setNomeOrcamento(orcamentoParaEditar.nome);
      setProdutos(orcamentoParaEditar.produtos);
      setOrcamentoModificado(false);
    }
    
    const unsubscribe = NetInfo.addEventListener(state => {
      setOffline(!state.isConnected);
    });
    
    return () => {
      unsubscribe();
    };
  }, [route.params]);

  // Atualizar o estado de modificação quando os produtos ou nome do orçamento mudam
  useEffect(() => {
    if (produtos.length > 0 || nomeOrcamento) {
      setOrcamentoModificado(true);
    }
  }, [produtos, nomeOrcamento]);

  // Função para confirmar saída sem salvar
  const confirmarSaidaSemSalvar = useCallback(() => {
    if (orcamentoModificado) {
      Alert.alert(
        'Sair sem salvar',
        'Você tem alterações não salvas. Deseja realmente sair sem salvar o orçamento?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Sair', 
            style: 'destructive',
            onPress: () => navigation.goBack()
          }
        ]
      );
      return true; // Previne a navegação padrão
    }
    return false; // Permite a navegação padrão
  }, [orcamentoModificado, navigation]);

  // Lidar com o botão de voltar do hardware no Android
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        return confirmarSaidaSemSalvar();
      });

      return () => subscription.remove();
    }, [confirmarSaidaSemSalvar])
  );

  const checkConnectivity = async () => {
    const netInfo = await NetInfo.fetch();
    const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
    const forceOfflineMode = offlineModeConfig === 'true';
    
    setOffline(!netInfo.isConnected || forceOfflineMode);
  };

  const carregarProdutosOffline = async () => {
    try {
      const data = await loadDataFromFile();
      if (data) {
        setProdutosOffline(data);
        console.log(`${data.length} produtos recuperados do armazenamento`);
      }
    } catch (error) {
      console.error('Erro ao carregar produtos offline:', error);
    }
  };
  
  const loadDataFromFile = async () => {
    try {
      const fileUri = FileSystem.documentDirectory + 'produtos.json';
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (fileInfo.exists) {
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        return JSON.parse(fileContent);
      }
      return null;
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      return null;
    }
  };

  const buscarProduto = async (codigoBarras: string) => {
    if (!codigoBarras) {
      Alert.alert('Erro', 'Digite um código de barras válido');
      return;
    }

    setLoading(true);
    try {
      // Verificar configuração de modo offline
      const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      const forceOfflineMode = offlineModeConfig === 'true';
      
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || forceOfflineMode) {
        console.log('Modo offline ativado, buscando no cache local');
        // Modo offline - buscar no cache local
        if (produtosOffline.length > 0) {
          console.log(`Buscando produto offline com código: ${codigoBarras}`);
          const produtoEncontrado = produtosOffline.find(
            produto => produto.codauxiliar === codigoBarras
          );
          
          if (produtoEncontrado) {
            console.log('Produto encontrado no cache local:', produtoEncontrado);
            adicionarProduto({
              id: Date.now().toString(),
              codprod: produtoEncontrado.codprod,
              codauxiliar: produtoEncontrado.codauxiliar,
              descricao: produtoEncontrado.descricao,
              pvenda: produtoEncontrado.pvenda,
              descontofidelidade: produtoEncontrado.descontofidelidade,
              pvendafidelidade: produtoEncontrado.pvendafidelidade,
              quantidade: 1,
              oferta: produtoEncontrado.oferta_filiais_offers > 0,
              preco_oferta: produtoEncontrado.oferta_filial_2 || produtoEncontrado.pvendafidelidade,
            });
            setCodBarras('');
          } else {
            console.log('Produto não encontrado no cache local');
            Alert.alert('Produto não encontrado', 'Verifique o código e tente novamente');
          }
        } else {
          console.log('Sem produtos sincronizados no cache local');
          Alert.alert(
            'Sem conexão',
            'Você está offline e não tem produtos sincronizados'
          );
        }
      } else {
        // Modo online - buscar na API
        console.log(`Buscando produto online com código: ${codigoBarras}`);
        
        // Obter o ID do dispositivo
        const id = await getDeviceId();
        if (!id) {
          Alert.alert('Erro', 'ID do dispositivo não encontrado');
          setLoading(false);
          return;
        }
        
        console.log(`URL da requisição: ${apiUrl}/buscar_produto.php?codauxiliar=${codigoBarras}&codaparelho=${id}`);
        
        const response = await axios.get<RespostaProduto>(
          `${apiUrl}/buscar_produto.php?codauxiliar=${codigoBarras}&codaparelho=${id}`
        );
        
        console.log('Resposta da API:', response.data);

        if (response.data.success && response.data.produtos.length > 0) {
          const produto = response.data.produtos[0];
          adicionarProduto({
            id: Date.now().toString(),
            codprod: produto.codprod,
            codauxiliar: produto.codauxiliar,
            descricao: produto.descricao,
            pvenda: produto.pvenda,
            descontofidelidade: produto.descontofidelidade,
            pvendafidelidade: produto.pvendafidelidade,
            quantidade: 1,
            oferta: produto.oferta_filiais_offers > 0,
            preco_oferta: produto.oferta_filial_2 || produto.pvendafidelidade,
          });
          setCodBarras('');
        } else {
          Alert.alert('Produto não encontrado', 'Verifique o código e tente novamente.');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      Alert.alert('Erro', 'Não foi possível buscar o produto. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const adicionarProduto = (produto: Produto) => {
    // Verifica se o produto já existe no orçamento
    const produtoExistente = produtos.find(p => p.codauxiliar === produto.codauxiliar);
    
    if (produtoExistente) {
      // Atualiza a quantidade do produto existente
      setProdutos(produtos.map(p => 
        p.codauxiliar === produto.codauxiliar 
          ? { ...p, quantidade: p.quantidade + 1 } 
          : p
      ));
    } else {
      // Adiciona o novo produto
      setProdutos([...produtos, produto]);
    }
    
    // Marcar que o orçamento foi modificado
    setOrcamentoModificado(true);
  };

  const removerProduto = (id: string) => {
    Alert.alert(
      'Remover produto',
      'Deseja realmente remover este produto do orçamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Remover', 
          style: 'destructive',
          onPress: () => {
            setProdutos(produtos.filter(p => p.id !== id));
          }
        }
      ]
    );
  };

  const alterarQuantidade = (id: string, quantidade: number) => {
    if (quantidade <= 0) {
      Alert.alert(
        'Remover produto',
        'Deseja remover este produto do orçamento?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Remover', 
            style: 'destructive',
            onPress: () => {
              setProdutos(produtos.filter(p => p.id !== id));
            }
          }
        ]
      );
      return;
    }
    
    setProdutos(produtos.map(p => 
      p.id === id ? { ...p, quantidade } : p
    ));
  };

  const calcularTotais = () => {
    let total = 0;
    let totalFidelidade = 0;
    let totalOferta = 0;
    
    produtos.forEach(produto => {
      // Total normal
      total += produto.pvenda * produto.quantidade;
      
      // Total com fidelidade
      totalFidelidade += produto.pvendafidelidade * produto.quantidade;
      
      // Total com ofertas (usa o preço de oferta quando disponível)
      if (produto.oferta) {
        totalOferta += produto.preco_oferta * produto.quantidade;
      } else {
        totalOferta += produto.pvendafidelidade * produto.quantidade;
      }
    });
    
    return { total, totalFidelidade, totalOferta };
  };

  const salvarOrcamento = async () => {
    if (produtos.length === 0) {
      Alert.alert('Erro', 'Adicione pelo menos um produto ao orçamento.');
      return;
    }
    
    try {
      const { total, totalFidelidade, totalOferta } = calcularTotais();
      
      // Carrega orçamentos existentes
      const orcamentosData = await AsyncStorage.getItem('@BuscaPreco:orcamentos');
      const orcamentosAtuais = orcamentosData ? JSON.parse(orcamentosData) : [];
      
      if (modoEdicao && orcamentoId) {
        // Atualiza o orçamento existente
        const orcamentoAtualizado = {
          id: orcamentoId,
          data: new Date().toISOString(),
          nome: nomeOrcamento || `Orçamento ${new Date().toLocaleDateString('pt-BR')}`,
          produtos,
          total,
          totalFidelidade,
          totalOferta,
        };
        
        const novosOrcamentos = orcamentosAtuais.map((orc: Orcamento) => 
          orc.id === orcamentoId ? orcamentoAtualizado : orc
        );
        
        await AsyncStorage.setItem('@BuscaPreco:orcamentos', JSON.stringify(novosOrcamentos));
        
        Alert.alert(
          'Orçamento atualizado',
          'Orçamento atualizado com sucesso!',
          [
            { 
              text: 'OK', 
              onPress: () => {
                setOrcamentoModificado(false);
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        // Cria um novo orçamento
        const novoOrcamento = {
          id: Date.now().toString(),
          data: new Date().toISOString(),
          nome: nomeOrcamento || `Orçamento ${new Date().toLocaleDateString('pt-BR')}`,
          produtos,
          total,
          totalFidelidade,
          totalOferta,
        };
        
        // Adiciona o novo orçamento
        const novosOrcamentos = [...orcamentosAtuais, novoOrcamento];
        await AsyncStorage.setItem('@BuscaPreco:orcamentos', JSON.stringify(novosOrcamentos));
        
        Alert.alert(
          'Orçamento salvo',
          'Orçamento salvo com sucesso!',
          [
            { 
              text: 'OK', 
              onPress: () => {
                setOrcamentoModificado(false);
                navigation.goBack();
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      Alert.alert('Erro', 'Não foi possível salvar o orçamento.');
    }
  };

  const abrirCamera = async () => {
    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Permissão necessária', 'É necessário permitir o acesso à câmera para escanear códigos de barras.');
        return;
      }
    }
    
    setCameraAtiva(true);
  };

  const fecharCamera = () => {
    setCameraAtiva(false);
  };

  const onCodeScanned = (code: string) => {
    setCameraAtiva(false);
    setCodBarras(code);
    buscarProduto(code);
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const { total, totalFidelidade, totalOferta } = calcularTotais();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#f12b00" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            if (orcamentoModificado) {
              confirmarSaidaSemSalvar();
            } else {
              navigation.goBack();
            }
          }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{modoEdicao ? 'Editar Orçamento' : 'Novo Orçamento'}</Text>
        <TouchableOpacity style={styles.saveButton} onPress={salvarOrcamento}>
          <MaterialIcons name="save" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nome do orçamento (opcional)"
            value={nomeOrcamento}
            onChangeText={setNomeOrcamento}
          />
        </View>
        
        <View style={styles.scanContainer}>
          <TextInput
            style={styles.scanInput}
            placeholder="Código de barras"
            value={codBarras}
            onChangeText={setCodBarras}
            keyboardType="numeric"
          />
          <TouchableOpacity 
            style={styles.scanButton} 
            onPress={() => buscarProduto(codBarras)}
          >
            <Text style={styles.scanButtonText}>Buscar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.cameraButton}
            onPress={abrirCamera}
          >
            <MaterialCommunityIcons name="barcode-scan" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Produtos</Text>
          
          {produtos.length === 0 ? (
            <View style={styles.emptyList}>
              <MaterialCommunityIcons name="cart-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nenhum produto adicionado</Text>
              <Text style={styles.emptySubText}>
                Adicione produtos escaneando o código de barras ou digitando manualmente
              </Text>
            </View>
          ) : (
            <FlatList
              data={produtos}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.produtoItem}>
                  <View style={styles.produtoInfo}>
                    <Text style={styles.produtoDescricao}>{item.descricao}</Text>
                    <Text style={styles.produtoCodigo}>
                      Cód: {item.codprod} | EAN: {item.codauxiliar}
                    </Text>
                    
                    <View style={styles.precoContainer}>
                      <Text style={styles.precoNormal}>
                        Preço: {formatarMoeda(item.pvenda)}
                      </Text>
                      <Text style={styles.precoFidelidade}>
                        Fidelidade: {formatarMoeda(item.pvendafidelidade)}
                      </Text>
                      {item.oferta && (
                        <Text style={styles.precoOferta}>
                          Oferta: {formatarMoeda(item.preco_oferta)}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.quantidadeContainer}>
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => alterarQuantidade(item.id, item.quantidade - 1)}
                    >
                      <MaterialIcons name="remove" size={20} color="#f12b00" />
                    </TouchableOpacity>
                    
                    <Text style={styles.quantidade}>{item.quantidade}</Text>
                    
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => alterarQuantidade(item.id, item.quantidade + 1)}
                    >
                      <MaterialIcons name="add" size={20} color="#f12b00" />
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => removerProduto(item.id)}
                  >
                    <MaterialIcons name="delete" size={18} color="#f12b00" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
        
        {produtos.length > 0 && (
          <View style={styles.totalContainer}>
            <View style={styles.totalItem}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{formatarMoeda(total)}</Text>
            </View>
            
            <View style={styles.totalItem}>
              <Text style={styles.totalLabel}>Total com fidelidade:</Text>
              <Text style={styles.totalValueFidelidade}>{formatarMoeda(totalFidelidade)}</Text>
            </View>
            
            <View style={styles.totalItem}>
              <Text style={styles.totalLabel}>Total com ofertas:</Text>
              <Text style={styles.totalValueOferta}>{formatarMoeda(totalOferta)}</Text>
            </View>
            
            <View style={styles.economiaContainer}>
              <Text style={styles.economiaLabel}>
                Economia total: {formatarMoeda(total - totalOferta)}
              </Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      
      {/* Modal da câmera */}
      <Modal
        visible={cameraAtiva}
        animationType="slide"
        onRequestClose={fecharCamera}
      >
        <SafeAreaView style={styles.cameraContainer}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={fecharCamera} style={styles.cameraCloseButton}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Escanear código de barras</Text>
          </View>
          
          {permission?.granted && (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_a"],
              }}
              onBarcodeScanned={(scanningResult) => {
                if (scanningResult.data) {
                  onCodeScanned(scanningResult.data);
                }
              }}
            />
          )}
          
          <View style={styles.cameraGuide}>
            <Text style={styles.cameraGuideText}>
              Posicione o código de barras dentro da área de leitura
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
      
      {/* Indicador de carregamento */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f12b00" />
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  scanContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  scanInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  scanButton: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginLeft: 8,
    borderRadius: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cameraButton: {
    backgroundColor: '#f12b00',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    marginLeft: 8,
    borderRadius: 8,
  },
  listContainer: {
    flex: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#888',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  produtoItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    position: 'relative',
  },
  produtoInfo: {
    flex: 1,
  },
  produtoDescricao: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  produtoCodigo: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  precoContainer: {
    marginTop: 4,
  },
  precoNormal: {
    fontSize: 14,
    color: '#333',
  },
  precoFidelidade: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  precoOferta: {
    fontSize: 14,
    color: '#f12b00',
    fontWeight: 'bold',
  },
  quantidadeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  quantidadeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 15,
  },
  quantidade: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8,
    minWidth: 24,
    textAlign: 'center',
  },
  totalContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  totalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValueFidelidade: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  totalValueOferta: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f12b00',
  },
  economiaContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  economiaLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'right',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  cameraCloseButton: {
    padding: 4,
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 16,
  },
  camera: {
    flex: 1,
  },
  cameraGuide: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 16,
  },
  cameraGuideText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff0f0',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ffdddd',
  },
});

export default NovoOrcamentoScreen; 