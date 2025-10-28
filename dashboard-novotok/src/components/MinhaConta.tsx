import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface UserData {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
}

const MinhaConta: React.FC = () => {
  const { usuario } = useAuth();
  const [userData, setUserData] = useState<UserData>({
    nome: '',
    email: '',
    cpf: '',
    telefone: ''
  });
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Carregar dados do usuário
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Obter dados do usuário atual
      const response = await api.get('/minha_conta.php');
      
      if (response.data && response.data.success) {
        setUserData({
          nome: response.data.usuario.nome || '',
          email: response.data.usuario.email || '',
          cpf: response.data.usuario.cpf || '',
          telefone: response.data.usuario.telefone || ''
        });
      } else {
        throw new Error('Erro ao carregar dados do usuário');
      }
    } catch (err) {
      console.error('Erro ao carregar dados do usuário:', err);
      setError('Erro ao carregar dados do usuário');
    } finally {
      setLoading(false);
    }
  };

  // Atualizar campo do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData((prev: UserData) => ({ ...prev, [name]: value }));
  };

  // Enviar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      
      const data = {
        ...userData,
        senha: senha || undefined // Só envia a senha se for preenchida
      };
      
      const response = await api.put('/atualizar_minha_conta.php', data);
      
      if (response.data && response.data.success) {
        setSuccess(response.data.message || 'Dados atualizados com sucesso!');
        setSenha(''); // Limpar campo de senha após atualização
      } else {
        throw new Error(response.data?.message || 'Erro ao atualizar dados');
      }
    } catch (err: any) {
      console.error('Erro ao atualizar dados:', err);
      setError(err.message || 'Não foi possível atualizar os dados');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <h2>Minha Conta</h2>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <Card.Header>Dados Pessoais</Card.Header>
        <Card.Body>
          {loading ? (
            <p className="text-center">Carregando...</p>
          ) : (
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Nome</Form.Label>
                <Form.Control 
                  type="text" 
                  name="nome"
                  value={userData.nome}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control 
                  type="email" 
                  name="email"
                  value={userData.email}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Senha</Form.Label>
                <Form.Control 
                  type="password" 
                  name="senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Deixe em branco para manter a senha atual"
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>CPF</Form.Label>
                <Form.Control 
                  type="text" 
                  name="cpf"
                  value={userData.cpf}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Telefone</Form.Label>
                <Form.Control 
                  type="text" 
                  name="telefone"
                  value={userData.telefone}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
              
              <Button 
                type="submit" 
                variant="primary" 
                disabled={submitting}
              >
                {submitting ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </Form>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default MinhaConta; 