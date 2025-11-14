import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// Interface para as permissões de um menu
interface MenuPermissao {
  id: number;
  nome: string;
  descricao: string;
  icone: string;
  rota: string;
  ordem: number;
  permissoes: {
    visualizar: boolean;
    criar: boolean;
    editar: boolean;
    excluir: boolean;
  };
}

// Interface para os dados do usuário
interface Usuario {
  id: number;
  nome: string;
  email: string;
  tipo_usuario: string;
  filial_id?: number | null;
}

interface AuthContextData {
  signed: boolean;
  token: string | null;
  loading: boolean;
  usuario: Usuario | null;
  menus: MenuPermissao[];
  signIn(email: string, password: string): Promise<boolean>;
  signOut(): void;
  hasPermission(rota: string, permissao: 'visualizar' | 'criar' | 'editar' | 'excluir'): boolean;
  refreshPermissions(): Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [menus, setMenus] = useState<MenuPermissao[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refreshPermissions = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await api.get('/verificar_permissoes.php');
      
      if (response.data && response.data.success) {
        setUsuario(response.data.usuario);
        setMenus(response.data.menus);
        
        localStorage.setItem('usuario', JSON.stringify(response.data.usuario));
        localStorage.setItem('menus', JSON.stringify(response.data.menus));
      }
    } catch (error) {
      console.error('Erro ao atualizar permissões:', error);
    }
  }, [token]);

  useEffect(() => {
    async function loadStorageData() {
      const storedToken = localStorage.getItem('token');
      const storedUsuario = localStorage.getItem('usuario');
      const storedMenus = localStorage.getItem('menus');
      
      if (storedToken) {
        setToken(storedToken);
        
        if (storedUsuario) {
          setUsuario(JSON.parse(storedUsuario));
        }
        
        if (storedMenus) {
          setMenus(JSON.parse(storedMenus));
        } else {
          // Se não tiver os menus armazenados, buscar do servidor
          await refreshPermissions();
        }
      }
      
      setLoading(false);
    }

    loadStorageData();
  }, [refreshPermissions]);

  async function signIn(email: string, password: string): Promise<boolean> {
    try {
      setLoading(true);
      const response = await api.post('/login.php', { email, password });
      
      // Verificar se a resposta contém dados
      if (!response.data) {
        throw new Error('Resposta vazia do servidor');
      }
      
      // Verificar se o login foi bem-sucedido
      if (response.data.success && response.data.token) {
        localStorage.setItem('token', response.data.token);
        setToken(response.data.token);
        
        if (response.data.usuario) {
          setUsuario(response.data.usuario);
          localStorage.setItem('usuario', JSON.stringify(response.data.usuario));
        }
        
        if (response.data.menus) {
          setMenus(response.data.menus);
          localStorage.setItem('menus', JSON.stringify(response.data.menus));
        }
        
        return true; // Login bem-sucedido
      } else {
        // Se a resposta contém uma mensagem de erro, usá-la
        if (response.data.message) {
          throw new Error(response.data.message);
        } else {
          throw new Error('Credenciais inválidas');
        }
      }
    } catch (error) {
      // Propagar o erro para ser tratado pelo componente de login
      throw error;
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('menus');
    setToken(null);
    setUsuario(null);
    setMenus([]);
    navigate('/login');
  }

  function hasPermission(rota: string, permissao: 'visualizar' | 'criar' | 'editar' | 'excluir'): boolean {
    // Admin tem todas as permissões
    if (usuario?.tipo_usuario === 'admin') {
      return true;
    }
    
    // Encontrar o menu pela rota
    const menu = menus.find(m => m.rota === rota);
    
    if (!menu) {
      return false;
    }
    
    return menu.permissoes[permissao];
  }

  return (
    <AuthContext.Provider value={{ 
      signed: !!token, 
      token, 
      loading, 
      usuario, 
      menus, 
      signIn, 
      signOut, 
      hasPermission,
      refreshPermissions
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default AuthContext;