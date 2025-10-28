import React, { useEffect } from 'react';
import { Button, Alert } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';

const MonitoramentoVendasMenu: React.FC = () => {
  const { refreshPermissions } = useAuth();
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Atualizar permissões ao carregar o componente
  useEffect(() => {
    handleRefreshPermissions();
  }, []);

  const handleRefreshPermissions = async () => {
    try {
      setMessage(null);
      setError(null);
      await refreshPermissions();
      setMessage('Permissões atualizadas com sucesso! Agora o menu de Monitoramento de Vendas deve estar visível.');
    } catch (err) {
      setError('Erro ao atualizar permissões. Tente fazer logout e login novamente.');
    }
  };

  return (
    <div className="p-4">
      <h2>Menu de Monitoramento de Vendas</h2>
      
      {message && <Alert variant="success" dismissible onClose={() => setMessage(null)}>{message}</Alert>}
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      
      <p>
        Se o menu de Monitoramento de Vendas não estiver aparecendo no menu lateral,
        clique no botão abaixo para atualizar suas permissões.
      </p>
      
      <Button 
        variant="primary" 
        onClick={handleRefreshPermissions}
      >
        Atualizar Permissões
      </Button>
      
      <hr />
      
      <p>
        <strong>Nota:</strong> Se mesmo após atualizar as permissões o menu não aparecer,
        tente fazer logout e login novamente para recarregar completamente suas permissões.
      </p>
    </div>
  );
};

export default MonitoramentoVendasMenu; 