import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
  requiredPermission?: 'visualizar' | 'criar' | 'editar' | 'excluir';
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ 
  children, 
  requiredPermission = 'visualizar' 
}) => {
  const { signed, loading, menus, refreshPermissions } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname.replace('/dashboard', '');
  
  useEffect(() => {
    // Se o usuário está autenticado mas não tem menus carregados, buscar permissões
    if (signed && menus.length === 0) {
      refreshPermissions();
    }
  }, [signed, menus.length, refreshPermissions]);
  
  if (loading) {
    return <div className="loading-spinner">Carregando...</div>;
  }
  
  if (!signed) {
    // Redireciona para a página de login se não estiver autenticado
    return <Navigate to="/login" replace />;
  }
  
  // Verificar se o usuário tem permissão para acessar a rota atual
  const hasAccess = menus.some(menu => {
    // Verificar se a rota atual corresponde a algum menu permitido
    return (menu.rota === currentPath || currentPath.startsWith(menu.rota)) && 
           menu.permissoes[requiredPermission];
  });
  
  // Permitir acesso à rota raiz do dashboard
  if (currentPath === '/' || currentPath === '') {
    return <>{children}</>;
  }
  
  if (!hasAccess) {
    // Redireciona para o dashboard se não tiver permissão
    return <Navigate to="/dashboard" replace />;
  }
  
  // Renderiza o conteúdo protegido se estiver autenticado e tiver permissão
  return <>{children}</>;
};

export default PrivateRoute; 