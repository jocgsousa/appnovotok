import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import ViewShot, { ViewShotProperties } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

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

type RouteParams = {
  orcamento: Orcamento;
  compartilhar?: boolean;
};

const DetalhesOrcamentoScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { orcamento, compartilhar } = route.params as RouteParams;
  const [loading, setLoading] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    // Se o parâmetro compartilhar for true, compartilha automaticamente o orçamento
    if (compartilhar) {
      compartilharOrcamento();
    }
  }, [compartilhar]);

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

  const compartilharOrcamento = async () => {
    // Verificação de segurança para garantir que viewShotRef.current existe
    if (!viewShotRef.current) {
      Alert.alert('Erro', 'Não foi possível preparar o orçamento para compartilhamento.');
      return;
    }

    try {
      setLoading(true);
      
      // Captura a imagem do orçamento
      const uri = await viewShotRef.current.capture();
      
      // Verifica se o compartilhamento é suportado
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Orçamento: ${orcamento.nome}`,
        });
      } else {
        // Fallback para dispositivos que não suportam o compartilhamento nativo
        await Share.share({
          title: `Orçamento: ${orcamento.nome}`,
          url: uri,
        });
      }
    } catch (error) {
      console.error('Erro ao compartilhar orçamento:', error);
      Alert.alert('Erro', 'Não foi possível compartilhar o orçamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#f12b00" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Orçamento</Text>
        <TouchableOpacity style={styles.shareButton} onPress={compartilharOrcamento}>
          <MaterialIcons name="share" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'png', quality: 0.9 }}
          style={styles.orcamentoContainer}
        >
          <View style={styles.orcamentoHeader}>
            <Text style={styles.orcamentoTitle}>{orcamento.nome}</Text>
            <Text style={styles.orcamentoData}>{formatarData(orcamento.data)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.produtosHeader}>
            <Text style={styles.produtosHeaderText}>Produto</Text>
            <Text style={styles.produtosHeaderText}>Qtd</Text>
            <Text style={styles.produtosHeaderText}>Preço</Text>
            <Text style={styles.produtosHeaderText}>Total</Text>
          </View>
          
          {orcamento.produtos.map((produto) => (
            <View key={produto.id} style={styles.produtoItem}>
              <View style={styles.produtoInfo}>
                <Text style={styles.produtoDescricao}>{produto.descricao}</Text>
                <Text style={styles.produtoCodigo}>
                  Cód: {produto.codprod} | EAN: {produto.codauxiliar}
                </Text>
              </View>
              
              <Text style={styles.produtoQtd}>{produto.quantidade}</Text>
              
              <View style={styles.produtoPrecos}>
                <Text style={styles.precoNormal}>{formatarMoeda(produto.pvenda)}</Text>
                <Text style={styles.precoFidelidade}>{formatarMoeda(produto.pvendafidelidade)}</Text>
                {produto.oferta && (
                  <Text style={styles.precoOferta}>{formatarMoeda(produto.pvendafidelidade * 0.9)}</Text>
                )}
              </View>
              
              <View style={styles.produtoTotais}>
                <Text style={styles.totalNormal}>{formatarMoeda(produto.pvenda * produto.quantidade)}</Text>
                <Text style={styles.totalFidelidade}>
                  {formatarMoeda(produto.pvendafidelidade * produto.quantidade)}
                </Text>
                {produto.oferta && (
                  <Text style={styles.totalOferta}>
                    {formatarMoeda(produto.pvendafidelidade * 0.9 * produto.quantidade)}
                  </Text>
                )}
              </View>
            </View>
          ))}
          
          <View style={styles.divider} />
          
          <View style={styles.resumo}>
            <View style={styles.resumoItem}>
              <Text style={styles.resumoLabel}>Total:</Text>
              <Text style={styles.resumoValor}>{formatarMoeda(orcamento.total)}</Text>
            </View>
            
            <View style={styles.resumoItem}>
              <Text style={styles.resumoLabel}>Total com fidelidade:</Text>
              <Text style={styles.resumoValorFidelidade}>{formatarMoeda(orcamento.totalFidelidade)}</Text>
            </View>
            
            <View style={styles.resumoItem}>
              <Text style={styles.resumoLabel}>Total com ofertas:</Text>
              <Text style={styles.resumoValorOferta}>{formatarMoeda(orcamento.totalOferta)}</Text>
            </View>
            
            <View style={styles.economiaContainer}>
              <Text style={styles.economiaLabel}>
                Economia total: {formatarMoeda(orcamento.total - orcamento.totalOferta)}
              </Text>
            </View>
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>Orçamento</Text>
            <Text style={styles.footerSubText}>
              Este orçamento é apenas uma simulação de preços e não garante disponibilidade de estoque, e preço no momento da venda, pois os preços podem variar conforme a data e hora da venda.
            </Text>
          </View>
        </ViewShot>
      </ScrollView>
      
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
  shareButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
  },
  orcamentoContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orcamentoHeader: {
    marginBottom: 16,
  },
  orcamentoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  orcamentoData: {
    fontSize: 14,
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12,
  },
  produtosHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 8,
  },
  produtosHeaderText: {
    fontWeight: 'bold',
    color: '#666',
    fontSize: 14,
  },
  produtoItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  produtoInfo: {
    flex: 2,
    paddingRight: 8,
  },
  produtoDescricao: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  produtoCodigo: {
    fontSize: 12,
    color: '#888',
  },
  produtoQtd: {
    flex: 0.5,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  produtoPrecos: {
    flex: 1,
    alignItems: 'flex-end',
  },
  precoNormal: {
    fontSize: 14,
    color: '#333',
  },
  precoFidelidade: {
    fontSize: 14,
    color: '#4CAF50',
  },
  precoOferta: {
    fontSize: 14,
    color: '#f12b00',
  },
  produtoTotais: {
    flex: 1,
    alignItems: 'flex-end',
  },
  totalNormal: {
    fontSize: 14,
    color: '#333',
  },
  totalFidelidade: {
    fontSize: 14,
    color: '#4CAF50',
  },
  totalOferta: {
    fontSize: 14,
    color: '#f12b00',
  },
  resumo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  resumoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resumoLabel: {
    fontSize: 16,
    color: '#333',
  },
  resumoValor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  resumoValorFidelidade: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  resumoValorOferta: {
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
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  footerSubText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
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
});

export default DetalhesOrcamentoScreen; 