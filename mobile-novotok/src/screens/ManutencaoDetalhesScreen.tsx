import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definir o tipo para os parâmetros da rota
type ManutencaoDetalhesParams = {
  tipo: string;
  mensagem: string;
  dataInicio: string | null;
  dataFim: string | null;
};

type ManutencaoDetalhesRouteProp = RouteProp<
  { ManutencaoDetalhes: ManutencaoDetalhesParams },
  'ManutencaoDetalhes'
>;

const ManutencaoDetalhesScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ManutencaoDetalhesRouteProp>();
  
  // Receber parâmetros da rota
  const [tipo, setTipo] = useState<string>(route.params?.tipo || 'geral');
  const [mensagem, setMensagem] = useState<string>(route.params?.mensagem || 'Sistema em manutenção');
  const [dataInicio, setDataInicio] = useState<string | null>(route.params?.dataInicio || null);
  const [dataFim, setDataFim] = useState<string | null>(route.params?.dataFim || null);
  
  // Carregar dados do AsyncStorage caso não venham da rota
  useEffect(() => {
    const carregarDados = async () => {
      if (!route.params) {
        try {
          const tipoArmazenado = await AsyncStorage.getItem('@BuscaPreco:manutencaoTipo');
          const mensagemArmazenada = await AsyncStorage.getItem('@BuscaPreco:manutencaoMensagem');
          const dataInicioArmazenada = await AsyncStorage.getItem('@BuscaPreco:manutencaoDataInicio');
          const dataFimArmazenada = await AsyncStorage.getItem('@BuscaPreco:manutencaoDataFim');
          
          if (tipoArmazenado) setTipo(tipoArmazenado);
          if (mensagemArmazenada) setMensagem(mensagemArmazenada);
          if (dataInicioArmazenada) setDataInicio(dataInicioArmazenada);
          if (dataFimArmazenada) setDataFim(dataFimArmazenada);
        } catch (error) {
          console.error('Erro ao carregar dados de manutenção:', error);
        }
      }
    };
    
    carregarDados();
  }, [route.params]);
  
  // Formatar data para exibição
  const formatarData = (dataString: string | null): string => {
    if (!dataString) return 'Não definida';
    
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
    if (!dataFim) return 'Não definido';
    
    const agora = new Date();
    const fimManutencao = new Date(dataFim);
    
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
  
  // Obter informações do tipo de manutenção
  const getManutencaoInfo = () => {
    switch (tipo) {
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
  
  // Obter informações do tipo de manutenção
  const tipoInfo = getManutencaoInfo();
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={tipoInfo.color} />
      
      <View style={[styles.header, { backgroundColor: tipoInfo.color }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da Manutenção</Text>
      </View>
      
      <ScrollView style={styles.container}>
        <View style={styles.tipoContainer}>
          <MaterialCommunityIcons 
            name={tipoInfo.icon} 
            size={40} 
            color={tipoInfo.color} 
          />
          <Text style={[styles.tipoText, { color: tipoInfo.color }]}>
            {tipoInfo.title}
          </Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informações</Text>
          
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="clock-start" size={20} color="#666" />
            <Text style={styles.infoLabel}>Início:</Text>
            <Text style={styles.infoValue}>{formatarData(dataInicio)}</Text>
          </View>
          
          {dataFim && (
            <>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="clock-end" size={20} color="#666" />
                <Text style={styles.infoLabel}>Término:</Text>
                <Text style={styles.infoValue}>{formatarData(dataFim)}</Text>
              </View>
              
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="timer-outline" size={20} color={tipoInfo.color} />
                <Text style={styles.infoLabel}>Tempo restante:</Text>
                <Text style={[styles.infoValue, { color: tipoInfo.color, fontWeight: 'bold' }]}>
                  {calcularTempoRestante()}
                </Text>
              </View>
            </>
          )}
        </View>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mensagem</Text>
          <Text style={styles.mensagemText}>{mensagem}</Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>O que isso significa?</Text>
          <Text style={styles.descricaoText}>
            {tipo === 'correcao_bugs' && 'Estamos trabalhando para corrigir problemas identificados no sistema. Algumas funcionalidades podem estar temporariamente indisponíveis.'}
            {tipo === 'atualizacao' && 'Estamos implementando novas funcionalidades e melhorias no sistema. Em breve você terá acesso a uma versão atualizada com novos recursos.'}
            {tipo === 'melhoria_performance' && 'Estamos otimizando o sistema para melhorar a velocidade e a eficiência. Isso resultará em um aplicativo mais rápido e responsivo.'}
            {tipo === 'backup' && 'Estamos realizando um backup de segurança dos dados do sistema. Este procedimento é importante para garantir a integridade das informações.'}
            {tipo === 'geral' && 'O sistema está passando por manutenção programada. Estamos trabalhando para restaurar o acesso o mais rápido possível.'}
            {tipo === 'outro' && 'O sistema está temporariamente indisponível para manutenção. Pedimos desculpas pelo inconveniente.'}
          </Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>O que fazer enquanto isso?</Text>
          <Text style={styles.descricaoText}>
            Você pode tentar usar o aplicativo no modo offline, se disponível. Caso precise acessar funcionalidades que estão indisponíveis, recomendamos tentar novamente mais tarde.
          </Text>
          <Text style={styles.descricaoText}>
            Se precisar de ajuda imediata, entre em contato com o suporte técnico.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  tipoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  tipoText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
    marginRight: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  mensagemText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    flexWrap: 'wrap',
  },
  descricaoText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    marginBottom: 8,
  },
});

export default ManutencaoDetalhesScreen; 