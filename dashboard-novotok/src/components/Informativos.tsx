import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, Form, Button, Alert, Table, Modal, Badge, Spinner, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import { API_URL } from '../config';

interface Imagem {
  id?: string | number;
  imagem: string;
  tipo_imagem: string;
  descricao: string;
  ordem?: number;
  file?: File;
}

interface Informativo {
  id?: string | number;
  titulo: string;
  texto: string;
  data?: string;
  ativo?: number;
  created_at?: string;
  updated_at?: string;
  imagens: Imagem[];
}

const Informativos: React.FC = () => {
  const [informativos, setInformativos] = useState<Informativo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [currentInformativo, setCurrentInformativo] = useState<Informativo>({
    titulo: '',
    texto: '',
    imagens: []
  });
  const [validated, setValidated] = useState<boolean>(false);
  const [imagens, setImagens] = useState<Imagem[]>([]);
  const [novaImagem, setNovaImagem] = useState<Imagem>({ imagem: '', tipo_imagem: '', descricao: '' });
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [informativoToDelete, setInformativoToDelete] = useState<number | string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Token de autenticação
  const token = localStorage.getItem('token');

  useEffect(() => {
    carregarInformativos();
  }, []);

  const carregarInformativos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_URL}/informativos/listar_informativos.php`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setInformativos(response.data.informativos);
      } else {
        setError(response.data.message || 'Erro ao carregar informativos');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor. Verifique sua conexão.');
      console.error('Erro ao buscar informativos:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentInformativo({
      titulo: '',
      texto: '',
      imagens: []
    });
    setImagens([]);
    setEditMode(false);
    setValidated(false);
  };

  const handleShowAddModal = () => {
    resetForm();
    setEditMode(false);
    setShowModal(true);
  };

  const handleShowEditModal = (informativo: Informativo) => {
    setCurrentInformativo(informativo);
    setImagens(informativo.imagens || []);
    setEditMode(true);
    setValidated(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setCurrentInformativo(prev => ({
        ...prev,
        [name]: checked ? 1 : 0
      }));
    } else {
      setCurrentInformativo(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    const file = e.target.files[0];
    
    // Verificar se é uma imagem
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.');
      return;
    }
    
    try {
      // Converter para base64
      const base64 = await convertFileToBase64(file);
      
      setNovaImagem({
        imagem: base64,
        tipo_imagem: file.type,
        descricao: novaImagem.descricao,
        file: file
      });
      
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      alert('Erro ao processar a imagem. Por favor, tente novamente.');
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleAddImagem = () => {
    if (novaImagem.imagem) {
      const novaListaImagens = [...imagens, { ...novaImagem, ordem: imagens.length }];
      setImagens(novaListaImagens);
      setNovaImagem({ imagem: '', tipo_imagem: '', descricao: '' });
      
      // Limpar o input de arquivo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImagem = (index: number) => {
    const novaListaImagens = imagens.filter((_, i) => i !== index);
    setImagens(novaListaImagens);
  };

  const handleDescricaoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setNovaImagem(prev => ({
      ...prev,
      descricao: value
    }));
  };

  const handleShowDeleteModal = (id: string | number) => {
    setInformativoToDelete(id);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setInformativoToDelete(null);
  };

  const handleDeleteInformativo = async () => {
    if (!informativoToDelete) return;

    try {
      setLoading(true);
      const response = await axios.delete(
        `${API_URL}/informativos/deletar_informativo.php?id=${informativoToDelete}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setSuccess('Informativo excluído com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
        carregarInformativos();
        handleCloseDeleteModal();
      } else {
        setError(response.data.message || 'Erro ao deletar informativo');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor. Verifique sua conexão.');
      console.error('Erro ao deletar informativo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const form = e.currentTarget;
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    
    setValidated(true);
    setLoading(true);
    
    const informativoData = {
      ...currentInformativo,
      imagens: imagens
    };
    
    try {
      let response;
      
      if (editMode && currentInformativo.id) {
        // Atualizar informativo existente
        response = await axios.put(
          `${API_URL}/informativos/atualizar_informativo.php`,
          informativoData,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
      } else {
        // Cadastrar novo informativo
        response = await axios.post(
          `${API_URL}/informativos/cadastrar_informativo.php`,
          informativoData,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
      }
      
      if (response.data.success) {
        setSuccess(editMode ? 'Informativo modificado com sucesso!' : 'Novo informativo cadastrado com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
        setShowModal(false);
        resetForm();
        carregarInformativos();
      } else {
        setError(response.data.message || 'Erro ao salvar informativo');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor. Verifique sua conexão.');
      console.error('Erro ao salvar informativo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (informativo: Informativo) => {
    try {
      setLoading(true);
      const novoStatus = informativo.ativo === 1 ? 0 : 1;
      
      const response = await axios.put(
        `${API_URL}/informativos/atualizar_informativo.php`,
        {
          ...informativo,
          ativo: novoStatus
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data.success) {
        setSuccess('Status do informativo alterado com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
        carregarInformativos();
      } else {
        setError(response.data.message || `Erro ao ${novoStatus ? 'ativar' : 'desativar'} informativo`);
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor. Verifique sua conexão.');
      console.error('Erro ao alterar status do informativo:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (dataString?: string) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    return data.toLocaleDateString();
  };

  // Filtrar informativos
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  
  const informativosFiltrados = informativos.filter(informativo => {
    if (filtroStatus === 'todos') return true;
    if (filtroStatus === 'ativos') return informativo.ativo === 1;
    if (filtroStatus === 'inativos') return informativo.ativo === 0;
    return true;
  });

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Gerenciamento de Informativos</h2>
        <Button 
          variant="primary" 
          onClick={handleShowAddModal}
        >
          Novo Informativo
        </Button>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      
      <Card>
        <Card.Body>
          <Card.Title>Informativos Disponíveis</Card.Title>
          
          <div className="mb-3">
            <Form.Group as={Row} className="align-items-center">
              <Form.Label column sm={2} className="mb-0">
                Filtrar por status:
              </Form.Label>
              <Col sm={4}>
                <Form.Select 
                  value={filtroStatus} 
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  size="sm"
                >
                  <option value="todos">Todos</option>
                  <option value="ativos">Ativos</option>
                  <option value="inativos">Inativos</option>
                </Form.Select>
              </Col>
            </Form.Group>
          </div>
          
          {loading && <p>Carregando...</p>}
          
          {!loading && informativosFiltrados.length === 0 && (
            <p>Nenhum informativo {filtroStatus !== 'todos' ? `${filtroStatus}` : ''} cadastrado.</p>
          )}
          
          {!loading && informativosFiltrados.length > 0 && (
            <Table responsive striped bordered hover>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Título</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Imagens</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {informativosFiltrados.map((informativo) => (
                  <tr key={informativo.id}>
                    <td>{informativo.id}</td>
                    <td>{informativo.titulo}</td>
                    <td>{formatarData(informativo.data)}</td>
                    <td>
                      <Button
                        variant={informativo.ativo === 1 ? 'success' : 'secondary'}
                        size="sm"
                        onClick={() => handleToggleStatus(informativo)}
                      >
                        {informativo.ativo === 1 ? 'Ativo' : 'Inativo'}
                      </Button>
                    </td>
                    <td>{informativo.imagens?.length || 0} imagens</td>
                    <td>
                      <Button 
                        variant="info" 
                        size="sm" 
                        className="me-2"
                        onClick={() => handleShowEditModal(informativo)}
                      >
                        Editar
                      </Button>
                      <Button 
                        variant="danger" 
                        size="sm"
                        onClick={() => handleShowDeleteModal(informativo.id as string | number)}
                      >
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Modal para adicionar/editar informativo */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editMode ? 'Editar Informativo' : 'Novo Informativo'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form noValidate validated={validated} onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Título</Form.Label>
              <Form.Control
                type="text"
                name="titulo"
                value={currentInformativo.titulo}
                onChange={handleInputChange}
                required
              />
              <Form.Control.Feedback type="invalid">
                O título é obrigatório
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Texto</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                name="texto"
                value={currentInformativo.texto}
                onChange={handleInputChange}
                required
              />
              <Form.Control.Feedback type="invalid">
                O texto é obrigatório
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Informativo Ativo"
                name="ativo"
                checked={currentInformativo.ativo === 1}
                onChange={(e) => setCurrentInformativo(prev => ({
                  ...prev,
                  ativo: e.target.checked ? 1 : 0
                }))}
              />
            </Form.Group>

            <hr />
            <h6>Imagens</h6>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Selecionar Imagem</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>Descrição</Form.Label>
                  <Form.Control
                    type="text"
                    name="descricao"
                    value={novaImagem.descricao}
                    onChange={handleDescricaoChange}
                  />
                </Form.Group>
              </Col>
            </Row>

            {novaImagem.imagem && (
              <div className="mb-3">
                <p>Pré-visualização:</p>
                <img 
                  src={novaImagem.imagem} 
                  alt="Pré-visualização" 
                  style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                />
              </div>
            )}

            <Button 
              variant="outline-secondary" 
              size="sm" 
              onClick={handleAddImagem}
              className="mb-3"
              disabled={!novaImagem.imagem}
            >
              Adicionar Imagem
            </Button>

            {imagens.length > 0 && (
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Imagem</th>
                    <th>Descrição</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {imagens.map((imagem, index) => (
                    <tr key={index}>
                      <td>
                        <img 
                          src={imagem.imagem} 
                          alt={imagem.descricao} 
                          style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                        />
                      </td>
                      <td>{imagem.descricao}</td>
                      <td>
                        <Button 
                          variant="danger" 
                          size="sm"
                          onClick={() => handleRemoveImagem(index)}
                        >
                          Excluir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            
            <div className="d-flex justify-content-end">
              <Button variant="secondary" onClick={handleCloseModal} className="me-2">
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal de confirmação para excluir */}
      <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar exclusão</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Tem certeza que deseja excluir este informativo? Esta ação não pode ser desfeita.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDeleteModal}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDeleteInformativo}>
            Excluir
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Informativos; 