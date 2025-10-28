import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  Clipboard,
  ToastAndroid,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
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

// Função para formatar valores monetários
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const OffersScreen = () => {
  const { apiUrl } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<ProductType[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<ProductType[]>([]);
  const [searchText, setSearchText] = useState('');
  const [offline, setOffline] = useState<boolean>(false);

  // Carregar ofertas ao iniciar a tela
  useEffect(() => {
    checkConnectivity();
  }, []);

  // Recarregar ofertas quando a tela receber foco
  useFocusEffect(
    React.useCallback(() => {
      loadOffers();
      checkConnectivity();
      return () => {};
    }, [])
  );

  // Filtrar ofertas quando o texto de pesquisa mudar
  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredOffers(offers);
    } else {
      const filtered = offers.filter(offer => 
        offer.descricao.toLowerCase().includes(searchText.toLowerCase()) ||
        offer.codauxiliar.includes(searchText) ||
        offer.codprod.toString().includes(searchText)
      );
      setFilteredOffers(filtered);
    }
  }, [searchText, offers]);

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

  // Carregar ofertas do cache local
  const loadOffers = async () => {
    try {
      setLoading(true);
      
      // Carregar produtos do cache local
      const produtosCache = await loadDataFromFile();
      
      if (!produtosCache || produtosCache.length === 0) {
        Alert.alert("Atenção", "Não há produtos sincronizados. Sincronize os produtos primeiro na tela inicial ou de configurações.");
        setOffers([]);
        setFilteredOffers([]);
        return;
      }
      
      // Filtrar apenas os produtos em oferta (oferta_filiais_offers > 0)
      const produtosEmOferta = produtosCache.filter(produto => produto.oferta_filiais_offers > 0);
      
      if (produtosEmOferta.length === 0) {
        Alert.alert("Atenção", "Não há produtos em oferta disponíveis.");
        setOffers([]);
        setFilteredOffers([]);
        return;
      }
      
      // Ordenar por descrição
      produtosEmOferta.sort((a, b) => a.descricao.localeCompare(b.descricao));
      
      setOffers(produtosEmOferta);
      setFilteredOffers(produtosEmOferta);
      
    } catch (error) {
      console.error('Erro ao carregar ofertas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as ofertas');
    } finally {
      setLoading(false);
    }
  };

  // Função para copiar o código de barras para a área de transferência
  const copyToClipboard = (codauxiliar: string) => {
    Clipboard.setString(codauxiliar);
    
    // Mostrar feedback ao usuário
    if (Platform.OS === 'android') {
      ToastAndroid.show('Código copiado!', ToastAndroid.SHORT);
    } else {
      Alert.alert('Copiado', 'Código de barras copiado para a área de transferência.');
    }
  };

  // Voltar para a tela inicial
  const goBack = () => {
    navigation.navigate('Home' as never);
  };

  // Renderizar item da lista de ofertas
  const renderOfferItem = ({ item }: { item: ProductType }) => (
    <View style={styles.offerItem}>
      <View style={styles.offerHeader}>
        <Text style={styles.offerCode}>{`Cód: ${item.codprod}`}</Text>
        <View style={styles.eanContainer}>
          <Text style={styles.offerEan}>{`EAN: ${item.codauxiliar}`}</Text>
          <TouchableOpacity 
            style={styles.copyButton}
            onPress={() => copyToClipboard(item.codauxiliar)}
          >
            <MaterialIcons name="content-copy" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={styles.offerDescription}>{item.descricao}</Text>
      
      <View style={styles.priceContainer}>
        <View style={styles.priceGroup}>
          <Text style={styles.priceLabel}>Preço Normal:</Text>
          <Text style={styles.regularPrice}>{formatCurrency(item.pvenda)}</Text>
        </View>
        <View style={styles.priceGroup}>
          <Text style={styles.offerLabel}>Preço Oferta:</Text>
          <Text style={styles.offerPrice}>{formatCurrency(item.oferta_filial_2)}</Text>
        </View>
      </View>

      {item.descontofidelidade > 0 && (
        <View style={styles.fidelidadeContainer}>
          <Text style={styles.fidelidadeLabel}>Preço Fidelidade:</Text>
          <Text style={styles.fidelidadePrice}>{formatCurrency(item.pvendafidelidade)}</Text>
        </View>
      )}

      {item.oferta_filiais_offers < 7 && (
        <View style={styles.filiaisContainer}>
          <Text style={styles.filiaisTitle}>Filiais:</Text>
          <View style={styles.filiaisList}>
            {item.oferta_filial_2 > 0 && <Text style={styles.filialBadge}>2</Text>}
            {item.oferta_filial_3 > 0 && <Text style={styles.filialBadge}>3</Text>}
            {item.oferta_filial_4 > 0 && <Text style={styles.filialBadge}>4</Text>}
            {item.oferta_filial_5 > 0 && <Text style={styles.filialBadge}>5</Text>}
            {item.oferta_filial_6 > 0 && <Text style={styles.filialBadge}>6</Text>}
            {item.oferta_filial_7 > 0 && <Text style={styles.filialBadge}>7</Text>}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#f12b00" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ofertas</Text>
        <View style={styles.headerRightContainer}>
          {offline && (
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
          <TouchableOpacity style={styles.refreshButton} onPress={loadOffers}>
            <MaterialIcons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar ofertas..."
            value={searchText}
            onChangeText={setSearchText}
            clearButtonMode="while-editing"
          />
          {searchText.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSearchText('')}
            >
              <MaterialIcons name="clear" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f12b00" />
            <Text style={styles.loadingText}>Carregando ofertas...</Text>
          </View>
        ) : (
          <>
            <View style={styles.countContainer}>
              <Text style={styles.countText}>
                {filteredOffers.length} {filteredOffers.length === 1 ? 'produto' : 'produtos'} encontrado{filteredOffers.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <FlatList
              data={filteredOffers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderOfferItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="search-off" size={60} color="#ccc" />
                  <Text style={styles.emptyText}>Nenhuma oferta encontrada</Text>
                </View>
              }
            />
          </>
        )}
      </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 5,
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
  refreshButton: {
    padding: 5,
  },
  syncStatusContainer: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#f12b00',
  },
  syncStatusText: {
    fontSize: 12,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
    position: 'relative',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  clearButton: {
    position: 'absolute',
    right: 20,
    top: 20,
  },
  countContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 5,
  },
  countText: {
    color: '#666',
    fontSize: 14,
  },
  listContent: {
    padding: 5,
  },
  offerItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#f12b00',
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  offerCode: {
    fontSize: 14,
    color: '#666',
  },
  eanContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerEan: {
    fontSize: 14,
    color: '#666',
    marginRight: 5,
  },
  copyButton: {
    padding: 3,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  offerDescription: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  priceGroup: {
    alignItems: 'flex-start',
  },
  priceLabel: {
    fontSize: 12,
    color: '#777',
  },
  offerLabel: {
    fontSize: 12,
    color: '#f12b00',
    fontWeight: 'bold',
  },
  regularPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  offerPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f12b00',
  },
  fidelidadeContainer: {
    marginTop: 8,
    padding: 5,
    backgroundColor: '#e6f7f6',
    borderRadius: 4,
  },
  fidelidadeLabel: {
    fontSize: 12,
    color: 'rgb(7, 150, 143)',
  },
  fidelidadePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'rgb(7, 150, 143)',
  },
  filiaisContainer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
  },
  filiaisTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  filiaisList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filialBadge: {
    backgroundColor: '#f12b00',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 5,
    marginBottom: 5,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999',
  },
});

export default OffersScreen; 