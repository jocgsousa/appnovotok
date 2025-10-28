import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Row, Col, Alert, Modal } from 'react-bootstrap';
import api from '../services/api';

interface Secao {
  id?: number;
  rid: string;
  codpto: string | number;
  codsec: string | number;
  descricao: string;
  linha?: string;
  qtmax?: number | null;
  tipo?: string | null;
  departamento_descricao?: string;
}

interface Departamento {
  id?: number;
  rid: string;
  codpto: string;
  descricao: string;
}

const Secoes: React.FC = () => {
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estado para filtro
  const [filtroDepartamento, setFiltroDepartamento] = useState<string>('');
  
  // Estado para o modal de nova seção
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Secao>({
    rid: generateRid(),
    codpto: '',
    codsec: '',
    descricao: '',
    linha: 'A',
    qtmax: null,
    tipo: null
  });

  // Estado para o modal de edição de seção
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Secao>({
    id: 0,
    rid: '',
    codpto: '',
    codsec: '',
    descricao: '',
    linha: 'A',
    qtmax: null,
    tipo: null
  });
  
  // Estado para o modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | undefined>(undefined);
  
  const [submitting, setSubmitting] = useState(false);

  // Carregar lista de departamentos e seções
  useEffect(() => {
    loadDepartamentos();
  }, []);

  useEffect(() => {
    loadSecoes();
  }, [filtroDepartamento]);

  const loadDepartamentos = async () => {
    try {
      setError(null);
      
      const response = await api.get('/listar_departamentos.php');
      if (response.data && response.data.departamentos) {
        setDepartamentos(response.data.departamentos);
      }
    } catch (err) {
      console.error('Erro ao carregar departamentos:', err);
      setError('Não foi possível carregar a lista de departamentos');
    }
  };

  const loadSecoes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/listar_secoes.php';
      if (filtroDepartamento) {
        url += `?codpto=${filtroDepartamento}`;
      }
      
      const response = await api.get(url);
      if (response.data && response.data.secoes) {
        setSecoes(response.data.secoes);
      }
    } catch (err) {
      console.error('Erro ao carregar seções:', err);
      setError('Não foi possível carregar a lista de seções');
    } finally {
      setLoading(false);
    }
  };

  // Função para gerar um RID único
  function generateRid() {
    return 'AAAPrbAAFAAA' + Math.random().toString(36).substring(2, 6) + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  // Atualizar campo do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Atualizar campo do formulário de edição
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  // Atualizar filtro
  const handleFiltroChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFiltroDepartamento(e.target.value);
  };

  // Abrir modal para cadastrar nova seção
  const handleOpenModal = () => {
    setFormData({
      rid: generateRid(),
      codpto: filtroDepartamento || '',
      codsec: '',
      descricao: '',
      linha: 'A',
      qtmax: null,
      tipo: null
    });
    setShowModal(true);
  };

  // Fechar modal
  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Abrir modal para editar seção
  const handleOpenEditModal = (secao: Secao) => {
    setEditFormData({
      ...secao
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
    
    if (!formData.codpto || !formData.codsec || !formData.descricao) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await api.post('/cadastrar_secao.php', formData);
      
      setSuccess('Seção cadastrada com sucesso!');
      handleCloseModal();
      loadSecoes();
    } catch (err: any) {
      console.error('Erro ao cadastrar seção:', err);
      setError(err.response?.data?.message || 'Não foi possível cadastrar a seção');
    } finally {
      setSubmitting(false);
    }
  };

  // Enviar formulário de edição
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editFormData.codpto || !editFormData.codsec || !editFormData.descricao) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await api.put('/atualizar_secao.php', editFormData);
      
      setSuccess('Seção atualizada com sucesso!');
      handleCloseEditModal();
      loadSecoes();
    } catch (err: any) {
      console.error('Erro ao atualizar seção:', err);
      setError(err.response?.data?.message || 'Não foi possível atualizar a seção');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar seção
  const handleDeleteSecao = async () => {
    try {
      setError(null);
      
      await api.delete('/deletar_secao.php', {
        data: { id: deleteId }
      });
      
      setSuccess('Seção excluída com sucesso!');
      handleCloseDeleteModal();
      loadSecoes();
    } catch (err: any) {
      console.error('Erro ao excluir seção:', err);
      setError(err.response?.data?.message || 'Não foi possível excluir a seção');
    }
  };

  // Renderizar formulário de seção
  const renderSecaoForm = (data: Secao, handleChangeFunc: any) => {
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
          <Form.Label column sm={3}>Departamento *</Form.Label>
          <Col sm={9}>
            <Form.Select
              name="codpto"
              value={data.codpto}
              onChange={handleChangeFunc}
              required
            >
              <option value="">Selecione...</option>
              {departamentos.map((departamento) => (
                <option key={departamento.id} value={departamento.codpto}>
                  {departamento.codpto} - {departamento.descricao}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={3}>Código da Seção *</Form.Label>
          <Col sm={9}>
            <Form.Control
              type="number"
              name="codsec"
              value={data.codsec}
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
          <Form.Label column sm={3}>Linha</Form.Label>
          <Col sm={9}>
            <Form.Select
              name="linha"
              value={data.linha || 'A'}
              onChange={handleChangeFunc}
            >
              <option value="A">A</option>
              <option value="V">V</option>
            </Form.Select>
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={3}>Quantidade Máxima</Form.Label>
          <Col sm={9}>
            <Form.Control
              type="number"
              name="qtmax"
              value={data.qtmax || ''}
              onChange={handleChangeFunc}
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3">
          <Form.Label column sm={3}>Tipo</Form.Label>
          <Col sm={9}>
            <Form.Control
              type="text"
              name="tipo"
              value={data.tipo || ''}
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
            <h5 className="mb-0">Gerenciamento de Seções</h5>
            <Button variant="light" size="sm" onClick={handleOpenModal}>
              <i className="bi bi-plus-circle me-1"></i> Nova Seção
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
          
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Filtrar por Departamento</Form.Label>
                <Form.Select
                  value={filtroDepartamento}
                  onChange={handleFiltroChange}
                >
                  <option value="">Todos os Departamentos</option>
                  {departamentos.map((departamento) => (
                    <option key={departamento.id} value={departamento.codpto}>
                      {departamento.codpto} - {departamento.descricao}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          
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
                    <th>Departamento</th>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th>Linha</th>
                    <th>Qtd. Máx.</th>
                    <th>Tipo</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {secoes.length > 0 ? (
                    secoes.map((secao) => (
                      <tr key={secao.id}>
                        <td>{secao.codpto} - {secao.departamento_descricao}</td>
                        <td>{secao.codsec}</td>
                        <td>{secao.descricao}</td>
                        <td>{secao.linha}</td>
                        <td>{secao.qtmax}</td>
                        <td>{secao.tipo}</td>
                        <td className="text-center">
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-1"
                            onClick={() => handleOpenEditModal(secao)}
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => handleOpenDeleteModal(secao.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center">Nenhuma seção encontrada</td>
                    </tr>
                  )}
                </tbody>
              </Table>
              {secoes.length > 0 && (
                <div className="text-muted mt-2">
                  <small>
                    Total de seções: {secoes.length}
                    {filtroDepartamento && ` (Filtradas por departamento: ${filtroDepartamento})`}
                  </small>
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal para cadastrar nova seção */}
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>Nova Seção</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {renderSecaoForm(formData, handleChange)}
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

      {/* Modal para editar seção */}
      <Modal show={showEditModal} onHide={handleCloseEditModal}>
        <Modal.Header closeButton>
          <Modal.Title>Editar Seção</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitEdit}>
          <Modal.Body>
            {renderSecaoForm(editFormData, handleEditChange)}
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
          Tem certeza que deseja excluir esta seção? Esta ação não pode ser desfeita.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDeleteModal}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDeleteSecao}>
            Excluir
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Secoes; 