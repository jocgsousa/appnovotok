import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  SafeAreaView,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { TextInputMask } from 'react-native-masked-text';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Tipos
type PcActivi = {
  id: number;
  codativi: string;
  ramo: string;
  created_at: string;
  updated_at: string;
};

type PcCidades = {
  id: number;
  codcidade: string;
  nomecidade: string;
  uf: string;
  created_at: string;
  updated_at: string;
};

type PcEstados = {
  id: number;
  uf: string;
};

type PcFilial = {
  id: string;
  name: string;
  codigo: string;
};

type FormData = {
  name: string;
  person_identification_number: string;
  email: string;
  commercial_zip_code: string;
  commercial_address: string;
  commercial_address_number: string;
  business_district: string;
  billingPhone: string;
  business_city: string;
  city_id: string | null;
  activity_id: string;
  filial: string | null;
  rca: string | null;
  data_nascimento: string | null;
  trade_name: string | null;
  state_inscription: string;
  email_nfe: string | null;
  billing_id: string;
  square_id: string;
};

type RespostaAtividades = {
  success: boolean;
  atividades: PcActivi[];
};

type RespostaCidades = {
  success: boolean;
  cidades: PcCidades[];
};

type RespostaFiliais = {
  success: boolean;
  filiais: PcFilial[];
};

