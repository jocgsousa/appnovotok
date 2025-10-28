import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import NetInfo from "@react-native-community/netinfo";
import {
  View,
  SafeAreaView,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  Modal,
  ActivityIndicator,
  StatusBar,
  Platform,
  AppState,
  ScrollView,
  Image,
  Dimensions,
  FlatList,
  Linking,
  PermissionsAndroid
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MaterialIcons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import { useAuth } from "../contexts/AuthContext";
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { buscarPermissoes, getPermissoesLocais, verificarPermissao } from '../services/permissoesService';

// Configurar o comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  }),
});

// Tipos de dados
type ProducType = {
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
  produtos: ProducType[];
};

// Adicionar tipos para resposta de manutenção
type RespostaManutencao = {
  success: boolean;
  manutencao: number;
  tipo_manutencao: string;
  mensagem: string;
  data_inicio: string | null;
  data_fim: string | null;
};

// Adicionar tipos para informativos
type Imagem = {
  id: string | number;
  imagem: string;
  tipo_imagem: string;
  descricao: string;
  ordem?: number;
};

type Informativo = {
  id: string | number;
  titulo: string;
  texto: string;
  data: string;
  ativo?: number;
  created_at?: string;
  updated_at?: string;
  imagens: Imagem[];
};

// Tipo para resposta de verificação de versão
type RespostaVerificacaoVersao = {
  success: boolean;
  tem_atualizacao: boolean;
  versao_disponivel?: string;
  titulo?: string;
  descricao?: string;
  link_download?: string;
  obrigatoria?: boolean;
  mensagem?: string;
};

// Função para formatar valores monetários
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Definir interface para as permissões
interface PermissoesFuncionalidades {
  orcamentos: boolean;
  minhas_vendas: boolean;
  minhas_metas: boolean;
  informativos: boolean;
  buscar_produto: boolean;
  ofertas: boolean;
  clientes: boolean;
}

// Função para verificar e solicitar permissões do sistema
const verificarPermissoesSistema = async () => {
  if (Platform.OS === 'android') {
    try {
      // Solicitar permissões diretamente
      const camera = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      
      const readStorage = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      
      const writeStorage = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );
      
      // Verificar quais permissões não foram concedidas
      const permissoesNegadas = [];
      
      if (camera !== 'granted') {
        permissoesNegadas.push('Câmera');
      }
      
      if (readStorage !== 'granted') {
        permissoesNegadas.push('Leitura de Armazenamento');
      }
      
      if (writeStorage !== 'granted') {
        permissoesNegadas.push('Escrita de Armazenamento');
      }
      
      // Registrar permissões não concedidas
      if (permissoesNegadas.length > 0) {
        console.log('Permissões não concedidas:', permissoesNegadas);
      } else {
        console.log('Todas as permissões necessárias foram concedidas');
      }
    } catch (error) {
      console.error('Erro ao verificar permissões do sistema:', error);
    }
  }
};

