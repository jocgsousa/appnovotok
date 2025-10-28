import api from './api';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  telefone: string | null;
  tipo_usuario: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface MenuPermissao {
  menu_id: number;
  menu_nome: string;
  menu_descricao: string;
  menu_icone: string;
  menu_rota: string;
  menu_ordem: number;
  visualizar: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
}

interface UsuarioDetalhado extends Usuario {
  permissoes: MenuPermissao[];
}

interface ListagemUsuarios {
  success: boolean;
  message: string;
  current_page: number;
  per_page: number;
  total_results: number;
  total_pages: number;
  usuarios: Usuario[];
}

interface UsuarioResponse {
  success: boolean;
  message: string;
  usuario: UsuarioDetalhado;
}

interface SimpleResponse {
  success: boolean;
  message: string;
  usuario_id?: number;
}

// Listar usuários com paginação e filtros
export const listarUsuarios = async (
  page: number = 1,
  perPage: number = 10,
  filtros?: {
    nome?: string;
    email?: string;
    tipo_usuario?: string;
    ativo?: boolean;
  }
): Promise<ListagemUsuarios> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('per_page', perPage.toString());

  if (filtros) {
    if (filtros.nome) params.append('nome', filtros.nome);
    if (filtros.email) params.append('email', filtros.email);
    if (filtros.tipo_usuario) params.append('tipo_usuario', filtros.tipo_usuario);
    if (filtros.ativo !== undefined) params.append('ativo', filtros.ativo ? '1' : '0');
  }

  const response = await api.get<ListagemUsuarios>(`/listar_usuarios.php?${params.toString()}`);
  return response.data;
};

// Obter detalhes de um usuário específico
export const obterUsuario = async (id: number): Promise<UsuarioResponse> => {
  const response = await api.get<UsuarioResponse>(`/obter_usuario.php?id=${id}`);
  return response.data;
};

// Cadastrar um novo usuário
export const cadastrarUsuario = async (
  usuario: {
    nome: string;
    email: string;
    cpf: string;
    senha: string;
    telefone?: string;
    tipo_usuario?: string;
    ativo?: boolean;
    permissoes?: Array<{
      menu_id: number;
      visualizar: boolean;
      criar: boolean;
      editar: boolean;
      excluir: boolean;
    }>;
  }
): Promise<SimpleResponse> => {
  const response = await api.post<SimpleResponse>('/cadastrar_usuario.php', usuario);
  return response.data;
};

// Atualizar um usuário existente
export const atualizarUsuario = async (
  id: number,
  usuario: {
    nome?: string;
    email?: string;
    cpf?: string;
    senha?: string;
    telefone?: string;
    tipo_usuario?: string;
    ativo?: boolean;
    permissoes?: Array<{
      menu_id: number;
      visualizar: boolean;
      criar: boolean;
      editar: boolean;
      excluir: boolean;
    }>;
  }
): Promise<SimpleResponse> => {
  const response = await api.put<SimpleResponse>('/atualizar_usuario.php', {
    id,
    ...usuario
  });
  return response.data;
};

// Excluir um usuário
export const excluirUsuario = async (id: number): Promise<SimpleResponse> => {
  const response = await api.delete<SimpleResponse>('/deletar_usuario.php', {
    data: { id }
  });
  return response.data;
};

// Verificar permissões do usuário atual
export const verificarPermissoes = async () => {
  const response = await api.get('/verificar_permissoes.php');
  return response.data;
};

export default {
  listarUsuarios,
  obterUsuario,
  cadastrarUsuario,
  atualizarUsuario,
  excluirUsuario,
  verificarPermissoes
}; 