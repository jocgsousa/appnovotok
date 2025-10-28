import React, { useState, useEffect } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Table,
  Modal,
  Form,
  Alert,
  Spinner,
  Badge,
  Tab,
  Tabs
} from 'react-bootstrap';
import npsService, { CampanhaNPS, InstanciaWhatsApp, PerguntaNPS } from '../services/npsService';
import { listarFiliais } from '../services/filiaisService';

interface FilialSimples {
  id: number;
  nome: string;
}

// Tipo específico para o formulário que permite instancia_id como null
type CampanhaFormData = Partial<CampanhaNPS> & {
  instancia_id?: number | null;
};

const NPSCampanhas: React.FC = () => {
  const [campanhas, setCampanhas] = useState<CampanhaNPS[]>([]);
  const [instancias, setInstancias] = useState<InstanciaWhatsApp[]>([]);
  const [filiais, setFiliais] = useState<FilialSimples[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<CampanhaNPS | null>(null);
  const [activeTab, setActiveTab] = useState('dados-gerais');
  
  const [formData, setFormData] = useState<CampanhaFormData>({
    nome: '',
    descricao: '',
    instancia_id: null, // Permite campanhas sem instância vinculada
    pergunta_principal: 'Em uma escala de 0 a 10, o quanto você recomendaria nossa loja para um amigo ou familiar?',
    mensagem_inicial: 'Olá! Sua opinião é muito importante para nós! 😊',
    mensagem_final: 'Muito obrigado pelo seu feedback! Sua opinião nos ajuda a melhorar sempre! 🙏✨',
    dias_apos_compra: 7,
    disparo_imediato: false,
    status: 'ativa',
    data_inicio: '',
    data_fim: '',
    max_tentativas_envio: 3,
    intervalo_reenvio_dias: 7,
    horario_envio_inicio: '09:00',
    horario_envio_fim: '18:00',
    dias_semana_envio: '1,2,3,4,5,6',
    filiais_ativas: [],
    timeout_conversa_minutos: 30,
    perguntas: [],
    imagem: null,
    imagem_tipo: null,
    imagem_nome: null
  });
  
  // Estado para preview da imagem
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [campanhasData, instanciasData, filiaisResponse] = await Promise.all([
        npsService.listarCampanhas(),
        npsService.listarInstancias(),
        listarFiliais()
      ]);
      
      setCampanhas(campanhasData);
      setInstancias(instanciasData.filter(i => i.status === 'ativa'));
      
      if (filiaisResponse.success && filiaisResponse.filiais) {
        setFiliais(filiaisResponse.filiais.map(f => ({ id: f.id, nome: f.nome_fantasia })));
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleShowModal = (campanha?: CampanhaNPS) => {
    // Permitir edição mesmo sem instâncias disponíveis
    // Apenas mostrar um aviso se não houver instâncias
    if (instancias.length === 0) {
      console.log('⚠️ [WARNING] Nenhuma instância disponível. Campanha poderá ser criada/editada sem instância vinculada.');
    }

    if (campanha) {
      // Debug: Log dos dados recebidos
      console.log('🔍 [DEBUG] Dados da campanha recebidos:', campanha);
      console.log('🔍 [DEBUG] instancia_id original:', campanha.instancia_id, 'tipo:', typeof campanha.instancia_id);
      console.log('🔍 [DEBUG] Instâncias disponíveis:', instancias.map(i => ({ id: i.id, nome: i.nome })));
      
      // Tentar diferentes formas de converter o instancia_id
      let instanciaIdConvertido = 0;
      if (campanha.instancia_id !== null && campanha.instancia_id !== undefined) {
        if (typeof campanha.instancia_id === 'string') {
          instanciaIdConvertido = parseInt(campanha.instancia_id, 10);
        } else if (typeof campanha.instancia_id === 'number') {
          instanciaIdConvertido = campanha.instancia_id;
        }
      }
      
      console.log('🔍 [DEBUG] instancia_id convertido:', instanciaIdConvertido);
      
      // Verificar se a instância existe na lista (apenas se houver instâncias disponíveis)
      let instanciaFinal: number | null = instanciaIdConvertido;
      
      if (instancias.length > 0) {
        const instanciaExiste = instancias.find(i => Number(i.id) === Number(instanciaIdConvertido));
        console.log('🔍 [DEBUG] Instância existe na lista?', instanciaExiste ? 'SIM' : 'NÃO', instanciaExiste);
        
        // Se a instância não existir, usar a primeira disponível
        if (!instanciaExiste) {
          instanciaFinal = instancias[0]?.id || null;
          console.log('⚠️ [WARNING] Instância original não encontrada, usando primeira disponível:', instancias[0]);
        }
      } else {
        // Se não há instâncias disponíveis, permitir null
        instanciaFinal = campanha.instancia_id || null;
        console.log('⚠️ [WARNING] Nenhuma instância disponível, mantendo valor original:', instanciaFinal);
      }
      
      setEditingCampanha(campanha);
      
      const dadosFormulario = {
        ...campanha,
        // Usar a instância final (existente ou primeira disponível)
        instancia_id: instanciaFinal,
        horario_envio_inicio: campanha.horario_envio_inicio?.substring(0, 5),
        horario_envio_fim: campanha.horario_envio_fim?.substring(0, 5),
        // Garantir que outros campos numéricos sejam números
        // Preservar valor 0 quando disparo_imediato estiver ativo
        dias_apos_compra: campanha.disparo_imediato ? 0 : (Number(campanha.dias_apos_compra) || 7),
        max_tentativas_envio: Number(campanha.max_tentativas_envio) || 3,
        intervalo_reenvio_dias: Number(campanha.intervalo_reenvio_dias) || 7,
        timeout_conversa_minutos: Number(campanha.timeout_conversa_minutos) || 30,
        // Garantir que arrays sejam arrays válidos
        filiais_ativas: Array.isArray(campanha.filiais_ativas) ? campanha.filiais_ativas : [],
        perguntas: Array.isArray(campanha.perguntas) ? campanha.perguntas : [],
        // Incluir campos de imagem
        imagem: campanha.imagem || null,
        imagem_tipo: campanha.imagem_tipo || null,
        imagem_nome: campanha.imagem_nome || null
      };
      
      console.log('🔍 [DEBUG] Dados do formulário preparados:', dadosFormulario);
      console.log('🔍 [DEBUG] instancia_id no formulário:', dadosFormulario.instancia_id);
      
      setFormData(dadosFormulario);
      
      // Carregar preview da imagem se existir
      if (campanha.imagem) {
        setImagemPreview(campanha.imagem);
      } else {
        setImagemPreview(null);
      }
    } else {
      setEditingCampanha(null);
      setFormData({
        nome: '',
        descricao: '',
        instancia_id: instancias[0]?.id || null, // Permite null quando não há instâncias
        pergunta_principal: 'Em uma escala de 0 a 10, o quanto você recomendaria nossa loja para um amigo ou familiar?',
        mensagem_inicial: 'Olá! Sua opinião é muito importante para nós! 😊',
        mensagem_final: 'Muito obrigado pelo seu feedback! Sua opinião nos ajuda a melhorar sempre! 🙏✨',
        dias_apos_compra: 7,
        disparo_imediato: false,
        status: 'ativa',
        max_tentativas_envio: 3,
        intervalo_reenvio_dias: 7,
        horario_envio_inicio: '09:00',
        horario_envio_fim: '18:00',
        dias_semana_envio: '1,2,3,4,5,6',
        filiais_ativas: [],
        timeout_conversa_minutos: 30,
        perguntas: []
      });
    }
    setActiveTab('dados-gerais');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCampanha(null);
    setFormData({});
    setActiveTab('dados-gerais');
    setImagemPreview(null);
    
    // Limpar input file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleInputChange = (campo: keyof CampanhaNPS, valor: any) => {
    setFormData(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  // Função para lidar com upload de imagem
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      
      // Atualizar preview
      setImagemPreview(result);
      
      // Atualizar dados do formulário
      handleInputChange('imagem', result);
      handleInputChange('imagem_tipo', file.type);
      handleInputChange('imagem_nome', file.name);
    };
    
    reader.readAsDataURL(file);
  };

  // Função para remover imagem
  const handleRemoveImage = () => {
    setImagemPreview(null);
    handleInputChange('imagem', null);
    handleInputChange('imagem_tipo', null);
    handleInputChange('imagem_nome', null);
    
    // Limpar input file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleFilialToggle = (filialId: number) => {
    const filiaisAtivas = formData.filiais_ativas || [];
    const novasFiliaisAtivas = filiaisAtivas.includes(filialId)
      ? filiaisAtivas.filter(id => id !== filialId)
      : [...filiaisAtivas, filialId];
    
    handleInputChange('filiais_ativas', novasFiliaisAtivas);
  };

  const handleDiaSemanaToggle = (dia: string) => {
    const diasAtivos = formData.dias_semana_envio?.split(',') || [];
    const novosDias = diasAtivos.includes(dia)
      ? diasAtivos.filter(d => d !== dia)
      : [...diasAtivos, dia];
    
    handleInputChange('dias_semana_envio', novosDias.sort().join(','));
  };

  const adicionarPergunta = () => {
    const novasPergunta: PerguntaNPS = {
      pergunta: '',
      tipo_resposta: 'texto_livre',
      mensagem_erro: 'Resposta inválida. Tente novamente.',
      obrigatoria: false,
      ordem: (formData.perguntas?.length || 0) + 1,
      status: 'ativa'
    };
    
    handleInputChange('perguntas', [...(formData.perguntas || []), novasPergunta]);
  };

  const removerPergunta = (index: number) => {
    const novasPerguntas = [...(formData.perguntas || [])];
    novasPerguntas.splice(index, 1);
    // Reordenar
    novasPerguntas.forEach((p, i) => p.ordem = i + 1);
    handleInputChange('perguntas', novasPerguntas);
  };

  const atualizarPergunta = (index: number, campo: keyof PerguntaNPS, valor: any) => {
    const novasPerguntas = [...(formData.perguntas || [])];
    novasPerguntas[index] = { ...novasPerguntas[index], [campo]: valor };
    handleInputChange('perguntas', novasPerguntas);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const dadosParaEnvio = {
        ...formData,
        horario_envio_inicio: formData.horario_envio_inicio + ':00',
        horario_envio_fim: formData.horario_envio_fim + ':00',
        // Incluir dados de imagem atualizados
        imagem: formData.imagem || null,
        imagem_tipo: formData.imagem_tipo || null,
        imagem_nome: formData.imagem_nome || null
      } as CampanhaNPS;

      if (editingCampanha) {
        await npsService.atualizarCampanha(dadosParaEnvio);
      } else {
        await npsService.criarCampanha(dadosParaEnvio);
      }
      
      handleCloseModal();
      carregarDados();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar campanha');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja deletar esta campanha?')) {
      try {
        await npsService.deletarCampanha(id);
        carregarDados();
      } catch (err: any) {
        // Tratar diferentes tipos de erro
        let errorMessage = 'Erro ao deletar campanha';
        
        if (err.response) {
          // Erro HTTP da API
          if (err.response.status === 400) {
            // Erro 400 - Bad Request (campanha com envios ativos)
            errorMessage = err.response.data?.error || err.response.data?.message || 'Não é possível deletar campanha com envios ativos';
          } else if (err.response.status === 404) {
            errorMessage = 'Campanha não encontrada';
          } else if (err.response.status === 403) {
            errorMessage = 'Você não tem permissão para deletar esta campanha';
          } else {
            errorMessage = err.response.data?.error || err.response.data?.message || `Erro ${err.response.status}: ${err.response.statusText}`;
          }
        } else if (err.message) {
          // Erro de rede ou outro tipo
          errorMessage = err.message;
        }
        
        setError(errorMessage);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ativa':
        return <Badge bg="success">Ativa</Badge>;
      case 'inativa':
        return <Badge bg="secondary">Inativa</Badge>;
      case 'pausada':
        return <Badge bg="warning">Pausada</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  const diasSemana = [
    { value: '1', label: 'Dom' },
    { value: '2', label: 'Seg' },
    { value: '3', label: 'Ter' },
    { value: '4', label: 'Qua' },
    { value: '5', label: 'Qui' },
    { value: '6', label: 'Sex' },
    { value: '7', label: 'Sáb' }
  ];

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2>Campanhas NPS</h2>
              <p className="text-muted">Gerencie as campanhas de pesquisa de satisfação</p>
            </div>
            <Button 
              variant="primary" 
              onClick={() => handleShowModal()}
              disabled={instancias.length === 0}
            >
              Nova Campanha
            </Button>
          </div>
        </Col>
      </Row>

      {error && (
        <Row className="mb-3">
          <Col>
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          </Col>
        </Row>
      )}

      {instancias.length === 0 && (
        <Row className="mb-3">
          <Col>
            <Alert variant="warning">
              <Alert.Heading>Nenhuma instância WhatsApp ativa</Alert.Heading>
              <p>Para criar campanhas NPS, você precisa primeiro configurar pelo menos uma instância WhatsApp ativa.</p>
            </Alert>
          </Col>
        </Row>
      )}

      <Row>
        <Col>
          <Card>
            <Card.Body>
              <div className="table-responsive">
                <Table striped hover>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Instância</th>
                      <th>Status</th>
                      <th>Dias Após Compra</th>
                      <th>Filiais Ativas</th>
                      <th>Horário Envio</th>
                      <th>Data Início</th>
                      <th>Data Fim</th>
                      <th>Data Cadastro</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campanhas.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center text-muted">
                          Nenhuma campanha cadastrada
                        </td>
                      </tr>
                    ) : (
                      campanhas.map(campanha => (
                        <tr key={campanha.id}>
                          <td>
                            <strong>{campanha.nome}</strong>
                            {campanha.descricao && (
                              <div className="text-muted small">{campanha.descricao}</div>
                            )}
                          </td>
                          <td>
                            {campanha.instancia_nome || (
                              <span className="text-muted fst-italic">Manual</span>
                            )}
                            {campanha.numero_whatsapp && (
                              <div className="text-muted small">
                                {npsService.formatarTelefone(campanha.numero_whatsapp)}
                              </div>
                            )}
                          </td>
                          <td>{getStatusBadge(campanha.status)}</td>
                          <td>{campanha.dias_apos_compra} dias</td>
                          <td>
                            {campanha.filiais_ativas?.length === 0 
                              ? 'Todas' 
                              : `${campanha.filiais_ativas?.length} filiais`
                            }
                          </td>
                          <td>
                            {campanha.horario_envio_inicio?.substring(0, 5)} - {campanha.horario_envio_fim?.substring(0, 5)}
                          </td>
                          <td>
                            {campanha.data_inicio 
                              ? new Date(campanha.data_inicio).toLocaleDateString('pt-BR')
                              : '-'
                            }
                          </td>
                          <td>
                            {campanha.data_fim 
                              ? new Date(campanha.data_fim).toLocaleDateString('pt-BR')
                              : '-'
                            }
                          </td>
                          <td>
                            {campanha.data_cadastro 
                              ? new Date(campanha.data_cadastro).toLocaleDateString('pt-BR')
                              : '-'
                            }
                          </td>
                          <td>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="me-2"
                              onClick={() => handleShowModal(campanha)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(campanha.id!)}
                            >
                              Deletar
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal de Criação/Edição */}
      <Modal show={showModal} onHide={handleCloseModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingCampanha ? 'Editar Campanha' : 'Nova Campanha'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'dados-gerais')}>
              <Tab eventKey="dados-gerais" title="Dados Gerais">
                <div className="mt-3">
                  <Row>
                    <Col md={8}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nome da Campanha *</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.nome || ''}
                          onChange={(e) => handleInputChange('nome', e.target.value)}
                          required
                          placeholder="Ex: Pesquisa Satisfação Pós-Venda"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Instância WhatsApp</Form.Label>
                        <Form.Select
                          value={formData.instancia_id?.toString() || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            handleInputChange('instancia_id', value === '' ? null : parseInt(value));
                          }}
                        >
                          <option value="">Nenhuma instância (campanha manual)</option>
                          {instancias.map(instancia => (
                            <option key={instancia.id} value={instancia.id}>
                              {instancia.nome} ({npsService.formatarTelefone(instancia.numero_whatsapp)})
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Text className="text-muted">
                          Campanhas sem instância devem ser executadas manualmente
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label>Descrição</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={formData.descricao || ''}
                      onChange={(e) => handleInputChange('descricao', e.target.value)}
                      placeholder="Descrição opcional da campanha"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Imagem da Campanha</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                    <Form.Text className="text-muted">
                      Imagem opcional que será enviada junto com a pesquisa NPS (máx. 5MB)
                    </Form.Text>
                    {imagemPreview && (
                      <div className="mt-2">
                        <img 
                          src={imagemPreview} 
                          alt="Preview" 
                          style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'cover' }}
                          className="img-thumbnail"
                        />
                        <div className="mt-1">
                          <Button 
                            variant="outline-danger" 
                            size="sm" 
                            onClick={handleRemoveImage}
                          >
                            Remover Imagem
                          </Button>
                        </div>
                      </div>
                    )}
                  </Form.Group>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Status</Form.Label>
                        <Form.Select
                          value={formData.status || 'ativa'}
                          onChange={(e) => handleInputChange('status', e.target.value)}
                        >
                          <option value="ativa">Ativa</option>
                          <option value="inativa">Inativa</option>
                          <option value="pausada">Pausada</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Data Início</Form.Label>
                        <Form.Control
                          type="date"
                          value={formData.data_inicio || ''}
                          onChange={(e) => handleInputChange('data_inicio', e.target.value)}
                        />
                        <Form.Text className="text-muted">
                          Data de início da campanha (opcional)
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Data Fim</Form.Label>
                        <Form.Control
                          type="date"
                          value={formData.data_fim || ''}
                          onChange={(e) => handleInputChange('data_fim', e.target.value)}
                        />
                        <Form.Text className="text-muted">
                          Data de fim da campanha (opcional)
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Dias Após Compra</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          max="365"
                          value={formData.dias_apos_compra || 7}
                          onChange={(e) => handleInputChange('dias_apos_compra', parseInt(e.target.value))}
                          disabled={formData.disparo_imediato}
                        />
                        <Form.Text className="text-muted">
                          Quantos dias aguardar após a compra para enviar a pesquisa
                        </Form.Text>
                        <Form.Check
                          type="checkbox"
                          label="Disparo Imediato"
                          checked={formData.disparo_imediato || false}
                          onChange={(e) => {
                            const isImediato = e.target.checked;
                            handleInputChange('disparo_imediato', isImediato);
                            if (isImediato) {
                              handleInputChange('dias_apos_compra', 0);
                            }
                          }}
                          className="mt-2"
                        />
                        <Form.Text className="text-muted small">
                          Enviar pesquisa imediatamente após a compra
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Timeout Conversa (min)</Form.Label>
                        <Form.Control
                          type="number"
                          min="5"
                          max="1440"
                          value={formData.timeout_conversa_minutos || 30}
                          onChange={(e) => handleInputChange('timeout_conversa_minutos', parseInt(e.target.value))}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </Tab>

              <Tab eventKey="mensagens" title="Mensagens">
                <div className="mt-3">
                  <Form.Group className="mb-3">
                    <Form.Label>Mensagem Inicial</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formData.mensagem_inicial || ''}
                      onChange={(e) => handleInputChange('mensagem_inicial', e.target.value)}
                      placeholder="Mensagem de abertura da conversa"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Pergunta Principal (NPS) *</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formData.pergunta_principal || ''}
                      onChange={(e) => handleInputChange('pergunta_principal', e.target.value)}
                      required
                      placeholder="Pergunta para avaliar a satisfação (escala 0-10)"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Mensagem Final</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formData.mensagem_final || ''}
                      onChange={(e) => handleInputChange('mensagem_final', e.target.value)}
                      placeholder="Mensagem de agradecimento ao final"
                    />
                  </Form.Group>
                </div>
              </Tab>

              <Tab eventKey="configuracoes" title="Configurações">
                <div className="mt-3">
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Horário de Envio</Form.Label>
                        <Row>
                          <Col>
                            <Form.Control
                              type="time"
                              value={formData.horario_envio_inicio || '09:00'}
                              onChange={(e) => handleInputChange('horario_envio_inicio', e.target.value)}
                            />
                            <Form.Text>Início</Form.Text>
                          </Col>
                          <Col>
                            <Form.Control
                              type="time"
                              value={formData.horario_envio_fim || '18:00'}
                              onChange={(e) => handleInputChange('horario_envio_fim', e.target.value)}
                            />
                            <Form.Text>Fim</Form.Text>
                          </Col>
                        </Row>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Dias da Semana</Form.Label>
                        <div className="d-flex gap-2">
                          {diasSemana.map(dia => (
                            <Form.Check
                              key={dia.value}
                              type="checkbox"
                              id={`dia-${dia.value}`}
                              label={dia.label}
                              checked={formData.dias_semana_envio?.includes(dia.value) || false}
                              onChange={() => handleDiaSemanaToggle(dia.value)}
                            />
                          ))}
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Máximo Tentativas</Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          max="10"
                          value={formData.max_tentativas_envio || 3}
                          onChange={(e) => handleInputChange('max_tentativas_envio', parseInt(e.target.value))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Intervalo Reenvio (dias)</Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          max="30"
                          value={formData.intervalo_reenvio_dias || 7}
                          onChange={(e) => handleInputChange('intervalo_reenvio_dias', parseInt(e.target.value))}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label>Filiais Ativas</Form.Label>
                    <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <Form.Check
                        type="checkbox"
                        id="todas-filiais"
                        label="Todas as filiais"
                        checked={formData.filiais_ativas?.length === 0}
                        onChange={() => handleInputChange('filiais_ativas', [])}
                        className="mb-2 fw-bold"
                      />
                      <hr />
                      {filiais.map(filial => (
                        <Form.Check
                          key={filial.id}
                          type="checkbox"
                          id={`filial-${filial.id}`}
                          label={filial.nome}
                          checked={formData.filiais_ativas?.includes(filial.id) || false}
                          onChange={() => handleFilialToggle(filial.id)}
                          className="mb-1"
                        />
                      ))}
                    </div>
                    <Form.Text className="text-muted">
                      Se nenhuma filial for selecionada, a campanha será ativa para todas
                    </Form.Text>
                  </Form.Group>
                </div>
              </Tab>
            </Tabs>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingCampanha ? 'Atualizar' : 'Criar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default NPSCampanhas;
