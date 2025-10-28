import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Clipboard,
  SafeAreaView,
  Platform,
  StatusBar,
  Dimensions,
  AppState,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios'; // Adicionado para fazer a requisição HTTP

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

const ConfigScreen = () => {
  const navigation = useNavigation();
  const { apiUrl, setApiBaseUrl, user, signOut, getDeviceId } = useAuth();
  const [newApiUrl, setNewApiUrl] = useState(apiUrl);
  const [offlineMode, setOfflineMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState('60');
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [cacheSize, setCacheSize] = useState<string>('0 KB');
  const [deviceId, setDeviceId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [offline, setOffline] = useState<boolean>(false);

  // Adicionar referência para o intervalo de sincronização
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastSyncTimeRef = useRef<number>(0);

  // Carregar configurações salvas
  useEffect(() => {
    loadSettings();
    calculateCacheSize();
    loadLastSyncDate();
    loadDeviceId();
    checkConnectivity();

    // Monitorar mudanças na conexão
    const unsubscribe = NetInfo.addEventListener(state => {
      // Atualizar o status de conexão considerando o modo offline
      if (offlineMode) {
        setIsConnected(false);
        setOffline(true);
      } else {
        setIsConnected(state.isConnected);
        setOffline(false);
      }
    });

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
          syncDataBackground();
          lastSyncTimeRef.current = now;
        }
      }
      
      appStateRef.current = nextAppState;
    });

    return () => {
      unsubscribe();
      appStateSubscription.remove();
      // Limpar o intervalo de sincronização quando o componente for desmontado
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [offlineMode]);

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
      await syncDataBackground();
    }, intervalMs);
  };

  // Sincronizar dados em segundo plano
  const syncDataBackground = async () => {
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
      const response = await axios.post(
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
        
        // Recalcular o tamanho do cache
        calculateCacheSize();
        
        console.log(`Sincronização em segundo plano concluída: ${response.data.produtos.length} produtos`);
      } else {
        console.error('Erro na resposta da API:', response.data.message);
      }
    } catch (error) {
      console.error('Erro na sincronização em segundo plano:', error);
    }
  };

  // Salvar dados no arquivo local
  const saveDataToFile = async (data: any[]) => {
    try {
      const fileUri = FileSystem.documentDirectory + 'produtos.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data));
      console.log('Dados salvos no arquivo local');
      return true;
    } catch (error) {
      console.error('Erro ao salvar dados no arquivo:', error);
      return false;
    }
  };

  // Verificar status do modo offline quando a tela receber foco
  useFocusEffect(
    React.useCallback(() => {
      const checkOfflineMode = async () => {
        await checkConnectivity();
        await loadLastSyncDate(); // Atualizar a data da última sincronização ao receber foco
      };
      
      checkOfflineMode();
      return () => {};
    }, [])
  );

  // Verificar conectividade
  const checkConnectivity = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      const offlineModeConfig = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      const forceOfflineMode = offlineModeConfig === 'true';
      
      // Considerar o modo offline configurado ao definir o status de conexão
      setIsConnected(!forceOfflineMode && netInfo.isConnected);
      setOffline(forceOfflineMode);
      setOfflineMode(forceOfflineMode);
    } catch (error) {
      console.error('Erro ao verificar conectividade:', error);
    }
  };

  // Carregar o ID do dispositivo
  const loadDeviceId = async () => {
    try {
      const id = await getDeviceId();
      if (id) {
        setDeviceId(id);
      } else {
        setDeviceId('Não disponível');
      }
    } catch (error) {
      console.error('Erro ao carregar ID do dispositivo:', error);
      setDeviceId('Erro ao carregar');
    }
  };

  // Função para atualizar o ID do dispositivo
  const refreshDeviceId = async () => {
    setRefreshing(true);
    await loadDeviceId();
    setRefreshing(false);
    Alert.alert('Sucesso', 'Código do dispositivo atualizado');
  };

  // Carregar configurações do AsyncStorage
  const loadSettings = async () => {
    try {
      const storedOfflineMode = await AsyncStorage.getItem('@BuscaPreco:offlineMode');
      const storedAutoSync = await AsyncStorage.getItem('@BuscaPreco:autoSync');
      const storedSyncInterval = await AsyncStorage.getItem('@BuscaPreco:syncInterval');

      if (storedOfflineMode) setOfflineMode(storedOfflineMode === 'true');
      if (storedAutoSync) setAutoSync(storedAutoSync === 'true');
      if (storedSyncInterval && storedSyncInterval !== '') setSyncInterval(storedSyncInterval);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  // Alternar modo offline com feedback imediato
  const toggleOfflineMode = async (value: boolean) => {
    setOfflineMode(value);
    setOffline(value);
    try {
      await AsyncStorage.setItem('@BuscaPreco:offlineMode', value.toString());
      
      // Atualizar o status de conexão no cabeçalho
      const netInfo = await NetInfo.fetch();
      setIsConnected(!value && netInfo.isConnected);
      
      // Feedback visual imediato
      if (value) {
        Alert.alert('Modo offline ativado', 'O aplicativo usará dados locais para buscar produtos.');
      } else {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          Alert.alert('Modo online ativado', 'O aplicativo usará a conexão com a internet para buscar produtos.');
        } else {
          Alert.alert('Atenção', 'Modo online ativado, mas você está sem conexão com a internet.');
        }
      }
    } catch (error) {
      console.error('Erro ao alternar modo offline:', error);
    }
  };

  // Salvar configurações no AsyncStorage
  const saveSettings = async () => {
    try {
      // Validar o intervalo de sincronização
      const intervalValue = parseInt(syncInterval, 10);
      if (isNaN(intervalValue) || intervalValue <= 0) {
        Alert.alert('Erro', 'O intervalo de sincronização deve ser um número positivo');
        return;
      }

      await AsyncStorage.setItem('@BuscaPreco:offlineMode', offlineMode.toString());
      await AsyncStorage.setItem('@BuscaPreco:autoSync', autoSync.toString());
      await AsyncStorage.setItem('@BuscaPreco:syncInterval', syncInterval);
      
      // Atualizar o status de conexão no cabeçalho
      const netInfo = await NetInfo.fetch();
      setIsConnected(!offlineMode && netInfo.isConnected);
      setOffline(offlineMode);
      
      // Reconfigurar a sincronização automática
      setupAutoSync();
      
      // Se a sincronização automática estiver ativada e não tiver sincronizado recentemente, sincronizar agora
      if (autoSync) {
        const now = Date.now();
        const lastSyncTime = lastSyncTimeRef.current || 0;
        const intervalMs = intervalValue * 60 * 1000;
        
        if (now - lastSyncTime > intervalMs) {
          console.log('Sincronizando após alteração das configurações');
          syncDataBackground();
        }
      }
      
      // Atualizar status imediatamente
      if (netInfo.isConnected && !offlineMode) {
        // Se estiver conectado e o modo offline for desativado, notificar o usuário
        Alert.alert('Sucesso', 'Configurações salvas com sucesso. Modo online ativado.');
      } else if (offlineMode) {
        // Se o modo offline for ativado, notificar o usuário
        Alert.alert('Sucesso', 'Configurações salvas com sucesso. Modo offline ativado.');
      } else {
        Alert.alert('Sucesso', 'Configurações salvas com sucesso');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      Alert.alert('Erro', 'Não foi possível salvar as configurações');
    }
  };

  // Salvar nova URL da API
  const saveApiUrl = async () => {
    if (!newApiUrl.trim()) {
      Alert.alert('Erro', 'Por favor, informe uma URL válida');
      return;
    }

    try {
      await setApiBaseUrl(newApiUrl);
      Alert.alert('Sucesso', 'URL da API configurada com sucesso');
    } catch (error) {
      console.error('Erro ao salvar URL da API:', error);
      Alert.alert('Erro', 'Não foi possível salvar a URL da API');
    }
  };

  // Calcular tamanho do cache
  const calculateCacheSize = async () => {
    try {
      const fileUri = FileSystem.documentDirectory + 'produtos.json';
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      if (fileInfo.exists && fileInfo.size) {
        const sizeInKB = Math.round(fileInfo.size / 1024);
        
        if (sizeInKB > 1024) {
          setCacheSize(`${(sizeInKB / 1024).toFixed(2)} MB`);
        } else {
          setCacheSize(`${sizeInKB} KB`);
        }
      } else {
        setCacheSize('0 KB');
      }
    } catch (error) {
      console.error('Erro ao calcular tamanho do cache:', error);
      setCacheSize('Erro');
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

  // Limpar cache
  const clearCache = async () => {
    try {
      const fileUri = FileSystem.documentDirectory + 'produtos.json';
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri);
        setCacheSize('0 KB');
        await AsyncStorage.removeItem('@BuscaPreco:lastSync');
        setLastSync(null);
        Alert.alert('Sucesso', 'Cache limpo com sucesso');
      } else {
        Alert.alert('Info', 'Não há cache para limpar');
      }
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      Alert.alert('Erro', 'Não foi possível limpar o cache');
    }
  };

  // Sincronizar dados (versão manual/visível para o usuário)
  const syncData = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        Alert.alert('Erro', 'Sem conexão com a internet');
        return;
      }

      setSyncModalVisible(true);
      setSyncing(true);
      setSyncProgress(0);

      // Simular progresso de sincronização
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.1;
        setSyncProgress(Math.min(progress, 0.9));
        
        if (progress >= 1) {
          clearInterval(interval);
        }
      }, 300);

      try {
        // Obter o ID do dispositivo
        const id = await getDeviceId();
        if (!id) {
          throw new Error('ID do dispositivo não disponível');
        }

        // Fazer a requisição para a API
        const response = await axios.post(
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
          
          // Recalcular o tamanho do cache
          calculateCacheSize();
          
          clearInterval(interval);
          setSyncProgress(1);
          
          setTimeout(() => {
            setSyncing(false);
            setSyncModalVisible(false);
            Alert.alert('Sucesso', `Sincronização concluída! ${response.data.produtos.length} produtos sincronizados.`);
          }, 500);
        } else {
          throw new Error(response.data.message || 'Erro na sincronização');
        }
      } catch (error) {
        clearInterval(interval);
        setSyncing(false);
        setSyncModalVisible(false);
        console.error('Erro ao sincronizar dados:', error);
        Alert.alert("Erro", error.response.data ? error.response.data.message : "Não foi possível sincronizar os produtos");
      }
    } catch (error) {
      console.error('Erro ao sincronizar dados:', error);
      setSyncing(false);
      setSyncModalVisible(false);
      Alert.alert("Erro", error.response.data ? error.response.data.message : "Não foi possível sincronizar os produtos");
    }
  };

  // Fazer logout
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sim', 
          onPress: async () => {
            try {
              // Mostrar indicador de carregamento ou desabilitar interações aqui, se necessário
              
              // Chamar a função de logout do contexto de autenticação
              await signOut();
              
              // O redirecionamento para a tela de login será feito automaticamente pelo AppNavigator
              console.log('Logout realizado com sucesso');
            } catch (error) {
              console.error('Erro ao fazer logout:', error);
              Alert.alert('Erro', 'Ocorreu um erro ao tentar sair. Tente novamente.');
            }
          } 
        }
      ]
    );
  };

  // Formatar data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} às ${date.toLocaleTimeString()}`;
  };

  // Função para copiar o código do dispositivo
  const copyDeviceId = () => {
    if (deviceId) {
      Clipboard.setString(deviceId);
      Alert.alert('Sucesso', 'Código do dispositivo copiado para a área de transferência');
    } else {
      Alert.alert('Erro', 'Não há código de dispositivo disponível para copiar');
    }
  };

   // Adicionar função para voltar
   const goBack = () => {
    navigation.navigate('Home' as never);
  };
  


  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#f12b00" />
      <View style={styles.header}>
      <TouchableOpacity 
          style={styles.backButton}
          onPress={goBack}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Configurações</Text>
        <View style={styles.headerRightContainer}>
          {offline && (
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </View>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Seção de usuário */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usuário</Text>
          
          <View style={styles.userInfo}>
            <MaterialIcons name="person" size={45} color="#f12b00" style={styles.userIcon} />
            <View>
              <Text style={styles.userName}>{user?.nome || 'Usuário'}</Text>
              <Text style={styles.userRca}>RCA: {user?.rca || 'N/A'}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialIcons name="logout" size={18} color="#fff" />
            <Text style={styles.logoutButtonText}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* Seção de Informações do Dispositivo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações do Dispositivo</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Código:</Text>
            <View style={styles.deviceIdContainer}>
              {refreshing ? (
                <ActivityIndicator size="small" color="#f12b00" />
              ) : (
                <Text style={styles.deviceIdValue} numberOfLines={1} ellipsizeMode="middle">
                  {deviceId || 'Não disponível'}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.copyButton} onPress={copyDeviceId}>
              <MaterialIcons name="content-copy" size={16} color="#fff" />
              <Text style={styles.copyButtonText}>Copiar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.copyButton, styles.refreshButton]} 
              onPress={refreshDeviceId}
              disabled={refreshing}
            >
              <MaterialIcons name="refresh" size={16} color="#fff" />
              <Text style={styles.copyButtonText}>Atualizar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Configuração da API */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuração da API</Text>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="URL da API"
              value={newApiUrl}
              onChangeText={setNewApiUrl}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={saveApiUrl}>
            <Text style={styles.saveButtonText}>Salvar URL</Text>
          </TouchableOpacity>
        </View>

        {/* Configurações de sincronização */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sincronização</Text>

          <View style={styles.statusContainer}>
            <Text style={styles.statusTitle}>Status atual:</Text>
            <View style={styles.statusValueContainer}>
              <View style={[
                styles.statusIndicator,
                { backgroundColor: offline ? '#ffcc00' : (isConnected ? '#4CAF50' : '#f12b00') }
              ]} />
              <Text style={styles.statusValue}>
                {offline ? 'Modo offline ativado' : (isConnected ? 'Online' : 'Sem conexão')}
              </Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Modo offline</Text>
            <View style={styles.switchContainer}>
              {offline && (
                <Text style={styles.offlineModeIndicator}>ATIVO</Text>
              )}
              <Switch
                value={offlineMode}
                onValueChange={toggleOfflineMode}
                trackColor={{ false: '#ccc', true: '#f12b00' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Sincronização automática</Text>
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{ false: '#ccc', true: '#f12b00' }}
              thumbColor="#fff"
            />
          </View>

          {autoSync && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Intervalo (minutos)</Text>
              <TextInput
                style={styles.intervalInput}
                value={syncInterval}
                onChangeText={setSyncInterval}
                keyboardType="numeric"
              />
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Última sincronização:</Text>
            <Text style={styles.infoValue}>{formatDate(lastSync)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tamanho do cache:</Text>
            <Text style={styles.infoValue}>{cacheSize}</Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionButton} onPress={syncData}>
              <MaterialIcons name="sync" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Sincronizar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={clearCache}>
              <MaterialIcons name="delete" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Limpar cache</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.saveButton, styles.saveSettingsButton]} onPress={saveSettings}>
            <Text style={styles.saveButtonText}>Salvar configurações</Text>
          </TouchableOpacity>
        </View>

        {/* Espaço extra no final para evitar sobreposição com a barra de navegação */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Modal de sincronização */}
      <Modal
        visible={syncModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !syncing && setSyncModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sincronizando dados</Text>
            
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${syncProgress * 100}%` }]} />
            </View>
            
            <Text style={styles.progressText}>{Math.round(syncProgress * 100)}%</Text>
            
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
  },
  contentContainer: {
    paddingBottom: 20,
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
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  connectionIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginLeft: 10,
  },
  connectionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 8,
    marginHorizontal: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 6,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userIcon: {
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userRca: {
    fontSize: 14,
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#f12b00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 5,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#f12b00',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  saveSettingsButton: {
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 14,
    color: '#333',
  },
  intervalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 50,
    textAlign: 'center',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#333',
  },
  infoValue: {
    fontSize: 14,
    color: '#666',
    maxWidth: '60%',
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: '#f12b00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 4,
  },
  clearButton: {
    backgroundColor: '#ff6b6b',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
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
  deviceIdContainer: {
    maxWidth: '60%',
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    padding: 2,
  },
  deviceIdValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: 'bold',
    padding: 4,
    textAlign: 'center',
  },
  copyButton: {
    backgroundColor: '#4a6da7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 4,
  },
  refreshButton: {
    backgroundColor: '#5cb85c',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  bottomSpacer: {
    height: Platform.OS === 'ios' ? 90 : 70,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineModeIndicator: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#f12b00',
    marginRight: 8,
    backgroundColor: '#ffeeee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusTitle: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  statusValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusValue: {
    fontSize: 14,
    color: '#666',
  },
});

export default ConfigScreen; 