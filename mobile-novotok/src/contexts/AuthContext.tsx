import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Definindo tipos
type User = {
  id: number;
  rca: string;
  nome: string;
  token: string;
  filial_id?: string;
};

type AuthContextData = {
  user: User | null;
  apiUrl: string;
  loading: boolean;
  signIn: (rca: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  setApiBaseUrl: (url: string) => Promise<void>;
  getDeviceId: () => Promise<string | null>;
};

type AuthProviderProps = {
  children: ReactNode;
};

// Chaves para o AsyncStorage
const USER_STORAGE_KEY = '@BuscaPreco:user';
const API_URL_STORAGE_KEY = '@BuscaPreco:apiUrl';
const DEVICE_ID_STORAGE_KEY = '@BuscaPreco:deviceId';
const SESSION_STORAGE_KEY = '@BuscaPreco:session';

// Criando o contexto
const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Provider do contexto
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  // const [apiUrl, setApiUrl] = useState<string>('http://192.168.10.112:8080');
  const [apiUrl, setApiUrl] = useState<string>('https://novotokapi.online/api/v1');
  const [loading, setLoading] = useState(true);

  // Carregar dados salvos ao iniciar o app
  React.useEffect(() => {
    async function loadStorageData() {
      setLoading(true);
      
      try {
        // Carrega os dados do usuário e da API
        const [storedUser, storedApiUrl, storedSession] = await Promise.all([
          AsyncStorage.getItem(USER_STORAGE_KEY),
          AsyncStorage.getItem(API_URL_STORAGE_KEY),
          AsyncStorage.getItem(SESSION_STORAGE_KEY)
        ]);
        
        // Verifica se o usuário está logado e se a sessão é válida
        if (storedUser && storedSession) {
          setUser(JSON.parse(storedUser));
          console.log('Usuário recuperado do storage:', JSON.parse(storedUser).nome);
        }
        
        // Configura a URL da API
        if (storedApiUrl) {
          setApiUrl(storedApiUrl);
        }
        
        // Garantir que temos um ID de dispositivo
        await getDeviceId();
      } catch (error) {
        console.error('Erro ao carregar dados do storage:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadStorageData();
  }, []);

  // Função para obter o ID único do dispositivo
  const getDeviceId = async (): Promise<string | null> => {
    try {
      // Verifica se já existe um ID armazenado
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
      
      // Se já existe um ID armazenado, retorna ele
      if (deviceId) {
        console.log('ID do dispositivo recuperado do storage:', deviceId);
        return deviceId;
      }
      
      // Se não existir, obtém o ID único do dispositivo
      let uniqueId = '';
      
      // Tenta obter o ID único do dispositivo de várias fontes
      if (Platform.OS === 'ios') {
        uniqueId = await Application.getIosIdForVendorAsync() || '';
      } else if (Platform.OS === 'android') {
        uniqueId = await Application.getAndroidId() || '';
      }
      
      // Se não conseguiu obter o ID, tenta outras fontes
      if (!uniqueId) {
        // Tenta obter o ID de instalação
        uniqueId = Constants.installationId || '';
      }
      
      // Se ainda não conseguiu, usa informações do dispositivo
      if (!uniqueId) {
        const deviceName = Device.deviceName || '';
        const deviceModel = Device.modelName || '';
        const deviceBrand = Device.brand || '';
        const deviceOsVersion = Device.osVersion || '';
        const deviceOsBuildId = Device.osBuildId || '';
        
        // Combina informações do dispositivo para criar um ID único
        uniqueId = `${deviceBrand}_${deviceModel}_${deviceName}_${deviceOsVersion}_${deviceOsBuildId}`;
      }
      
      // Adiciona um timestamp para garantir unicidade
      uniqueId = `${uniqueId}_${Date.now()}`;
      
      // Formata o ID para ser mais amigável e remove caracteres especiais
      deviceId = uniqueId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      
      console.log('ID único do dispositivo gerado:', deviceId);
      
      return deviceId;
    } catch (error) {
      console.error('Erro ao obter ID do dispositivo:', error);
      return null;
    }
  };

  // Função para registrar o aparelho na API
  const registerDevice = async (): Promise<string | null> => {
    try {
      // Obtém o ID do dispositivo
      const deviceId = await getDeviceId();
      
      if (!deviceId) {
        console.error('Não foi possível obter o ID do dispositivo');
        return null;
      }
      
      console.log('Registrando dispositivo com ID:', deviceId);
      console.log('URL da API para registro:', `${apiUrl}/register_aparelho.php`);
      
      // Salva o ID do dispositivo no AsyncStorage antes de enviar para a API
      await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
      
      const response = await axios.post(`${apiUrl}/register_aparelho.php`, {
        codaparelho: deviceId,
        use_device_id: true // Indica para a API usar o ID enviado
      });
      
      console.log('Resposta do registro de dispositivo:', response.data);
      
      if (response.data.success) {
        // Verifica se a API retornou um código diferente e atualiza se necessário
        if (response.data.codaparelho && response.data.codaparelho !== deviceId) {
          console.log('API retornou um código diferente, atualizando local:', response.data.codaparelho);
          await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, response.data.codaparelho);
          return response.data.codaparelho;
        }
        
        return deviceId;
      } else {
        console.error('Erro ao registrar dispositivo:', response.data.message);
        return null;
      }
    } catch (error) {
      console.error('Erro ao registrar dispositivo:', error);
      return null;
    }
  };

  // Função para fazer login
  const signIn = async (rca: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      console.log('URL da API para login:', `${apiUrl}/login_vendedor.php`);
      
      // Primeiro, registra o dispositivo
      const deviceCode = await registerDevice();
      if (!deviceCode) {
        console.warn('Não foi possível registrar o dispositivo, mas continuando com o login');
      }
      
      // Tenta fazer login
      const response = await axios.post(`${apiUrl}/login_vendedor.php`, {
        rca,
        password
      });
      
      console.log('Resposta do login:', response.data);
      
      if (response.data.success) {
        const userData = {
          id: response.data.id,
          rca: rca,
          nome: response.data.nome,
          token: response.data.token,
          filial_id: response.data.filial_id
        };
        
        // Salva os dados do usuário
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
        
        // Cria uma sessão com timestamp
        const sessionData = {
          timestamp: Date.now(),
          isActive: true
        };
        await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
        
        setUser(userData);
        setLoading(false);
        return true;
      } else {
        setLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setLoading(false);
      return false;
    }
  };

  // Função para fazer logout
  const signOut = async () => {
    try {
      // Preserva o ID do dispositivo
      const deviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
      const apiUrlValue = await AsyncStorage.getItem(API_URL_STORAGE_KEY);
      
      // Limpa todos os dados do AsyncStorage
      await AsyncStorage.clear();
      
      // Restaura o ID do dispositivo e a URL da API
      if (deviceId) {
        await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
      }
      
      if (apiUrlValue) {
        await AsyncStorage.setItem(API_URL_STORAGE_KEY, apiUrlValue);
      }
      
      // Remove o usuário do estado
      setUser(null);
      console.log('Logout realizado com sucesso');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // Função para configurar a URL da API
  const setApiBaseUrl = async (url: string) => {
    await AsyncStorage.setItem(API_URL_STORAGE_KEY, url);
    setApiUrl(url);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      apiUrl,
      loading,
      signIn, 
      signOut,
      setApiBaseUrl,
      getDeviceId
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar o contexto de autenticação
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  
  return context;
}

export default AuthContext; 