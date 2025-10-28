import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Row, Col, Alert, Modal } from 'react-bootstrap';
import { 
  listarFiliais, 
  cadastrarFilial, 
  atualizarFilial, 
  obterFilial,
  deletarFilial,
  Filial
} from '../services/filialService';
import PageHeader from './PageHeader';
import ActionButtons from './ActionButtons';
import ResponsiveTable from './ResponsiveTable';

const Filiais: React.FC = () => {
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estado para o modal de nova filial
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Filial>({
    codigo: '',
    nome_fantasia: '',
    razao_social: '',
    cnpj: '',
    ie: '',
    telefone: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: ''
  });

  // Estado para o modal de edição de filial
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Filial>({
    id: 0,
    codigo: '',
    nome_fantasia: '',
    razao_social: '',
    cnpj: '',
    ie: '',
    telefone: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: ''
  });
  
  const [submitting, setSubmitting] = useState(false);

  // Carregar lista de filiais
  useEffect(() => {
    loadFiliais();
  }, []);

  const loadFiliais = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await listarFiliais();
      setFiliais(data);
    } catch (err) {
      console.error('Erro ao carregar filiais:', err);
      setError('Não foi possível carregar a lista de filiais');
    } finally {
      setLoading(false);
    }
  };

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

  // Abrir modal para cadastrar nova filial
  const handleOpenModal = () => {
    setFormData({
      codigo: '',
      nome_fantasia: '',
      razao_social: '',
      cnpj: '',
      ie: '',
      telefone: '',
      email: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: ''
    });
    setShowModal(true);
  };

  // Fechar modal
  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Abrir modal para editar filial
  const handleOpenEditModal = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const filial = await obterFilial(id);
      
      setEditFormData({
        ...filial
      });
      
      setShowEditModal(true);
    } catch (err) {
      console.error('Erro ao carregar dados da filial:', err);
      setError('Não foi possível carregar os dados da filial para edição');
    } finally {
      setLoading(false);
    }
  };

  // Fechar modal de edição
  const handleCloseEditModal = () => {
    setShowEditModal(false);
  };

  // Enviar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.codigo.trim() || !formData.nome_fantasia.trim() || !formData.razao_social.trim() || !formData.cnpj.trim()) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const response = await cadastrarFilial(formData);
      
      if (response.message) {
        setSuccess('Filial cadastrada com sucesso!');
        handleCloseModal();
        loadFiliais();
      } else {
        setError('Erro ao cadastrar filial');
      }
    } catch (err: any) {
      console.error('Erro ao cadastrar filial:', err);
      setError(err.response?.data?.message || 'Não foi possível cadastrar a filial');
    } finally {
      setSubmitting(false);
    }
  };

  // Enviar formulário de edição
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editFormData.codigo.trim() || !editFormData.nome_fantasia.trim() || !editFormData.razao_social.trim() || !editFormData.cnpj.trim()) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const response = await atualizarFilial(editFormData);
      
      if (response.message) {
        setSuccess('Filial atualizada com sucesso!');
        handleCloseEditModal();
        loadFiliais();
      } else {
        setError('Erro ao atualizar filial');
      }
    } catch (err: any) {
      console.error('Erro ao atualizar filial:', err);
      setError(err.response?.data?.message || 'Não foi possível atualizar a filial');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar filial
  const handleDeleteFilial = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta filial?')) {
      try {
        setError(null);
        
        const response = await deletarFilial(id);
        
        if (response.message) {
          setSuccess('Filial excluída com sucesso!');
          loadFiliais();
        } else {
          setError('Erro ao excluir filial');
        }
      } catch (err: any) {
        console.error('Erro ao excluir filial:', err);
        setError(err.response?.data?.message || 'Não foi possível excluir a filial');
      }
    }
  };

  // Renderizar formulário de filial
  const renderFilialForm = (data: Filial, handleChangeFunc: any) => {
    return (
      <>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Código *</Form.Label>
              <Form.Control
                type="text"
                name="codigo"
                value={data.codigo}
                onChange={handleChangeFunc}
                required
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>CNPJ *</Form.Label>
              <Form.Control
                type="text"
                name="cnpj"
                value={data.cnpj}
                onChange={handleChangeFunc}
                required
              />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Nome Fantasia *</Form.Label>
              <Form.Control
                type="text"
                name="nome_fantasia"
                value={data.nome_fantasia}
                onChange={handleChangeFunc}
                required
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Razão Social *</Form.Label>
              <Form.Control
                type="text"
                name="razao_social"
                value={data.razao_social}
                onChange={handleChangeFunc}
                required
              />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Inscrição Estadual</Form.Label>
              <Form.Control
                type="text"
                name="ie"
                value={data.ie || ''}
                onChange={handleChangeFunc}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Telefone</Form.Label>
              <Form.Control
                type="text"
                name="telefone"
                value={data.telefone || ''}
                onChange={handleChangeFunc}
              />
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            name="email"
            value={data.email || ''}
            onChange={handleChangeFunc}
          />
        </Form.Group>

        <Row>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>CEP</Form.Label>
              <Form.Control
                type="text"
                name="cep"
                value={data.cep || ''}
                onChange={handleChangeFunc}
              />
            </Form.Group>
          </Col>
          <Col md={8}>
            <Form.Group className="mb-3">
              <Form.Label>Logradouro</Form.Label>
              <Form.Control
                type="text"
                name="logradouro"
                value={data.logradouro || ''}
                onChange={handleChangeFunc}
              />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Número</Form.Label>
              <Form.Control
                type="text"
                name="numero"
                value={data.numero || ''}
                onChange={handleChangeFunc}
              />
            </Form.Group>
          </Col>
          <Col md={8}>
            <Form.Group className="mb-3">
              <Form.Label>Complemento</Form.Label>
              <Form.Control
                type="text"
                name="complemento"
                value={data.complemento || ''}
                onChange={handleChangeFunc}
              />
            </Form.Group>
          </Col>
        </Row>
      </>
    );
  };

  // Definir as colunas da tabela
  const columns = [
    { header: 'ID', accessor: 'id' },
    { header: 'Código', accessor: 'codigo' },
    { header: 'Nome Fantasia', accessor: 'nome_fantasia' },
    { header: 'CNPJ', accessor: 'cnpj' },
    { 
      header: 'Telefone', 
      accessor: 'telefone',
      cell: (row: Filial) => row.telefone || '-'
    },
    { 
      header: 'Ações', 
      accessor: 'actions',
      cell: (row: Filial) => {
        const actionButtons = [
          {
            label: 'Editar',
            icon: 'pencil',
            variant: 'info',
            onClick: () => handleOpenEditModal(row.id!)
          },
          {
            label: 'Excluir',
            icon: 'trash',
            variant: 'danger',
            onClick: () => handleDeleteFilial(row.id!)
          }
        ];

        return <ActionButtons buttons={actionButtons} showLabels={true} />;
      }
    }
  ];

  // Componente de carregamento
  const loadingComponent = (
    <div className="text-center py-4">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Carregando...</span>
      </div>
      <p className="mt-2">Carregando filiais...</p>
    </div>
  );

  // Componente para quando não há dados
  const emptyComponent = (
    <div className="text-center py-4">
      <i className="bi bi-exclamation-circle text-muted" style={{ fontSize: '2rem' }}></i>
      <p className="mt-2">Nenhuma filial encontrada</p>
    </div>
  );

  return (
    <div className="containerview">
      <PageHeader 
        title="Filiais" 
        buttonText="Nova Filial" 
        buttonIcon="building-add" 
        onButtonClick={handleOpenModal} 
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Lista de Filiais</h5>
        </Card.Header>
        <Card.Body className="p-0 p-md-3">
          <ResponsiveTable 
            columns={columns}
            data={filiais}
            isLoading={loading}
            loadingComponent={loadingComponent}
            emptyComponent={emptyComponent}
          />
        </Card.Body>
      </Card>

      {/* Modal para cadastrar nova filial */}
      <Modal 
        show={showModal} 
        onHide={handleCloseModal} 
        size="lg"
        centered
        className="modal-fullscreen-sm-down"
      >
        <Modal.Header closeButton>
          <Modal.Title>Cadastrar Nova Filial</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            {renderFilialForm(formData, handleChange)}

            <div className="d-flex justify-content-end mt-3">
              <Button variant="secondary" onClick={handleCloseModal} className="me-2">
                <i className="bi bi-x-circle me-1"></i> Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                <i className="bi bi-check-circle me-1"></i> {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal para editar filial */}
      <Modal 
        show={showEditModal} 
        onHide={handleCloseEditModal} 
        size="lg"
        centered
        className="modal-fullscreen-sm-down"
      >
        <Modal.Header closeButton>
          <Modal.Title>Editar Filial</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmitEdit}>
            {renderFilialForm(editFormData, handleEditChange)}

            <div className="d-flex justify-content-end mt-3">
              <Button variant="secondary" onClick={handleCloseEditModal} className="me-2">
                <i className="bi bi-x-circle me-1"></i> Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                <i className="bi bi-check-circle me-1"></i> {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Filiais; 