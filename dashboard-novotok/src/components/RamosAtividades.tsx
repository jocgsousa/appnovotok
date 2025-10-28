import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Row, Col, Alert, Modal } from 'react-bootstrap';
import { 
  listarAtividades, 
  cadastrarAtividade, 
  atualizarAtividade,
  obterAtividade,
  deletarAtividade as deletarAtividadeService 
} from '../services/atividadesService';

interface Atividade {
  id: number;
  codativi: string;
  ramo: string;
  created_at: string;
  updated_at: string;
}

const RamosAtividades: React.FC = () => {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Estado para o modal de edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editNome, setEditNome] = useState('');

  // Carregar lista de atividades
  useEffect(() => {
    loadAtividades();
  }, []);

  const loadAtividades = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await listarAtividades();
      setAtividades(data);
    } catch (err) {
      console.error('Erro ao carregar atividades:', err);
      setError('Não foi possível carregar a lista de atividades');
    } finally {
      setLoading(false);
    }
  };

  // Enviar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!codigo.trim() || !nome.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await cadastrarAtividade(codigo, nome);
      
      // Limpar formulário e recarregar lista
      setCodigo('');
      setNome('');
      setSuccess('Ramo de Atividade salvo com sucesso!');
      loadAtividades();
    } catch (err) {
      console.error('Erro ao salvar atividade:', err);
      setError('Não foi possível salvar o ramo de atividade');
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de edição
  const handleOpenEditModal = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const atividade = await obterAtividade(id);
      
      setEditId(atividade.id);
      setEditCodigo(atividade.codativi);
      setEditNome(atividade.ramo);
      setShowEditModal(true);
    } catch (err) {
      console.error('Erro ao carregar dados da atividade:', err);
      setError('Não foi possível carregar os dados da atividade para edição');
    } finally {
      setLoading(false);
    }
  };

  // Fechar modal de edição
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditId(null);
    setEditCodigo('');
    setEditNome('');
  };

  // Enviar formulário de edição
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editCodigo.trim() || !editNome.trim() || !editId) {
      setError('Preencha todos os campos');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await atualizarAtividade(editId, editCodigo, editNome);
      
      // Fechar modal e recarregar lista
      handleCloseEditModal();
      setSuccess('Ramo de Atividade atualizado com sucesso!');
      loadAtividades();
    } catch (err) {
      console.error('Erro ao atualizar atividade:', err);
      setError('Não foi possível atualizar o ramo de atividade');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar atividade
  const deletarAtividade = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este ramo de atividade?')) {
      try {
        setError(null);
        
        await deletarAtividadeService(id);
        
        setSuccess('Atividade deletada com sucesso!');
        loadAtividades();
      } catch (err) {
        console.error('Erro ao deletar atividade:', err);
        setError('Erro ao deletar a atividade. Tente novamente.');
      }
    }
  };

  // Limpar mensagens de sucesso após 3 segundos
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <div>
      <div className="dashboard-header">
        <h2>Ramos de Atividades</h2>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && (
        <Alert variant="success" className="alert-success" style={{ backgroundColor: '#d4edda', color: '#155724', borderColor: '#c3e6cb' }}>
          {success}
        </Alert>
      )}

      <Row>
        <Col md={5}>
          <Card className="mb-4">
            <Card.Header>Cadastrar Novo Ramo</Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Código</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Nome</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={7}>
          <Card>
            <Card.Header>Lista de Atividades</Card.Header>
            <Card.Body>
              {loading ? (
                <p className="text-center">Carregando...</p>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Código</th>
                      <th>Ramo</th>
                      <th>Criado em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atividades.length > 0 ? (
                      atividades.map((atividade) => (
                        <tr key={atividade.id}>
                          <td>{atividade.id}</td>
                          <td>{atividade.codativi}</td>
                          <td>{atividade.ramo}</td>
                          <td>{atividade.created_at}</td>
                          <td>
                            <Button 
                              variant="info" 
                              size="sm"
                              className="me-2"
                              onClick={() => handleOpenEditModal(atividade.id)}
                            >
                              Editar
                            </Button>
                            <Button 
                              variant="danger" 
                              size="sm"
                              onClick={() => deletarAtividade(atividade.id)}
                            >
                              Deletar
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center">Nenhuma atividade encontrada</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal de Edição */}
      <Modal show={showEditModal} onHide={handleCloseEditModal}>
        <Modal.Header closeButton>
          <Modal.Title>Editar Ramo de Atividade</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmitEdit}>
            <Form.Group className="mb-3">
              <Form.Label>Código</Form.Label>
              <Form.Control 
                type="text" 
                value={editCodigo}
                onChange={(e) => setEditCodigo(e.target.value)}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Nome</Form.Label>
              <Form.Control 
                type="text" 
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                required
              />
            </Form.Group>
            
            <div className="d-flex justify-content-end mt-3">
              <Button variant="secondary" onClick={handleCloseEditModal} className="me-2">
                Cancelar
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default RamosAtividades; 