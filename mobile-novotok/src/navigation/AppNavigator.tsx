import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { ActivityIndicator, View, Platform, SafeAreaView, Alert, Text, TouchableOpacity, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../contexts/AuthContext';
import { verificarPermissao, getPermissoesLocais, buscarPermissoes } from '../services/permissoesService';
import { useNavigation } from '@react-navigation/native';

// Screens
import HomeScreen from '../screens/HomeScreen';
import OffersScreen from '../screens/OffersScreen';
import NewClientScreen from '../screens/NewClientScreen';
import LoginScreen from '../screens/LoginScreen';
import ConfigScreen from '../screens/ConfigScreen';
import ProductSearchScreen from '../screens/ProductSearchScreen';
import OrcamentosScreen from '../screens/OrcamentosScreen';
import NovoOrcamentoScreen from '../screens/NovoOrcamentoScreen';
import DetalhesOrcamentoScreen from '../screens/DetalhesOrcamentoScreen';
import MinhasVendasScreen from '../screens/MinhasVendasScreen';
import InformativosScreen from '../screens/InformativosScreen';
import ManutencaoDetalhesScreen from '../screens/ManutencaoDetalhesScreen';
import MetasScreen from '../screens/MetasScreen';

// Definindo os tipos para a navegação
type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Orcamentos: undefined;
  NovoOrcamento: undefined;
  EditarOrcamento: { orcamento: any };
  DetalhesOrcamento: { orcamento: any; compartilhar?: boolean };
  MinhasVendas: undefined;
  Informativos: undefined;
  ManutencaoDetalhes: { 
    tipo: string;
    mensagem: string;
    dataInicio: string | null;
    dataFim: string | null;
  };
  Metas: undefined;
  Ofertas: undefined;
  Clientes: undefined;
};

