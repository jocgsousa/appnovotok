import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Row, Col, Badge } from 'react-bootstrap';
import axios from 'axios';
import { API_URL } from '../config';

// Estilos inline
const styles = {
  statusIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    display: 'inline-block'
  },
  statusOperational: {
    backgroundColor: '#28a745'
  },
  statusMaintenance: {
    backgroundColor: '#dc3545'
  }
};

// Tipos de manutenção disponíveis
const tiposManutenção = [
  { valor: 'geral', label: 'Manutenção Geral', cor: 'secondary' },
  { valor: 'correcao_bugs', label: 'Correção de Bugs', cor: 'danger' },
  { valor: 'atualizacao', label: 'Atualização do Sistema', cor: 'primary' },
  { valor: 'melhoria_performance', label: 'Melhoria de Performance', cor: 'success' },
  { valor: 'backup', label: 'Backup do Sistema', cor: 'info' },
  { valor: 'outro', label: 'Outro', cor: 'warning' }
];

// Função para formatar data ISO para o formato de entrada datetime-local
const formatDateForInput = (dateString: string | null): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  // Formato YYYY-MM-DDThh:mm necessário para o input datetime-local
  return date.toISOString().slice(0, 16);
};

// Função para formatar data para exibição
const formatDateForDisplay = (dateString: string | null): string => {
  if (!dateString) return 'Não definida';
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const Manutencao: React.FC = () => {
  const [status, setStatus] = useState<number>(0);
  const [tipoManutencao, setTipoManutencao] = useState<string>('geral');
  const [mensagem, setMensagem] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    carregarStatusManutencao();
  }, []);

  const carregarStatusManutencao = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/manutencao.php`);
      if (response.data.success) {
        setStatus(response.data.manutencao);
        setTipoManutencao(response.data.tipo_manutencao || 'geral');
        setMensagem(response.data.mensagem);
        
        // Configurar datas de início e fim
        if (response.data.data_inicio) {
          setDataInicio(formatDateForInput(response.data.data_inicio));
        }
        
        if (response.data.data_fim) {
          setDataFim(formatDateForInput(response.data.data_fim));
        }
      } else {
        setError('Erro ao carregar status de manutenção');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatusManutencao = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar datas quando o sistema estiver em manutenção
    if (status === 1) {
      if (!dataInicio) {
        setError('A data de início da manutenção é obrigatória');
        return;
      }
      
      // Se a data de fim for definida, verificar se é posterior à data de início
      if (dataFim && new Date(dataFim) <= new Date(dataInicio)) {
        setError('A data de fim deve ser posterior à data de início');
        return;
      }
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/atualizar_manutencao.php`,
        { 
          status, 
          tipo_manutencao: tipoManutencao, 
          mensagem,
          data_inicio: dataInicio || null,
          data_fim: dataFim || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setSuccess('Status de manutenção atualizado com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.data.message || 'Erro ao atualizar status de manutenção');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Encontrar o objeto do tipo de manutenção atual
  const tipoAtual = tiposManutenção.find(tipo => tipo.valor === tipoManutencao) || tiposManutenção[0];

  // Configurar data de início para agora quando o status muda para manutenção
  useEffect(() => {
    if (status === 1 && !dataInicio) {
      const now = new Date();
      setDataInicio(formatDateForInput(now.toISOString()));
    }
  }, [status]);

  return (
    <Container>
      <h2 className="mb-4">Gerenciamento de Manutenção</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      
      <Card>
        <Card.Body>
          <Card.Title>Status de Manutenção do Sistema</Card.Title>
          
          <div className="mb-4">
            <h5>Status Atual:</h5>
            <div className="d-flex align-items-center">
              <div 
                style={{
                  ...styles.statusIndicator,
                  ...(status === 1 ? styles.statusMaintenance : styles.statusOperational)
                }}
              ></div>
              <span className="ms-2 fw-bold">
                {status === 0 ? 'Sistema Operacional' : 'Sistema em Manutenção'}
              </span>
              {status === 1 && (
                <Badge bg={tipoAtual.cor} className="ms-2">
                  {tipoAtual.label}
                </Badge>
              )}
            </div>
            
            {status === 1 && dataInicio && (
              <div className="mt-2 ps-4">
                <small className="text-muted">
                  <strong>Início:</strong> {formatDateForDisplay(dataInicio)}
                  {dataFim && (
                    <>
                      <strong className="ms-3">Previsão de término:</strong> {formatDateForDisplay(dataFim)}
                    </>
                  )}
                </small>
              </div>
            )}
          </div>
          
          <Form onSubmit={atualizarStatusManutencao}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select 
                    value={status} 
                    onChange={(e) => setStatus(parseInt(e.target.value))}
                    disabled={loading}
                  >
                    <option value={0}>Sistema Operacional</option>
                    <option value={1}>Sistema em Manutenção</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tipo de Manutenção</Form.Label>
                  <Form.Select 
                    value={tipoManutencao} 
                    onChange={(e) => setTipoManutencao(e.target.value)}
                    disabled={loading || status === 0}
                  >
                    {tiposManutenção.map(tipo => (
                      <option key={tipo.valor} value={tipo.valor}>
                        {tipo.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Data de Início</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    disabled={loading || status === 0}
                  />
                  {status === 1 && (
                    <Form.Text className="text-muted">
                      Data e hora de início da manutenção
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Previsão de Término</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    disabled={loading || status === 0}
                  />
                  {status === 1 && (
                    <Form.Text className="text-muted">
                      Data e hora prevista para o término (opcional)
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Mensagem</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Informe a mensagem que será exibida durante a manutenção"
                disabled={loading || status === 0}
              />
              {status === 1 && (
                <Form.Text className="text-muted">
                  Esta mensagem será exibida para os usuários do aplicativo durante o período de manutenção.
                </Form.Text>
              )}
            </Form.Group>
            
            <Button 
              variant="primary" 
              type="submit" 
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Manutencao; 