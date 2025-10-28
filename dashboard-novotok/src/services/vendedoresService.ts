import api from './api';

// Listar todos os vendedores com opções de filtro
export const listarVendedores = async (params?: URLSearchParams) => {
  try {
    const response = await api.get('/listar_vendedores.php', { params });
    return response.data;
  } catch (error) {
    console.error('Erro ao listar vendedores:', error);
    throw error;
  }
};

// Obter um vendedor específico pelo ID
export const obterVendedor = async (id: number) => {
  try {
    const params = new URLSearchParams();
    params.append('id', id.toString());
    
    const response = await api.get('/obter_vendedor.php', { params });
    return response.data;
  } catch (error) {
    console.error('Erro ao obter vendedor:', error);
    throw error;
  }
};

export default {
  listarVendedores,
  obterVendedor
}; 