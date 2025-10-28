import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  AcessoNegado: { funcionalidade: string };
  Main: undefined;
};

type AcessoNegadoRouteProp = RouteProp<RootStackParamList, 'AcessoNegado'>;
type AcessoNegadoNavigationProp = StackNavigationProp<RootStackParamList>;

type Props = {
  route: AcessoNegadoRouteProp;
};

const AcessoNegadoScreen: React.FC<Props> = ({ route }) => {
  const navigation = useNavigation<AcessoNegadoNavigationProp>();
  const { funcionalidade } = route.params;

  const voltar = () => {
    navigation.navigate('Main');
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <MaterialIcons name="block" size={80} color="#f12b00" />
      </View>
      
      <Text style={styles.title}>Acesso Negado</Text>
      
      <Text style={styles.message}>
        Você não tem permissão para acessar a funcionalidade:
      </Text>
      
      <Text style={styles.funcionalidade}>
        {funcionalidade}
      </Text>
      
      <Text style={styles.info}>
        Entre em contato com o administrador do sistema para solicitar acesso.
      </Text>
      
      <TouchableOpacity style={styles.button} onPress={voltar}>
        <Text style={styles.buttonText}>Voltar para o Início</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff'
  },
  iconContainer: {
    marginBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333'
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    color: '#555'
  },
  funcionalidade: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#f12b00'
  },
  info: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    color: '#777',
    paddingHorizontal: 20
  },
  button: {
    backgroundColor: '#f12b00',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default AcessoNegadoScreen; 