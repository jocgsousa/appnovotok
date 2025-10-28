import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, Form, Button, Alert, Table, Modal, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { API_URL } from '../config';

interface Atualizacao {
  id: number;
  versao: string;
  titulo: string;
  descricao: string;
  link_download: string;
  obrigatoria: boolean;
  ativa: boolean;
  data_lancamento: string;
}

const Atualizacoes: React.FC = () => {
  const [atualizacoes, setAtualizacoes] = useState<Atualizacao[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para o formulário de nova atualização
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<Atualizacao>>({
    versao: '',
    titulo: '',
    descricao: '',
    link_download: '',
    obrigatoria: false,
    ativa: true
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  useEffect(() => {
    carregarAtualizacoes();
  }, []);

  const carregarAtualizacoes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/listar_atualizacoes.php`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setAtualizacoes(response.data.atualizacoes);
      } else {
        setError('Erro ao carregar atualizações');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({
        ...formData,
        [name]: checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const resetForm = () => {
    setFormData({
      versao: '',
      titulo: '',
      descricao: '',
      link_download: '',
      obrigatoria: false,
      ativa: true
    });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setEditMode(false);
    setCurrentId(null);
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      setError('Nenhum arquivo selecionado para upload');
      return null;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      console.log('Iniciando upload do arquivo:', selectedFile.name, 'tamanho:', selectedFile.size);
      
      const uploadFormData = new FormData();
      uploadFormData.append('arquivo', selectedFile);
      uploadFormData.append('versao', formData.versao || '');
      
      const token = localStorage.getItem('token');
      
      const response = await axios.post(`${API_URL}/upload_atualizacao.php`, uploadFormData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          console.log(`Progresso de upload: ${percentCompleted}%`);
          setUploadProgress(percentCompleted);
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      console.log('Resposta do servidor:', response.data);
      
      if (response.data.success) {
        return response.data.download_url;
      } else {
        setError('Erro ao fazer upload do arquivo: ' + response.data.message);
        return null;
      }
    } catch (err) {
      console.error('Erro no upload:', err);
      setError('Erro ao enviar arquivo para o servidor');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Primeiro fazer o upload do arquivo se houver um selecionado
      let downloadUrl = formData.link_download;
      
      if (selectedFile) {
        const uploadedUrl = await handleUploadFile();
        if (!uploadedUrl) {
          setLoading(false);
          return; // Se o upload falhou, não continua
        }
        downloadUrl = uploadedUrl;
      } else if (!editMode || !downloadUrl) {
        setError('É necessário selecionar um arquivo APK para a atualização');
        setLoading(false);
        return;
      }
      
      const token = localStorage.getItem('token');
      let response;
      
      const dataToSend = {
        ...formData,
        link_download: downloadUrl
      };
      
      if (editMode && currentId) {
        response = await axios.post(
          `${API_URL}/atualizar_atualizacao.php`,
          { ...dataToSend, id: currentId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        response = await axios.post(
          `${API_URL}/cadastrar_atualizacao.php`,
          dataToSend,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      if (response.data.success) {
        setSuccess(editMode ? 'Atualização modificada com sucesso!' : 'Nova atualização cadastrada com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
        setShowModal(false);
        resetForm();
        carregarAtualizacoes();
      } else {
        setError(response.data.message || 'Erro ao processar solicitação');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (atualizacao: Atualizacao) => {
    setFormData({
      versao: atualizacao.versao,
      titulo: atualizacao.titulo,
      descricao: atualizacao.descricao,
      link_download: atualizacao.link_download,
      obrigatoria: atualizacao.obrigatoria,
      ativa: atualizacao.ativa
    });
    setEditMode(true);
    setCurrentId(atualizacao.id);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta atualização?')) {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await axios.post(
          `${API_URL}/deletar_atualizacao.php`,
          { id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          setSuccess('Atualização excluída com sucesso!');
          setTimeout(() => setSuccess(null), 3000);
          carregarAtualizacoes();
        } else {
          setError(response.data.message || 'Erro ao excluir atualização');
        }
      } catch (err) {
        setError('Erro ao conectar com o servidor');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleStatus = async (id: number, novoStatus: boolean) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/atualizar_status_atualizacao.php`,
        { id, ativa: novoStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setSuccess('Status da atualização alterado com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
        carregarAtualizacoes();
      } else {
        setError(response.data.message || 'Erro ao alterar status da atualização');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Gerenciamento de Atualizações</h2>
        <Button 
          variant="primary" 
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          Nova Atualização
        </Button>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      
      <Card>
        <Card.Body>
          <Card.Title>Atualizações Disponíveis</Card.Title>
          
          {loading && <p>Carregando...</p>}
          
          {!loading && atualizacoes.length === 0 && (
            <p>Nenhuma atualização cadastrada.</p>
          )}
          
          {!loading && atualizacoes.length > 0 && (
            <Table responsive striped bordered hover>
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Título</th>
                  <th>Obrigatória</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {atualizacoes.map(atualizacao => (
                  <tr key={atualizacao.id}>
                    <td>{atualizacao.versao}</td>
                    <td>{atualizacao.titulo}</td>
                    <td>{atualizacao.obrigatoria ? 'Sim' : 'Não'}</td>
                    <td>
                      <Button
                        variant={atualizacao.ativa ? 'success' : 'secondary'}
                        size="sm"
                        onClick={() => handleToggleStatus(atualizacao.id, !atualizacao.ativa)}
                      >
                        {atualizacao.ativa ? 'Ativa' : 'Inativa'}
                      </Button>
                    </td>
                    <td>{new Date(atualizacao.data_lancamento).toLocaleDateString()}</td>
                    <td>
                      <Button 
                        variant="info" 
                        size="sm" 
                        className="me-2"
                        onClick={() => handleEdit(atualizacao)}
                      >
                        Editar
                      </Button>
                      <Button 
                        variant="danger" 
                        size="sm"
                        onClick={() => handleDelete(atualizacao.id)}
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
      
      {/* Modal de Formulário */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editMode ? 'Editar Atualização' : 'Nova Atualização'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Versão</Form.Label>
              <Form.Control
                type="text"
                name="versao"
                value={formData.versao}
                onChange={handleChange}
                placeholder="Ex: 1.0.0"
                required
              />
              <Form.Text className="text-muted">
                Use o formato semântico (ex: 1.0.0)
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Título</Form.Label>
              <Form.Control
                type="text"
                name="titulo"
                value={formData.titulo}
                onChange={handleChange}
                placeholder="Título da atualização"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Descrição</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                placeholder="Descreva as novidades e correções desta versão"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Arquivo APK</Form.Label>
              <Form.Control
                type="file"
                accept=".apk"
                ref={fileInputRef}
                onChange={handleFileChange}
                required={!editMode}
              />
              <Form.Text className="text-muted">
                {editMode ? 'Selecione um novo arquivo apenas se desejar substituir o atual' : 'Selecione o arquivo APK para upload'}
              </Form.Text>
              
              {uploading && (
                <div className="mt-2">
                  <div className="d-flex align-items-center">
                    <div className="me-2">Enviando: {uploadProgress}%</div>
                    <div className="progress flex-grow-1">
                      <div 
                        className="progress-bar" 
                        role="progressbar" 
                        style={{ width: `${uploadProgress}%` }} 
                        aria-valuenow={uploadProgress} 
                        aria-valuemin={0} 
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {editMode && formData.link_download && (
                <div className="mt-2">
                  <small>
                    Link atual: <a href={formData.link_download} target="_blank" rel="noopener noreferrer">{formData.link_download}</a>
                  </small>
                </div>
              )}
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Atualização Obrigatória"
                name="obrigatoria"
                checked={formData.obrigatoria}
                onChange={handleChange}
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Atualização Ativa"
                name="ativa"
                checked={formData.ativa}
                onChange={handleChange}
              />
            </Form.Group>
            
            <div className="d-flex justify-content-end">
              <Button variant="secondary" onClick={() => setShowModal(false)} className="me-2">
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={loading || uploading}>
                {loading || uploading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                    Salvando...
                  </>
                ) : 'Salvar'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default Atualizacoes; 