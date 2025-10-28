import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Row, Col, Alert, Modal } from 'react-bootstrap';
import api from '../services/api';

interface Departamento {
  id?: number;
  rid: string;
  atualizainvgeral: string;
  codpto: string;
  descricao: string;
  margemprevista: number;
  referencia: string;
  tipomerc: string;
}

const Departamentos: React.FC = () => {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estado para o modal de novo departamento
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Departamento>({
    rid: generateRid(),
    atualizainvgeral: 'N',
    codpto: '',
    descricao: '',
    margemprevista: 0,
    referencia: '',
    tipomerc: ''
  });

  // Estado para o modal de edição de departamento
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Departamento>({
    id: 0,
    rid: '',
    atualizainvgeral: 'N',
    codpto: '',
    descricao: '',
    margemprevista: 0,
    referencia: '',
    tipomerc: ''
  });
  
  // Estado para o modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | undefined>(undefined);
  
  const [submitting, setSubmitting] = useState(false);

  // Carregar lista de departamentos
  useEffect(() => {
    loadDepartamentos();
  }, []);

  const loadDepartamentos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/listar_departamentos.php');
      if (response.data && response.data.departamentos) {
        setDepartamentos(response.data.departamentos);
      }
    } catch (err) {
      console.error('Erro ao carregar departamentos:', err);
      setError('Não foi possível carregar a lista de departamentos');
    } finally {
      setLoading(false);
    }
  };

  // Função para gerar um RID único
  function generateRid() {
    return 'AAAPu7AAFAAA' + Math.random().toString(36).substring(2, 6) + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  // Atualizar campo do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked ? 'S' : 'N' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Atualizar campo do formulário de edição
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setEditFormData(prev => ({ ...prev, [name]: checked ? 'S' : 'N' }));
    } else {
      setEditFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Abrir modal para cadastrar novo departamento
  const handleOpenModal = () => {
    setFormData({
      rid: generateRid(),
      atualizainvgeral: 'N',
      codpto: '',
      descricao: '',
      margemprevista: 0,
      referencia: '',
      tipomerc: ''
    });
    setShowModal(true);
  };

  // Fechar modal
  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Abrir modal para editar departamento
  const handleOpenEditModal = (departamento: Departamento) => {
    setEditFormData({
      ...departamento
    });
    setShowEditModal(true);
  };

  // Fechar modal de edição
  const handleCloseEditModal = () => {
    setShowEditModal(false);
  };

  // Abrir modal de confirmação de exclusão
  const handleOpenDeleteModal = (id: number | undefined) => {
    if (id) {
      setDeleteId(id);
      setShowDeleteModal(true);
    }
  };

  // Fechar modal de confirmação de exclusão
  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
  };

  // Enviar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.codpto.trim() || !formData.descricao.trim()) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await api.post('/cadastrar_departamento.php', formData);
      
      setSuccess('Departamento cadastrado com sucesso!');
      handleCloseModal();
      loadDepartamentos();
    } catch (err: any) {
      console.error('Erro ao cadastrar departamento:', err);
      setError(err.response?.data?.message || 'Não foi possível cadastrar o departamento');
    } finally {
      setSubmitting(false);
    }
  };

  // Enviar formulário de edição
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editFormData.codpto.trim() || !editFormData.descricao.trim()) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await api.put('/atualizar_departamento.php', editFormData);
      
      setSuccess('Departamento atualizado com sucesso!');
      handleCloseEditModal();
      loadDepartamentos();
    } catch (err: any) {
      console.error('Erro ao atualizar departamento:', err);
      setError(err.response?.data?.message || 'Não foi possível atualizar o departamento');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar departamento
  const handleDeleteDepartamento = async () => {
    try {
      setError(null);
      
      await api.delete('/deletar_departamento.php', {
        data: { id: deleteId }
      });
      
      setSuccess('Departamento excluído com sucesso!');
      handleCloseDeleteModal();
      loadDepartamentos();
    } catch (err: any) {
      console.error('Erro ao excluir departamento:', err);
      setError(err.response?.data?.message || 'Não foi possível excluir o departamento');
    }
  };

  // Renderizar formulário de departamento
  const renderDepartamentoForm = (data: Departamento, handleChangeFunc: any) => {
    return (
      <>
        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={3}>RID</Form.Label>
          <Col sm={9}>
            <Form.Control
              type="text"
              name="rid"
              value={data.rid}
              onChange={handleChangeFunc}
              disabled
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={3}>Código *</Form.Label>
          <Col sm={9}>
            <Form.Control
              type="number"
              name="codpto"
              value={data.codpto}
              onChange={handleChangeFunc}
              required
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={3}>Descrição *</Form.Label>
          <Col sm={9}>
            <Form.Control
              type="text"
              name="descricao"
              value={data.descricao}
              onChange={handleChangeFunc}
              required
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={3}>Atualiza Inv. Geral</Form.Label>
          <Col sm={9}>
            <Form.Check
              type="checkbox"
              name="atualizainvgeral"
              checked={data.atualizainvgeral === 'S'}
              onChange={handleChangeFunc}
              label="Sim"
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={3}>Margem Prevista</Form.Label>
          <Col sm={9}>
            <Form.Control
              type="number"
              step="0.01"
              name="margemprevista"
              value={data.margemprevista}
              onChange={handleChangeFunc}
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={3}>Referência</Form.Label>
          <Col sm={9}>
            <Form.Control
              type="text"
              name="referencia"
              value={data.referencia}
              onChange={handleChangeFunc}
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={3}>Tipo Mercadoria</Form.Label>
          <Col sm={9}>
            <Form.Control
              type="text"
              name="tipomerc"
              value={data.tipomerc}
              onChange={handleChangeFunc}
            />
          </Col>
        </Form.Group>
      </>
    );
  };

  return (
    <div className="container-fluid">
      <Card className="shadow-sm">
        <Card.Header className="bg-primary text-white">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Gerenciamento de Departamentos</h5>
            <Button variant="light" size="sm" onClick={handleOpenModal}>
              <i className="bi bi-plus-circle me-1"></i> Novo Departamento
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
              {success}
            </Alert>
          )}
          
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Carregando...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover bordered>
                <thead className="table-light">
                  <tr>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th>Atualiza Inv. Geral</th>
                    <th>Margem Prevista</th>
                    <th>Referência</th>
                    <th>Tipo Merc.</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {departamentos.length > 0 ? (
                    departamentos.map((departamento) => (
                      <tr key={departamento.id}>
                        <td>{departamento.codpto}</td>
                        <td>{departamento.descricao}</td>
                        <td>{departamento.atualizainvgeral === 'S' ? 'Sim' : 'Não'}</td>
                        <td>{departamento.margemprevista}</td>
                        <td>{departamento.referencia}</td>
                        <td>{departamento.tipomerc}</td>
                        <td className="text-center">
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-1"
                            onClick={() => handleOpenEditModal(departamento)}
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => handleOpenDeleteModal(departamento.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center">Nenhum departamento encontrado</td>
                    </tr>
                  )}
                </tbody>
              </Table>
              {departamentos.length > 0 && (
                <div className="text-muted mt-2">
                  <small>Total de departamentos: {departamentos.length}</small>
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal para cadastrar novo departamento */}
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>Novo Departamento</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {renderDepartamentoForm(formData, handleChange)}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal para editar departamento */}
      <Modal show={showEditModal} onHide={handleCloseEditModal}>
        <Modal.Header closeButton>
          <Modal.Title>Editar Departamento</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitEdit}>
          <Modal.Body>
            {renderDepartamentoForm(editFormData, handleEditChange)}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseEditModal}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal para confirmar exclusão */}
      <Modal show={showDeleteModal} onHide={handleCloseDeleteModal}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar Exclusão</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Tem certeza que deseja excluir este departamento? Esta ação não pode ser desfeita.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDeleteModal}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDeleteDepartamento}>
            Excluir
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Departamentos; 