import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Alert, Row, Col, Spinner } from 'react-bootstrap';
import configCadastroClientesService, { ConfigCadastroClientes as ConfigType } from '../services/configCadastroClientesService';

// Estilos inline
const styles = {
  cardHeader: {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderBottom: '1px solid #dee2e6'
  },
  cardHeaderTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 500
  },
  cardHeaderSubtitle: {
    margin: '0.5rem 0 0 0',
    fontSize: '0.875rem',
    color: '#6c757d'
  }
};

const ConfigCadastroClientes: React.FC = () => {
  const [config, setConfig] = useState<ConfigType | null>(null);
  const [timer, setTimer] = useState<number>(3000);
  const [automatic, setAutomatic] = useState<boolean>(false);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Carregar configurações ao montar o componente
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const configData = await configCadastroClientesService.obterConfig();
        setConfig(configData);
        setTimer(configData.timer);
        setAutomatic(configData.automatic);
      } catch (err) {
        setError('Erro ao carregar configurações');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Função para salvar as configurações
  const handleSave = async () => {
    try {
      setSaving(true);
      const updatedConfig = await configCadastroClientesService.atualizarConfig({
        timer,
        automatic
      });
      
      setConfig(updatedConfig);
      setSuccess('Configurações salvas com sucesso');
      
      // Limpar mensagem de sucesso após 3 segundos
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erro ao salvar configurações');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Limpar mensagens de erro após exibição
  const handleCloseError = () => {
    setError(null);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <Card>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardHeaderTitle}>Configurações de Cadastro de Clientes</h3>
        <p style={styles.cardHeaderSubtitle}>Gerencie as configurações do sistema de cadastro de clientes</p>
      </div>
      
      <Card.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={handleCloseError}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert variant="success">
            {success}
          </Alert>
        )}
        
        <Form>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Timer de Sincronização (ms)</Form.Label>
                <Form.Control
                  type="number"
                  value={timer}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimer(Number(e.target.value))}
                  min={1000}
                />
                <Form.Text className="text-muted">
                  Tempo em milissegundos entre sincronizações (mínimo 1000ms)
                </Form.Text>
              </Form.Group>
            </Col>
            
            <Col md={6}>
              <Form.Group className="mb-3 mt-2">
                <Form.Check
                  type="checkbox"
                  id="automatic-sync"
                  label="Sincronização Automática"
                  checked={automatic}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAutomatic(e.target.checked)}
                />
                <Form.Text className="text-muted">
                  Quando ativado, o sistema sincroniza automaticamente os dados
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
          
          <div className="d-flex justify-content-end mt-4">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                  Salvando...
                </>
              ) : (
                <>
                  Salvar Configurações
                </>
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default ConfigCadastroClientes; 