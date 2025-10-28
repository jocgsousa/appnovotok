import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

// Tipo para os orçamentos
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

// Tipo para a navegação
type RootStackParamList = {
  NovoOrcamento: undefined;
  EditarOrcamento: { orcamento: Orcamento };
  DetalhesOrcamento: { orcamento: Orcamento; compartilhar?: boolean };
};

const OrcamentosScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar orçamentos quando a tela receber foco
  useFocusEffect(
    React.useCallback(() => {
      console.log('OrcamentosScreen recebeu foco - carregando orçamentos');
      carregarOrcamentos();
      return () => {
        // Limpeza quando a tela perder o foco (se necessário)
      };
    }, [])
  );

  const carregarOrcamentos = async () => {
    try {
      setLoading(true);
      const orcamentosData = await AsyncStorage.getItem('@BuscaPreco:orcamentos');
      if (orcamentosData) {
        setOrcamentos(JSON.parse(orcamentosData));
      }
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os orçamentos.');
    } finally {
      setLoading(false);
    }
  };

  const excluirOrcamento = async (id: string) => {
    Alert.alert(
      'Confirmar exclusão',
      'Tem certeza que deseja excluir este orçamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const novosOrcamentos = orcamentos.filter(orc => orc.id !== id);
              await AsyncStorage.setItem('@BuscaPreco:orcamentos', JSON.stringify(novosOrcamentos));
              setOrcamentos(novosOrcamentos);
            } catch (error) {
              console.error('Erro ao excluir orçamento:', error);
              Alert.alert('Erro', 'Não foi possível excluir o orçamento.');
            }
          },
        },
      ]
    );
  };

  const formatarData = (data: string) => {
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const novoOrcamento = () => {
    navigation.navigate('NovoOrcamento');
  };

  const verDetalhes = (orcamento: Orcamento) => {
    navigation.navigate('DetalhesOrcamento', { orcamento });
  };

  const editarOrcamento = (orcamento: Orcamento) => {
    navigation.navigate('EditarOrcamento', { orcamento });
  };

  const compartilharOrcamento = (orcamento: Orcamento) => {
    navigation.navigate('DetalhesOrcamento', { orcamento, compartilhar: true });
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
        <Text style={styles.headerTitle}>Orçamentos</Text>
        <TouchableOpacity style={styles.addButton} onPress={novoOrcamento}>
          <MaterialIcons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {orcamentos.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Nenhum orçamento encontrado</Text>
          <Text style={styles.emptySubText}>Toque em "Novo" para criar um orçamento</Text>
        </View>
      ) : (
        <FlatList
          data={orcamentos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.orcamentoCard}
              onPress={() => verDetalhes(item)}
            >
              <View style={styles.orcamentoHeader}>
                <Text style={styles.orcamentoNome}>{item.nome || 'Orçamento sem nome'}</Text>
                <Text style={styles.orcamentoData}>{formatarData(item.data)}</Text>
              </View>
              
              <View style={styles.orcamentoInfo}>
                <Text style={styles.orcamentoItens}>
                  {item.produtos.length} {item.produtos.length === 1 ? 'item' : 'itens'}
                </Text>
                <Text style={styles.orcamentoTotal}>
                  Total: {formatarMoeda(item.total)}
                </Text>
              </View>
              
              <View style={styles.orcamentoEconomia}>
                <Text style={styles.economiaText}>
                  Economia com fidelidade: {formatarMoeda(item.total - item.totalFidelidade)}
                </Text>
                {item.totalOferta < item.totalFidelidade && (
                  <Text style={styles.economiaText}>
                    Economia com ofertas: {formatarMoeda(item.totalFidelidade - item.totalOferta)}
                  </Text>
                )}
              </View>
              
              <View style={styles.orcamentoActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => editarOrcamento(item)}
                >
                  <MaterialIcons name="edit" size={20} color="#f12b00" />
                  <Text style={styles.actionText}>Editar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => compartilharOrcamento(item)}
                >
                  <MaterialIcons name="share" size={20} color="#f12b00" />
                  <Text style={styles.actionText}>Compartilhar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => excluirOrcamento(item.id)}
                >
                  <MaterialIcons name="delete" size={20} color="#f12b00" />
                  <Text style={styles.actionText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
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
    justifyContent: 'space-between',
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
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: 'bold',
  },
  emptyContainer: {
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
  listContent: {
    padding: 16,
  },
  orcamentoCard: {
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
  orcamentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orcamentoNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orcamentoData: {
    fontSize: 12,
    color: '#888',
  },
  orcamentoInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orcamentoItens: {
    fontSize: 14,
    color: '#555',
  },
  orcamentoTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orcamentoEconomia: {
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  economiaText: {
    fontSize: 13,
    color: '#4CAF50',
    marginBottom: 4,
  },
  orcamentoActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  actionText: {
    fontSize: 14,
    color: '#f12b00',
    marginLeft: 4,
  },
});

export default OrcamentosScreen; 