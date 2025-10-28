import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Alert } from 'react-bootstrap';
import logo from '../assets/logo.png';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signed } = useAuth();

  // Verificar se já está logado
  useEffect(() => {
    if (signed) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, signed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await signIn(email, password);
      
      // Redirecionar apenas se o login for bem-sucedido
      if (success) {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      console.error('Erro no login:', err);
      
      // Extrair mensagem de erro da resposta da API
      if (err.response && err.response.data) {
        const responseData = err.response.data;
        setError(responseData.message || 'Erro ao fazer login. Verifique suas credenciais.');
      } else {
        setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="logo-container">
        <img src={logo} alt="Logo" className="logo" />
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Form onSubmit={handleSubmit}>
        <Form.Group className="form-group" controlId="email">
          <Form.Label>Email</Form.Label>
          <Form.Control 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
        </Form.Group>

        <Form.Group className="form-group" controlId="password">
          <Form.Label>Senha</Form.Label>
          <Form.Control 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
        </Form.Group>

        <Button 
          type="submit" 
          className="btn-login" 
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </Form>
    </div>
  );
};

export default Login; 