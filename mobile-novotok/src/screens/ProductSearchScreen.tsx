import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  ActivityIndicator,
  StatusBar,
  Platform,
  SafeAreaView,
  Modal,
  AppState,
  FlatList,
  BackHandler,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

// Tipos de dados
type ProductType = {
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
};

type RespostaProdutos = {
  success: boolean;
  message: string;
  produtos: ProductType[];
};

// Função para formatar valores monetários
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const ProductSearchScreen = () => {
  const { apiUrl, getDeviceId } = useAuth();
  const navigation = useNavigation();
  const [search, setSearch] = useState<boolean>(false); // Mudamos para false por padrão
  const [codbarra, setCodBarra] = useState<string>('');
  const [codbarraManual, setCodBarraManual] = useState<string>('');
  const [product, setProduct] = useState<ProductType | null>(null);
  const [buscando, setBuscando] = useState<boolean>(false);
  const [offline, setOffline] = useState<boolean>(false);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [produtosOffline, setProdutosOffline] = useState<ProductType[]>([]);
  const [sincronized, setSincronized] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const rotation = new Animated.Value(0);
  const [deviceId, setDeviceId] = useState<string>('');
  // Novos estados para o modal de progresso
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncInterval, setSyncInterval] = useState<string>('60');
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastSyncTimeRef = useRef<number>(0);
  // Novos estados para o modal de ofertas
  const [modalVisible, setModalVisible] = useState(false);
  const [offers, setOffers] = useState<ProductType[]>();
  const [offersFiltered, setOffersFiltered] = useState<ProductType[]>();
  const [stringFilter, setStringFilter] = useState<string>("");
  
  // Novo estado para o modal da câmera
  const [cameraModalVisible, setCameraModalVisible] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraKey = useRef<number>(0);

  // Estado para controlar a montagem/desmontagem da câmera
  const [mountCamera, setMountCamera] = useState<boolean>(false);
  const [isScreenFocused, setIsScreenFocused] = useState<boolean>(false);
  const isFocused = useRef<boolean>(false);
  const cameraInitTimeout = useRef<NodeJS.Timeout | null>(null);

  // Verificar conectividade e carregar dados offline ao iniciar
  useEffect(() => {
    console.log('Inicializando ProductSearchScreen');
    checkConnectivity();
    loadDeviceId();
    sincronizaOffline(false);
    loadOfflineModeSetting();
    loadSyncSettings();
    loadLastSyncDate();
    
    // Monitorar mudanças na conexão
    const unsubscribe = NetInfo.addEventListener(state => {
      checkConnectivity();
      if (!state.isConnected) {
        sincronizaOffline(true);
      }
    });

    // Adicionar listener para mudanças no modo offline
    const offlineModeListener = async () => {
      const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      const forceOfflineMode = offlineModeConfig === 'true';
      
      const netInfo = await NetInfo.fetch();
      setOffline(!netInfo.isConnected || forceOfflineMode);
    };

    // Verificar a cada 2 segundos se houve mudança na configuração
    const intervalId = setInterval(offlineModeListener, 2000);

    // Monitorar mudanças no estado do aplicativo
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App voltou para o primeiro plano');
        checkConnectivity();
        loadLastSyncDate();
        
        // Verificar se é necessário sincronizar com base no intervalo configurado
        const now = Date.now();
        const intervalMs = parseInt(syncInterval, 10) * 60 * 1000;
        
        if (autoSync && now - lastSyncTimeRef.current > intervalMs) {
          console.log('Sincronizando após retorno ao primeiro plano');
          sincronizarBackground();
          lastSyncTimeRef.current = now;
        }
      }
      
      appStateRef.current = nextAppState;
    });

    // Lidar com o botão de voltar no Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (cameraModalVisible) {
        fecharCamera();
        return true;
      }
      return false;
    });

    return () => {
      console.log('Desmontando ProductSearchScreen');
      unsubscribe();
      clearInterval(intervalId);
      appStateSubscription.remove();
      backHandler.remove();
      
      // Limpar o intervalo de sincronização quando o componente for desmontado
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      
      // Limpar o timeout de inicialização da câmera
      if (cameraInitTimeout.current) {
        clearTimeout(cameraInitTimeout.current);
      }
      
      // Limpar estados relacionados à câmera
      setCameraReady(false);
      setSearch(false);
      setMountCamera(false);
      setCameraModalVisible(false);
    };
  }, []);

  // Configurar sincronização automática quando as configurações mudarem
  useEffect(() => {
    setupAutoSync();
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [autoSync, syncInterval]);

  // Carregar configurações de sincronização
  const loadSyncSettings = async () => {
    try {
      const storedAutoSync = await AsyncStorage.getItem('@BuscaPreco:autoSync');
      const storedSyncInterval = await AsyncStorage.getItem('@BuscaPreco:syncInterval');

      if (storedAutoSync) setAutoSync(storedAutoSync === 'true');
      if (storedSyncInterval && storedSyncInterval !== '') setSyncInterval(storedSyncInterval);
    } catch (error) {
      console.error("Erro ao carregar configurações de sincronização:", error);
    }
  };

  // Configurar sincronização automática
  const setupAutoSync = async () => {
    // Limpar intervalo existente
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    // Se a sincronização automática estiver desativada, não fazer nada
    if (!autoSync) {
      console.log('Sincronização automática desativada');
      return;
    }

    // Converter o intervalo para milissegundos (de minutos)
    const intervalMs = parseInt(syncInterval, 10) * 60 * 1000;
    
    if (isNaN(intervalMs) || intervalMs <= 0) {
      console.error('Intervalo de sincronização inválido:', syncInterval);
      return;
    }

    console.log(`Configurando sincronização automática a cada ${syncInterval} minutos (${intervalMs}ms)`);
    
    // Configurar o intervalo de sincronização
    syncIntervalRef.current = setInterval(async () => {
      console.log('Executando sincronização automática');
      
      // Verificar conectividade antes de sincronizar
      const netInfo = await NetInfo.fetch();
      const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      const forceOfflineMode = offlineModeConfig === 'true';
      
      if (!netInfo.isConnected) {
        console.log('Sincronização automática pulada: sem conexão com internet');
        return;
      }
      
      if (forceOfflineMode) {
        console.log('Sincronização automática pulada: modo offline ativado');
        return;
      }
      
      // Executar sincronização em segundo plano
      await sincronizarBackground();
    }, intervalMs);
  };

  // Sincronização em segundo plano
  const sincronizarBackground = async () => {
    try {
      console.log('Iniciando sincronização em segundo plano');
      
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('Sem conexão com a internet, sincronização cancelada');
        return;
      }

      // Obter o ID do dispositivo
      const id = await getDeviceId();
      if (!id) {
        console.error('ID do dispositivo não disponível para sincronização');
        return;
      }

      // Fazer a requisição para a API
      const response = await axios.post<RespostaProdutos>(
        `${apiUrl}/buscar_produto_database.php`,
        { codaparelho: id }
      );

      if (response.data.success) {
        // Salvar os produtos no armazenamento local
        await saveDataToFile(response.data.produtos);
        
        // Salvar a data da sincronização
        const now = new Date().toISOString();
        await AsyncStorage.setItem('@BuscaPreco:lastSync', now);
        setLastSync(now);
        lastSyncTimeRef.current = Date.now();
        
        // Atualizar os produtos em memória
        setProdutosOffline(response.data.produtos);
        setSincronized(true);
        
        console.log(`Sincronização em segundo plano concluída: ${response.data.produtos.length} produtos`);
      } else {
        console.error('Erro na resposta da API:', response.data.message);
      }
    } catch (error) {
      console.error('Erro na sincronização em segundo plano:', error);
    }
  };

  // Verificar status do modo offline quando a tela receber foco
  useFocusEffect(
    React.useCallback(() => {
      console.log('Tela ProductSearchScreen recebeu foco');
      isFocused.current = true;
      setIsScreenFocused(true);
      
      // Verificar conectividade e carregar última data de sincronização
      const checkOfflineMode = async () => {
        await checkConnectivity();
        await loadLastSyncDate();
      };
      
      checkOfflineMode();
      
      return () => {
        console.log('Tela ProductSearchScreen perdeu foco');
        isFocused.current = false;
        setIsScreenFocused(false);
        
        // Limpar o timeout ao perder o foco
        if (cameraInitTimeout.current) {
          clearTimeout(cameraInitTimeout.current);
        }
        
        // Fechar o modal da câmera ao sair da tela
        fecharCamera();
      };
    }, [])
  );

  // Carregar o ID do dispositivo
  const loadDeviceId = async () => {
    try {
      const id = await getDeviceId();
      if (id) {
        setDeviceId(id);
      }
    } catch (error) {
      console.error('Erro ao carregar ID do dispositivo:', error);
    }
  };

  // Carregar configuração de modo offline
  const loadOfflineModeSetting = async () => {
    try {
      const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      if (offlineModeConfig === 'true') {
        setOffline(true);
        sincronizaOffline(true);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração de modo offline:', error);
    }
  };

  // Carregar data da última sincronização
  const loadLastSyncDate = async () => {
    try {
      const lastSyncDate = await AsyncStorage.getItem('@BuscaPreco:lastSync');
      setLastSync(lastSyncDate);
      
      // Inicializar o valor de lastSyncTimeRef.current
      if (lastSyncDate) {
        const date = new Date(lastSyncDate);
        lastSyncTimeRef.current = date.getTime();
      } else {
        lastSyncTimeRef.current = 0;
      }
    } catch (error) {
      console.error('Erro ao carregar data de sincronização:', error);
      lastSyncTimeRef.current = 0;
    }
  };

  // Formatar data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} às ${date.toLocaleTimeString()}`;
  };

  // Verificar conectividade
  const checkConnectivity = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      const forceOfflineMode = offlineModeConfig === 'true';
      
      setOffline(!netInfo.isConnected || forceOfflineMode);
    } catch (error) {
      console.error('Erro ao verificar conectividade:', error);
    }
  };

  // Animação de rotação para o ícone de sincronização
  const startRotation = () => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  // Parar a rotação
  const stopRotation = () => {
    rotation.stopAnimation();
    rotation.setValue(0);
  };

  // Estilo para aplicar a rotação
  const rotationStyle = {
    transform: [
      {
        rotate: rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  // Sincronizar produtos para uso offline
  const sincronizaOffline = async (isDisconnected: boolean) => {
    try {
      const data = await loadDataFromFile();
      if (data) {
        setProdutosOffline(data);
        setSincronized(true);
        console.log(`${data.length} produtos recuperados do armazenamento`);
      } else if (isDisconnected) {
        Alert.alert(
          'Erro',
          'Sem base de dados local para busca, por favor conecte-se à internet e reinicie o app para realizar a sincronização!'
        );
      }
    } catch (error) {
      console.error('Erro ao sincronizar offline:', error);
    }
  };

  // Sincronizar produtos com o servidor
  const sincronizar = async () => {
    try {
      setSyncing(true);
      startRotation();
      
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        Alert.alert('Erro', 'Sem conexão com a internet');
        setSyncing(false);
        stopRotation();
        return;
      }

      // Mostrar modal de progresso
      setSyncModalVisible(true);
      setSyncProgress(0);

      // Obter o ID do dispositivo
      const deviceId = await AsyncStorage.getItem('@BuscaPreco:deviceId');
      
      if (!deviceId) {
        Alert.alert('Erro', 'ID do dispositivo não encontrado');
        setSyncing(false);
        stopRotation();
        setSyncModalVisible(false);
        return;
      }

      // Iniciar simulação de progresso
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.05;
        setSyncProgress(Math.min(progress, 0.9));
        
        if (progress >= 1) {
          clearInterval(interval);
        }
      }, 200);

      // Usar método POST em vez de GET
      const response = await axios.post<RespostaProdutos>(
        `${apiUrl}/buscar_produto_database.php`,
        { codaparelho: deviceId }
      );

      // Limpar o intervalo e definir progresso como 100%
      clearInterval(interval);
      setSyncProgress(1);

      if (response.data.success) {
        const produtos = response.data.produtos;
        await saveDataToFile(produtos);
        setProdutosOffline(produtos);
        setSincronized(true);
        
        // Salvar a data da sincronização
        const now = new Date().toISOString();
        await AsyncStorage.setItem('@BuscaPreco:lastSync', now);
        setLastSync(now);
        lastSyncTimeRef.current = Date.now();
        
        // Fechar o modal após um breve atraso
        setTimeout(() => {
          setSyncing(false);
          stopRotation();
          setSyncModalVisible(false);
          Alert.alert('Sucesso', `${produtos.length} produtos sincronizados com sucesso`);
        }, 500);
      } else {
        setSyncing(false);
        stopRotation();
        setSyncModalVisible(false);
        Alert.alert('Erro', response.data.message || 'Não foi possível sincronizar os produtos');
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      setSyncing(false);
      stopRotation();
      setSyncModalVisible(false);
      Alert.alert('Erro', 'Não foi possível sincronizar os produtos');
    }
  };

  // Salvar dados em arquivo local
  const saveDataToFile = async (data: ProductType[]) => {
    try {
      const fileUri = FileSystem.documentDirectory + 'produtos.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
    }
  };

  // Carregar dados do arquivo local
  const loadDataFromFile = async (): Promise<ProductType[] | null> => {
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

  // Buscar produto pelo código de barras
  const searchProduct = async (codigodebarra: string) => {
    try {
      setBuscando(true);
      setProduct(null);
      console.log(`Buscando produto com código: ${codigodebarra}`);

      // Verificar configuração de modo offline
      const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      const forceOfflineMode = offlineModeConfig === 'true';
      
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || forceOfflineMode) {
        console.log('Modo offline ativado, buscando no cache local');
        // Modo offline - buscar no cache local
        if (produtosOffline.length > 0) {
          const codToSearch = codbarraManual || codigodebarra;
          console.log(`Buscando produto offline com código: ${codToSearch}`);
          const produtoEncontrado = produtosOffline.find(
            produto => produto.codauxiliar === codToSearch
          );
          
          if (produtoEncontrado) {
            console.log('Produto encontrado no cache local:', produtoEncontrado);
            setProduct(produtoEncontrado);
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
        setBuscando(false);
        return;
      }

      // Modo online - buscar na API
      const codToSearch = codbarraManual || codigodebarra;
      console.log(`Buscando produto online com código: ${codToSearch}`);
      
      // Obter o ID do dispositivo
      const id = await getDeviceId();
      if (!id) {
        Alert.alert('Erro', 'ID do dispositivo não encontrado');
        setBuscando(false);
        return;
      }
      
      console.log(`URL da requisição: ${apiUrl}/buscar_produto.php?codauxiliar=${codToSearch}&codaparelho=${id}`);
      
      const response = await axios.get<RespostaProdutos>(
        `${apiUrl}/buscar_produto.php?codauxiliar=${codToSearch}&codaparelho=${id}`
      );
      
      console.log('Resposta da API:', response.data);

      if (response.data.success && response.data.produtos && response.data.produtos.length > 0) {
        console.log('Produto encontrado na API:', response.data.produtos[0]);
        setProduct(response.data.produtos[0]);
      } else {
        console.log('Produto não encontrado na API');
        Alert.alert('Produto não encontrado', 'Verifique o código e tente novamente');
      }
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      Alert.alert('Erro', 'Não foi possível buscar o produto');
    } finally {
      setBuscando(false);
    }
  };

  // Abrir/fechar a câmera para buscar produto
  const requestSearch = () => {
    setSearch(!search);
    setCodBarra('');
    setCodBarraManual('');
    setCameraReady(!cameraReady);
  };

  // Abrir a câmera em um modal
  const abrirCamera = async () => {
    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Permissão necessária', 'É necessário permitir o acesso à câmera para escanear códigos de barras.');
        return;
      }
    }
    
    // Resetar estado de erro
    setCameraError(null);
    
    // Incrementar a key para forçar a recriação do componente da câmera
    cameraKey.current += 1;
    
    // Mostrar o modal primeiro
    setCameraModalVisible(true);
    
    // Aguardar a animação do modal antes de montar a câmera
    setTimeout(() => {
      setMountCamera(true);
    }, 300);
  };

  // Fechar o modal da câmera
  const fecharCamera = () => {
    // Desmontar a câmera primeiro
    setMountCamera(false);
    setCameraReady(false);
    
    // Aguardar um momento para garantir que a câmera seja desmontada
    setTimeout(() => {
      setCameraModalVisible(false);
    }, 100);
  };

  // Processar código de barras escaneado
  const scanned = (cod: string) => {
    console.log(`Código escaneado: ${cod}`);
    fecharCamera();
    searchProduct(cod);
  };

  // Buscar produto pelo código digitado manualmente
  const scannedManual = () => {
    if (codbarraManual) {
      searchProduct(codbarraManual);
    } else {
      Alert.alert('Erro', 'Digite um código de barras válido');
    }
  };

  // Voltar para o modo de câmera
  const voltarParaCamera = () => {
    console.log('Voltando para o modo de câmera');
    setProduct(null);
    setCodBarra('');
    setCodBarraManual('');
    
    // Abrir a câmera usando o novo método
    abrirCamera();
  };

  // Tentar reconectar a câmera em caso de erro
  const retryCamera = () => {
    setCameraError(null);
    
    // Incrementar a key para forçar a recriação do componente da câmera
    cameraKey.current += 1;
    
    // Desmontar e remontar a câmera
    setMountCamera(false);
    setTimeout(() => {
      setMountCamera(true);
    }, 500);
  };

  // Filtrar ofertas por descrição
  const handleFilter = (text: string) => {
    setStringFilter(text);
    if (offers) {
      const filtered = offers.filter((offer) =>
        offer.descricao.toLowerCase().includes(text.toLowerCase())
      );
      setOffersFiltered(filtered);
    }
  };

  // Mostrar modal de ofertas
  const handleShowOffers = async () => {
    try {
      setBuscando(true);
      
      // Carregar produtos do cache local
      const produtosCache = await loadDataFromFile();
      
      if (!produtosCache || produtosCache.length === 0) {
        Alert.alert("Atenção", "Não há produtos sincronizados. Sincronize os produtos primeiro.");
        setBuscando(false);
        return;
      }
      
      // Filtrar apenas os produtos em oferta (oferta_filiais_offers > 0)
      const produtosEmOferta = produtosCache.filter(produto => produto.oferta_filiais_offers > 0);
      
      if (produtosEmOferta.length === 0) {
        Alert.alert("Atenção", "Não há produtos em oferta disponíveis.");
        setBuscando(false);
        return;
      }
      
      // Ordenar por descrição
      produtosEmOferta.sort((a, b) => a.descricao.localeCompare(b.descricao));
      
      setOffers(produtosEmOferta);
      setOffersFiltered(produtosEmOferta);
      setStringFilter("");
      setModalVisible(true);
      
    } catch (error) {
      console.error('Erro ao carregar ofertas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as ofertas');
    } finally {
      setBuscando(false);
    }
  };

  // Voltar para a tela inicial
  const goBack = () => {
    navigation.navigate('Home' as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#f12b00" />
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Busca de Produtos</Text>
        
        <View style={styles.headerRightContainer}>
          {offline && (
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.offerButton}
            onPress={handleShowOffers}
          >
            <MaterialCommunityIcons
              name="sale"
              size={28}
              color="#fff"
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.syncButton}
            onPress={sincronizar}
            disabled={syncing}
          >
            <Animated.View style={syncing ? rotationStyle : undefined}>
              {syncing ? (
                <MaterialCommunityIcons
                  name="loading"
                  size={28}
                  color="#fff"
                />
              ) : (
                <MaterialCommunityIcons
                  name="download-circle-outline"
                  size={28}
                  color="#fff"
                />
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.container}>
        {/* Informação do Produto encontrado */}
        {product && (
          <>
            <View style={styles.infoContainer}>
              {product.oferta_filiais_offers > 0 && (
                <MaterialCommunityIcons
                  style={styles.offer}
                  name="sale"
                  size={50}
                  color="orange"
                />
              )}
              <Text
                style={styles.infoText}
              >{`Cod. Prod: ${product.codprod}`}</Text>
              <Text
                style={styles.infoText}
              >{`Cod. Ean: ${product.codauxiliar}`}</Text>
              <Text style={styles.infoTextDesc}>{product.descricao}</Text>
              <Text style={styles.priceText}>
                {formatCurrency(product.pvenda)}
              </Text>
              {product.descontofidelidade > 0 && (
                <View style={styles.infoContainerFidelidade}>
                  <Text style={styles.infoTextDescontoFidelidade}>
                    CLIENTE FIDELIDADE
                  </Text>
                  <Text style={styles.infoTextDescontoFidelidade}>
                    {formatCurrency(product.pvendafidelidade)}
                  </Text>
                </View>
              )}
              {product.oferta_filiais_offers > 0 && (
                <View style={styles.infoContainerOferta}>
                  <Text style={styles.infoTextDescontoOferta}>Em Oferta</Text>
                  <Text style={styles.infoTextDescontoOfertaPrice}>
                    {formatCurrency(product.oferta_filial_2)}
                  </Text>
                  {product.oferta_filiais_offers < 7 && (
                    <View style={styles.offerFiliaisContainer}>
                      <Text style={styles.offerFilaisTitle}>Filiais:</Text>
                      {product.oferta_filial_2 > 0 && (
                        <Text style={styles.offerFiliaisNumber}>2</Text>
                      )}
                      {product.oferta_filial_3 > 0 && (
                        <Text style={styles.offerFiliaisNumber}>3</Text>
                      )}
                      {product.oferta_filial_4 > 0 && (
                        <Text style={styles.offerFiliaisNumber}>4</Text>
                      )}
                      {product.oferta_filial_5 > 0 && (
                        <Text style={styles.offerFiliaisNumber}>5</Text>
                      )}
                      {product.oferta_filial_6 > 0 && (
                        <Text style={styles.offerFiliaisNumber}>6</Text>
                      )}
                      {product.oferta_filial_7 > 0 && (
                        <Text style={styles.offerFiliaisNumber}>7</Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.novaBuscaButton} onPress={voltarParaCamera}>
              <MaterialIcons name="camera-alt" size={20} color="#fff" />
              <Text style={styles.novaBuscaButtonText}>Nova Busca</Text>
            </TouchableOpacity>
          </>
        )}

        {buscando && (
          <View style={styles.infoContainerBuscando}>
            <ActivityIndicator size="large" color="#f12b00" />
            <Text style={styles.textInfoContainerBuscando}>Buscando...</Text>
          </View>
        )}

        {!product && !buscando && (
          <View style={styles.infoContainer}>
            <Text style={styles.productSearch}>
              DIGITE O CÓDIGO DE BARRAS PARA CONSULTAR.
            </Text>
          </View>
        )}

        {/* Input e botão para informar o código de barra manualmente */}
        {!product && !buscando && (
          <>
            <View style={styles.inputAndButtonContainer}>
              <TextInput
                style={styles.productSearchInput}
                placeholder="CÓDIGO DE BARRAS"
                value={codbarraManual}
                onChangeText={setCodBarraManual}
                keyboardType="number-pad"
                returnKeyType="search"
                onSubmitEditing={scannedManual}
                autoFocus={true}
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={scannedManual}
              >
                <MaterialIcons name="search" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.voltarCameraButton} onPress={abrirCamera}>
              <MaterialIcons name="camera-alt" size={20} color="#fff" />
              <Text style={styles.voltarCameraButtonText}>Usar Câmera</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Código do dispositivo discreto no rodapé */}
      <View style={styles.deviceIdContainer}>
        <Text style={styles.deviceIdText}>{deviceId ? deviceId.substring(0, 10) + '...' : ''}</Text>
      </View>

      {/* Modal da câmera */}
      <Modal
        visible={cameraModalVisible}
        animationType="slide"
        onRequestClose={fecharCamera}
        statusBarTranslucent={true}
      >
        <SafeAreaView style={styles.cameraModalContainer}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={fecharCamera} style={styles.cameraCloseButton}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Escanear código de barras</Text>
          </View>
          
          {permission?.granted && mountCamera ? (
            cameraError ? (
              <View style={styles.cameraErrorContainer}>
                <MaterialIcons name="error-outline" size={60} color="#f12b00" />
                <Text style={styles.cameraErrorText}>
                  Erro ao inicializar a câmera
                </Text>
                <Text style={styles.cameraErrorSubtext}>
                  {cameraError}
                </Text>
                <TouchableOpacity style={styles.cameraRetryButton} onPress={retryCamera}>
                  <Text style={styles.cameraRetryText}>Tentar Novamente</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <CameraView
                key={`camera-view-${cameraKey.current}`}
                style={styles.cameraFullScreen}
                autofocus="on"
                barcodeScannerSettings={{
                  barcodeTypes: ["ean8", "ean13"],
                }}
                onMountError={(error) => {
                  console.error('Erro ao montar a câmera:', error);
                  setCameraError(error.message || 'Erro desconhecido');
                  setCameraReady(false);
                }}
                onCameraReady={() => {
                  console.log('Camera está pronta');
                  setCameraReady(true);
                }}
                onBarcodeScanned={(e) => {
                  if (e.data && cameraReady) {
                    console.log(`Código de barras escaneado: ${e.data}`);
                    scanned(e.data);
                  }
                }}
              />
            )
          ) : (
            <View style={styles.cameraLoadingContainer}>
              <ActivityIndicator size="large" color="#f12b00" />
              <Text style={styles.cameraLoadingText}>
                {permission?.granted 
                  ? 'Ativando câmera...' 
                  : 'Permissão da câmera não concedida'}
              </Text>
            </View>
          )}
          
          {cameraReady && mountCamera && !cameraError && (
            <View style={styles.cameraGuide}>
              <View style={styles.cameraViewLine} />
              <Text style={styles.cameraGuideText}>
                Posicione o código de barras dentro da linha
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Modal de sincronização */}
      <Modal
        visible={syncModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !syncing && setSyncModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sincronizando produtos</Text>
            
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${syncProgress * 100}%` }]} />
            </View>
            
            <Text style={styles.progressText}>{Math.round(syncProgress * 100)}%</Text>
            {produtosOffline.length > 0 && syncProgress === 1 && (
              <Text style={styles.productCountText}>
                {produtosOffline.length} produtos baixados
              </Text>
            )}
            
            {syncing ? (
              <ActivityIndicator size="large" color="#f12b00" style={styles.modalActivity} />
            ) : (
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setSyncModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Fechar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de ofertas */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.headerModal}>
              <View style={styles.headerModal2}>
                <Text style={styles.modalTitle}>
                  PRODUTOS EM OFERTA:{" "}
                  {offersFiltered ? offersFiltered.length : offers?.length}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={30} color="#f12b00" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputAndButtonContainerOffersFilter}>
                <TextInput
                  style={styles.productSearchInput}
                  placeholder="FILTRAR PELA DESCRIÇÃO"
                  onChangeText={handleFilter}
                  value={stringFilter}
                  keyboardType="default"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <FlatList
              data={stringFilter.length ? offersFiltered : offers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.offerItem}
                  onPress={() => {
                    setProduct(item);
                    setModalVisible(false);
                  }}
                >
                  <View style={styles.offerItemHeader}>
                    <Text style={styles.offerItemCode}>Cod: {item.codprod}</Text>
                    <Text style={styles.offerItemEan}>EAN: {item.codauxiliar}</Text>
                  </View>
                  <Text style={styles.offerItemDesc}>{item.descricao}</Text>
                  
                  <View style={styles.offerItemPrices}>
                    <View style={styles.offerItemPriceContainer}>
                      <Text style={styles.offerItemPriceLabel}>Preço Normal:</Text>
                      <Text style={styles.offerItemPrice}>
                        {formatCurrency(item.pvenda)}
                      </Text>
                    </View>
                    
                    <View style={styles.offerItemPriceContainer}>
                      <Text style={styles.offerItemOfferLabel}>Preço Oferta:</Text>
                      <Text style={styles.offerItemOfferPrice}>
                        {formatCurrency(item.oferta_filial_2)}
                      </Text>
                    </View>
                  </View>
                  
                  {item.descontofidelidade > 0 && (
                    <View style={styles.offerItemFidelidade}>
                      <Text style={styles.offerItemFidelidadeLabel}>
                        Preço Fidelidade:
                      </Text>
                      <Text style={styles.offerItemFidelidadePrice}>
                        {formatCurrency(item.pvendafidelidade)}
                      </Text>
                    </View>
                  )}
                  
                  {item.oferta_filiais_offers < 7 && item.oferta_filiais_offers > 0 && (
                    <View style={styles.offerItemFiliais}>
                      <Text style={styles.offerItemFiliaisLabel}>Filiais:</Text>
                      <View style={styles.offerItemFiliaisNumbers}>
                        {item.oferta_filial_2 > 0 && (
                          <Text style={styles.offerItemFiliaisNumber}>2</Text>
                        )}
                        {item.oferta_filial_3 > 0 && (
                          <Text style={styles.offerItemFiliaisNumber}>3</Text>
                        )}
                        {item.oferta_filial_4 > 0 && (
                          <Text style={styles.offerItemFiliaisNumber}>4</Text>
                        )}
                        {item.oferta_filial_5 > 0 && (
                          <Text style={styles.offerItemFiliaisNumber}>5</Text>
                        )}
                        {item.oferta_filial_6 > 0 && (
                          <Text style={styles.offerItemFiliaisNumber}>6</Text>
                        )}
                        {item.oferta_filial_7 > 0 && (
                          <Text style={styles.offerItemFiliaisNumber}>7</Text>
                        )}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
    alignItems: 'center',
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
    padding: 5,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // Compensar o botão voltar
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineIndicator: {
    backgroundColor: '#ffcc00',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
  },
  offlineText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 12,
  },
  syncButton: {
    padding: 5,
  },
  infoContainer: {
    width: '90%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoContainerBuscando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInfoContainerBuscando: {
    marginTop: 15,
    fontSize: 18,
    color: '#555',
  },
  infoText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 5,
  },
  infoTextDesc: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 10,
  },
  priceText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f12b00',
    marginVertical: 5,
  },
  infoContainerFidelidade: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#e6f7f6',
    borderRadius: 5,
    alignItems: 'center',
  },
  infoTextDescontoFidelidade: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'rgb(7, 150, 143)',
    marginVertical: 2,
  },
  infoContainerOferta: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#fff9e6',
    borderRadius: 5,
    alignItems: 'center',
  },
  infoTextDescontoOferta: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'orange',
  },
  infoTextDescontoOfertaPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'orange',
    marginVertical: 5,
  },
  offerFiliaisContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
    padding: 8,
  },
  offerFilaisTitle: {
    fontWeight: 'bold',
    color: 'orange',
    marginRight: 5,
  },
  offerFiliaisNumber: {
    color: 'orange',
    marginHorizontal: 3,
    fontWeight: 'bold',
  },
  offer: {
    position: 'absolute',
    top: -15,
    right: -15,
    zIndex: 1,
  },
  productSearch: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
  },
  inputAndButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    marginVertical: 20,
  },
  productSearchInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
  },
  searchButton: {
    width: 50,
    height: 50,
    backgroundColor: '#f12b00',
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    width: '90%',
    aspectRatio: 1,
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraView: {
    width: '100%',
    height: '100%',
  },
  cameraViewLine: {
    width: '80%',
    height: 2,
    backgroundColor: '#f12b00',
  },
  requestPermissionButton: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f12b00',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  textRequestPermissionButton: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 16,
  },
  buttonBuscarProduto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f12b00',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  textButtonBuscarProduto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  deviceIdContainer: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'transparent',
  },
  deviceIdText: {
    fontSize: 8,
    color: '#cccccc',
    opacity: 0.5,
  },
  // Estilos para o modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#f12b00',
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: 'bold',
  },
  productCountText: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
  modalActivity: {
    marginTop: 16,
  },
  modalButton: {
    backgroundColor: '#f12b00',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 5,
    marginTop: 16,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  novaBuscaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f12b00',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    width: '90%',
  },
  novaBuscaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  entradaManualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#555',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    width: '90%',
  },
  entradaManualButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  voltarCameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f12b00',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    width: '90%',
  },
  voltarCameraButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  offerButton: {
    padding: 5,
    marginRight: 10,
  },
  headerModal: {
    marginBottom: 15,
  },
  headerModal2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputAndButtonContainerOffersFilter: {
    marginTop: 15,
  },
  offerItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#f12b00',
  },
  offerItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  offerItemCode: {
    fontSize: 14,
    color: '#777',
  },
  offerItemEan: {
    fontSize: 14,
    color: '#777',
  },
  offerItemDesc: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 5,
  },
  offerItemPrices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  offerItemPriceContainer: {
    alignItems: 'flex-start',
  },
  offerItemPriceLabel: {
    fontSize: 12,
    color: '#777',
  },
  offerItemPrice: {
    fontSize: 16,
    color: '#777',
    textDecorationLine: 'line-through',
  },
  offerItemOfferLabel: {
    fontSize: 12,
    color: '#f12b00',
    fontWeight: 'bold',
  },
  offerItemOfferPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f12b00',
  },
  offerItemFidelidade: {
    marginTop: 8,
    padding: 5,
    backgroundColor: '#e6f7f6',
    borderRadius: 4,
  },
  offerItemFidelidadeLabel: {
    fontSize: 12,
    color: 'rgb(7, 150, 143)',
  },
  offerItemFidelidadePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'rgb(7, 150, 143)',
  },
  offerItemFiliais: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerItemFiliaisLabel: {
    fontSize: 12,
    color: '#FF8C00',
    marginRight: 5,
  },
  offerItemFiliaisNumbers: {
    flexDirection: 'row',
  },
  offerItemFiliaisNumber: {
    fontSize: 12,
    color: '#FF8C00',
    fontWeight: 'bold',
    marginHorizontal: 2,
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  // Novos estilos para o modal da câmera
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  cameraCloseButton: {
    padding: 8,
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 16,
  },
  cameraFullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  cameraLoadingText: {
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
    fontSize: 16,
  },
  cameraErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  cameraErrorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  cameraErrorSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    marginBottom: 30,
  },
  cameraRetryButton: {
    backgroundColor: '#f12b00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  cameraRetryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraGuide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  cameraViewLine: {
    width: '80%',
    height: 2,
    backgroundColor: '#f12b00',
  },
  cameraGuideText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
    marginTop: 20,
  },
});

export default ProductSearchScreen; 