const NewClientScreen = () => {
  const navigation = useNavigation();
  const { apiUrl, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [atividades, setAtividades] = useState<PcActivi[]>([]);
  const [pccidades, setPcCidades] = useState<PcCidades[]>([]);
  const [pcestados, setPcEstados] = useState<PcEstados[]>([]);
  const [typeNumber, setTypeNumber] = useState<'cpf' | 'cnpj'>('cpf');
  const [informarCep, setInformarCep] = useState<boolean>(true);
  const [cepValido, setCepValido] = useState<boolean>(false);
  const [estadoSelecionado, setEstadoSelecionado] = useState<string>('PA');
  const [cidadesFiltradas, setCidadesFiltradas] = useState<PcCidades[]>([]);
  
  // Estado do formulário
  const [formData, setFormData] = useState<FormData>({
    name: '',
    person_identification_number: '',
    email: '',
    commercial_zip_code: '',
    commercial_address: '',
    commercial_address_number: '',
    business_district: '',
    billingPhone: '',
    business_city: '',
    city_id: null,
    activity_id: '',
    filial: '',
    rca: user?.rca || null,
    data_nascimento: null,
    trade_name: null,
    state_inscription: 'ISENTO',
    email_nfe: null,
    billing_id: 'D',
    square_id: '1',
  });

  // Filiais disponíveis
  const [filiais, setFiliais] = useState<PcFilial[]>([]);

  // Estado de loading específico para filiais
  const [loadingFiliais, setLoadingFiliais] = useState<boolean>(false);

  // Carregar dados ao iniciar
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Primeiro carrega dados locais (rápido, sem loading)
        await loadLocalData();
        
        // Depois carrega dados da API em segundo plano
        loadApiDataInBackground();
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      }
    };
    
    loadInitialData();
  }, []);

  // Função para carregar dados locais
  const loadLocalData = async () => {
    setLoading(true);
    try {
      // Carregar dados salvos localmente
      await loadSavedActivities();
      await loadSavedCities();
      await loadSavedFiliais();
      await loadUserFilial();
    } catch (error) {
      console.error('Erro ao carregar dados locais:', error);
    } finally {
      setLoading(false);
    }
  };

  // Função para carregar dados da API em segundo plano
  const loadApiDataInBackground = async () => {
    try {
      // Não ativa o loading para estas operações
      await loadActivitiesFromApi();
      await loadCitiesFromApi();
      await loadFiliaisFromApi();
    } catch (error) {
      console.error('Erro ao carregar dados da API em segundo plano:', error);
    }
  };

  // Carregar atividades salvas localmente
  const loadSavedActivities = async () => {
    try {
      const offlineActivities = await AsyncStorage.getItem('@BuscaPreco:activities');
      if (offlineActivities) {
        setAtividades(JSON.parse(offlineActivities));
      }
    } catch (error) {
      console.error('Erro ao carregar atividades salvas:', error);
    }
  };

  // Carregar atividades da API
  const loadActivitiesFromApi = async () => {
    try {
      const response = await axios.get<RespostaAtividades>(`${apiUrl}/listar_ativi.php`);
      if (response.data.success) {
        setAtividades(response.data.atividades);
        // Salvar para uso offline
        await AsyncStorage.setItem('@BuscaPreco:activities', JSON.stringify(response.data.atividades));
      }
    } catch (error) {
      console.warn('Erro ao buscar atividades online:', error);
    }
  };

  // Carregar cidades salvas localmente
  const loadSavedCities = async () => {
    try {
      const offlineCities = await AsyncStorage.getItem('@BuscaPreco:cities');
      if (offlineCities) {
        const cities = JSON.parse(offlineCities);
        setPcCidades(cities);
        
        const offlineStates = await AsyncStorage.getItem('@BuscaPreco:states');
        if (offlineStates) {
          setPcEstados(JSON.parse(offlineStates));
        } else {
          // Extrair estados das cidades offline com tipagem explícita
          const ufs: string[] = cities.map((cidade: PcCidades) => cidade.uf);
          const uniqueUfs: string[] = [...new Set(ufs)].sort();
          const estadosUnicos: PcEstados[] = uniqueUfs.map(uf => ({ id: 0, uf }));
          
          setPcEstados(estadosUnicos);
          await AsyncStorage.setItem('@BuscaPreco:states', JSON.stringify(estadosUnicos));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar cidades salvas:', error);
    }
  };

  // Carregar cidades da API
  const loadCitiesFromApi = async () => {
    try {
      const response = await axios.get<RespostaCidades>(`${apiUrl}/listar_cidades.php`);
      if (response.data.success) {
        setPcCidades(response.data.cidades);
        
        // Extrair estados únicos com tipagem explícita
        const ufs: string[] = response.data.cidades.map(cidade => cidade.uf);
        const uniqueUfs: string[] = [...new Set(ufs)].sort();
        const estadosUnicos: PcEstados[] = uniqueUfs.map(uf => ({ id: 0, uf }));
        
        setPcEstados(estadosUnicos);
        
        // Salvar para uso offline
        await AsyncStorage.setItem('@BuscaPreco:cities', JSON.stringify(response.data.cidades));
        await AsyncStorage.setItem('@BuscaPreco:states', JSON.stringify(estadosUnicos));
      }
    } catch (error) {
      console.warn('Erro ao buscar cidades online:', error);
    }
  };

  // Carregar filiais salvas localmente
  const loadSavedFiliais = async () => {
    try {
      const offlineFiliais = await AsyncStorage.getItem('@BuscaPreco:filiais');
      if (offlineFiliais) {
        console.log('Usando filiais do cache');
        const filiaisCache = JSON.parse(offlineFiliais);
        setFiliais(filiaisCache);
        
        // Definir filial padrão apenas se não houver uma definida pelo usuário
        if (!formData.filial && !user?.filial_id) {
          console.log('Definindo filial do cache como padrão');
          setFormData(prev => ({
            ...prev,
            filial: filiaisCache[0].id
          }));
        }
      } else {
        console.log('Usando filiais padrão');
        // Fallback para filiais padrão caso não consiga buscar do cache
        const filiaisPadrao = [
          { id: '1', name: 'CD', codigo: '1' },
          { id: '2', name: 'São Félix', codigo: '2' },
          { id: '3', name: 'Cidade Nova', codigo: '3' },
          { id: '4', name: 'Velha Marabá', codigo: '4' },
          { id: '5', name: 'Itupiranga', codigo: '5' },
          { id: '6', name: 'Shopping', codigo: '6' },
          { id: '7', name: 'Folha 28', codigo: '7' },
          { id: '8', name: 'Parauapebas', codigo: '8' }
        ];
        setFiliais(filiaisPadrao);
        
        // Definir filial padrão apenas se não houver uma definida pelo usuário
        if (!formData.filial && !user?.filial_id) {
          console.log('Definindo filial padrão da lista fixa');
          setFormData(prev => ({
            ...prev,
            filial: filiaisPadrao[0].id
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar filiais salvas:', error);
    }
  };

  // Carregar filiais da API
  const loadFiliaisFromApi = async () => {
    try {
      // Verificar primeiro se o usuário já tem uma filial_id definida
      if (user?.filial_id) {
        console.log('Usuário já tem filial_id definida:', user.filial_id);
      }
      
      // Obter token de autenticação
      const token = user?.token;
      
      if (!token) {
        console.warn('Token de autenticação não disponível para buscar filiais');
        throw new Error('Token de autenticação não disponível');
      }
      
      const response = await axios.get(`${apiUrl}/listar_filiais.php`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data) {
        console.log('Resposta da API de filiais:', response.data);
        
        // Verificar se a resposta é um array
        const filiaisData = Array.isArray(response.data) ? response.data : 
                          (response.data.filiais ? response.data.filiais : []);
        
        if (filiaisData.length === 0) {
          console.warn('Nenhum dado de filial válido na resposta da API:', response.data);
        }
        
        // Transformar os dados no formato esperado pelo componente
        const filiaisFormatadas = filiaisData.map((filial: any) => {
          // Verificar se temos um objeto válido
          if (!filial || typeof filial !== 'object') {
            console.warn('Filial inválida nos dados:', filial);
            return null;
          }
          
          return {
            id: filial.codigo?.toString() || filial.id?.toString() || '',
            name: filial.nome_fantasia || filial.name || filial.razao_social || 'Filial sem nome',
            codigo: filial.codigo?.toString() || ''
          };
        }).filter(Boolean); // Remover itens nulos ou indefinidos
        
        console.log('Filiais formatadas:', filiaisFormatadas);
        
        if (filiaisFormatadas.length > 0) {
          setFiliais(filiaisFormatadas);
          
          // Salvar para uso offline
          await AsyncStorage.setItem('@BuscaPreco:filiais', JSON.stringify(filiaisFormatadas));
          
          // Definir filial padrão apenas se não houver uma definida pelo usuário
          if (!formData.filial && !user?.filial_id) {
            console.log('Definindo filial padrão (primeira da lista)');
            setFormData(prev => ({
              ...prev,
              filial: filiaisFormatadas[0].id
            }));
          }
        }
      }
    } catch (error) {
      console.warn('Erro ao buscar filiais online:', error);
    }
  };

  // Filtrar cidades por estado selecionado
  useEffect(() => {
    if (pccidades.length > 0 && estadoSelecionado) {
      const filtered = pccidades.filter(cidade => cidade.uf === estadoSelecionado);
      setCidadesFiltradas(filtered);
    }
  }, [estadoSelecionado, pccidades]);

  // Verificar tipo de documento (CPF ou CNPJ)
  useEffect(() => {
    const documentNumber = formData.person_identification_number.replace(/\D/g, '');
    if (documentNumber.length > 11) {
      setTypeNumber('cnpj');
    } else {
      setTypeNumber('cpf');
    }
  }, [formData.person_identification_number]);

  // Atualizar email_nfe quando o email mudar
  useEffect(() => {
    if (formData.email) {
      setFormData(prev => ({
        ...prev,
        email_nfe: formData.email
      }));
    }
  }, [formData.email]);

  // Extrair primeiro nome para trade_name quando o nome mudar
  useEffect(() => {
    if (formData.name) {
      const firstName = formData.name.trim().split(' ')[0];
      setFormData(prev => ({
        ...prev,
        trade_name: firstName
      }));
    }
  }, [formData.name]);

  // Atualizar a filial quando o usuário ou as filiais mudarem
  useEffect(() => {
    // Verificar se temos um usuário com filial_id e se as filiais foram carregadas
    if (user?.filial_id && filiais.length > 0) {
      console.log('useEffect: Atualizando filial do usuário quando as dependências mudaram');
      console.log('Filial do usuário:', user.filial_id);
      console.log('Filial atual no form:', formData.filial);
      
      // Verificar se a filial atual é diferente da filial do usuário
      if (formData.filial !== String(user.filial_id)) {
        console.log('Atualizando filial para:', user.filial_id);
        setFormData(prev => ({
          ...prev,
          filial: String(user.filial_id)
        }));
      }
    }
  }, [user, filiais]);

  // Carregar filial salva
  const loadSavedFilial = async () => {
    try {
      // Verificar se o usuário tem filial_id primeiro
      if (user?.filial_id) {
        setFormData(prev => ({ ...prev, filial: String(user.filial_id) }));
        console.log('Usando filial_id associada ao usuário:', user.filial_id);
        return;
      }

      // Se não tiver filial_id no usuário, tentar carregar do AsyncStorage
      const savedFilial = await AsyncStorage.getItem('@BuscaPreco:filial');
      if (savedFilial) {
        setFormData(prev => ({ ...prev, filial: savedFilial }));
        console.log('Usando filial salva no AsyncStorage:', savedFilial);
      } else {
        console.log('Nenhuma filial salva encontrada');
      }
    } catch (error) {
      console.error('Erro ao carregar filial salva:', error);
    }
  };

  // Carregar atividades
  const loadActivities = async () => {
    try {
      const offlineActivities = await AsyncStorage.getItem('@BuscaPreco:activities');
      
      // Tentar buscar atividades online
      try {
        const response = await axios.get<RespostaAtividades>(`${apiUrl}/listar_ativi.php`);
        if (response.data.success) {
          setAtividades(response.data.atividades);
          // Salvar para uso offline
          await AsyncStorage.setItem('@BuscaPreco:activities', JSON.stringify(response.data.atividades));
          return;
        }
      } catch (error) {
        console.warn('Erro ao buscar atividades online, usando cache:', error);
      }
      
      // Se falhou online ou não tem dados, usar offline
      if (offlineActivities) {
        setAtividades(JSON.parse(offlineActivities));
      }
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
      Alert.alert('Erro', 'Não foi possível carregar as atividades');
    }
  };

  // Carregar cidades
  const loadCities = async () => {
    try {
      const offlineCities = await AsyncStorage.getItem('@BuscaPreco:cities');
      
      // Tentar buscar cidades online
      try {
        const response = await axios.get<RespostaCidades>(`${apiUrl}/listar_cidades.php`);
        if (response.data.success) {
          setPcCidades(response.data.cidades);
          
          // Extrair estados únicos de forma simplificada com tipagem explícita
          const ufs: string[] = response.data.cidades.map(cidade => cidade.uf);
          const uniqueUfs: string[] = [...new Set(ufs)].sort();
          const estadosArray: PcEstados[] = uniqueUfs.map(uf => ({ id: 0, uf }));
          
          setPcEstados(estadosArray);
          
          // Salvar para uso offline
          await AsyncStorage.setItem('@BuscaPreco:cities', JSON.stringify(response.data.cidades));
          await AsyncStorage.setItem('@BuscaPreco:states', JSON.stringify(estadosArray));
          return;
        }
      } catch (error) {
        console.warn('Erro ao buscar cidades online, usando cache:', error);
      }
      
      // Se falhou online ou não tem dados, usar offline
      if (offlineCities) {
        const cities = JSON.parse(offlineCities);
        setPcCidades(cities);
        
        const offlineStates = await AsyncStorage.getItem('@BuscaPreco:states');
        if (offlineStates) {
          setPcEstados(JSON.parse(offlineStates));
        } else {
          // Extrair estados das cidades offline de forma simplificada com tipagem explícita
          const ufs: string[] = cities.map((cidade: PcCidades) => cidade.uf);
          const uniqueUfs: string[] = [...new Set(ufs)].sort();
          const estadosArray: PcEstados[] = uniqueUfs.map(uf => ({ id: 0, uf }));
          
          setPcEstados(estadosArray);
          await AsyncStorage.setItem('@BuscaPreco:states', JSON.stringify(estadosArray));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar cidades:', error);
      Alert.alert('Erro', 'Não foi possível carregar as cidades');
    }
  };

  // Carregar filiais
  const loadFiliais = async () => {
    setLoadingFiliais(true);
    try {
      // Verificar primeiro se o usuário já tem uma filial_id definida
      if (user?.filial_id) {
        console.log('Usuário já tem filial_id definida:', user.filial_id);
      }
      
      const offlineFiliais = await AsyncStorage.getItem('@BuscaPreco:filiais');
      
      // Tentar buscar filiais online
      try {
        // Obter token de autenticação
        const token = user?.token;
        
        if (!token) {
          console.warn('Token de autenticação não disponível para buscar filiais');
          throw new Error('Token de autenticação não disponível');
        }
        
        const response = await axios.get(`${apiUrl}/listar_filiais.php`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data) {
          console.log('Resposta da API de filiais:', response.data);
          
          // Verificar se a resposta é um array
          const filiaisData = Array.isArray(response.data) ? response.data : 
                             (response.data.filiais ? response.data.filiais : []);
          
          if (filiaisData.length === 0) {
            console.warn('Nenhum dado de filial válido na resposta da API:', response.data);
          }
          
          // Transformar os dados no formato esperado pelo componente
          const filiaisFormatadas = filiaisData.map((filial: any) => {
            // Verificar se temos um objeto válido
            if (!filial || typeof filial !== 'object') {
              console.warn('Filial inválida nos dados:', filial);
              return null;
            }
            
            return {
              id: filial.codigo?.toString() || filial.id?.toString() || '',
              name: filial.nome_fantasia || filial.name || filial.razao_social || 'Filial sem nome',
              codigo: filial.codigo?.toString() || ''
            };
          }).filter(Boolean); // Remover itens nulos ou indefinidos
          
          console.log('Filiais formatadas:', filiaisFormatadas);
          
          if (filiaisFormatadas.length > 0) {
            setFiliais(filiaisFormatadas);
            
            // Salvar para uso offline
            await AsyncStorage.setItem('@BuscaPreco:filiais', JSON.stringify(filiaisFormatadas));
            
            // Definir filial padrão apenas se não houver uma definida pelo usuário
            if (!formData.filial && !user?.filial_id) {
              console.log('Definindo filial padrão (primeira da lista)');
              setFormData(prev => ({
                ...prev,
                filial: filiaisFormatadas[0].id
              }));
            }
          } else {
            throw new Error('Nenhuma filial retornada pela API');
          }
          
          setLoadingFiliais(false);
          return;
        }
      } catch (error) {
        console.warn('Erro ao buscar filiais online, usando cache:', error);
      }
      
      // Se falhou online ou não tem dados, usar offline
      if (offlineFiliais) {
        console.log('Usando filiais do cache');
        const filiaisCache = JSON.parse(offlineFiliais);
        setFiliais(filiaisCache);
        
        // Definir filial padrão apenas se não houver uma definida pelo usuário
        if (!formData.filial && !user?.filial_id) {
          console.log('Definindo filial do cache como padrão');
          setFormData(prev => ({
            ...prev,
            filial: filiaisCache[0].id
          }));
        }
      } else {
        console.log('Usando filiais padrão');
        // Fallback para filiais padrão caso não consiga buscar da API nem do cache
        const filiaisPadrao = [
          { id: '1', name: 'CD', codigo: '1' },
          { id: '2', name: 'São Félix', codigo: '2' },
          { id: '3', name: 'Cidade Nova', codigo: '3' },
          { id: '4', name: 'Velha Marabá', codigo: '4' },
          { id: '5', name: 'Itupiranga', codigo: '5' },
          { id: '6', name: 'Shopping', codigo: '6' },
          { id: '7', name: 'Folha 28', codigo: '7' },
          { id: '8', name: 'Parauapebas', codigo: '8' }
        ];
        setFiliais(filiaisPadrao);
        await AsyncStorage.setItem('@BuscaPreco:filiais', JSON.stringify(filiaisPadrao));
        
        // Definir filial padrão apenas se não houver uma definida pelo usuário
        if (!formData.filial && !user?.filial_id) {
          console.log('Definindo filial padrão da lista fixa');
          setFormData(prev => ({
            ...prev,
            filial: filiaisPadrao[0].id
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar filiais:', error);
      // Usar filiais padrão em caso de erro
      const filiaisPadrao = [
        { id: '1', name: 'CD', codigo: '1' },
        { id: '2', name: 'São Félix', codigo: '2' },
        { id: '3', name: 'Cidade Nova', codigo: '3' },
        { id: '4', name: 'Velha Marabá', codigo: '4' },
        { id: '5', name: 'Itupiranga', codigo: '5' },
        { id: '6', name: 'Shopping', codigo: '6' },
        { id: '7', name: 'Folha 28', codigo: '7' },
        { id: '8', name: 'Parauapebas', codigo: '8' }
      ];
      setFiliais(filiaisPadrao);
      
      // Definir filial padrão apenas se não houver uma definida pelo usuário
      if (!formData.filial && !user?.filial_id) {
        console.log('Definindo filial padrão da lista fixa (tratamento de erro)');
        setFormData(prev => ({
          ...prev,
          filial: filiaisPadrao[0].id
        }));
      }
    } finally {
      setLoadingFiliais(false);
    }
  };

  // Atualizar campo do formulário
  const handleChange = (key: keyof FormData, value: string) => {
    // Campos que devem ser exibidos em maiúsculas
    if (['name', 'commercial_address', 'business_district', 'business_city'].includes(key)) {
      // Converter para letras maiúsculas
      value = value.toUpperCase();
    }

    if (key === 'person_identification_number') {
      // Verificar comprimento para determinar se é CPF ou CNPJ
      const numericValue = value.replace(/\D/g, '');
      setTypeNumber(numericValue.length > 11 ? 'cnpj' : 'cpf');
    }
    
    if (key === 'commercial_address' && value.length > 40) {
      // Limitar o campo de endereço a 40 caracteres
      return;
    }
    
    if (key === 'commercial_zip_code' && value.length === 9) {
      // Buscar endereço pelo CEP quando tiver 9 caracteres (com hífen)
      buscarCep(value);
    }
    
    if (key === 'business_city') {
      // Quando a cidade é alterada, tenta encontrar o ID da cidade no estado atual
      const cidadeNormalizada = normalizeText(value);
      const cidadesDoEstado = pccidades.filter(c => c.uf === estadoSelecionado);
      
      const cidadeEncontrada = cidadesDoEstado.find(
        cidade => normalizeText(cidade.nomecidade) === cidadeNormalizada
      );
      
      if (cidadeEncontrada) {
        setFormData(prev => ({
          ...prev,
          [key]: value,
          city_id: cidadeEncontrada.codcidade // Use codcidade instead of id
        }));
        return;
      }
    }

    // Atualização para o campo email (atualiza também email_nfe)
    if (key === 'email') {
      setFormData(prev => ({ 
        ...prev, 
        [key]: value,
        email_nfe: value 
      }));
      return;
    }

    // Atualização para o campo name (atualiza também trade_name com primeiro nome)
    if (key === 'name') {
      const firstName = value.trim().split(' ')[0];
      setFormData(prev => ({ 
        ...prev, 
        [key]: value,
        trade_name: firstName 
      }));
      return;
    }
    
    // Atualização padrão para outros campos
    setFormData(prev => ({ ...prev, [key]: value }));
  };
  
  // Função para tratar a mudança de estado
  const handleEstadoChange = (uf: string) => {
    setEstadoSelecionado(uf);
    
    // Limpar cidade quando o estado muda
    setFormData(prev => ({
      ...prev,
      business_city: '',
      city_id: null
    }));
  };
  
  // Função para validar a cidade selecionada
  const validateCity = (cityName: string): boolean => {
    if (!cityName.trim()) return false;
    
    const cidadeNormalizada = normalizeText(cityName);
    const cidadesDoEstado = pccidades.filter(c => c.uf === estadoSelecionado);
    
    // Busca exata
    const cidadeExata = cidadesDoEstado.find(
      cidade => normalizeText(cidade.nomecidade) === cidadeNormalizada
    );
    
    if (cidadeExata) {
      setFormData(prev => ({
        ...prev,
        city_id: cidadeExata.codcidade // Use codcidade instead of id
      }));
      return true;
    }
    
    // Busca por correspondência parcial
    const cidadeParcial = cidadesDoEstado.find(
      cidade => 
        normalizeText(cidade.nomecidade).includes(cidadeNormalizada) || 
        cidadeNormalizada.includes(normalizeText(cidade.nomecidade))
    );
    
    if (cidadeParcial) {
      setFormData(prev => ({
        ...prev,
        city_id: cidadeParcial.codcidade // Use codcidade instead of id
      }));
      return true;
    }
    
    return false;
  };
  
  // Função para alternar entre usar CEP ou não
  // const toggleUseCep = (useIt: boolean) => {
  //   setInformarCep(useIt);
    
  //   if (!useIt) {
  //     // Se desabilitar CEP, limpar o campo e status de validação
  //     setFormData(prev => ({
  //       ...prev,
  //       commercial_zip_code: ''
  //     }));
  //     setCepValido(false);
  //   }
  // };

  // Buscar endereço pelo CEP
  const buscarCep = async (cep: string) => {
    try {
      const cepLimpo = cep.replace(/\D/g, '');
      if (cepLimpo.length !== 8) return;
      
      // Usar loading discreto ao invés de loading completo
      setLoading(true);
      const response = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      
      if (!response.data.erro) {
        setCepValido(true);
        setFormData(prev => ({
          ...prev,
          commercial_address: response.data.logradouro ? response.data.logradouro.toUpperCase() : prev.commercial_address,
          business_district: response.data.bairro ? response.data.bairro.toUpperCase() : prev.business_district,
          business_city: response.data.localidade ? response.data.localidade.toUpperCase() : prev.business_city,
        }));
        
        // Buscar ID da cidade
        const cidade = pccidades.find(
          cidade => 
            normalizeText(cidade.nomecidade) === normalizeText(response.data.localidade) && 
            cidade.uf === response.data.uf
        );
        
        if (cidade) {
          setFormData(prev => ({
            ...prev,
            city_id: cidade.codcidade, // Use codcidade instead of id
          }));
        } else {
          // Se não encontrar cidade exata, buscar por correspondência parcial
          const cidadesUF = pccidades.filter(c => c.uf === response.data.uf);
          const cidadeSimilar = cidadesUF.find(c => 
            normalizeText(c.nomecidade).includes(normalizeText(response.data.localidade)) || 
            normalizeText(response.data.localidade).includes(normalizeText(c.nomecidade))
          );
          
          if (cidadeSimilar) {
            setFormData(prev => ({
              ...prev,
              city_id: cidadeSimilar.codcidade, // Use codcidade instead of id
            }));
          }
        }
      } else {
        setCepValido(false);
        Alert.alert('CEP Inválido', 'O CEP informado não foi encontrado. Tente informar os dados manualmente.');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      setCepValido(false);
      Alert.alert('Erro', 'Não foi possível buscar o endereço pelo CEP. Verifique sua conexão com a internet.');
    } finally {
      setLoading(false);
    }
  };

  // Normalizar texto (remover acentos, etc)
  const normalizeText = (text: string): string =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ');

  // Função para validar CPF
  const isValidCPF = (cpf: string): boolean => {
    cpf = cpf.replace(/[^\d]/g, '');
    
    // Verificações iniciais
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    
    // Cálculo dos dígitos verificadores
    const calcDigit = (slice: string): number => {
      let sum = 0;
      for (let i = 0; i < slice.length; i++) {
        sum += parseInt(slice[i]) * (slice.length + 1 - i);
      }
      const mod = sum % 11;
      return mod < 2 ? 0 : 11 - mod;
    };
    
    // Verifica o primeiro dígito
    const digit1 = calcDigit(cpf.substring(0, 9));
    if (digit1 !== parseInt(cpf[9])) return false;
    
    // Verifica o segundo dígito
    const digit2 = calcDigit(cpf.substring(0, 10));
    if (digit2 !== parseInt(cpf[10])) return false;
    
    return true;
  };

  // Função para validar CNPJ
  const isValidCNPJ = (cnpj: string): boolean => {
    cnpj = cnpj.replace(/[^\d]/g, '');
    
    // Verificações iniciais
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    
    // Cálculo dos dígitos verificadores
    const calcDigit = (slice: string, weights: number[]): number => {
      let sum = 0;
      for (let i = 0; i < slice.length; i++) {
        sum += parseInt(slice[i]) * weights[i];
      }
      const mod = sum % 11;
      return mod < 2 ? 0 : 11 - mod;
    };
    
    // Pesos para o cálculo do primeiro dígito
    const weight1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    // Pesos para o cálculo do segundo dígito
    const weight2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    // Verifica o primeiro dígito
    const digit1 = calcDigit(cnpj.substring(0, 12), weight1);
    if (digit1 !== parseInt(cnpj[12])) return false;
    
    // Verifica o segundo dígito
    const digit2 = calcDigit(cnpj.substring(0, 13), weight2);
    if (digit2 !== parseInt(cnpj[13])) return false;
    
    return true;
  };

  // Função para validar email
  const isValidEmail = (email: string): boolean => {
    if (!email || !email.trim()) return false;
    
    // Verificar se contém '@'
    if (!email.includes('@')) return false;
    
    // Dividir em partes antes e depois do '@'
    const parts = email.split('@');
    
    // Deve ter exatamente duas partes (antes e depois do @)
    if (parts.length !== 2) return false;
    
    const [localPart, domainPart] = parts;
    
    // Verificar se ambas as partes existem e não são vazias
    if (!localPart || !localPart.trim() || !domainPart || !domainPart.trim()) return false;
    
    // Verificar se a parte do domínio contém pelo menos um ponto
    if (!domainPart.includes('.')) return false;
    
    // Verificar se não há pontos consecutivos no domínio
    if (domainPart.includes('..')) return false;
    
    // Verificar se não começa ou termina com ponto
    if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
    
    // Verificar se há conteúdo após o último ponto (extensão do domínio)
    const domainParts = domainPart.split('.');
    const lastPart = domainParts[domainParts.length - 1];
    if (!lastPart || lastPart.length < 2) return false;
    
    return true;
  };

  // Validar campos do formulário
  const validateFields = (): boolean => {
    const errors = [];
    
    // Validar nome
    if (!formData.name.trim()) {
      errors.push('Nome é obrigatório');
    } else if (formData.name.trim().length < 3) {
      errors.push('Nome deve ter pelo menos 3 caracteres');
    }

    // Validar CPF/CNPJ
    if (!formData.person_identification_number.trim()) {
      errors.push('CPF/CNPJ é obrigatório');
    } else {
      const cleanNumber = formData.person_identification_number.replace(/\D/g, '');
      if (cleanNumber.length <= 11) {
        // Validação de CPF
        if (!isValidCPF(cleanNumber)) {
          errors.push('CPF inválido');
        }
      } else {
        // Validação de CNPJ
        if (!isValidCNPJ(cleanNumber)) {
          errors.push('CNPJ inválido');
        }
      }
    }

    // Validar email (se fornecido)
    if (formData.email && formData.email.trim()) {
      if (!isValidEmail(formData.email.trim())) {
        errors.push('Email deve conter @ e um formato válido (ex: usuario@dominio.com)');
      }
    }

    // Validar telefone
    if (!formData.billingPhone.trim()) {
      errors.push('Telefone é obrigatório');
    } else if (formData.billingPhone.replace(/\D/g, '').length < 10) {
      errors.push('Telefone deve ter pelo menos 10 dígitos');
    }

    // Validar se o CEP foi informado e se a quantidade de digitos é de 8
    if (!formData.commercial_zip_code.trim()) {
      errors.push('CEP é obrigatório');
    } else if (formData.commercial_zip_code.replace(/\D/g, '').length !== 8) {
      errors.push('CEP deve ter exatamente 8 dígitos');
    }   

    // Validar endereço
    if (!formData.commercial_address.trim()) {
      errors.push('Endereço é obrigatório');
    }

    // Validar número
    if (!formData.commercial_address_number.trim()) {
      errors.push('Número é obrigatório');
    }

    // Validar bairro
    if (!formData.business_district.trim()) {
      errors.push('Bairro é obrigatório');
    }

    // Validar cidade
    if (!formData.business_city.trim()) {
      errors.push('Cidade é obrigatória');
    }

    // Validar ID da cidade
    if (!formData.city_id) {
      errors.push('Selecione uma cidade válida');
    }

    // Validar atividade
    if (!formData.activity_id) {
      errors.push('Ramo de atividade é obrigatório');
    }

    // Validar filial
    if (!formData.filial) {
      errors.push('Filial é obrigatória');
    }
    
    // Validar RCA (código de vendedor)
    if (!formData.rca) {
      errors.push('Código do vendedor (RCA) é obrigatório');
    }
    
    // Verificar se o CEP é obrigatório e válido
    if (informarCep && !cepValido) {
      errors.push('CEP informado é inválido ou o serviço de busca está indisponível');
    }

    // Se houver erros, exibe o primeiro
    if (errors.length > 0) {
      Alert.alert('Erro de validação', errors[0]);
      return false;
    }

    return true;
  };

  // Enviar formulário
  const handleSubmit = async () => {
    if (!validateFields()) return;

    try {
      // Usar loading discreto
      setLoading(true);
      
      // Preparar os dados formatados para envio
      const formattedData = {
        ...formData,
        person_identification_number: formData.person_identification_number.replace(/\D/g, ''),
        commercial_zip_code: formData.commercial_zip_code.replace(/\D/g, ''),
        billingPhone: formData.billingPhone.replace(/\D/g, ''),
        // Garantir que os campos adicionados estejam presentes
        trade_name: formData.trade_name || formData.name.split(' ')[0],
        state_inscription: formData.state_inscription || 'ISENTO',
        // Usar email padrão se não for fornecido
        email: formData.email || 'email@gmail.com',
        email_nfe: formData.email_nfe || formData.email || 'email@gmail.com',
        billing_id: formData.billing_id || 'D',
        square_id: formData.square_id || '1'
      };

      const response = await axios.post(`${apiUrl}/cadastrar_cliente.php`, formattedData);
      
      if (response.data.success) {
        Alert.alert(
          'Sucesso', 
          'Cliente cadastrado com sucesso',
          [
            { 
              text: 'OK', 
              onPress: () => {
                // Limpar formulário mantendo alguns campos
                setFormData({
                  name: '',
                  person_identification_number: '',
                  email: '',
                  commercial_zip_code: '',
                  commercial_address: '',
                  commercial_address_number: '',
                  business_district: '',
                  billingPhone: '',
                  business_city: '',
                  city_id: null,
                  activity_id: '',
                  filial: formData.filial, // Manter a filial
                  rca: user?.rca || null, // Manter o RCA
                  data_nascimento: null,
                  trade_name: null,
                  state_inscription: 'ISENTO',
                  email_nfe: null,
                  billing_id: 'D',
                  square_id: '1'
                });
                setCepValido(false);
              } 
            }
          ]
        );
      } else {
        if (response.data.error === 'duplicate_entry') {
          // Cliente já existe, perguntar se deseja atualizar
          Alert.alert(
            'Cliente já cadastrado',
            'Este CPF/CNPJ já está registrado. Deseja atualizar os dados?',
            [
              { text: 'Não', style: 'cancel' },
              { 
                text: 'Sim', 
                onPress: () => updateCustomer(formattedData, response.data.id) 
              }
            ]
          );
        } else {
          Alert.alert('Erro', response.data.message || 'Não foi possível cadastrar o cliente');
        }
      }
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      
      // Log detalhado do erro da API
      if (axios.isAxiosError(error)) {
        console.error('Detalhes do erro da API:');
        console.error('Status:', error.response?.status);
        console.error('Dados:', JSON.stringify(error.response?.data, null, 2));
        console.error('Headers:', JSON.stringify(error.response?.headers, null, 2));
        
        // Mostrar mensagem de erro específica da API se disponível
        const errorMessage = error.response?.data?.message || 'Erro desconhecido na API';
        console.error('Mensagem de erro:', errorMessage);
        
        if (error.response?.data?.campos_faltando) {
          console.error('Campos faltando:', error.response.data.campos_faltando);
        }
      }
      
      // Verificar se o erro é de duplicidade
      if (axios.isAxiosError(error) && error.response?.data?.error === 'duplicate_entry') {
        Alert.alert(
          'Cliente já cadastrado',
          'Este CPF/CNPJ já está registrado. Deseja atualizar os dados?',
          [
            { text: 'Não', style: 'cancel' },
            { 
              text: 'Sim', 
              onPress: () => updateCustomer(
                {
                  ...formData,
                  person_identification_number: formData.person_identification_number.replace(/\D/g, ''),
                  commercial_zip_code: formData.commercial_zip_code.replace(/\D/g, ''),
                  billingPhone: formData.billingPhone.replace(/\D/g, ''),
                  trade_name: formData.trade_name || formData.name.split(' ')[0],
                  state_inscription: formData.state_inscription || 'ISENTO',
                  // Usar email padrão se não for fornecido
                  email: formData.email || 'email@gmail.com',
                  email_nfe: formData.email_nfe || formData.email || 'email@gmail.com',
                  billing_id: formData.billing_id || 'D',
                  square_id: formData.square_id || '1'
                }, 
                error.response?.data?.id
              ) 
            }
          ]
        );
      } else {
        // Mostrar mensagem de erro com detalhes da API quando disponível
        const errorMessage = axios.isAxiosError(error) && error.response?.data?.message
          ? `Erro: ${error.response.data.message}`
          : 'Ocorreu um erro ao cadastrar o cliente. Verifique sua conexão e tente novamente.';
        
        Alert.alert('Erro', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Atualizar dados do cliente
  const updateCustomer = async (data: any, customerId: string) => {
    try {
      // Usar loading discreto
      setLoading(true);
      
      // Garantir que os campos adicionados estejam presentes
      const updatedData = {
        ...data,
        id: customerId,
        trade_name: data.trade_name || data.name.split(' ')[0],
        state_inscription: data.state_inscription || 'ISENTO',
        // Usar email padrão se não for fornecido
        email: data.email || 'email@gmail.com',
        email_nfe: data.email_nfe || data.email || 'email@gmail.com',
        billing_id: data.billing_id || 'D',
        square_id: data.square_id || '1'
      };
      
      const response = await axios.put(
        `${apiUrl}/atualizar_cliente.php`, 
        updatedData
      );
      
      if (response.data.success) {
        Alert.alert(
          'Sucesso', 
          'Dados do cliente atualizados com sucesso',
          [
            { 
              text: 'OK', 
              onPress: () => {
                // Limpar formulário mantendo alguns campos
                setFormData({
                  name: '',
                  person_identification_number: '',
                  email: '',
                  commercial_zip_code: '',
                  commercial_address: '',
                  commercial_address_number: '',
                  business_district: '',
                  billingPhone: '',
                  business_city: '',
                  city_id: null,
                  activity_id: '',
                  filial: formData.filial, // Manter a filial
                  rca: user?.rca || null, // Manter o RCA
                  data_nascimento: null,
                  trade_name: null,
                  state_inscription: 'ISENTO',
                  email_nfe: null,
                  billing_id: 'D',
                  square_id: '1'
                });
                setCepValido(false);
              } 
            }
          ]
        );
      } else {
        Alert.alert('Erro', response.data.message || 'Não foi possível atualizar os dados do cliente');
      }
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      
      // Log detalhado do erro da API
      if (axios.isAxiosError(error)) {
        console.error('Detalhes do erro de atualização:');
        console.error('Status:', error.response?.status);
        console.error('Dados:', JSON.stringify(error.response?.data, null, 2));
        console.error('Headers:', JSON.stringify(error.response?.headers, null, 2));
        
        // Mostrar mensagem de erro específica da API se disponível
        const errorMessage = error.response?.data?.message || 'Erro desconhecido na API';
        console.error('Mensagem de erro:', errorMessage);
        
        if (error.response?.data?.campos_faltando) {
          console.error('Campos faltando:', error.response.data.campos_faltando);
        }
        
        // Mostrar alerta com a mensagem de erro da API
        Alert.alert(
          'Erro', 
          `Erro ao atualizar cliente: ${errorMessage}`
        );
      } else {
        Alert.alert('Erro', 'Ocorreu um erro ao atualizar os dados do cliente');
      }
    } finally {
      setLoading(false);
    }
  };

  // Voltar para a tela inicial
  const goBack = () => {
    navigation.navigate('Home' as never);
  };

  // Carregar filial do usuário
  const loadUserFilial = async () => {
    if (!user) {
      console.log('Nenhum usuário logado para definir filial');
      return;
    }
    
    try {
      // Verificar se o usuário já tem filial_id definido
      if (user.filial_id) {
        console.log('Definindo filial do usuário a partir do filial_id:', user.filial_id);
        
        // Forçar a atualização do formData com a filial do usuário
        setFormData(prev => {
          const newState = {
            ...prev,
            filial: String(user.filial_id)
          };
          console.log('Estado atualizado com filial do usuário:', newState.filial);
          return newState;
        });
        
        // Verificar se a filial existe na lista de filiais
        const filialExiste = filiais.some(f => f.id === String(user.filial_id));
        if (!filialExiste) {
          console.warn('A filial do usuário não está na lista de filiais carregadas!');
          console.log('Lista de filiais disponíveis:', filiais);
        }
        
        return;
      }
      
      // Se não tiver filial_id, tentar obter da API
      const token = user.token;
      
      if (token) {
        console.log('Tentando obter filial do usuário da API...');
        // Fazer uma requisição para obter os detalhes do usuário
        const response = await axios.get(`${apiUrl}/obter_detalhes_vendedor.php?id=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('Resposta da API para detalhes do vendedor:', response.data);
        
        if (response.data && response.data.success && response.data.vendedor) {
          const userFilial = response.data.vendedor.filial;
          
          if (userFilial) {
            console.log('Filial obtida da API:', userFilial);
            setFormData(prev => {
              const newState = {
                ...prev,
                filial: String(userFilial)
              };
              console.log('Estado atualizado com filial da API:', newState.filial);
              return newState;
            });
            return;
          }
        }
      }
      
      // Se não conseguiu obter da API, carregar a filial salva localmente
      console.log('Tentando carregar filial salva...');
      await loadSavedFilial();
    } catch (error) {
      console.error('Erro ao carregar filial do usuário:', error);
      // Fallback para filial salva
      await loadSavedFilial();
    }
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
        <Text style={styles.headerTitle}>Novo Cliente</Text>
      </View>
      
      {/* Indicador de carregamento discreto */}
      {loading && (
        <View style={styles.discreetLoadingContainer}>
          <ActivityIndicator size="small" color="#f12b00" />
          <Text style={styles.discreetLoadingText}>Processando...</Text>
        </View>
      )}
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          {/* Remover o indicador de progresso que cobria toda a tela */}
          
          {/* Dados pessoais */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="person" size={20} color="#f12b00" />
              <Text style={styles.sectionTitle}>Dados Pessoais</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(value) => handleChange('name', value)}
                placeholder="Nome completo"
                autoCapitalize="characters"
              />
            </View>

            <Text style={styles.label}>Tipo de Documento *</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity 
                style={styles.radioOption} 
                onPress={() => setTypeNumber('cpf')}
              >
                <View style={[
                  styles.radioCircle,
                  typeNumber === 'cpf' && styles.radioCircleSelected
                ]}>
                  {typeNumber === 'cpf' && <View style={styles.radioCircleInner} />}
                </View>
                <Text style={styles.radioText}>CPF</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.radioOption} 
                onPress={() => setTypeNumber('cnpj')}
              >
                <View style={[
                  styles.radioCircle,
                  typeNumber === 'cnpj' && styles.radioCircleSelected
                ]}>
                  {typeNumber === 'cnpj' && <View style={styles.radioCircleInner} />}
                </View>
                <Text style={styles.radioText}>CNPJ</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>{typeNumber === 'cpf' ? 'CPF *' : 'CNPJ *'}</Text>
              <TextInputMask
                type={typeNumber}
                style={styles.input}
                value={formData.person_identification_number}
                onChangeText={(value) => handleChange('person_identification_number', value)}
                placeholder={typeNumber === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Data de Nascimento *</Text>
              <TextInputMask
                type={'datetime'}
                options={{
                  format: 'DD/MM/YYYY'
                }}
                style={styles.input}
                value={formData.data_nascimento || ''}
                onChangeText={(value) => handleChange('data_nascimento', value)}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
                placeholder="email@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Telefone *</Text>
              <TextInputMask
                type={'cel-phone'}
                options={{
                  maskType: 'BRL',
                  withDDD: true,
                  dddMask: '(99) ',
                }}
                style={styles.input}
                value={formData.billingPhone}
                onChangeText={(value) => handleChange('billingPhone', value)}
                placeholder="(00) 00000-0000"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Endereço */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="location-on" size={20} color="#f12b00" />
              <Text style={styles.sectionTitle}>Endereço</Text>
            </View>

          {/* 
            <View style={styles.inputContainer}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Informar CEP</Text>
                <Switch
                  trackColor={{ false: '#767577', true: '#f12b0050' }}
                  thumbColor={informarCep ? '#f12b00' : '#f4f3f4'}
                  onValueChange={toggleUseCep}
                  value={informarCep}
                  disabled
                />
              </View>
            </View> */}

            {informarCep && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>CEP *</Text>
                <View style={styles.cepContainer}>
                  <TextInputMask
                    type={'zip-code'}
                    style={[styles.input, styles.cepInput]}
                    value={formData.commercial_zip_code}
                    onChangeText={(value) => handleChange('commercial_zip_code', value)}
                    placeholder="00000-000"
                    keyboardType="numeric"
                  />
                  {loading && <ActivityIndicator size="small" color="#f12b00" />}
                  {formData.commercial_zip_code && cepValido && (
                    <MaterialIcons name="check-circle" size={24} color="green" style={styles.cepIcon} />
                  )}
                  {formData.commercial_zip_code && !cepValido && formData.commercial_zip_code.length === 9 && (
                    <MaterialIcons name="error" size={24} color="red" style={styles.cepIcon} />
                  )}
                </View>
              </View>
            )}

            <View style={styles.inputContainer}>
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Endereço *</Text>
                <Text style={styles.characterCount}>
                  {formData.commercial_address.length}/40
                </Text>
              </View>
              <TextInput
                style={styles.input}
                value={formData.commercial_address}
                onChangeText={(value) => handleChange('commercial_address', value)}
                placeholder="Rua, Avenida, etc."
                maxLength={40}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Número *</Text>
              <TextInput
                style={styles.input}
                value={formData.commercial_address_number}
                onChangeText={(value) => handleChange('commercial_address_number', value)}
                placeholder="Número"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Bairro *</Text>
              <TextInput
                style={styles.input}
                value={formData.business_district}
                onChangeText={(value) => handleChange('business_district', value)}
                placeholder="Bairro"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Estado *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={estadoSelecionado}
                  onValueChange={handleEstadoChange}
                  style={styles.picker}
                >
                  <Picker.Item label="Selecione um estado" value="" />
                  {pcestados.map((estado) => (
                    <Picker.Item
                      key={estado.uf}
                      label={estado.uf}
                      value={estado.uf}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Cidade *</Text>
              <TextInput
                style={styles.input}
                value={formData.business_city}
                onChangeText={(value) => handleChange('business_city', value)}
                placeholder="Cidade"
                autoCapitalize="characters"
              />
              {formData.city_id && (
                <MaterialIcons name="check-circle" size={24} color="green" style={styles.cityValidIcon} />
              )}
            </View>
          </View>

          {/* Informações adicionais */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="business" size={20} color="#f12b00" />
              <Text style={styles.sectionTitle}>Informações Adicionais</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Ramo de Atividade *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.activity_id}
                  onValueChange={(itemValue) => handleChange('activity_id', String(itemValue))}
                  style={styles.picker}
                >
                  <Picker.Item label="Selecione uma atividade" value="" />
                  {atividades.map((atividade) => (
                    <Picker.Item
                      key={atividade.id}
                      label={atividade.ramo}
                      value={String(atividade.id)}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Filial *</Text>
              <View style={styles.pickerContainerReadonly}>
                {loadingFiliais ? (
                  <View style={styles.loadingPickerContainer}>
                    <ActivityIndicator size="small" color="#f12b00" />
                    <Text style={styles.loadingPickerText}>Carregando filiais...</Text>
                  </View>
                ) : (
                  <View style={styles.readonlyField}>
                    <MaterialIcons name="store" size={18} color="#555" style={styles.readonlyIcon} />
                    <Text style={styles.readonlyText}>
                      {(() => {
                        // Mostrar detalhes da filial para depuração
                        console.log('Renderizando campo de filial. Valor atual:', formData.filial);
                        console.log('Filiais disponíveis:', filiais);
                        
                        const filialSelecionada = filiais.find(f => f.id === formData.filial);
                        if (filialSelecionada) {
                          console.log('Filial selecionada:', filialSelecionada);
                          return filialSelecionada.name;
                        } else {
                          console.warn('Filial não encontrada na lista:', formData.filial);
                          return `Filial ${formData.filial || 'não definida'}`;
                        }
                      })()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.filialInfo}>
                <MaterialIcons name="info-outline" size={16} color="#666" style={styles.filialIcon} />
                <Text style={styles.filialText}>
                  Filial associada ao vendedor (ID: {formData.filial || 'não definido'})
                </Text>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Código do Vendedor (RCA) *</Text>
              <TextInput
                style={styles.input}
                value={formData.rca || ''}
                onChangeText={(value) => handleChange('rca', value)}
                placeholder="Código do vendedor"
                keyboardType="numeric"
                editable={!user?.rca} // Desabilitar se o usuário já tiver um RCA
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="person-add" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Cadastrar Cliente</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 30,
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
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#f12b00',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
    color: '#555',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#333',
  },
  cepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  cepInput: {
    flex: 1,
  },
  cepIcon: {
    position: 'absolute',
    right: 10,
  },
  cityValidIcon: {
    position: 'absolute',
    right: 10,
    bottom: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  radioCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#f12b00',
  },
  radioCircleInner: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: '#f12b00',
  },
  radioText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  submitButton: {
    backgroundColor: '#f12b00',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loadingPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    paddingHorizontal: 12,
  },
  loadingPickerText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  characterCount: {
    fontSize: 12,
    color: '#888',
  },
  pickerContainerReadonly: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f0f0f0', // Fundo mais claro para campos de leitura
    overflow: 'hidden',
  },
  readonlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  readonlyIcon: {
    marginRight: 8,
  },
  readonlyText: {
    fontSize: 16,
    color: '#555',
    flex: 1,
  },
  discreetLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(241, 43, 0, 0.1)',
    paddingVertical: 6,
    borderRadius: 4,
    marginHorizontal: 16,
    marginTop: 8,
  },
  discreetLoadingText: {
    fontSize: 14,
    color: '#f12b00',
    marginLeft: 8,
  },
  filialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  filialIcon: {
    marginRight: 4,
  },
  filialText: {
    fontSize: 14,
    color: '#666',
  },
});

export default NewClientScreen; 