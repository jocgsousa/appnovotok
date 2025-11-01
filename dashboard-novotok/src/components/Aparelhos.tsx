import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Alert, Modal, Form, Tabs, Tab, Row, Col } from 'react-bootstrap';
import { 
  listarAparelhos, 
  autorizarAparelho as autorizarAparelhoService, 
  bloquearAparelho as bloquearAparelhoService, 
  deletarAparelho as deletarAparelhoService,
  vincularVendedorAparelho,
  desvincularVendedorAparelho
} from '../services/aparelhoService';
import { listarVendedores, Funcionario as Vendedor } from '../services/funcionariosService';
import { 
  PermissaoFuncaoApp, 
  obterPermissoesFuncaoApp, 
  atualizarPermissoesFuncaoApp 
} from '../services/permissoesAppService';
import PageHeader from './PageHeader';
import ActionButtons from './ActionButtons';
import ResponsiveTable from './ResponsiveTable';

interface Aparelho {
  id: number;
  codaparelho: string;
  autorized: boolean;
  vendedor?: {
    id: number;
    nome: string;
    rca: string;
  };
}

const Aparelhos: React.FC = () => {
  const [aparelhos, setAparelhos] = useState<Aparelho[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("aparelhos");
  
  // Estado para o modal de vinculação
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [selectedAparelho, setSelectedAparelho] = useState<Aparelho | null>(null);
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Estado para o modal de permissões
  const [showPermissoesModal, setShowPermissoesModal] = useState(false);
  const [loadingPermissoes, setLoadingPermissoes] = useState(false);
  const [permissoes, setPermissoes] = useState<PermissaoFuncaoApp | null>(null);
  const [permissoesError, setPermissoesError] = useState<string | null>(null);

  // Carregar lista de aparelhos e vendedores
  useEffect(() => {
    loadAparelhos();
    loadVendedores();
  }, []);

  const loadAparelhos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await listarAparelhos();
      setAparelhos(data);
    } catch (err) {
      console.error('Erro ao carregar aparelhos:', err);
      setError('Não foi possível carregar a lista de aparelhos');
    } finally {
      setLoading(false);
    }
  };

  const loadVendedores = async () => {
    try {
      const data = await listarVendedores();
      setVendedores(data.filter((vendedor: any) => vendedor.ativo));
    } catch (err) {
      console.error('Erro ao carregar vendedores:', err);
      setError('Não foi possível carregar a lista de vendedores');
    }
  };

  // Autorizar aparelho
  const autorizarAparelho = async (id: number) => {
    try {
      setError(null);
      await autorizarAparelhoService(id);
      setSuccess('Aparelho autorizado com sucesso!');
      loadAparelhos();
    } catch (err) {
      console.error('Erro ao autorizar aparelho:', err);
      setError('Erro ao autorizar o aparelho. Tente novamente.');
    }
  };

  // Bloquear aparelho
  const bloquearAparelho = async (id: number) => {
    try {
      setError(null);
      await bloquearAparelhoService(id);
      setSuccess('Aparelho bloqueado com sucesso!');
      loadAparelhos();
    } catch (err) {
      console.error('Erro ao bloquear aparelho:', err);
      setError('Erro ao bloquear o aparelho. Tente novamente.');
    }
  };

  // Deletar aparelho
  const deletarAparelho = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este aparelho?')) {
      try {
        setError(null);
        await deletarAparelhoService(id);
        setSuccess('Aparelho deletado com sucesso!');
        loadAparelhos();
      } catch (err) {
        console.error('Erro ao deletar aparelho:', err);
        setError('Erro ao deletar o aparelho. Tente novamente.');
      }
    }
  };

  // Abrir modal para vincular vendedor
  const handleOpenVincularModal = (aparelho: Aparelho) => {
    setSelectedAparelho(aparelho);
    setSelectedVendedorId(aparelho.vendedor?.id.toString() || '');
    setShowVincularModal(true);
  };

  // Fechar modal de vinculação
  const handleCloseVincularModal = () => {
    setShowVincularModal(false);
    setSelectedAparelho(null);
    setSelectedVendedorId('');
  };

  // Vincular vendedor ao aparelho
  const handleVincular = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAparelho || !selectedVendedorId) {
      setError('Selecione um vendedor para vincular ao aparelho');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      console.log(`Enviando requisição para vincular aparelho ${selectedAparelho.id} ao vendedor ${selectedVendedorId}`);
      
      const vendedorIdNumerico = parseInt(selectedVendedorId);
      if (isNaN(vendedorIdNumerico)) {
        setError('ID do vendedor inválido. Deve ser um número.');
        setSubmitting(false);
        return;
      }
      
      const response = await vincularVendedorAparelho(selectedAparelho.id, vendedorIdNumerico);
      console.log('Resposta da vinculação:', response);
      
      if (response && response.success !== false) {
        setSuccess('Vendedor vinculado ao aparelho com sucesso!');
        handleCloseVincularModal();
        
        // Aguardar um momento antes de atualizar a lista
        setTimeout(() => {
          loadAparelhos();
        }, 500);
      } else {
        // Exibir mensagem de erro detalhada
        let mensagemErro = response?.message || 'Erro ao vincular vendedor ao aparelho';
        
        // Se houver detalhes adicionais na resposta, exibir
        if (response?.detalhes) {
          mensagemErro += ` Detalhes: ${response.detalhes}`;
        }
        
        // Se houver vendedores disponíveis na resposta, exibir
        if (response?.vendedores_disponiveis && Array.isArray(response.vendedores_disponiveis)) {
          mensagemErro += ` IDs de vendedores disponíveis: ${response.vendedores_disponiveis.join(', ')}`;
        }
        
        setError(mensagemErro);
      }
    } catch (err: any) {
      console.error('Erro ao vincular vendedor ao aparelho:', err);
      let mensagemErro = 'Não foi possível vincular o vendedor ao aparelho';
      
      if (err?.response?.data?.message) {
        mensagemErro += `: ${err.response.data.message}`;
      } else if (err?.message) {
        mensagemErro += `: ${err.message}`;
      }
      
      setError(mensagemErro);
    } finally {
      setSubmitting(false);
    }
  };

  // Desvincular vendedor do aparelho
  const handleDesvincular = async (aparelhoId: number) => {
    if (window.confirm('Tem certeza que deseja desvincular o vendedor deste aparelho?')) {
      try {
        setError(null);
        
        console.log(`Enviando requisição para desvincular vendedor do aparelho ${aparelhoId}`);
        
        const response = await desvincularVendedorAparelho(aparelhoId);
        console.log('Resposta da desvinculação:', response);
        
        if (response && response.success !== false) {
          setSuccess('Vendedor desvinculado do aparelho com sucesso!');
          
          // Aguardar um momento antes de atualizar a lista
          setTimeout(() => {
            loadAparelhos();
          }, 500);
        } else {
          setError(response?.message || 'Erro ao desvincular vendedor do aparelho');
        }
      } catch (err: any) {
        console.error('Erro ao desvincular vendedor do aparelho:', err);
        setError(`Não foi possível desvincular o vendedor do aparelho: ${err?.response?.data?.message || err?.message || 'Erro desconhecido'}`);
      }
    }
  };

  // Abrir modal para gerenciar permissões
  const handleOpenPermissoesModal = async (aparelho: Aparelho) => {
    setSelectedAparelho(aparelho);
    setShowPermissoesModal(true);
    setPermissoesError(null);
    
    try {
      setLoadingPermissoes(true);
      const permissoesData = await obterPermissoesFuncaoApp(aparelho.id);
      setPermissoes(permissoesData);
    } catch (err: any) {
      console.error('Erro ao carregar permissões:', err);
      setPermissoesError('Não foi possível carregar as permissões do aparelho');
    } finally {
      setLoadingPermissoes(false);
    }
  };

  // Fechar modal de permissões
  const handleClosePermissoesModal = () => {
    setShowPermissoesModal(false);
    setSelectedAparelho(null);
    setPermissoes(null);
  };

  // Atualizar permissões do aparelho
  const handleSalvarPermissoes = async () => {
    if (!permissoes) return;
    
    try {
      setSubmitting(true);
      setPermissoesError(null);
      
      await atualizarPermissoesFuncaoApp(permissoes);
      
      setSuccess('Permissões atualizadas com sucesso!');
      handleClosePermissoesModal();
    } catch (err: any) {
      console.error('Erro ao atualizar permissões:', err);
      setPermissoesError('Não foi possível atualizar as permissões do aparelho');
    } finally {
      setSubmitting(false);
    }
  };

  // Atualizar estado das permissões quando um checkbox for alterado
  const handlePermissaoChange = (campo: keyof PermissaoFuncaoApp, valor: boolean) => {
    if (!permissoes) return;
    
    setPermissoes({
      ...permissoes,
      [campo]: valor
    });
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
    { header: 'Código Aparelho', accessor: 'codaparelho' },
    { 
      header: 'Autorizado', 
      accessor: 'autorized',
      cell: (row: Aparelho) => row.autorized ? 'Sim' : 'Não'
    },
    { 
      header: 'Vendedor', 
      accessor: 'vendedor',
      cell: (row: Aparelho) => row.vendedor ? 
        `${row.vendedor.nome} (${row.vendedor.rca})` : 
        'Não vinculado'
    },
    { 
      header: 'Ações', 
      accessor: 'actions',
      cell: (row: Aparelho) => {
        const actionButtons = [
          {
            label: 'Autorizar',
            icon: 'check-circle',
            variant: 'success',
            onClick: () => autorizarAparelho(row.id)
          },
          {
            label: 'Bloquear',
            icon: 'slash-circle',
            variant: 'warning',
            onClick: () => bloquearAparelho(row.id)
          },
          {
            label: 'Vincular',
            icon: 'link',
            variant: 'info',
            onClick: () => handleOpenVincularModal(row)
          }
        ];

        if (row.vendedor) {
          actionButtons.push({
            label: 'Desvincular',
            icon: 'unlink',
            variant: 'secondary',
            onClick: () => handleDesvincular(row.id)
          });
        }

        actionButtons.push(
          {
            label: 'Permissões',
            icon: 'gear',
            variant: 'primary',
            onClick: () => handleOpenPermissoesModal(row)
          },
          {
            label: 'Excluir',
            icon: 'trash',
            variant: 'danger',
            onClick: () => deletarAparelho(row.id)
          }
        );

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
      <p className="mt-2">Carregando aparelhos...</p>
    </div>
  );

  // Componente para quando não há dados
  const emptyComponent = (
    <div className="text-center py-4">
      <i className="bi bi-exclamation-circle text-muted" style={{ fontSize: '2rem' }}></i>
      <p className="mt-2">Nenhum aparelho encontrado</p>
    </div>
  );

  return (
    <div className="containerview">
      <PageHeader 
        title="Aparelhos" 
        buttonText="Atualizar" 
        buttonIcon="arrow-clockwise" 
        onButtonClick={loadAparelhos} 
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {success && (
        <Alert variant="success" className="alert-success" style={{ backgroundColor: '#d4edda', color: '#155724', borderColor: '#c3e6cb' }}>
          {success}
        </Alert>
      )}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <Tabs 
            activeKey={activeTab} 
            onSelect={(k) => setActiveTab(k || "aparelhos")}
            className="mb-0 flex-grow-1"
          >
            <Tab eventKey="aparelhos" title="Lista de Aparelhos" />
          </Tabs>
        </Card.Header>
        <Card.Body className="p-0 p-md-3">
          <ResponsiveTable 
            columns={columns}
            data={aparelhos}
            isLoading={loading}
            loadingComponent={loadingComponent}
            emptyComponent={emptyComponent}
          />
        </Card.Body>
      </Card>

      {/* Modal para vincular vendedor */}
      <Modal 
        show={showVincularModal} 
        onHide={handleCloseVincularModal}
        centered
        className="modal-fullscreen-sm-down"
      >
        <Modal.Header closeButton>
          <Modal.Title>Vincular Vendedor ao Aparelho</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedAparelho && (
            <Form onSubmit={handleVincular}>
              <Form.Group className="mb-3">
                <Form.Label>Aparelho</Form.Label>
                <Form.Control
                  type="text"
                  value={selectedAparelho.codaparelho}
                  readOnly
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Selecione um Vendedor</Form.Label>
                <Form.Select
                  value={selectedVendedorId}
                  onChange={(e) => setSelectedVendedorId(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {vendedores.map(vendedor => (
                    <option key={vendedor.id} value={vendedor.id}>
                      {vendedor.nome} ({vendedor.rca})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <div className="d-flex justify-content-end mt-3">
                <Button variant="secondary" onClick={handleCloseVincularModal} className="me-2">
                  <i className="bi bi-x-circle me-2"></i> Cancelar
                </Button>
                <Button variant="primary" type="submit" disabled={submitting}>
                  <i className="bi bi-check-circle me-2"></i> {submitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </Form>
          )}
        </Modal.Body>
      </Modal>

      {/* Modal para gerenciar permissões */}
      <Modal 
        show={showPermissoesModal} 
        onHide={handleClosePermissoesModal}
        centered
        className="modal-fullscreen-sm-down"
      >
        <Modal.Header closeButton>
          <Modal.Title>Permissões de Funcionalidades do App</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingPermissoes ? (
            <div className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Carregando...</span>
              </div>
              <p className="mt-2">Carregando permissões...</p>
            </div>
          ) : permissoesError ? (
            <Alert variant="danger">{permissoesError}</Alert>
          ) : permissoes && selectedAparelho ? (
            <>
              <div className="mb-3">
                <strong>Aparelho:</strong> {selectedAparelho.codaparelho}
                {selectedAparelho.vendedor && (
                  <div>
                    <strong>Vendedor:</strong> {selectedAparelho.vendedor.nome} ({selectedAparelho.vendedor.rca})
                  </div>
                )}
              </div>

              <p className="text-muted mb-3">
                Selecione as funcionalidades que estarão disponíveis para este aparelho:
              </p>

              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="orcamentos-switch"
                        label="Orçamentos"
                        checked={permissoes.orcamentos}
                        onChange={(e) => handlePermissaoChange('orcamentos', e.target.checked)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="minhas-vendas-switch"
                        label="Minhas Vendas"
                        checked={permissoes.minhas_vendas}
                        onChange={(e) => handlePermissaoChange('minhas_vendas', e.target.checked)}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="minhas-metas-switch"
                        label="Minhas Metas"
                        checked={permissoes.minhas_metas}
                        onChange={(e) => handlePermissaoChange('minhas_metas', e.target.checked)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="informativos-switch"
                        label="Informativos"
                        checked={permissoes.informativos}
                        onChange={(e) => handlePermissaoChange('informativos', e.target.checked)}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="buscar-produto-switch"
                        label="Buscar Produto"
                        checked={permissoes.buscar_produto}
                        onChange={(e) => handlePermissaoChange('buscar_produto', e.target.checked)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="ofertas-switch"
                        label="Ofertas"
                        checked={permissoes.ofertas}
                        onChange={(e) => handlePermissaoChange('ofertas', e.target.checked)}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="switch"
                        id="clientes-switch"
                        label="Clientes"
                        checked={permissoes.clientes}
                        onChange={(e) => handlePermissaoChange('clientes', e.target.checked)}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Alert variant="info">
                  <strong>Nota:</strong> As funcionalidades "Home" e "Configurações" estão sempre habilitadas por padrão.
                </Alert>
              </Form>
            </>
          ) : (
            <p>Não foi possível carregar as permissões.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClosePermissoesModal}>
            <i className="bi bi-x-circle me-2"></i> Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSalvarPermissoes}
            disabled={loadingPermissoes || !permissoes || submitting}
          >
            <i className="bi bi-check-circle me-2"></i> {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Aparelhos;