type MainTabParamList = {
  Home: undefined;
  Offers: undefined;
  ProductSearch: undefined;
  NewClient: undefined;
  Config: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Tipos para as permissões
interface Permissoes {
  orcamentos: boolean;
  minhas_vendas: boolean;
  minhas_metas: boolean;
  informativos: boolean;
  buscar_produto: boolean;
  ofertas: boolean;
  clientes: boolean;
}

// Tipo para parâmetros de rota
interface RouteParams {
  funcionalidade?: string;
}

// Componente para tela de acesso não autorizado
const AcessoNegadoScreen = ({ route }: { route?: { params?: RouteParams } }) => {
  const navigation = useNavigation();
  const funcionalidade = route?.params?.funcionalidade || 'esta funcionalidade';
  
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
      <MaterialIcons name="lock" size={60} color="#f12b00" />
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
        Acesso não autorizado
      </Text>
      <Text style={{ fontSize: 16, marginTop: 10, textAlign: 'center', color: '#666', marginBottom: 20 }}>
        Você não tem permissão para acessar {funcionalidade}.
      </Text>
      <Text style={{ fontSize: 14, marginBottom: 30, textAlign: 'center', color: '#888' }}>
        Entre em contato com o administrador para solicitar acesso.
      </Text>
      
      <TouchableOpacity 
        style={{ 
          backgroundColor: '#f12b00', 
          paddingVertical: 12, 
          paddingHorizontal: 30, 
          borderRadius: 8,
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        }}
        onPress={() => navigation.navigate('Home' as never)}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Voltar à tela inicial</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

// Função para criar um componente com verificação de permissão
const withPermissionCheck = (Component: React.ComponentType<any>, permissionKey: keyof Permissoes, permissoes: Permissoes | null) => {
  return (props: any) => {
    if (permissoes && verificarPermissao(permissoes, permissionKey)) {
      return <Component {...props} />;
    } else {
      return <AcessoNegadoScreen {...props} route={{ params: { funcionalidade: getNomeFuncionalidade(permissionKey) } }} />;
    }
  };
};

// Função para obter o nome amigável da funcionalidade
const getNomeFuncionalidade = (key: keyof Permissoes): string => {
  const nomes: Record<keyof Permissoes, string> = {
    'orcamentos': 'Orçamentos',
    'minhas_vendas': 'Minhas Vendas',
    'minhas_metas': 'Minhas Metas',
    'informativos': 'Informativos',
    'buscar_produto': 'Buscar Produto',
    'ofertas': 'Ofertas',
    'clientes': 'Clientes'
  };
  
  return nomes[key];
};

// Navegação principal com tabs
const MainNavigator = () => {
  const [permissoes, setPermissoes] = useState<any>(null);
  const [carregando, setCarregando] = useState(false); // Alterado para false

  useEffect(() => {
    const carregarPermissoes = async () => {
      try {
        const permissoesData = await getPermissoesLocais();
        setPermissoes(permissoesData);
      } catch (error) {
        console.error('Erro ao carregar permissões para navegação:', error);
      }
    };

    // Se não temos permissões, usar as padrões temporariamente
    if (!permissoes) {
      const permissoesPadrao = {
        orcamentos: true,
        minhas_vendas: true,
        minhas_metas: true,
        informativos: true,
        buscar_produto: true,
        ofertas: true,
        clientes: true
      };
      setPermissoes(permissoesPadrao);
    }

    // Carregar permissões em segundo plano
    carregarPermissoes();
  }, []);

  // Remover a tela de carregamento
  if (!permissoes) {
    // Definir permissões padrão temporárias
    const permissoesPadrao = {
      orcamentos: true,
      minhas_vendas: true,
      minhas_metas: true,
      informativos: true,
      buscar_produto: true,
      ofertas: true,
      clientes: true
    };
    setPermissoes(permissoesPadrao);
  }

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#f12b00',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#ddd',
          paddingBottom: Platform.OS === 'ios' ? 5 : 3,
          paddingTop: 5,
          height: Platform.OS === 'ios' ? 85 : 110,
          elevation: 8,
          shadowOpacity: 0.1,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: Platform.OS === 'ios' ? 0 : 5,
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      {/* Home - sempre disponível */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Início',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      
      {/* Ofertas - somente exibir se tiver permissão */}
      {permissoes && verificarPermissao(permissoes, 'ofertas') && (
        <Tab.Screen
          name="Offers"
          component={OffersScreen}
          options={{
            tabBarLabel: 'Ofertas',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <MaterialCommunityIcons name="sale" size={size} color={color} />
            ),
            headerShown: false,
          }}
        />
      )}
      
      {/* Buscar Produto - somente exibir se tiver permissão */}
      {permissoes && verificarPermissao(permissoes, 'buscar_produto') && (
        <Tab.Screen
          name="ProductSearch"
          component={ProductSearchScreen}
          options={{
            tabBarLabel: 'Buscar',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <MaterialCommunityIcons name="barcode-scan" size={size} color={color} />
            ),
          }}
        />
      )}
      
      {/* Clientes - somente exibir se tiver permissão */}
      {permissoes && verificarPermissao(permissoes, 'clientes') && (
        <Tab.Screen
          name="NewClient"
          component={NewClientScreen}
          options={{
            tabBarLabel: 'Clientes',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <FontAwesome5 name="user-plus" size={size} color={color} />
            ),
            headerShown: false,
          }}
        />
      )}
      
      {/* Config - sempre disponível */}
      <Tab.Screen
        name="Config"
        component={ConfigScreen}
        options={{
          tabBarLabel: 'Config.',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Navegador raiz da aplicação
const AppNavigator = () => {
  const { user, loading, apiUrl, getDeviceId } = useAuth();
  const [permissoes, setPermissoes] = useState<any>(null);
  const [carregandoPermissoes, setCarregandoPermissoes] = useState(false); // Alterado para false
  const appState = useRef(AppState.currentState);
  const [ultimaVerificacao, setUltimaVerificacao] = useState<number>(0);
  const intervaloMinimoVerificacao = 60000; // 1 minuto em milissegundos
  const [permissoesAtualizadas, setPermissoesAtualizadas] = useState<boolean>(false);
  
  // Função para carregar permissões do servidor e armazenamento local
  const carregarPermissoes = async () => {
    try {
      // Verifica se já passou tempo suficiente desde a última verificação
      const agora = Date.now();
      if (agora - ultimaVerificacao < intervaloMinimoVerificacao && permissoes !== null && !permissoesAtualizadas) {
        console.log('Ignorando verificação de permissões, última verificação muito recente');
        return;
      }
      
      setUltimaVerificacao(agora);
      
      // Primeiro carregamos do armazenamento local para resposta rápida
      const permissoesLocais = await getPermissoesLocais();
      if (permissoesLocais) {
        setPermissoes(permissoesLocais);
      }
      
      // Se o usuário estiver autenticado, tentamos buscar permissões atualizadas da API
      if (user) {
        const deviceId = await getDeviceId();
        if (deviceId && apiUrl) {
          try {
            // Forçar atualização se a flag permissoesAtualizadas estiver ativa
            const permissoesAtualizadas = await buscarPermissoes(apiUrl, deviceId, true);
            setPermissoes(permissoesAtualizadas);
            console.log('Permissões verificadas com a API');
            
            // Resetar a flag de permissões atualizadas
            setPermissoesAtualizadas(false);
          } catch (error) {
            console.log('Erro ao buscar permissões atualizadas, usando permissões locais');
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar permissões para navegação:', error);
    }
  };
  
  // Notificar que as permissões foram atualizadas
  const notificarPermissoesAtualizadas = () => {
    setPermissoesAtualizadas(true);
    carregarPermissoes();
  };
  
  // Carregar permissões ao iniciar a aplicação
  useEffect(() => {
    // Carregar permissões em segundo plano sem mostrar tela de carregamento
    carregarPermissoes();
    
    // Configurar listener para mudanças no estado do aplicativo
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Aplicativo voltou ao primeiro plano, recarregar permissões
        console.log('App voltou ao primeiro plano, verificando necessidade de recarregar permissões...');
        carregarPermissoes();
      }
      
      appState.current = nextAppState;
    });
    
    // Adicionar um listener para mudanças de conectividade
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        // Se a conexão foi restaurada, verificar permissões
        console.log('Conexão restaurada, verificando permissões...');
        carregarPermissoes();
      }
    });
    
    return () => {
      subscription.remove();
      unsubscribeNetInfo();
    };
  }, [user]);
  
  // Mostra um indicador de carregamento apenas durante a verificação de autenticação
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#f12b00" />
        <Text style={{ marginTop: 10, color: '#666' }}>
          Verificando autenticação...
        </Text>
      </SafeAreaView>
    );
  }

  // Se as permissões ainda não foram carregadas, usar permissões padrão temporárias
  if (!permissoes) {
    const permissoesPadrao = {
      orcamentos: true,
      minhas_vendas: true,
      minhas_metas: true,
      informativos: true,
      buscar_produto: true,
      ofertas: true,
      clientes: true
    };
    setPermissoes(permissoesPadrao);
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? "Main" : "Login"}
        screenOptions={{ headerShown: false }}
      >
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            
            {/* Telas com verificação de permissão */}
            <Stack.Screen 
              name="Orcamentos" 
              component={withPermissionCheck(OrcamentosScreen, 'orcamentos', permissoes)}
              options={{ headerShown: false, title: 'Orçamentos' }}
            />
            <Stack.Screen 
              name="NovoOrcamento" 
              component={withPermissionCheck(NovoOrcamentoScreen, 'orcamentos', permissoes)}
              options={{ headerShown: false, title: 'Novo Orçamento' }}
            />
            <Stack.Screen 
              name="EditarOrcamento" 
              component={withPermissionCheck(NovoOrcamentoScreen, 'orcamentos', permissoes)}
              options={{ headerShown: false, title: 'Editar Orçamento' }}
            />
            <Stack.Screen 
              name="DetalhesOrcamento" 
              component={withPermissionCheck(DetalhesOrcamentoScreen, 'orcamentos', permissoes)}
              options={{ headerShown: false, title: 'Detalhes do Orçamento' }}
            />
            <Stack.Screen 
              name="MinhasVendas" 
              component={withPermissionCheck(MinhasVendasScreen, 'minhas_vendas', permissoes)}
              options={{ headerShown: false, title: 'Minhas Vendas' }}
            />
            <Stack.Screen 
              name="Informativos" 
              component={withPermissionCheck(InformativosScreen, 'informativos', permissoes)}
              options={{ headerShown: false, title: 'Informativos' }}
            />
            <Stack.Screen 
              name="ManutencaoDetalhes" 
              component={ManutencaoDetalhesScreen} 
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="Metas" 
              component={withPermissionCheck(MetasScreen, 'minhas_metas', permissoes)}
              options={{ headerShown: false, title: 'Metas' }}
            />
            <Stack.Screen 
              name="Ofertas" 
              component={withPermissionCheck(OffersScreen, 'ofertas', permissoes)}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="Clientes" 
              component={withPermissionCheck(NewClientScreen, 'clientes', permissoes)}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 