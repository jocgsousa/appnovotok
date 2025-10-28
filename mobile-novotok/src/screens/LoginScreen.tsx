import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

const LoginScreen = () => {
  const [rca, setRca] = useState('');
  const [password, setPassword] = useState('');
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const { signIn, loading, setApiBaseUrl, apiUrl: currentApiUrl, user } = useAuth();
  const navigation = useNavigation();

  // Inicializar o estado com a URL atual
  useEffect(() => {
    setApiUrl(currentApiUrl);
  }, [currentApiUrl]);

  // Redirecionar para a tela principal se o usuário já estiver logado
  useEffect(() => {
    if (user) {
      navigation.navigate('Main' as never);
    }
  }, [user, navigation]);

  // Função para fazer login
  const handleLogin = async () => {
    if (!rca.trim() || !password.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    try {
      const success = await signIn(rca, password);
      
      if (success) {
        console.log('Login bem-sucedido. Redirecionando para a tela principal.');
        console.log('Filial do vendedor:', user?.filial_id);
        // O redirecionamento é feito automaticamente pelo useEffect que monitora o usuário
      } else {
        Alert.alert('Erro', 'RCA ou senha incorretos');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao tentar fazer login. Tente novamente.');
    }
  };

  // Função para salvar a URL da API
  const handleSaveApiUrl = async () => {
    if (!apiUrl.trim()) {
      Alert.alert('Erro', 'Por favor, informe uma URL válida');
      return;
    }

    try {
      await setApiBaseUrl(apiUrl);
      setConfigModalVisible(false);
      Alert.alert('Sucesso', 'URL da API configurada com sucesso');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar a URL');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/logo.png')} 
              style={styles.logo} 
              resizeMode="contain"
            />
          </View>

          {/* Formulário de login */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <MaterialIcons name="person" size={24} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="RCA"
                value={rca}
                onChangeText={setRca}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={24} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Senha"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>ENTRAR</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.configButton}
              onPress={() => setConfigModalVisible(true)}
            >
              <MaterialIcons name="settings" size={18} color="#888" />
              <Text style={styles.configButtonText}>Configurar API</Text>
            </TouchableOpacity>
          </View>

          {/* Modal de configuração da API */}
          <Modal
            visible={configModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setConfigModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Configurar URL da API</Text>

                <TextInput
                  style={styles.modalInput}
                  placeholder="URL"
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  autoCapitalize="none"
                />

                <View style={styles.modalButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setConfigModalVisible(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalSaveButton]}
                    onPress={handleSaveApiUrl}
                  >
                    <Text style={styles.modalButtonText}>Salvar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 100,
    resizeMode: 'contain',
  },
  formContainer: {
    width: '100%',
    maxWidth: 350,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#f12b00',
    borderRadius: 5,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  configButtonText: {
    color: '#888',
    marginLeft: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  modalCancelButton: {
    backgroundColor: '#ccc',
  },
  modalSaveButton: {
    backgroundColor: '#f12b00',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default LoginScreen; 