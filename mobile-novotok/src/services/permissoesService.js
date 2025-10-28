import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Estrutura padrão das permissões (todas habilitadas por padrão)
const permissoesPadrao = {
  orcamentos: true,
  minhas_vendas: true,
  minhas_metas: true,
  informativos: true,
  buscar_produto: true,
  ofertas: true,
  clientes: true
};

// Controle de cache para evitar múltiplas chamadas à API
let ultimaVerificacaoPermissoes = 0;
const intervaloMinimoVerificacao = 60000; // 1 minuto em milissegundos
let cachePermissoes = null;

/**
 * Compara duas estruturas de permissões para verificar se são iguais
 * @param {Object} permissoes1 - Primeiro conjunto de permissões
 * @param {Object} permissoes2 - Segundo conjunto de permissões
 * @returns {boolean} - true se as permissões forem iguais, false caso contrário
 */
const saoPermissoesIguais = (permissoes1, permissoes2) => {
  if (!permissoes1 || !permissoes2) return false;
  
  const chaves = Object.keys(permissoesPadrao);
  
  for (const chave of chaves) {
    if (permissoes1[chave] !== permissoes2[chave]) {
      return false;
    }
  }
  
  return true;
};

/**
 * Busca as permissões do aparelho na API
 * @param {string} apiUrl - URL base da API
 * @param {string} deviceId - ID do dispositivo
 * @param {boolean} forcaAtualizacao - Se true, ignora o cache e força a busca na API
 * @returns {Promise<Object>} - Objeto com as permissões
 */
export const buscarPermissoes = async (apiUrl, deviceId, forcaAtualizacao = false) => {
  try {
    // Obter permissões locais primeiro para comparação posterior
    const permissoesLocais = await getPermissoesLocais();
    
    // Verificar se podemos usar o cache
    const agora = Date.now();
    if (!forcaAtualizacao && cachePermissoes && (agora - ultimaVerificacaoPermissoes < intervaloMinimoVerificacao)) {
      console.log('Usando cache de permissões');
      return cachePermissoes;
    }
    
    // Verificar conectividade
    const netInfo = await NetInfo.fetch();
    
    if (!netInfo.isConnected) {
      // Se estiver offline, usar permissões salvas localmente
      console.log('Offline: usando permissões locais');
      cachePermissoes = permissoesLocais;
      return permissoesLocais;
    }
    
    // Fazer requisição à API
    console.log(`Buscando permissões na API para o dispositivo: ${deviceId}`);
    const response = await axios.get(`${apiUrl}/obter_permissoes_funcao_app.php?codaparelho=${deviceId}`);
    
    if (response.data.success) {
      // Extrair permissões da resposta da API
      const permissoesAPI = {
        orcamentos: response.data.permissoes.orcamentos,
        minhas_vendas: response.data.permissoes.minhas_vendas,
        minhas_metas: response.data.permissoes.minhas_metas,
        informativos: response.data.permissoes.informativos,
        buscar_produto: response.data.permissoes.buscar_produto,
        ofertas: response.data.permissoes.ofertas,
        clientes: response.data.permissoes.clientes
      };
      
      // Verificar se as permissões são diferentes das salvas localmente
      const permissoesDiferentes = !saoPermissoesIguais(permissoesAPI, permissoesLocais);
      
      if (permissoesDiferentes) {
        console.log('Permissões da API são diferentes das locais. Atualizando...');
        await salvarPermissoesLocais(permissoesAPI);
        
        // Atualizar cache
        cachePermissoes = permissoesAPI;
        ultimaVerificacaoPermissoes = agora;
        
        console.log('Permissões atualizadas da API:', permissoesAPI);
        return permissoesAPI;
      } else {
        console.log('Permissões da API são iguais às locais. Mantendo as atuais.');
        cachePermissoes = permissoesLocais;
        ultimaVerificacaoPermissoes = agora;
        return permissoesLocais;
      }
    } else {
      // Em caso de erro, usar permissões salvas localmente
      console.log('Erro na resposta da API, usando permissões locais');
      cachePermissoes = permissoesLocais;
      return permissoesLocais;
    }
  } catch (error) {
    console.error('Erro ao buscar permissões:', error);
    // Em caso de erro, usar permissões salvas localmente
    console.log('Erro ao buscar permissões da API, usando permissões locais');
    const permissoesLocais = await getPermissoesLocais();
    cachePermissoes = permissoesLocais;
    return permissoesLocais;
  }
};

/**
 * Salva as permissões no armazenamento local
 * @param {Object} permissoes - Objeto com as permissões
 */
export const salvarPermissoesLocais = async (permissoes) => {
  try {
    await AsyncStorage.setItem('@BuscaPreco:permissoes', JSON.stringify(permissoes));
    // Atualizar cache também
    cachePermissoes = permissoes;
    ultimaVerificacaoPermissoes = Date.now();
  } catch (error) {
    console.error('Erro ao salvar permissões localmente:', error);
  }
};

/**
 * Obtém as permissões do armazenamento local
 * @returns {Promise<Object>} - Objeto com as permissões
 */
export const getPermissoesLocais = async () => {
  try {
    // Se temos um cache válido, usar ele
    if (cachePermissoes) {
      return cachePermissoes;
    }
    
    const permissoesString = await AsyncStorage.getItem('@BuscaPreco:permissoes');
    
    if (permissoesString) {
      const permissoes = JSON.parse(permissoesString);
      cachePermissoes = permissoes;
      return permissoes;
    }
    
    // Se não houver permissões salvas, retornar as permissões padrão
    cachePermissoes = permissoesPadrao;
    return permissoesPadrao;
  } catch (error) {
    console.error('Erro ao obter permissões localmente:', error);
    // Em caso de erro, retornar as permissões padrão
    return permissoesPadrao;
  }
};

/**
 * Verifica se uma funcionalidade específica está habilitada
 * @param {Object} permissoes - Objeto com as permissões
 * @param {string} funcionalidade - Nome da funcionalidade a ser verificada
 * @returns {boolean} - true se a funcionalidade estiver habilitada, false caso contrário
 */
export const verificarPermissao = (permissoes, funcionalidade) => {
  if (!permissoes) return true; // Se não houver permissões definidas, permitir acesso
  
  return permissoes[funcionalidade] === true;
}; 