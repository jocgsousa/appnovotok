import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';

// Tipos de dados para os informativos
type Imagem = {
  id: string;
  imagem: string;
  tipo_imagem: string;
  descricao: string;
  ordem?: number;
};

type Informativo = {
  id: string;
  titulo: string;
  texto: string;
  data: string;
  ativo?: number;
  created_at?: string;
  updated_at?: string;
  imagens: Imagem[];
};

const InformativosScreen = () => {
  const { apiUrl } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [informativos, setInformativos] = useState<Informativo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [imagemSelecionada, setImagemSelecionada] = useState<Imagem | null>(null);

  useEffect(() => {
    carregarInformativos();
  }, []);

  const carregarInformativos = async () => {
    try {
      setLoading(true);
      setErro(null);

      // Verificar conectividade
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        setErro('Sem conexão com a internet. Tente novamente mais tarde.');
        setLoading(false);
        return;
      }

      // Fazer requisição à API real
      const response = await axios.get(`${apiUrl}/informativos/listar_informativos.php`);
      
      if (response.data.success) {
        setInformativos(response.data.informativos);
      } else {
        setErro(response.data.message || 'Erro ao carregar informativos.');
      }
    } catch (error) {
      console.error('Erro ao carregar informativos:', error);
      setErro('Não foi possível carregar os informativos. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarInformativos();
  };

  const formatarData = (dataString: string) => {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const abrirImagem = (imagem: Imagem) => {
    setImagemSelecionada(imagem);
    setModalVisible(true);
  };

  const fecharImagem = () => {
    setModalVisible(false);
    setImagemSelecionada(null);
  };

  // Voltar para a tela inicial
  const goBack = () => {
    navigation.goBack();
  };

  const renderItem = ({ item }: { item: Informativo }) => {
    return (
      <View style={styles.informativoCard}>
        <View style={styles.informativoHeader}>
          <Text style={styles.informativoTitulo}>{item.titulo}</Text>
          <Text style={styles.informativoData}>{formatarData(item.data)}</Text>
        </View>
        
        <Text style={styles.informativoTexto}>{item.texto}</Text>
        
        {item.imagens && item.imagens.length > 0 && (
          <View style={styles.imageContainer}>
            {item.imagens.map((imagem) => (
              <TouchableOpacity
                key={imagem.id}
                style={styles.imagemThumbnail}
                onPress={() => abrirImagem(imagem)}
              >
                <Image
                  source={{ uri: imagem.imagem }}
                  style={styles.imagem}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
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
        <Text style={styles.headerTitle}>Informativos</Text>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f12b00" />
          <Text style={styles.loadingText}>Carregando informativos...</Text>
        </View>
      ) : erro ? (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#f12b00" />
          <Text style={styles.errorText}>{erro}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={carregarInformativos}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={informativos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f12b00']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="info-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nenhum informativo disponível</Text>
            </View>
          }
        />
      )}
      
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={fecharImagem}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={fecharImagem}>
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          
          {imagemSelecionada && (
            <View style={styles.modalContent}>
              <Image
                source={{ uri: imagemSelecionada.imagem }}
                style={styles.modalImagem}
                resizeMode="contain"
              />
              {imagemSelecionada.descricao && (
                <Text style={styles.modalDescricao}>{imagemSelecionada.descricao}</Text>
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');
const imageSize = (width - 48) / 2;

const styles = StyleSheet.create({
  safeArea: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#f12b00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  informativoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  informativoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  informativoTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  informativoData: {
    fontSize: 12,
    color: '#888',
  },
  informativoTexto: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
  },
  imageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginHorizontal: -4,
  },
  imagemThumbnail: {
    width: imageSize,
    height: imageSize,
    margin: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  imagem: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    marginTop: 16,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
  },
  modalImagem: {
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: 8,
  },
  modalDescricao: {
    color: '#fff',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default InformativosScreen; 