const HomeScreen = () => {
  const { apiUrl, user, getDeviceId } = useAuth();
  const navigation = useNavigation();
  const [search, setSearch] = useState<boolean>(false);
  const [codbarra, setCodBarra] = useState<string>("");
  const [codbarraManual, setCodBarraManual] = useState<string>("");
  const [product, setProduct] = useState<ProducType | null>(null);
  const [buscando, setBuscando] = useState<boolean>(false);
  const [offline, setOffline] = useState<boolean | null>(false);
  const animatedValue = useState(new Animated.Value(0))[0];
  const [sincronized, setSincronized] = useState<boolean>(false);
  const [produtosOffline, setProdutosOffline] = useState<ProducType[]>();
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [manutencao, setManutencao] = useState<number>(0);
  // Novos estados para informações de manutenção
  const [tipoManutencao, setTipoManutencao] = useState<string>('geral');
  const [mensagemManutencao, setMensagemManutencao] = useState<string>('');
  const [dataInicioManutencao, setDataInicioManutencao] = useState<string | null>(null);
  const [dataFimManutencao, setDataFimManutencao] = useState<string | null>(null);
  // Novo estado para o modal de manutenção
  const [manutencaoModalVisible, setManutencaoModalVisible] = useState<boolean>(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [deviceId, setDeviceId] = useState<string>("");
  // Novos estados para o modal de progresso
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncInterval, setSyncInterval] = useState<string>('60');
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastSyncTimeRef = useRef<number>(0);

  // Novos estados para o carrossel de informativos
  const [informativos, setInformativos] = useState<Informativo[]>([]);
  const [carregandoInformativos, setCarregandoInformativos] = useState<boolean>(true);
  const [atualizandoInformativos, setAtualizandoInformativos] = useState<boolean>(false);
  const [temNovosInformativos, setTemNovosInformativos] = useState<boolean>(false);
  const [currentInformativoIndex, setCurrentInformativoIndex] = useState<number>(0);
  const flatListRef = useRef<FlatList>(null);
  const carouselInterval = useRef<NodeJS.Timeout | null>(null);
  const { width } = Dimensions.get('window');
  
  // Referência para armazenar o último ID de informativo visto
  const ultimoInformativoIdRef = useRef<string | number>('0');
  // Intervalo para verificação de novos informativos
  const verificacaoInformativosInterval = useRef<NodeJS.Timeout | null>(null);

  // Novos estados para verificação de versão
  const [atualizacaoDisponivel, setAtualizacaoDisponivel] = useState<boolean>(false);
  const [versaoDisponivel, setVersaoDisponivel] = useState<string>('');
  const [tituloAtualizacao, setTituloAtualizacao] = useState<string>('');
  const [descricaoAtualizacao, setDescricaoAtualizacao] = useState<string>('');
  const [linkDownload, setLinkDownload] = useState<string>('');
  const [atualizacaoObrigatoria, setAtualizacaoObrigatoria] = useState<boolean>(false);
  const [atualizacaoModalVisible, setAtualizacaoModalVisible] = useState<boolean>(false);
  
  // Novo estado para as permissões de funcionalidades com tipagem correta
  const [permissoes, setPermissoes] = useState<PermissoesFuncionalidades>({
    orcamentos: true,
    minhas_vendas: true,
    minhas_metas: true,
    informativos: true,
    buscar_produto: true,
    ofertas: true,
    clientes: true
  });
  const [carregandoPermissoes, setCarregandoPermissoes] = useState<boolean>(false);
  const [permissoesErro, setPermissoesErro] = useState<string | null>(null);
  
  // Estado para o modal de funcionalidade não disponível
  const [funcionalidadeNaoDisponivel, setFuncionalidadeNaoDisponivel] = useState<string | null>(null);

  // Verificar atualizações disponíveis
  const verificarAtualizacoes = async () => {
    try {
      // Verificar conectividade
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('Sem conexão com a internet. Verificação de atualização ignorada.');
        return;
      }
      
      // Obter a versão atual do app
      const versaoAtual = Constants.expoConfig?.version || '1.0.0';
      console.log(`Verificando atualizações. Versão atual do app: ${versaoAtual}`);
      
      // Fazer requisição à API
      console.log(`Chamando API para verificar atualizações: ${apiUrl}/verificar_atualizacao.php?versao_atual=${versaoAtual}`);
      const response = await axios.get<RespostaVerificacaoVersao>(
        `${apiUrl}/verificar_atualizacao.php?versao_atual=${versaoAtual}`
      );
      
      console.log('Resposta da verificação de versão:', JSON.stringify(response.data));
      
      if (response.data.success) {
        if (response.data.tem_atualizacao) {
          console.log(`Atualização disponível: ${response.data.versao_disponivel}`);
          setAtualizacaoDisponivel(true);
          setVersaoDisponivel(response.data.versao_disponivel || '');
          setTituloAtualizacao(response.data.titulo || '');
          setDescricaoAtualizacao(response.data.descricao || '');
          setLinkDownload(response.data.link_download || '');
          setAtualizacaoObrigatoria(response.data.obrigatoria || false);
          
          // Mostrar modal de atualização
          setAtualizacaoModalVisible(true);
        } else {
          console.log('Nenhuma atualização disponível.');
          setAtualizacaoDisponivel(false);
          setAtualizacaoModalVisible(false);
        }
      } else {
        console.error('Erro na resposta da API:', response.data.mensagem);
      }
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
      // Se houver erro, tentar novamente após um tempo
      setTimeout(() => {
        console.log('Tentando verificar atualizações novamente após erro...');
        verificarAtualizacoes();
      }, 30000); // Tentar novamente após 30 segundos
    }
  };
  
  // Função para abrir o link de download
  const abrirLinkDownload = async () => {
    if (linkDownload) {
      try {
        const supported = await Linking.canOpenURL(linkDownload);
        
        if (supported) {
          await Linking.openURL(linkDownload);
        } else {
          Alert.alert(
            'Erro',
            'Não foi possível abrir o link de download'
          );
        }
      } catch (error) {
        console.error('Erro ao abrir link de download:', error);
        Alert.alert(
          'Erro',
          'Não foi possível abrir o link de download'
        );
      }
    }
  };

  // Verificar o status do sistema ao iniciar
  useEffect(() => {
    const inicializarApp = async () => {
      try {
        console.log('Inicializando aplicativo...');
        // Verificar permissões do sistema
        await verificarPermissoesSistema();
        
        // Já inicializamos com permissões padrão no estado, não precisamos definir novamente
        
        // Carregar permissões locais em segundo plano
        getPermissoesLocais().then(permissoesLocais => {
          if (permissoesLocais) {
            setPermissoes(permissoesLocais as PermissoesFuncionalidades);
          }
        });
        
        // Inicializar outros recursos em paralelo
        Promise.all([
          sincronizaOffline(false),
          loadDeviceId(),
          loadOfflineModeSetting(),
          loadSyncSettings(),
          loadLastSyncDate(),
          carregarUltimoInformativoId()
        ]).then(() => {
          // Carregar informativos separadamente para evitar bloqueios
          carregarInformativos();
          
          // Verificar e atualizar permissões da API em segundo plano
          NetInfo.fetch().then(state => {
            if (state.isConnected) {
              verificarEAtualizarPermissoes();
            } else {
              console.log('Offline: não será feita atualização de permissões da API');
            }
          });
        });

        // Verificar status do sistema e atualizações separadamente para garantir que sejam executados
        console.log('Verificando status do sistema e atualizações...');
        await verificarStatusDoSistema();
        await verificarAtualizacoes();
      } catch (error) {
        console.error('Erro ao inicializar o app:', error);
      }
    };
    
    inicializarApp();
    
    // Configurar verificação periódica de novos informativos (a cada 60 segundos)
    verificacaoInformativosInterval.current = setInterval(() => {
      verificarNovosInformativos();
    }, 60 * 1000); // Aumentado para 60 segundos para reduzir chamadas à API
    
    // Configurar verificação periódica de status do sistema e atualizações (a cada 5 minutos)
    const verificacaoSistemaInterval = setInterval(() => {
      console.log('Verificação periódica de status do sistema e atualizações...');
      verificarStatusDoSistema();
      verificarAtualizacoes();
    }, 5 * 60 * 1000); // A cada 5 minutos
    
    // Monitorar mudanças na conexão
    const unsubscribe = NetInfo.addEventListener(state => {
      checkConnectivity();
      if (!state.isConnected) {
        sincronizaOffline(true);
      } else {
        // Se a conexão foi restaurada, verificar permissões e status do sistema
        verificarEAtualizarPermissoes();
        verificarStatusDoSistema();
        verificarAtualizacoes();
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
        
        // Verificar status do sistema e atualizações quando o app volta ao primeiro plano
        verificarStatusDoSistema();
        verificarAtualizacoes();
        
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

    return () => {
      unsubscribe();
      clearInterval(intervalId);
      clearInterval(verificacaoSistemaInterval);
      appStateSubscription.remove();
      // Limpar o intervalo de sincronização quando o componente for desmontado
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      
      // Limpar o intervalo de verificação de informativos
      if (verificacaoInformativosInterval.current) {
        clearInterval(verificacaoInformativosInterval.current);
      }
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

  // Configurar o carrossel automático
  useEffect(() => {
    // Só iniciar o carrossel se houver mais de um informativo
    if (informativos && Array.isArray(informativos) && informativos.length > 1) {
      // Reiniciar o índice do carrossel quando os informativos forem atualizados
      setCurrentInformativoIndex(0);
      // Rolar para o primeiro item
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
      // Iniciar o intervalo do carrossel
      startCarouselInterval();
    }
    
    return () => {
      if (carouselInterval.current) {
        clearInterval(carouselInterval.current);
      }
    };
  }, [informativos]);

  // Atualizar o tempo restante a cada minuto
  useEffect(() => {
    if (manutencao === 1 && dataFimManutencao) {
      const interval = setInterval(() => {
        // Forçar atualização do componente
        setCurrentInformativoIndex(prev => prev);
      }, 60000); // Atualiza a cada 1 minuto
      
      return () => clearInterval(interval);
    }
  }, [manutencao, dataFimManutencao]);

  // Função para iniciar o intervalo do carrossel
  const startCarouselInterval = () => {
    if (carouselInterval.current) {
      clearInterval(carouselInterval.current);
    }
    
    // Verificar se há informativos suficientes para fazer o carrossel
    if (!informativos || !Array.isArray(informativos) || informativos.length <= 1) {
      return;
    }
    
    carouselInterval.current = setInterval(() => {
      const nextIndex = (currentInformativoIndex + 1) % informativos.length;
      setCurrentInformativoIndex(nextIndex);
      
      // Rolar para o próximo item
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
        viewPosition: 0.5,
        viewOffset: 0,
      });
    }, 5000); // 5 segundos
  };

  // Função para carregar informativos da API
  const carregarInformativos = async () => {
    try {
      // Não mostrar indicador de carregamento para evitar flash na tela
      // setCarregandoInformativos(true);
      
      // Verificar conectividade
      const netInfo = await NetInfo.fetch();
      const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      const forceOfflineMode = offlineModeConfig === 'true';
      
      if (!netInfo.isConnected || forceOfflineMode) {
        // Não limpar informativos para evitar flash na tela
        // setInformativos([]);
        setCarregandoInformativos(false);
        return;
      }
      
      // Fazer requisição à API
      console.log('Carregando informativos da API...');
      const response = await axios.get(`${apiUrl}/informativos/listar_informativos.php`);
      
      if (response.data.success && response.data.informativos) {
        // Filtrar apenas informativos ativos e limitar a 5 itens
        const informativosAtivos = response.data.informativos
          .filter((item: Informativo) => item.ativo === 1)
          .slice(0, 5);
          
        console.log(`Informativos carregados: ${informativosAtivos.length}`);
        setInformativos(informativosAtivos);
        
        // Se houver informativos, salvar o ID do mais recente
        if (informativosAtivos.length > 0) {
          // Ordenar informativos por ID (assumindo que IDs maiores são mais recentes)
          const informativosOrdenados = [...informativosAtivos].sort((a, b) => {
            const idA = typeof a.id === 'string' ? parseInt(a.id) : a.id as number;
            const idB = typeof b.id === 'string' ? parseInt(b.id) : b.id as number;
            return idB - idA;
          });
          
          const idMaisRecente = informativosOrdenados[0].id;
          await salvarUltimoInformativoId(idMaisRecente);
        }
      } else {
        // Garantir que mesmo em caso de erro, o estado de carregamento seja desativado
        console.log('Nenhum informativo encontrado ou erro na resposta da API');
        // Não limpar informativos para evitar flash na tela
        // setInformativos([]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar informativos:', error);
      // Garantir que mesmo em caso de erro, o estado de carregamento seja desativado
      // Não limpar informativos para evitar flash na tela
      // setInformativos([]);
    } finally {
      setCarregandoInformativos(false);
    }
  };

  // Função para lidar com o scroll do carrossel
  const handleCarouselScroll = (event: any) => {
    if (!informativos || !Array.isArray(informativos) || informativos.length <= 1) return;
    
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    
    if (index >= 0 && index < informativos.length && index !== currentInformativoIndex) {
      setCurrentInformativoIndex(index);
      
      // Reiniciar o intervalo quando o usuário navega manualmente
      startCarouselInterval();
    }
  };

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
      const checkOfflineMode = async () => {
        await checkConnectivity();
        await loadLastSyncDate();
      };
      
      checkOfflineMode();
      return () => {};
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
      console.error("Erro ao carregar ID do dispositivo:", error);
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
      console.error("Erro ao carregar configuração de modo offline:", error);
    }
  };

  // Verificar conectividade
  const checkConnectivity = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      const forceOfflineMode = offlineModeConfig === 'true';
      
      setOffline(!netInfo.isConnected || forceOfflineMode);
    } catch (error) {
      console.error("Erro ao verificar conectividade:", error);
    }
  };

  // Verificar se o sistema está em manutenção
  const verificarStatusDoSistema = async () => {
    try {
      // Verificar conectividade
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('Sem conexão com a internet. Verificação de manutenção ignorada.');
        return;
      }
      
      console.log(`Chamando API para verificar status de manutenção: ${apiUrl}/manutencao.php`);
      const response = await axios.get<RespostaManutencao>(`${apiUrl}/manutencao.php`);
      console.log('Resposta da verificação de manutenção:', JSON.stringify(response.data));
      
      setManutencao(response.data.manutencao);
      
      // Armazenar informações adicionais sobre a manutenção
      if (response.data.manutencao === 1) {
        console.log('Sistema em manutenção. Exibindo modal de manutenção.');
        const tipo = response.data.tipo_manutencao || 'geral';
        const mensagem = response.data.mensagem || '';
        const dataInicio = response.data.data_inicio || null;
        const dataFim = response.data.data_fim || null;
        
        setTipoManutencao(tipo);
        setMensagemManutencao(mensagem);
        setDataInicioManutencao(dataInicio);
        setDataFimManutencao(dataFim);
        
        await AsyncStorage.setItem('@BuscaPreco:manutencaoTipo', tipo);
        await AsyncStorage.setItem('@BuscaPreco:manutencaoMensagem', mensagem);
        
        if (dataInicio) {
          await AsyncStorage.setItem('@BuscaPreco:manutencaoDataInicio', dataInicio);
        } else {
          await AsyncStorage.removeItem('@BuscaPreco:manutencaoDataInicio');
        }
        
        if (dataFim) {
          await AsyncStorage.setItem('@BuscaPreco:manutencaoDataFim', dataFim);
        } else {
          await AsyncStorage.removeItem('@BuscaPreco:manutencaoDataFim');
        }
        
        // Mostrar modal de manutenção
        setManutencaoModalVisible(true);
      } else {
        console.log('Sistema operacional. Não há manutenção ativa.');
        setTipoManutencao('geral');
        setMensagemManutencao('');
        setDataInicioManutencao(null);
        setDataFimManutencao(null);
        
        await AsyncStorage.removeItem('@BuscaPreco:manutencaoTipo');
        await AsyncStorage.removeItem('@BuscaPreco:manutencaoMensagem');
        await AsyncStorage.removeItem('@BuscaPreco:manutencaoDataInicio');
        await AsyncStorage.removeItem('@BuscaPreco:manutencaoDataFim');
        
        // Garantir que o modal de manutenção está fechado
        setManutencaoModalVisible(false);
      }
    } catch (error: any) {
      console.error("Erro ao verificar status do sistema:", error);
      
      // Tentar carregar do AsyncStorage em caso de falha na API
      try {
        if (await AsyncStorage.getItem('@BuscaPreco:manutencaoTipo')) {
          console.log('Carregando dados de manutenção do armazenamento local.');
          setTipoManutencao(await AsyncStorage.getItem('@BuscaPreco:manutencaoTipo') || 'geral');
          setMensagemManutencao(await AsyncStorage.getItem('@BuscaPreco:manutencaoMensagem') || '');
          setDataInicioManutencao(await AsyncStorage.getItem('@BuscaPreco:manutencaoDataInicio'));
          setDataFimManutencao(await AsyncStorage.getItem('@BuscaPreco:manutencaoDataFim'));
          
          // Mostrar modal de manutenção se houver dados no storage
          setManutencaoModalVisible(true);
        }
      } catch (err) {
        console.error("Erro ao carregar dados de manutenção do armazenamento local:", err);
      }
      
      // Se houver erro, tentar novamente após um tempo
      setTimeout(() => {
        console.log('Tentando verificar status do sistema novamente após erro...');
        verificarStatusDoSistema();
      }, 30000); // Tentar novamente após 30 segundos
    }
  };

  // Animação de rotação para o ícone de sincronização
  const startRotation = () => {
    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      if (syncing) startRotation();
    });
  };

  const rotationStyle = {
    transform: [
      {
        rotate: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        }),
      },
    ],
  };

  // Sincronizar produtos para uso offline
  const sincronizaOffline = async (isDisconected: boolean) => {
    try {
      await checkConnectivity();

      if (!offline || !isDisconected) {
        const data = await loadDataFromFile();
        if (data) {
          setProdutosOffline(data);
          setSincronized(true);
        }
      }
    } catch (error) {
      console.error("Erro ao sincronizar offline:", error);
    }
  };

  // Sincronizar produtos com o servidor
  const sincronizar = async () => {
    try {
      setSyncing(true);
      startRotation();
      const netInfo = await NetInfo.fetch();

      if (!netInfo.isConnected) {
        Alert.alert("Erro", "Sem conexão com a internet");
        setSyncing(false);
        return;
      }

      // Mostrar modal de progresso
      setSyncModalVisible(true);
      setSyncProgress(0);

      // Obter o ID do dispositivo
      const deviceId = await AsyncStorage.getItem('@BuscaPreco:deviceId');
      
      if (!deviceId) {
        Alert.alert("Erro", "ID do dispositivo não encontrado");
        setSyncing(false);
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
          setSyncModalVisible(false);
          Alert.alert("Sucesso", `${produtos.length} produtos sincronizados com sucesso`);
        }, 500);
      } else {
        setSyncing(false);
        setSyncModalVisible(false);
        Alert.alert("Erro", response.data.message);
      }
    } catch (error: any) {
      console.error("Erro ao sincronizar:", error);
      setSyncing(false);
      setSyncModalVisible(false);
      Alert.alert("Erro", error.response?.data?.message || "Não foi possível sincronizar os produtos");
    }
  };

  // Salvar dados em arquivo local
  const saveDataToFile = async (data: ProducType[]) => {
    try {
      const fileUri = FileSystem.documentDirectory + "produtos.json";
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data));
    } catch (error) {
      console.error("Erro ao salvar dados:", error);
    }
  };

  // Carregar dados do arquivo local
  const loadDataFromFile = async (): Promise<ProducType[] | null> => {
    try {
      const fileUri = FileSystem.documentDirectory + "produtos.json";
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (fileInfo.exists) {
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        return JSON.parse(fileContent);
      }
      return null;
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
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
        if (produtosOffline) {
          const produtoEncontrado = produtosOffline.find(
            (produto) => produto.codauxiliar === codigodebarra
          );
          
          if (produtoEncontrado) {
            console.log('Produto encontrado no cache local:', produtoEncontrado);
            setProduct(produtoEncontrado);
          } else {
            console.log('Produto não encontrado no cache local');
            Alert.alert("Produto não encontrado", "Verifique o código e tente novamente");
          }
        } else {
          console.log('Sem produtos sincronizados no cache local');
          Alert.alert(
            "Sem conexão",
            "Você está offline e não tem produtos sincronizados"
          );
        }
        setBuscando(false);
        return;
      }

      // Modo online - buscar na API
      console.log(`Buscando produto online com código: ${codigodebarra}`);
      
      // Obter o ID do dispositivo
      const id = await getDeviceId();
      if (!id) {
        Alert.alert('Erro', 'ID do dispositivo não encontrado');
        setBuscando(false);
        return;
      }
      
      console.log(`URL da requisição: ${apiUrl}/buscar_produto.php?codauxiliar=${codigodebarra}&codaparelho=${id}`);
      
      const response = await axios.get<RespostaProdutos>(
        `${apiUrl}/buscar_produto.php?codauxiliar=${codigodebarra}&codaparelho=${id}`
      );
      
      console.log('Resposta da API:', response.data);

      if (response.data.success && response.data.produtos && response.data.produtos.length > 0) {
        console.log('Produto encontrado na API:', response.data.produtos[0]);
        setProduct(response.data.produtos[0]);
      } else {
        console.log('Produto não encontrado na API');
        Alert.alert("Produto não encontrado", "Verifique o código e tente novamente");
      }
    } catch (error) {
      console.error("Erro ao buscar produto:", error);
      Alert.alert("Erro", "Não foi possível buscar o produto");
    } finally {
      setBuscando(false);
    }
  };

  // Abrir/fechar a câmera para buscar produto
  const requestSearch = () => {
    setSearch(!search);
    setCodBarra("");
    setCodBarraManual("");
  };

  // Processar código de barras escaneado
  const scanned = (cod: string) => {
    setCodBarra(cod);
    searchProduct(cod);
  };

  // Buscar produto pelo código digitado manualmente
  const scannedManual = () => {
    if (codbarraManual) {
      searchProduct(codbarraManual);
    }
  };

  // Removida a função handleFilter

  // Removida a função handleShowOffers

  // Navegar para a tela de busca de produtos
  const navigateToProductSearch = () => {
    if (permissoes && verificarPermissao(permissoes, 'buscar_produto')) {
      navigation.navigate('ProductSearch' as never);
    } else {
      setFuncionalidadeNaoDisponivel('Buscar Produto');
    }
  };

  // Funções para navegar para as novas telas
  const navigateToOrcamentos = () => {
    if (permissoes && verificarPermissao(permissoes, 'orcamentos')) {
      navigation.navigate('Orcamentos' as never);
    } else {
      setFuncionalidadeNaoDisponivel('Orçamentos');
    }
  };

  const navigateToMinhasVendas = () => {
    if (permissoes && verificarPermissao(permissoes, 'minhas_vendas')) {
      navigation.navigate('MinhasVendas' as never);
    } else {
      setFuncionalidadeNaoDisponivel('Minhas Vendas');
    }
  };

  const navigateToInformativos = () => {
    if (permissoes && verificarPermissao(permissoes, 'informativos')) {
      // Resetar o indicador de novos informativos
      setTemNovosInformativos(false);
      navigation.navigate('Informativos' as never);
    } else {
      setFuncionalidadeNaoDisponivel('Informativos');
    }
  };

  const navigateToMetas = () => {
    if (permissoes && verificarPermissao(permissoes, 'minhas_metas')) {
      navigation.navigate('Metas' as never);
    } else {
      setFuncionalidadeNaoDisponivel('Minhas Metas');
    }
  };
  
  // Novas funções de navegação
  const navigateToOfertas = () => {
    if (permissoes && verificarPermissao(permissoes, 'ofertas')) {
      navigation.navigate('Offers' as never);
    } else {
      setFuncionalidadeNaoDisponivel('Ofertas');
    }
  };
  
  const navigateToClientes = () => {
    if (permissoes && verificarPermissao(permissoes, 'clientes')) {
      navigation.navigate('NewClient' as never);
    } else {
      setFuncionalidadeNaoDisponivel('Clientes');
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

  // Formatar data de manutenção de forma mais amigável
  const formatarDataManutencao = (dataString: string | null): string => {
    if (!dataString) return '';
    
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calcular tempo restante até o fim da manutenção
  const calcularTempoRestante = (): string => {
    if (!dataFimManutencao) return '';
    
    const agora = new Date();
    const fimManutencao = new Date(dataFimManutencao);
    
    if (agora >= fimManutencao) {
      return 'Prazo encerrado';
    }
    
    const diferencaMs = fimManutencao.getTime() - agora.getTime();
    const horas = Math.floor(diferencaMs / (1000 * 60 * 60));
    const minutos = Math.floor((diferencaMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (horas > 24) {
      const dias = Math.floor(horas / 24);
      return `${dias} dia${dias > 1 ? 's' : ''} restante${dias > 1 ? 's' : ''}`;
    }
    
    if (horas > 0) {
      return `${horas}h ${minutos}min restantes`;
    }
    
    return `${minutos} minuto${minutos > 1 ? 's' : ''} restante${minutos > 1 ? 's' : ''}`;
  };

  // Obter o ícone e cor para o tipo de manutenção
  const getManutencaoInfo = () => {
    switch (tipoManutencao) {
      case 'correcao_bugs':
        return { 
          icon: 'bug' as const, 
          color: '#dc3545',
          title: 'Correção de Bugs'
        };
      case 'atualizacao':
        return { 
          icon: 'update' as const, 
          color: '#007bff',
          title: 'Atualização do Sistema'
        };
      case 'melhoria_performance':
        return { 
          icon: 'flash' as const, 
          color: '#28a745',
          title: 'Melhoria de Performance'
        };
      case 'backup':
        return { 
          icon: 'database' as const, 
          color: '#17a2b8',
          title: 'Backup do Sistema'
        };
      case 'outro':
        return { 
          icon: 'information' as const, 
          color: '#ffc107',
          title: 'Manutenção'
        };
      default:
        return { 
          icon: 'tools' as const, 
          color: '#6c757d',
          title: 'Manutenção Geral'
        };
    }
  };

  // Carregar o último ID de informativo visto do AsyncStorage
  const carregarUltimoInformativoId = async () => {
    try {
      const ultimoId = await AsyncStorage.getItem('@BuscaPreco:ultimoInformativoId');
      if (ultimoId) {
        ultimoInformativoIdRef.current = ultimoId;
      }
    } catch (error) {
      console.error('Erro ao carregar último ID de informativo:', error);
    }
  };

  // Salvar o último ID de informativo visto no AsyncStorage
  const salvarUltimoInformativoId = async (id: string | number) => {
    try {
      await AsyncStorage.setItem('@BuscaPreco:ultimoInformativoId', id.toString());
      ultimoInformativoIdRef.current = id;
    } catch (error) {
      console.error('Erro ao salvar último ID de informativo:', error);
    }
  };

  // Verificar se existem novos informativos
  const verificarNovosInformativos = async () => {
    try {
      // Evitar verificações simultâneas
      if (atualizandoInformativos) {
        console.log('Verificação de informativos já em andamento, ignorando...');
        return;
      }
      
      // Verificar conectividade
      const netInfo = await NetInfo.fetch();
      const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      const forceOfflineMode = offlineModeConfig === 'true';
      
      if (!netInfo.isConnected || forceOfflineMode) {
        return;
      }
      
      console.log('Verificando novos informativos...');
      setAtualizandoInformativos(true);
      
      // Fazer requisição à API
      const response = await axios.get(`${apiUrl}/informativos/listar_informativos.php`);
      
      if (response.data.success && response.data.informativos) {
        // Filtrar apenas informativos ativos
        const informativosAtivos = response.data.informativos
          .filter((item: Informativo) => item.ativo === 1);
          
        if (informativosAtivos.length > 0) {
          // Ordenar informativos por ID (assumindo que IDs maiores são mais recentes)
          const informativosOrdenados = [...informativosAtivos].sort((a, b) => {
            const idA = typeof a.id === 'string' ? parseInt(a.id) : a.id as number;
            const idB = typeof b.id === 'string' ? parseInt(b.id) : b.id as number;
            return idB - idA;
          });
          
          const informativoMaisRecente = informativosOrdenados[0];
          const idMaisRecente = informativoMaisRecente.id;
          
          // Converter IDs para números para comparação
          const ultimoIdSalvo = typeof ultimoInformativoIdRef.current === 'string' 
            ? parseInt(ultimoInformativoIdRef.current) 
            : ultimoInformativoIdRef.current as number;
          
          const idAtual = typeof idMaisRecente === 'string' 
            ? parseInt(idMaisRecente) 
            : idMaisRecente as number;
          
          console.log(`Último ID salvo: ${ultimoIdSalvo}, ID mais recente: ${idAtual}`);
          
          // Sempre atualizar a lista de informativos na tela principal
          setInformativos(informativosOrdenados.slice(0, 5));
          
          // Se o ID mais recente for maior que o último salvo, temos um novo informativo
          if (idAtual > ultimoIdSalvo && ultimoIdSalvo !== 0) {
            // Marcar que existem novos informativos
            setTemNovosInformativos(true);
            
            // Enviar notificação
            await enviarNotificacao(
              'Novo Informativo',
              `${informativoMaisRecente.titulo}`
            );
            
            // Reiniciar o carrossel para mostrar o novo informativo
            setCurrentInformativoIndex(0);
            if (flatListRef.current) {
              flatListRef.current.scrollToOffset({ offset: 0, animated: true });
            }
          }
          
          // Salvar o ID mais recente
          await salvarUltimoInformativoId(idMaisRecente);
        } else {
          // Não há informativos ativos
          setInformativos([]);
        }
      } else {
        console.log('Erro ou nenhum informativo na resposta da API');
      }
    } catch (error: any) {
      console.error('Erro ao verificar novos informativos:', error);
    } finally {
      setAtualizandoInformativos(false);
    }
  };

  // Função para enviar notificação
  const enviarNotificacao = async (titulo: string, corpo: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: titulo,
          body: corpo,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Enviar imediatamente
      });
      console.log('Notificação enviada com sucesso');
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
    }
  };

  // Solicitar permissões para notificações
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Permissão para notificações não concedida');
        } else {
          console.log('Permissão para notificações concedida');
        }
      } catch (error) {
        console.error('Erro ao solicitar permissões para notificações:', error);
      }
    })();
  }, []);

  // Função para vincular dispositivo ao vendedor
  const vincularDispositivo = async () => {
    console.log('=== INICIANDO VINCULAÇÃO DE DISPOSITIVO ===');
    
    try {
      // Verificar se temos usuário e conectividade
      console.log('Verificando dados do usuário...');
      console.log('User object:', JSON.stringify(user, null, 2));
      
      if (!user || !user.rca) {
        console.log('❌ Usuário não encontrado ou sem código de vendedor');
        console.log('User exists:', !!user);
        console.log('User RCA:', user?.rca);
        return;
      }

      console.log('✅ Usuário válido encontrado:', user.rca);

      console.log('Verificando conectividade...');
      const netInfo = await NetInfo.fetch();
      console.log('NetInfo:', JSON.stringify(netInfo, null, 2));
      
      if (!netInfo.isConnected) {
        console.log('❌ Sem conexão com a internet. Vinculação de dispositivo ignorada.');
        return;
      }

      console.log('✅ Conectividade confirmada');

      // Obter o ID do dispositivo
      console.log('Obtendo ID do dispositivo...');
      const deviceId = await getDeviceId();
      console.log('Device ID obtido:', deviceId);
      
      if (!deviceId) {
        console.error('❌ ID do dispositivo não encontrado');
        return;
      }

      console.log('✅ Device ID válido:', deviceId);

      // Preparar dados do dispositivo
      console.log('Preparando dados do dispositivo...');
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        model: Constants.deviceName || 'Unknown',
        app_version: Constants.expoConfig?.version || '1.0.0'
      };
      
      console.log('Device Info:', JSON.stringify(deviceInfo, null, 2));

      // Preparar payload da requisição
      const payload = {
        device_id: deviceId,
        vendedor_codigo: user.rca,
        device_info: deviceInfo
      };

      console.log('=== DADOS DA REQUISIÇÃO ===');
      console.log('URL:', `${apiUrl}/vincular_mobile.php`);
      console.log('Payload:', JSON.stringify(payload, null, 2));
      console.log('API URL base:', apiUrl);

      console.log('Enviando requisição para API...');

      // Fazer requisição à API
      const response = await axios.post(`${apiUrl}/vincular_mobile.php`, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000 // 10 segundos de timeout
      });

      console.log('=== RESPOSTA DA API ===');
      console.log('Status:', response.status);
      console.log('Headers:', JSON.stringify(response.headers, null, 2));
      console.log('Data:', JSON.stringify(response.data, null, 2));

      if (response.data.success) {
        console.log('✅ Dispositivo vinculado com sucesso:', response.data.message);
        console.log('✅ Ação realizada:', response.data.action);
        console.log('✅ Vendedor:', JSON.stringify(response.data.vendedor, null, 2));
      } else {
        console.error('❌ Erro na resposta da API:', response.data.message);
      }
    } catch (error: any) {
      console.log('=== ERRO NA VINCULAÇÃO ===');
      console.error('❌ Erro ao vincular dispositivo:', error);
      
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', JSON.stringify(error.response.data, null, 2));
        console.error('❌ Response headers:', JSON.stringify(error.response.headers, null, 2));
      } else if (error.request) {
        console.error('❌ Request error:', error.request);
      } else {
        console.error('❌ Error message:', error.message);
      }
      
      console.error('❌ Error config:', JSON.stringify(error.config, null, 2));
    }
    
    console.log('=== FIM DA VINCULAÇÃO DE DISPOSITIVO ===');
  };

  // Verificar e atualizar permissões da API
  const verificarEAtualizarPermissoes = async () => {
    try {
      // Obter o ID do dispositivo
      const deviceId = await getDeviceId();
      if (!deviceId) {
        console.error('ID do dispositivo não encontrado');
        return;
      }
      
      // Buscar permissões na API - a função buscarPermissoes já compara com as locais
      // e só atualiza se forem diferentes
      console.log(`Verificando permissões para o dispositivo: ${deviceId}`);
      
      // Obter permissões locais para comparação
      const permissoesLocais = await getPermissoesLocais();
      
      // Buscar permissões da API
      const permissoesAtualizadas = await buscarPermissoes(apiUrl, deviceId, true);
      
      // Verificar se houve mudanças nas permissões
      const houveAlteracao = JSON.stringify(permissoesLocais) !== JSON.stringify(permissoesAtualizadas);
      
      // Atualizar o estado com as permissões (sejam elas novas ou as mesmas)
      setPermissoes(permissoesAtualizadas as PermissoesFuncionalidades);
      
      // Se houve alteração nas permissões, notificar o usuário
      if (houveAlteracao) {
        console.log('Permissões foram alteradas. Notificando usuário...');
        
        // Mostrar alerta informando sobre a mudança nas permissões
        Alert.alert(
          'Permissões Atualizadas',
          'As permissões do seu dispositivo foram atualizadas. Algumas funcionalidades podem estar disponíveis ou indisponíveis agora.',
          [
            { text: 'OK', onPress: () => console.log('Alerta de permissões fechado') }
          ]
        );
        
        // Enviar notificação
        await enviarNotificacao(
          'Permissões Atualizadas',
          'As permissões do seu dispositivo foram atualizadas.'
        );
      }
    } catch (error) {
      console.error('Erro ao verificar e atualizar permissões:', error);
    }
  };

  // Carregar permissões atualizadas da API
  const carregarPermissoesAtualizadas = async () => {
    await verificarEAtualizarPermissoes();
  };

  // Limpar estados e reiniciar componentes quando necessário
  const resetInformativosState = () => {
    // Não limpar informativos para evitar flash na tela
    // setInformativos([]);
    
    // Não mostrar loading para evitar flash na tela
    // setCarregandoInformativos(true);
    
    setAtualizandoInformativos(false);
    setTemNovosInformativos(false);
    
    if (carouselInterval.current) {
      clearInterval(carouselInterval.current);
      carouselInterval.current = null;
    }
    
    // Carregar informativos em segundo plano
    carregarInformativos();
  };

  // Adicionar um efeito para reiniciar o estado dos informativos quando houver mudanças na conexão
  useEffect(() => {
    if (!offline && permissoes && verificarPermissao(permissoes, 'informativos')) {
      resetInformativosState();
    }
  }, [offline, permissoes]);

  // Efeito para vincular dispositivo após login
  useEffect(() => {
    if (user && user.rca && !offline) {
      // Aguardar um pouco para garantir que o componente está totalmente carregado
      const timer = setTimeout(() => {
        vincularDispositivo();
      }, 2000); // 2 segundos de delay

      return () => clearTimeout(timer);
    }
  }, [user, offline, apiUrl]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#f12b00" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NovoTok</Text>
        
        <View style={styles.headerRightContainer}>
          {offline && (
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
          
          {manutencao >= 1 && (
            <TouchableOpacity 
              style={styles.manutencaoIndicator}
              onPress={() => setManutencaoModalVisible(true)}
            >
              <Text style={styles.manutencaoText}>Manutenção</Text>
            </TouchableOpacity>
          )}
          
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
        {/* Menu de navegação em carrossel */}
        {!search && !buscando && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.menuCarousel}
          >
            {/* Botão Orçamentos - mostrar apenas se tiver permissão */}
            {permissoes && verificarPermissao(permissoes, 'orcamentos') && (
              <TouchableOpacity 
                style={{...styles.menuButton, backgroundColor: '#a1efff'}} 
                onPress={navigateToOrcamentos}
              >
                <MaterialCommunityIcons name="file-document-outline" size={40} color="#5e5e5e" />
                <Text style={styles.menuButtonText}>Orçamentos</Text>
              </TouchableOpacity>
            )}

            {/* Botão Minhas Vendas - mostrar apenas se tiver permissão */}
            {permissoes && verificarPermissao(permissoes, 'minhas_vendas') && (
              <TouchableOpacity 
                style={{...styles.menuButton, backgroundColor: '#a1ffd9'}} 
                onPress={navigateToMinhasVendas}
              >
                <MaterialCommunityIcons name="chart-line" size={40} color="#5e5e5e" />
                <Text style={styles.menuButtonText}>Minhas Vendas</Text>
              </TouchableOpacity>
            )}

            {/* Botão Minhas Metas - mostrar apenas se tiver permissão */}
            {permissoes && verificarPermissao(permissoes, 'minhas_metas') && (
              <TouchableOpacity 
                style={{...styles.menuButton, backgroundColor: '#ffcba1'}} 
                onPress={navigateToMetas}
              >
                <MaterialCommunityIcons name="target" size={40} color="#5e5e5e" />
                <Text style={styles.menuButtonText}>Minhas Metas</Text>
              </TouchableOpacity>
            )}

            {/* Botão Informativos - mostrar apenas se tiver permissão */}
            {permissoes && verificarPermissao(permissoes, 'informativos') && (
              <TouchableOpacity 
                style={{...styles.menuButton, backgroundColor: '#d9df88'}} 
                onPress={navigateToInformativos}
              >
                <View style={styles.menuButtonIconContainer}>
                  <MaterialCommunityIcons name="bell-outline" size={40} color="#5e5e5e" />
                  {temNovosInformativos && (
                    <View style={styles.menuButtonNotificationBadge} />
                  )}
                </View>
                <Text style={styles.menuButtonText}>Informativos</Text>
              </TouchableOpacity>
            )}

            {/* Botão Buscar Produtos - mostrar apenas se tiver permissão */}
            {permissoes && verificarPermissao(permissoes, 'buscar_produto') && (
              <TouchableOpacity 
                style={{...styles.menuButton, backgroundColor: '#ffe2e2'}} 
                onPress={navigateToProductSearch}
              >
                <MaterialCommunityIcons name="barcode-scan" size={40} color="#5e5e5e" />
                <Text style={styles.menuButtonText}>Buscar Produtos</Text>
              </TouchableOpacity>
            )}
            
            {/* Botão Ofertas - mostrar apenas se tiver permissão */}
            {permissoes && verificarPermissao(permissoes, 'ofertas') && (
              <TouchableOpacity 
                style={{...styles.menuButton, backgroundColor: '#ffd9a1'}} 
                onPress={navigateToOfertas}
              >
                <MaterialCommunityIcons name="sale" size={40} color="#5e5e5e" />
                <Text style={styles.menuButtonText}>Ofertas</Text>
              </TouchableOpacity>
            )}
            
            {/* Botão Clientes - mostrar apenas se tiver permissão */}
            {permissoes && verificarPermissao(permissoes, 'clientes') && (
              <TouchableOpacity 
                style={{...styles.menuButton, backgroundColor: '#c9a1ff'}} 
                onPress={navigateToClientes}
              >
                <MaterialCommunityIcons name="account-group" size={40} color="#5e5e5e" />
                <Text style={styles.menuButtonText}>Clientes</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* Carrossel de Informativos - mostrar apenas se tiver permissão */}
        {!search && !buscando && permissoes && verificarPermissao(permissoes, 'informativos') && (
          <View style={styles.informativosCarouselContainer}>
            {carregandoInformativos && informativos.length === 0 ? (
              <View style={styles.informativosEmptyContainer}>
                <Text style={styles.informativosEmptyText}>Carregando informativos...</Text>
              </View>
            ) : informativos && Array.isArray(informativos) && informativos.length > 0 ? (
              <>
                <View style={styles.informativosHeader}>
                  <View style={styles.informativosTitleContainer}>
                    <Text style={styles.informativosTitle}>Últimos Informativos</Text>
                    {temNovosInformativos && (
                      <View style={styles.informativosNewBadge}>
                        <Text style={styles.informativosNewBadgeText}>Novo</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.informativosHeaderButtons}>
                    <TouchableOpacity 
                      onPress={() => {
                        // Reiniciar a verificação de informativos
                        verificarNovosInformativos();
                      }} 
                      style={styles.informativosRefreshButton}
                      disabled={atualizandoInformativos}
                    >
                      {atualizandoInformativos ? (
                        <ActivityIndicator size="small" color="#f12b00" />
                      ) : (
                        <MaterialCommunityIcons name="refresh" size={16} color="#f12b00" />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={navigateToInformativos}>
                      <Text style={styles.informativosVerTodos}>Ver todos</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <FlatList
                  ref={flatListRef}
                  data={informativos}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={handleCarouselScroll}
                  keyExtractor={(item) => item.id.toString()}
                  initialNumToRender={1}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  removeClippedSubviews={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={[styles.informativoCard, { width }]}
                      onPress={navigateToInformativos}
                    >
                      {item.imagens && item.imagens.length > 0 ? (
                        <Image 
                          source={{ uri: item.imagens[0].imagem }}
                          style={styles.informativoBackgroundImage}
                          blurRadius={1.5}
                          onError={(e) => {
                            console.log('Erro ao carregar imagem do informativo:', e.nativeEvent.error);
                          }}
                        />
                      ) : (
                        <View style={styles.informativoNoImage} />
                      )}
                      
                      <View style={styles.informativoContent}>
                        <Text style={styles.informativoTitle}>{item.titulo}</Text>
                        <Text 
                          style={styles.informativoText} 
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {item.texto}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  onScrollToIndexFailed={(info) => {
                    console.log('Falha ao rolar para o índice:', info);
                    // Tentar novamente com um timeout
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                      if (flatListRef.current && informativos && informativos.length > 0) {
                        flatListRef.current.scrollToIndex({ 
                          index: Math.min(info.index, informativos.length - 1),
                          animated: true 
                        });
                      }
                    });
                  }}
                />
                
                {/* Indicadores de página */}
                {informativos && informativos.length > 1 && (
                  <View style={styles.paginationContainer}>
                    {informativos.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.paginationDot,
                          index === currentInformativoIndex && styles.paginationDotActive
                        ]}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.informativosEmptyContainer}>
                <Text style={styles.informativosEmptyText}>Nenhum informativo disponível</Text>
              </View>
            )}
          </View>
        )}

        {/* Informação do Produto encontrado */}
        {product && (
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
        )}

        {buscando && (
          <View style={styles.infoContainerBuscando}>
            <ActivityIndicator size="large" color="#f12b00" />
            <Text style={styles.textInfoContainerBuscando}>Buscando...</Text>
          </View>
        )}

        {/* Input e botão para informar o código de barra manualmente */}
        {!product && search && (
          <View style={styles.inputAndButtonContainer}>
            <TextInput
              style={styles.productSearchInput}
              placeholder="CÓDIGO DE BARRAS"
              value={codbarraManual}
              onChangeText={setCodBarraManual}
              keyboardType="number-pad"
              returnKeyType="search"
              onSubmitEditing={scannedManual}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={scannedManual}
            >
              <MaterialIcons name="search" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Scanner de Código de Barras */}
        {search && codbarra === "" && (
          <View style={styles.cameraContainer}>
            {permission?.granted ? (
              <CameraView
                style={styles.cameraView}
                autofocus="on"
                barcodeScannerSettings={{
                  barcodeTypes: ["ean8", "ean13"],
                }}
                onCameraReady={() => {
                  setCameraReady(true);
                }}
                onBarcodeScanned={(e) => {
                  if (e.data) scanned(e.data);
                }}
              />
            ) : (
              <TouchableWithoutFeedback onPress={requestPermission}>
                <View style={styles.requestPermissionButton}>
                  <MaterialIcons name="camera-alt" size={20} color="#fff" />
                  <Text style={styles.textRequestPermissionButton}>
                    Ativar câmera
                  </Text>
                </View>
              </TouchableWithoutFeedback>
            )}
            {cameraReady && <View style={styles.cameraViewLine} />}
          </View>
        )}
      </View>
      
      {/* Código do dispositivo discreto no rodapé */}
      <View style={styles.deviceIdContainer}>
        <Text style={styles.deviceIdText}>{deviceId ? deviceId.substring(0, 10) + '...' : ''}</Text>
      </View>

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
            {produtosOffline && syncProgress === 1 && (
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

      {/* Modal de Manutenção */}
      <Modal
        visible={manutencaoModalVisible && manutencao === 1}
        transparent
        animationType="fade"
        onRequestClose={() => setManutencaoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.manutencaoModalContent}>
            <View style={styles.manutencaoModalHeader}>
              <MaterialCommunityIcons 
                name={getManutencaoInfo().icon} 
                size={40} 
                color={getManutencaoInfo().color} 
              />
              <Text style={[styles.manutencaoModalTitle, { color: getManutencaoInfo().color }]}>
                {getManutencaoInfo().title}
              </Text>
            </View>
            
            <ScrollView style={styles.manutencaoModalScrollView}>
              <Text style={styles.manutencaoModalMessage}>
                {mensagemManutencao || 'Sistema em manutenção!'}
              </Text>
              
              {dataInicioManutencao && (
                <View style={styles.manutencaoDatasContainer}>
                  <View style={styles.manutencaoDataRow}>
                    <MaterialCommunityIcons name="clock-start" size={16} color="#666" />
                    <Text style={styles.manutencaoDataLabel}>Início:</Text>
                    <Text style={styles.manutencaoDataValue}>
                      {formatarDataManutencao(dataInicioManutencao)}
                    </Text>
                  </View>
                  
                  {dataFimManutencao && (
                    <View style={styles.manutencaoDataRow}>
                      <MaterialCommunityIcons name="clock-end" size={16} color="#666" />
                      <Text style={styles.manutencaoDataLabel}>Previsão de término:</Text>
                      <Text style={styles.manutencaoDataValue}>
                        {formatarDataManutencao(dataFimManutencao)}
                      </Text>
                    </View>
                  )}
                  
                  {dataFimManutencao && (
                    <View style={styles.manutencaoDataRow}>
                      <MaterialCommunityIcons name="timer-sand" size={16} color="#666" />
                      <Text style={styles.manutencaoDataLabel}>Tempo restante:</Text>
                      <Text style={styles.manutencaoDataValue}>
                        {calcularTempoRestante()}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
              <Text style={styles.manutencaoModalInstructions}>
                Para mais informações, entre em contato com o suporte.
              </Text>
            </ScrollView>
            
            <View style={styles.manutencaoModalButtonsContainer}>
              <TouchableOpacity 
                style={[styles.manutencaoModalButton, styles.manutencaoModalButtonSecondary]}
                onPress={() => {
                  // Apenas fecha o modal e permite usar o app
                  setManutencaoModalVisible(false);
                }}
              >
                <Text style={styles.manutencaoModalButtonSecondaryText}>Fechar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.manutencaoModalButton, styles.manutencaoModalButtonPrimary]}
                onPress={() => {
                  // @ts-ignore
                  navigation.navigate('ManutencaoDetalhes', {
                    tipo: tipoManutencao,
                    mensagem: mensagemManutencao || '',
                    dataInicio: dataInicioManutencao,
                    dataFim: dataFimManutencao
                  });
                }}
              >
                <Text style={styles.manutencaoModalButtonPrimaryText}>Detalhes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal de Atualização */}
      <Modal
        visible={atualizacaoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !atualizacaoObrigatoria && setAtualizacaoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.atualizacaoModalContent}>
            <View style={styles.atualizacaoModalHeader}>
              <MaterialCommunityIcons 
                name="update" 
                size={40} 
                color="#007bff" 
              />
              <Text style={styles.atualizacaoModalTitle}>
                Nova Versão Disponível
              </Text>
            </View>
            
            <ScrollView style={styles.atualizacaoModalScrollView}>
              <Text style={styles.atualizacaoVersao}>
                Versão {versaoDisponivel}
              </Text>
              
              <Text style={styles.atualizacaoTitulo}>
                {tituloAtualizacao}
              </Text>
              
              <Text style={styles.atualizacaoDescricao}>
                {descricaoAtualizacao}
              </Text>
              
              {atualizacaoObrigatoria && (
                <View style={styles.atualizacaoObrigatoriaContainer}>
                  <MaterialCommunityIcons 
                    name="alert-circle" 
                    size={20} 
                    color="#dc3545" 
                  />
                  <Text style={styles.atualizacaoObrigatoriaText}>
                    Esta atualização é obrigatória
                  </Text>
                </View>
              )}
            </ScrollView>
            
            <View style={styles.atualizacaoModalButtonsContainer}>
              {!atualizacaoObrigatoria && (
                <TouchableOpacity 
                  style={[styles.atualizacaoModalButton, styles.atualizacaoModalButtonSecondary]}
                  onPress={() => setAtualizacaoModalVisible(false)}
                >
                  <Text style={styles.atualizacaoModalButtonSecondaryText}>Depois</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={[
                  styles.atualizacaoModalButton, 
                  styles.atualizacaoModalButtonPrimary,
                  atualizacaoObrigatoria ? styles.atualizacaoModalButtonFull : {}
                ]}
                onPress={abrirLinkDownload}
              >
                <Text style={styles.atualizacaoModalButtonPrimaryText}>
                  {atualizacaoObrigatoria ? 'Atualizar Agora' : 'Atualizar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal para funcionalidade não disponível */}
      <Modal
        visible={!!funcionalidadeNaoDisponivel}
        transparent
        animationType="fade"
        onRequestClose={() => setFuncionalidadeNaoDisponivel(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.funcionalidadeNaoDisponivelContent}>
            <MaterialCommunityIcons name="lock" size={50} color="#f12b00" />
            <Text style={styles.funcionalidadeNaoDisponivelTitle}>
              Acesso Indisponível
            </Text>
            <Text style={styles.funcionalidadeNaoDisponivelText}>
              A funcionalidade "{funcionalidadeNaoDisponivel}" não está disponível para o seu dispositivo.
            </Text>
            <Text style={styles.funcionalidadeNaoDisponivelSubText}>
              Entre em contato com o administrador para solicitar acesso.
            </Text>
            <TouchableOpacity 
              style={styles.funcionalidadeNaoDisponivelButton}
              onPress={() => setFuncionalidadeNaoDisponivel(null)}
            >
              <Text style={styles.funcionalidadeNaoDisponivelButtonText}>Entendi</Text>
            </TouchableOpacity>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  manutencaoIndicator: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
  },
  manutencaoText: {
    color: "#f12b00",
    fontWeight: "bold",
    fontSize: 12,
  },
  offlineIndicator: {
    backgroundColor: "#ffcc00",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
  },
  offlineText: {
    color: "#333",
    fontWeight: "bold",
    fontSize: 12,
  },
  syncButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: 20,
  },
  infoContainer: {
    width: "90%",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoContainerBuscando: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textInfoContainerBuscando: {
    marginTop: 15,
    fontSize: 18,
    color: "#555",
  },
  textManutencaoContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#fff9f9",
    borderRadius: 8,
    width: "90%",
    alignSelf: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#cc0000",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  textManutencao: {
    color: "#555",
    fontSize: 14,
    lineHeight: 20,
  },
  infoText: {
    fontSize: 16,
    color: "#555",
    marginBottom: 5,
  },
  infoTextDesc: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginVertical: 10,
  },
  priceText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f12b00",
    marginVertical: 5,
  },
  infoContainerFidelidade: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#e6f7f6",
    borderRadius: 5,
    alignItems: "center",
  },
  infoTextDescontoFidelidade: {
    fontSize: 16,
    fontWeight: "bold",
    color: "rgb(7, 150, 143)",
    marginVertical: 2,
  },
  infoContainerOferta: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#fff9e6",
    borderRadius: 5,
    alignItems: "center",
  },
  infoTextDescontoOferta: {
    fontSize: 18,
    fontWeight: "bold",
    color: "orange",
  },
  infoTextDescontoOfertaPrice: {
    fontSize: 22,
    fontWeight: "bold",
    color: "orange",
    marginVertical: 5,
  },
  offerFiliaisContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 5,
    padding: 8,
  },
  offerFilaisTitle: {
    fontWeight: "bold",
    color: "orange",
    marginRight: 5,
  },
  offerFiliaisNumber: {
    color: "orange",
    marginHorizontal: 3,
    fontWeight: "bold",
  },
  offer: {
    position: "absolute",
    top: -15,
    right: -15,
    zIndex: 1,
  },
  productSearch: {
    fontSize: 16,
    color: "#777",
    textAlign: "center",
  },
  inputAndButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "90%",
    marginVertical: 20,
  },
  productSearchInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
  },
  searchButton: {
    width: 50,
    height: 50,
    backgroundColor: "#f12b00",
    borderRadius: 8,
    marginLeft: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraContainer: {
    width: "90%",
    aspectRatio: 1,
    marginTop: 20,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  cameraView: {
    width: "100%",
    height: "100%",
  },
  cameraViewLine: {
    position: "absolute",
    width: "80%",
    height: 2,
    backgroundColor: "#f12b00",
    top: "50%",
    left: "10%",
  },
  requestPermissionButton: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f12b00",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  textRequestPermissionButton: {
    color: "#fff",
    marginLeft: 10,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 10,
    width: "90%",
    maxHeight: "80%",
    padding: 20,
  },
  headerModal: {
    marginBottom: 15,
  },
  headerModal2: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  inputAndButtonContainerOffersFilter: {
    marginTop: 15,
  },
  offerItem: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#f12b00",
  },
  offerItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  offerItemCode: {
    fontSize: 14,
    color: "#777",
  },
  offerItemEan: {
    fontSize: 14,
    color: "#777",
  },
  offerItemDesc: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
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
    color: "#777",
  },
  offerItemPrice: {
    fontSize: 16,
    color: "#777",
    textDecorationLine: "line-through",
  },
  offerItemOfferLabel: {
    fontSize: 12,
    color: "#f12b00",
    fontWeight: "bold",
  },
  offerItemOfferPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f12b00",
  },
  offerItemFidelidade: {
    marginTop: 8,
    padding: 5,
    backgroundColor: "#e6f7f6",
    borderRadius: 4,
  },
  offerItemFidelidadeLabel: {
    fontSize: 12,
    color: "rgb(7, 150, 143)",
  },
  offerItemFidelidadePrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "rgb(7, 150, 143)",
  },
  offerItemFiliais: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerItemFiliaisLabel: {
    fontSize: 12,
    color: "#FF8C00",
    marginRight: 5,
  },
  offerItemFiliaisNumbers: {
    flexDirection: 'row',
  },
  offerItemFiliaisNumber: {
    fontSize: 12,
    color: "#FF8C00",
    fontWeight: "bold",
    marginHorizontal: 2,
    backgroundColor: "#FFF5E6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
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
  // Estilos para o modal de progresso de sincronização
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
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginTop: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f12b00',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  syncStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginVertical: 10,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#f12b00',
  },
  syncStatusText: {
    fontSize: 12,
    color: '#666',
  },
  connectionStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  menuCarousel: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  menuButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: 150,
    height: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuButtonText: {
    marginTop: 8,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Estilos para o carrossel de informativos
  informativosCarouselContainer: {
    marginVertical: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  informativosLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  informativosLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  informativosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  informativosTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  informativosTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  informativosNewBadge: {
    backgroundColor: '#ff0000',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 5,
  },
  informativosNewBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  informativosVerTodos: {
    fontSize: 12,
    color: '#f12b00',
    fontWeight: 'bold',
  },
  informativoCard: {
    height: 150,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  informativoBackgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  informativoNoImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  informativoContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  informativoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  informativoText: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#f12b00',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  manutencaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  manutencaoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  manutencaoDatasContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  manutencaoDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  manutencaoDataLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  manutencaoDataValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 5,
  },
  manutencaoTempoRestanteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  manutencaoTempoRestante: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  verMaisContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  verMaisText: {
    fontSize: 12,
    color: '#888',
    marginRight: 5,
  },
  // Novos estilos para o modal de manutenção
  manutencaoModalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "90%",
    maxHeight: "80%",
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  manutencaoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  manutencaoModalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: 10,
  },
  manutencaoModalScrollView: {
    maxHeight: 300,
  },
  manutencaoModalMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  manutencaoModalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  manutencaoModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  manutencaoModalButtonPrimary: {
    backgroundColor: '#f12b00',
  },
  manutencaoModalButtonSecondary: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  manutencaoModalButtonPrimaryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  manutencaoModalButtonSecondaryText: {
    color: '#666',
    fontSize: 16,
  },
  // Estilos para o modal de atualização
  atualizacaoModalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "90%",
    maxHeight: "80%",
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  atualizacaoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  atualizacaoModalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: 10,
    color: "#007bff",
  },
  atualizacaoModalScrollView: {
    maxHeight: 300,
  },
  atualizacaoVersao: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  atualizacaoTitulo: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  atualizacaoDescricao: {
    fontSize: 14,
    lineHeight: 20,
    color: "#555",
    marginBottom: 15,
    textAlign: "center",
  },
  atualizacaoObrigatoriaContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff8f8",
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ffcccc",
    marginTop: 10,
  },
  atualizacaoObrigatoriaText: {
    color: "#dc3545",
    fontWeight: "bold",
    marginLeft: 5,
  },
  atualizacaoModalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  atualizacaoModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  atualizacaoModalButtonPrimary: {
    backgroundColor: '#007bff',
  },
  atualizacaoModalButtonSecondary: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  atualizacaoModalButtonFull: {
    flex: 1,
    marginHorizontal: 0,
  },
  atualizacaoModalButtonPrimaryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  atualizacaoModalButtonSecondaryText: {
    color: '#666',
    fontSize: 16,
  },
  
  // Adicionar estilos para a tela de carregamento
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
  },
  loadingErrorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#f12b00',
    textAlign: 'center',
  },
  // Estilos para o modal de funcionalidade não disponível
  funcionalidadeNaoDisponivelContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "90%",
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  funcionalidadeNaoDisponivelTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#f12b00",
    marginTop: 10,
    marginBottom: 15,
  },
  funcionalidadeNaoDisponivelText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  funcionalidadeNaoDisponivelSubText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  funcionalidadeNaoDisponivelButton: {
    backgroundColor: "#f12b00",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  funcionalidadeNaoDisponivelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  informativosHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  informativosRefreshButton: {
    marginRight: 10,
    padding: 4,
  },
  menuButtonIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonNotificationBadge: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff0000',
    top: 0,
    right: -5,
  },
  informativosEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    height: 100,
  },
  informativosEmptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  manutencaoModalInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  manutencaoModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen; 