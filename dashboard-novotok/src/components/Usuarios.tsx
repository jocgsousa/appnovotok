import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Modal, Form, Badge, Tabs, Tab, Alert } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  telefone: string | null;
  tipo_usuario: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface MenuPermissao {
  menu_id: number;
  menu_nome: string;
  menu_descricao: string;
  menu_icone: string;
  menu_rota: string;
  menu_ordem: number;
  visualizar: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
}

interface UsuarioDetalhado extends Usuario {
  permissoes: MenuPermissao[];
}

interface FormData {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  senha: string;
  confirmarSenha: string;
  tipo_usuario: string;
  ativo: boolean;
}

const Usuarios: React.FC = () => {
  const { hasPermission } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UsuarioDetalhado | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTipo, setModalTipo] = useState<'cadastrar' | 'editar'>('cadastrar');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    senha: '',
    confirmarSenha: '',
    tipo_usuario: 'operador',
    ativo: true
  });
  const [permissoes, setPermissoes] = useState<{[key: number]: {visualizar: boolean, criar: boolean, editar: boolean, excluir: boolean}}>({});
  const [menus, setMenus] = useState<{id: number, nome: string, descricao: string, icone: string, rota: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Carregar a lista de usuários
  useEffect(() => {
    carregarUsuarios();
  }, [currentPage]);

  // Carregar menus disponíveis
  useEffect(() => {
    carregarMenus();
  }, []);

  const carregarMenus = async () => {
    try {
      const response = await api.get('/verificar_permissoes.php');
      if (response.data && response.data.success) {
        // Extrair apenas os dados necessários dos menus
        const menusData = response.data.menus.map((menu: any) => ({
          id: menu.id,
          nome: menu.nome,
          descricao: menu.descricao,
          icone: menu.icone,
          rota: menu.rota
        }));
        setMenus(menusData);
      }
    } catch (error) {
      console.error('Erro ao carregar menus:', error);
      setError('Erro ao carregar menus. Tente novamente mais tarde.');
    }
  };

  const carregarUsuarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('per_page', '10');
      
      if (searchTerm) {
        params.append('nome', searchTerm);
      }

      const response = await api.get(`/listar_usuarios.php?${params.toString()}`);
      
      if (response.data && response.data.success) {
        setUsuarios(response.data.usuarios);
        setTotalPages(response.data.total_pages);
      } else {
        setError('Erro ao carregar usuários');
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setError('Erro ao carregar usuários. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  const carregarUsuarioDetalhado = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/obter_usuario.php?id=${id}`);
      
      if (response.data && response.data.success) {
        setUsuarioSelecionado(response.data.usuario);
        
        // Inicializar permissões
        const perms: {[key: number]: {visualizar: boolean, criar: boolean, editar: boolean, excluir: boolean}} = {};
        response.data.usuario.permissoes.forEach((perm: MenuPermissao) => {
          perms[perm.menu_id] = {
            visualizar: perm.visualizar,
            criar: perm.criar,
            editar: perm.editar,
            excluir: perm.excluir
          };
        });
        setPermissoes(perms);
        
        setFormData({
          nome: response.data.usuario.nome,
          email: response.data.usuario.email,
          cpf: response.data.usuario.cpf,
          telefone: response.data.usuario.telefone || '',
          senha: '',
          confirmarSenha: '',
          tipo_usuario: response.data.usuario.tipo_usuario,
          ativo: response.data.usuario.ativo
        });
      } else {
        setError('Erro ao carregar detalhes do usuário');
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes do usuário:', error);
      setError('Erro ao carregar detalhes do usuário. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (tipo: 'cadastrar' | 'editar', id?: number) => {
    setModalTipo(tipo);
    setError(null);
    
    if (tipo === 'cadastrar') {
      setUsuarioSelecionado(null);
      setFormData({
        nome: '',
        email: '',
        cpf: '',
        telefone: '',
        senha: '',
        confirmarSenha: '',
        tipo_usuario: 'operador',
        ativo: true
      });
      
      // Inicializar todas as permissões como false
      const perms: {[key: number]: {visualizar: boolean, criar: boolean, editar: boolean, excluir: boolean}} = {};
      menus.forEach(menu => {
        perms[menu.id] = {
          visualizar: false,
          criar: false,
          editar: false,
          excluir: false
        };
      });
      setPermissoes(perms);
    } else if (id) {
      carregarUsuarioDetalhado(id);
    }
    
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setUsuarioSelecionado(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePermissaoChange = (menuId: number, tipo: 'visualizar' | 'criar' | 'editar' | 'excluir', checked: boolean) => {
    setPermissoes(prev => ({
      ...prev,
      [menuId]: {
        ...prev[menuId],
        [tipo]: checked
      }
    }));
    
    // Se desmarcar "visualizar", desmarcar também as outras permissões
    if (tipo === 'visualizar' && !checked) {
      setPermissoes(prev => ({
        ...prev,
        [menuId]: {
          ...prev[menuId],
          visualizar: false,
          criar: false,
          editar: false,
          excluir: false
        }
      }));
    }
    
    // Se marcar qualquer outra permissão, marcar também "visualizar"
    if (tipo !== 'visualizar' && checked) {
      setPermissoes(prev => ({
        ...prev,
        [menuId]: {
          ...prev[menuId],
          visualizar: true,
          [tipo]: checked
        }
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Validar formulário
    if (!formData.nome || !formData.email || !formData.cpf) {
      setError('Nome, email e CPF são obrigatórios.');
      return;
    }
    
    if (modalTipo === 'cadastrar' && (!formData.senha || formData.senha.length < 6)) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    
    if (modalTipo === 'cadastrar' && formData.senha !== formData.confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }
    
    try {
      setLoading(true);
      
      // Preparar dados das permissões
      const permissoesArray = Object.entries(permissoes).map(([menuId, perm]) => ({
        menu_id: parseInt(menuId),
        visualizar: perm.visualizar,
        criar: perm.criar,
        editar: perm.editar,
        excluir: perm.excluir
      }));
      
      if (modalTipo === 'cadastrar') {
        // Cadastrar novo usuário
        const response = await api.post('/cadastrar_usuario.php', {
          ...formData,
          permissoes: permissoesArray
        });
        
        if (response.data && response.data.success) {
          setSuccess('Usuário cadastrado com sucesso!');
          handleCloseModal();
          carregarUsuarios();
        } else {
          setError(response.data.message || 'Erro ao cadastrar usuário.');
        }
      } else {
        // Atualizar usuário existente
        if (!usuarioSelecionado) return;
        
        const response = await api.put('/atualizar_usuario.php', {
          id: usuarioSelecionado.id,
          ...formData,
          permissoes: permissoesArray
        });
        
        if (response.data && response.data.success) {
          setSuccess('Usuário atualizado com sucesso!');
          handleCloseModal();
          carregarUsuarios();
        } else {
          setError(response.data.message || 'Erro ao atualizar usuário.');
        }
      }
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      setError(error.response?.data?.message || 'Erro ao salvar usuário. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!usuarioSelecionado) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.delete('/deletar_usuario.php', {
        data: { id: usuarioSelecionado.id }
      });
      
      if (response.data && response.data.success) {
        setSuccess('Usuário excluído com sucesso!');
        setShowDeleteModal(false);
        carregarUsuarios();
      } else {
        setError(response.data.message || 'Erro ao excluir usuário.');
      }
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      setError(error.response?.data?.message || 'Erro ao excluir usuário. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    carregarUsuarios();
  };

  return (
    <Container fluid>
      <h1 className="mt-3 mb-4">Gestão de Usuários</h1>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      
      <Card className="mb-4">
        <Card.Header>
          <Row className="align-items-center">
            <Col>
              <h5 className="mb-0">Usuários</h5>
            </Col>
            <Col xs="auto">
              {hasPermission('/usuarios', 'criar') && (
                <Button variant="primary" onClick={() => handleOpenModal('cadastrar')}>
                  <i className="bi bi-plus-circle me-2"></i>Novo Usuário
                </Button>
              )}
            </Col>
          </Row>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSearch} className="mb-3">
            <Row>
              <Col md={10}>
                <Form.Control
                  type="text"
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Col>
              <Col md={2}>
                <Button type="submit" variant="secondary" className="w-100">
                  <i className="bi bi-search me-2"></i>Buscar
                </Button>
              </Col>
            </Row>
          </Form>
          
          {loading ? (
            <div className="text-center my-5">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Carregando...</span>
              </div>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Tipo</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.length > 0 ? (
                      usuarios.map(usuario => (
                        <tr key={usuario.id}>
                          <td>{usuario.id}</td>
                          <td>{usuario.nome}</td>
                          <td>{usuario.email}</td>
                          <td>
                            <Badge bg={
                              usuario.tipo_usuario === 'admin' ? 'danger' : 
                              usuario.tipo_usuario === 'gestor' ? 'warning' : 'info'
                            }>
                              {usuario.tipo_usuario}
                            </Badge>
                          </td>
                          <td>
                            <Badge bg={usuario.ativo ? 'success' : 'secondary'}>
                              {usuario.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </td>
                          <td>
                            {hasPermission('/usuarios', 'visualizar') && (
                              <Button 
                                variant="info" 
                                size="sm" 
                                className="me-2"
                                onClick={() => handleOpenModal('editar', usuario.id)}
                              >
                                <i className="bi bi-eye"></i>
                              </Button>
                            )}
                            
                            {hasPermission('/usuarios', 'editar') && (
                              <Button 
                                variant="warning" 
                                size="sm" 
                                className="me-2"
                                onClick={() => handleOpenModal('editar', usuario.id)}
                              >
                                <i className="bi bi-pencil"></i>
                              </Button>
                            )}
                            
                            {hasPermission('/usuarios', 'excluir') && usuario.id !== 1 && (
                              <Button 
                                variant="danger" 
                                size="sm"
                                onClick={() => {
                                  setUsuarioSelecionado({...usuario, permissoes: []});
                                  setShowDeleteModal(true);
                                }}
                              >
                                <i className="bi bi-trash"></i>
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center">Nenhum usuário encontrado</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
              
              {totalPages > 1 && (
                <div className="d-flex justify-content-center mt-3">
                  <Button 
                    variant="outline-secondary" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="me-2"
                  >
                    <i className="bi bi-chevron-left"></i>
                  </Button>
                  
                  <span className="align-self-center mx-3">
                    Página {currentPage} de {totalPages}
                  </span>
                  
                  <Button 
                    variant="outline-secondary" 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  >
                    <i className="bi bi-chevron-right"></i>
                  </Button>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>
      
      {/* Modal para cadastrar/editar usuário */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {modalTipo === 'cadastrar' ? 'Cadastrar Novo Usuário' : 'Editar Usuário'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <div className="text-center my-5">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Carregando...</span>
              </div>
            </div>
          ) : (
            <Form onSubmit={handleSubmit}>
              <Tabs defaultActiveKey="dados" id="usuario-tabs" className="mb-3">
                <Tab eventKey="dados" title="Dados do Usuário">
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nome</Form.Label>
                        <Form.Control 
                          type="text" 
                          name="nome" 
                          value={formData.nome}
                          onChange={handleInputChange}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control 
                          type="email" 
                          name="email" 
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>CPF</Form.Label>
                        <Form.Control 
                          type="text" 
                          name="cpf" 
                          value={formData.cpf}
                          onChange={handleInputChange}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Telefone</Form.Label>
                        <Form.Control 
                          type="text" 
                          name="telefone" 
                          value={formData.telefone}
                          onChange={handleInputChange}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Tipo de Usuário</Form.Label>
                        <Form.Select 
                          name="tipo_usuario" 
                          value={formData.tipo_usuario}
                          onChange={handleInputChange}
                          required
                        >
                          <option value="admin">Administrador</option>
                          <option value="gestor">Gestor</option>
                          <option value="operador">Operador</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Status</Form.Label>
                        <Form.Check 
                          type="switch"
                          id="ativo-switch"
                          label="Ativo"
                          name="ativo"
                          checked={formData.ativo}
                          onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>{modalTipo === 'cadastrar' ? 'Senha' : 'Nova Senha (deixe em branco para manter)'}</Form.Label>
                        <Form.Control 
                          type="password" 
                          name="senha" 
                          value={formData.senha}
                          onChange={handleInputChange}
                          required={modalTipo === 'cadastrar'}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Confirmar Senha</Form.Label>
                        <Form.Control 
                          type="password" 
                          name="confirmarSenha" 
                          value={formData.confirmarSenha}
                          onChange={handleInputChange}
                          required={modalTipo === 'cadastrar' || formData.senha !== ''}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Tab>
                
                <Tab eventKey="permissoes" title="Permissões de Acesso">
                  <div className="table-responsive">
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th>Menu</th>
                          <th className="text-center">Visualizar</th>
                          <th className="text-center">Criar</th>
                          <th className="text-center">Editar</th>
                          <th className="text-center">Excluir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {menus.map(menu => (
                          <tr key={menu.id}>
                            <td>
                              <i className={`bi bi-${menu.icone} me-2`}></i>
                              {menu.nome}
                            </td>
                            <td className="text-center">
                              <Form.Check 
                                type="checkbox"
                                checked={permissoes[menu.id]?.visualizar || false}
                                onChange={(e) => handlePermissaoChange(menu.id, 'visualizar', e.target.checked)}
                              />
                            </td>
                            <td className="text-center">
                              <Form.Check 
                                type="checkbox"
                                checked={permissoes[menu.id]?.criar || false}
                                onChange={(e) => handlePermissaoChange(menu.id, 'criar', e.target.checked)}
                                disabled={!permissoes[menu.id]?.visualizar}
                              />
                            </td>
                            <td className="text-center">
                              <Form.Check 
                                type="checkbox"
                                checked={permissoes[menu.id]?.editar || false}
                                onChange={(e) => handlePermissaoChange(menu.id, 'editar', e.target.checked)}
                                disabled={!permissoes[menu.id]?.visualizar}
                              />
                            </td>
                            <td className="text-center">
                              <Form.Check 
                                type="checkbox"
                                checked={permissoes[menu.id]?.excluir || false}
                                onChange={(e) => handlePermissaoChange(menu.id, 'excluir', e.target.checked)}
                                disabled={!permissoes[menu.id]?.visualizar}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Tab>
              </Tabs>
              
              {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
              
              <div className="d-flex justify-content-end mt-3">
                <Button variant="secondary" onClick={handleCloseModal} className="me-2">
                  Cancelar
                </Button>
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>
            </Form>
          )}
        </Modal.Body>
      </Modal>
      
      {/* Modal de confirmação de exclusão */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar Exclusão</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {usuarioSelecionado && (
            <p>Tem certeza que deseja excluir o usuário <strong>{usuarioSelecionado.nome}</strong>?</p>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete} disabled={loading}>
            {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Usuarios; 