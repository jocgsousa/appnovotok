import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Row, Col, Alert, Modal } from 'react-bootstrap';
import { 
  listarVendedores, 
  cadastrarVendedor, 
  atualizarVendedor,
  obterVendedor,
  atualizarStatusVendedor, 
  deletarVendedor as excluirVendedor
} from '../services/funcionariosService';
import { listarFiliais, Filial as FilialType } from '../services/filialService';
import PageHeader from './PageHeader';
import ActionButtons from './ActionButtons';
import ResponsiveTable from './ResponsiveTable';

interface Funcionario {
  id: number;
  rca: string;
  nome: string;
  email: string;
  filial?: {
    id: number;
    nome: string;
    codigo: string;
  };
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

const Funcionarios: React.FC = () => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [filiais, setFiliais] = useState<FilialType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estado para o modal de novo funcionário
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    rca: '',
    nome: '',
    email: '',
    senha: '',
    filial: '1',
    ativo: true
  });

  // Estado para o modal de edição de funcionário
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: 0,
    rca: '',
    nome: '',
    email: '',
    senha: '',
    filial: '1',
    ativo: true
  });
  
  const [submitting, setSubmitting] = useState(false);
  
  // Carregar lista de funcionários e filiais
  useEffect(() => {
    loadFuncionarios();
    loadFiliais();
  }, []);

  const loadFuncionarios = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await listarVendedores();
      setFuncionarios(data);
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
      setError('Não foi possível carregar a lista de funcionários');
    } finally {
      setLoading(false);
    }
  };

  const loadFiliais = async () => {
    try {
      const data = await listarFiliais();
      setFiliais(data);
    } catch (err) {
      console.error('Erro ao carregar filiais:', err);
      setError('Não foi possível carregar a lista de filiais');
    }
  };

  // Atualizar campo do formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Atualizar campo do formulário de edição
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setEditFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setEditFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Abrir modal para cadastrar novo funcionário
  const openModal = () => {
    setFormData({
      rca: '',
      nome: '',
      email: '',
      senha: '',
      filial: '1',
      ativo: true
    });
    setShowModal(true);
  };

  // Abrir modal para editar funcionário
  const openEditModal = async (id: number) => {
    try {
      setError(null);
      const response = await obterVendedor(id);
      console.log('Resposta da API obterVendedor:', response);
      
      if (!response.success || !response.vendedor) {
        throw new Error('Dados do funcionário não encontrados');
      }
      
      const funcionario = response.vendedor;
      
      const defaultFilialId = filiais.length > 0 && filiais[0]?.id ? filiais[0].id.toString() : '1';
      setEditFormData({
        id: funcionario.id,
        rca: funcionario.rca,
        nome: funcionario.nome,
        email: funcionario.email || '',
        senha: '',
        filial: funcionario.filial ? funcionario.filial.id.toString() : defaultFilialId,
        ativo: funcionario.ativo
      });
      
      setShowEditModal(true);
    } catch (err) {
      console.error('Erro ao carregar dados do funcionário:', err);
      setError('Não foi possível carregar os dados do funcionário para edição');
    }
  };

  // Fechar modal
  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Abrir modal para editar vendedor
  const handleOpenEditModal = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await obterVendedor(id);
      console.log('Resposta da API obterVendedor:', response);
      
      if (!response.success || !response.vendedor) {
        throw new Error('Dados do vendedor não encontrados');
      }
      
      const vendedor = response.vendedor;
      const defaultFilialId = filiais.length > 0 && filiais[0].id ? filiais[0].id.toString() : '1';
      
      setEditFormData({
        id: vendedor.id,
        rca: vendedor.rca,
        nome: vendedor.nome,
        email: vendedor.email || '',
        senha: '', // Senha vazia para não alterar
        filial: vendedor.filial ? vendedor.filial.id.toString() : defaultFilialId,
        ativo: vendedor.ativo
      });
      
      setShowEditModal(true);
    } catch (err) {
      console.error('Erro ao carregar dados do vendedor:', err);
      setError('Não foi possível carregar os dados do vendedor para edição');
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
    
    if (!formData.nome || !formData.rca || !formData.senha) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const response = await cadastrarVendedor({
        ...formData,
        filial_id: parseInt(formData.filial)
      });

      if (response.success) {
        setSuccess('Funcionário cadastrado com sucesso!');
        // Atualizar a lista de funcionários
        await loadFuncionarios();
        setShowModal(false);
      } else {
        setError(response.message || 'Erro ao cadastrar funcionário');
      }
    } catch (err) {
      console.error('Erro ao cadastrar funcionário:', err);
      setError('Não foi possível cadastrar o funcionário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Permitir atualização sem email; exigir apenas Nome e RCA
    if (!editFormData.nome || !editFormData.rca) {
      setError('Por favor, preencha os campos obrigatórios: Nome e RCA');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      // Montar payload sem enviar email vazio (não atualiza email se em branco)
      const payload: any = {
        id: editFormData.id,
        rca: editFormData.rca,
        nome: editFormData.nome,
        filial_id: parseInt(editFormData.filial),
        ativo: editFormData.ativo,
      };

      if (editFormData.email && editFormData.email.trim() !== '') {
        payload.email = editFormData.email.trim();
      }

      if (editFormData.senha && editFormData.senha.trim() !== '') {
        payload.senha = editFormData.senha;
      }

      const response = await atualizarVendedor(payload);

      if (response.success) {
        setSuccess('Funcionário atualizado com sucesso!');
        setShowEditModal(false);
        // Atualiza a lista de funcionários imediatamente após editar
        await loadFuncionarios();
      } else {
        setError(response.message || 'Erro ao atualizar funcionário');
      }
    } catch (err) {
      console.error('Erro ao atualizar funcionário:', err);
      setError('Não foi possível atualizar o funcionário');
    } finally {
      setSubmitting(false);
    }
  };

  // Alternar status do funcionário (ativo/inativo)
  const toggleStatus = async (id: number, ativo: boolean) => {
    try {
      setError(null);
      
      const response = await atualizarStatusVendedor(id, !ativo);
      
      if (response.success) {
        setSuccess(`Funcionário ${!ativo ? 'ativado' : 'desativado'} com sucesso!`);
        // Atualiza a lista de funcionários imediatamente após alterar o status
        await loadFuncionarios();
      } else {
        setError(response.message || 'Erro ao atualizar status do funcionário');
      }
    } catch (err) {
      console.error('Erro ao atualizar status do funcionário:', err);
      setError('Não foi possível atualizar o status do funcionário');
    }
  };

  // Deletar funcionário
  const deletarFuncionario = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este funcionário?')) {
      try {
        setError(null);
        
        const response = await excluirVendedor(id);
        
        if (response.success) {
          setSuccess('Funcionário excluído com sucesso!');
          // Atualiza a lista de funcionários imediatamente após excluir
          await loadFuncionarios();
        } else {
          setError(response.message || 'Erro ao excluir funcionário');
        }
      } catch (err) {
        console.error('Erro ao excluir funcionário:', err);
        setError('Não foi possível excluir o funcionário');
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

  // Definir as colunas da tabela
  const columns = [
    { header: 'ID', accessor: 'id' },
    { header: 'RCA', accessor: 'rca' },
    { header: 'Nome', accessor: 'nome' },
    { 
      header: 'Email', 
      accessor: 'email',
      cell: (row: Funcionario) => row.email || '-'
    },
    { 
      header: 'Filial', 
      accessor: 'filial',
      cell: (row: Funcionario) => row.filial ? row.filial.nome : '-'
    },
    { 
      header: 'Status', 
      accessor: 'ativo',
      cell: (row: Funcionario) => (
        <span className={`badge ${row.ativo ? 'bg-success' : 'bg-danger'}`}>
          {row.ativo ? 'Ativo' : 'Inativo'}
        </span>
      )
    },
    { 
      header: 'Ações', 
      accessor: 'actions',
      cell: (row: Funcionario) => {
        const actionButtons = [
          {
            label: 'Editar',
            icon: 'pencil',
            variant: 'info',
            onClick: () => handleOpenEditModal(row.id)
          },
          {
            label: row.ativo ? 'Desativar' : 'Ativar',
            icon: row.ativo ? 'x-circle' : 'check-circle',
            variant: row.ativo ? 'warning' : 'success',
            onClick: () => toggleStatus(row.id, row.ativo)
          },
          {
            label: 'Excluir',
            icon: 'trash',
            variant: 'danger',
            onClick: () => deletarFuncionario(row.id)
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
      <p className="mt-2">Carregando vendedores...</p>
    </div>
  );

  // Componente para quando não há dados
  const emptyComponent = (
    <div className="text-center py-4">
      <i className="bi bi-exclamation-circle text-muted" style={{ fontSize: '2rem' }}></i>
      <p className="mt-2">Nenhum vendedor encontrado</p>
    </div>
  );

  return (
    <div className="containerview">
      <PageHeader 
        title="Funcionários" 
        buttonText="Novo Funcionário" 
        onButtonClick={openModal}
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {success && (
        <Alert variant="success" className="alert-success" style={{ backgroundColor: '#d4edda', color: '#155724', borderColor: '#c3e6cb' }}>
          {success}
        </Alert>
      )}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Lista de Vendedores</h5>
        </Card.Header>
        <Card.Body className="p-0 p-md-3">
          <ResponsiveTable 
            columns={columns}
            data={funcionarios}
            isLoading={loading}
            loadingComponent={loadingComponent}
            emptyComponent={emptyComponent}
          />
          
          {funcionarios.length > 0 && (
            <div className="text-muted mt-3">
              <small>Total de vendedores: {funcionarios.length}</small>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal para cadastrar novo vendedor */}
      <Modal 
        show={showModal} 
        onHide={handleCloseModal}
        centered
        className="modal-fullscreen-sm-down"
      >
        <Modal.Header closeButton>
          <Modal.Title>Cadastrar Novo Vendedor</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>RCA *</Form.Label>
                  <Form.Control
                    type="text"
                    name="rca"
                    value={formData.rca}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome *</Form.Label>
                  <Form.Control
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Senha *</Form.Label>
              <Form.Control
                type="password"
                name="senha"
                value={formData.senha}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Filial</Form.Label>
                  <Form.Select
                    name="filial"
                    value={formData.filial}
                    onChange={handleChange}
                  >
                    {filiais.length > 0 ? (
                      filiais.map(filial => (
                        <option key={filial.id} value={filial.id}>
                          {filial.nome_fantasia} ({filial.codigo})
                        </option>
                      ))
                    ) : (
                      <option value="0">Carregando filiais...</option>
                    )}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Check
                    type="checkbox"
                    name="ativo"
                    label="Ativo"
                    checked={formData.ativo}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex justify-content-end mt-3">
              <Button variant="secondary" onClick={handleCloseModal} className="me-2">
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal para editar vendedor */}
      <Modal 
        show={showEditModal} 
        onHide={handleCloseEditModal}
        centered
        className="modal-fullscreen-sm-down"
      >
        <Modal.Header closeButton>
          <Modal.Title>Editar Vendedor</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleEditSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>RCA *</Form.Label>
                  <Form.Control
                    type="text"
                    name="rca"
                    value={editFormData.rca}
                    onChange={handleEditChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome *</Form.Label>
                  <Form.Control
                    type="text"
                    name="nome"
                    value={editFormData.nome}
                    onChange={handleEditChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={editFormData.email}
                onChange={handleEditChange}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Senha (deixe em branco para manter a atual)</Form.Label>
              <Form.Control
                type="password"
                name="senha"
                value={editFormData.senha}
                onChange={handleEditChange}
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Filial</Form.Label>
                  <Form.Select
                    name="filial"
                    value={editFormData.filial}
                    onChange={handleEditChange}
                  >
                    {filiais.length > 0 ? (
                      filiais.map(filial => (
                        <option key={filial.id} value={filial.id}>
                          {filial.nome_fantasia} ({filial.codigo})
                        </option>
                      ))
                    ) : (
                      <option value="0">Carregando filiais...</option>
                    )}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Check
                    type="checkbox"
                    name="ativo"
                    label="Ativo"
                    checked={editFormData.ativo}
                    onChange={handleEditChange}
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex justify-content-end mt-3">
              <Button variant="secondary" onClick={handleCloseEditModal} className="me-2">
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Funcionarios;