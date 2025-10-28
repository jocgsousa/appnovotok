import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Form, Button, Modal, Badge } from 'react-bootstrap';
import { 
  listarRequisicoes, 
  cadastrarRequisicao, 
  atualizarRequisicao, 
  deletarRequisicao,
  Requisicao, 
  RequisicaoFiltros 
} from '../services/vendasService';
import ResponsiveTable from './ResponsiveTable';
import FilterAccordion from './FilterAccordion';
import TablePagination from './TablePagination';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RequisicoesProps {
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
}

const RequisicoesSync: React.FC<RequisicoesProps> = ({ setError, setSuccess }) => {
  // Estados para dados e paginação
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [totalPaginas, setTotalPaginas] = useState<number>(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState<number>(10);
  const [totalRegistros, setTotalRegistros] = useState<number>(0);
  
  // Estado para filtros
  const [filtros, setFiltros] = useState<RequisicaoFiltros>({
    filial: undefined,
    caixa: undefined,
    data_inicio: undefined,
    data_fim: undefined,
    status: undefined
  });

  // Estados para modal de cadastro/edição
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modoEdicao, setModoEdicao] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<Requisicao>>({
    filial: 0,
    caixa: 0,
    datavendas: '',
    nregistros: undefined,
    initial: false
  });

  // Estado para modal de confirmação de exclusão
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);
  const [idExcluir, setIdExcluir] = useState<number | null>(null);

  // Carregar dados iniciais
  useEffect(() => {
    carregarRequisicoes();
  }, [paginaAtual, registrosPorPagina]);

  // Função para carregar requisições
  const carregarRequisicoes = async () => {
    try {
      setLoading(true);
      const response = await listarRequisicoes({
        ...filtros,
        page: paginaAtual,
        per_page: registrosPorPagina
      });
      
      setRequisicoes(response.data);
      setTotalRegistros(response.pagination.total_records);
      setTotalPaginas(response.pagination.total_pages);
    } catch (error) {
      console.error('Erro ao carregar requisições:', error);
      setError('Não foi possível carregar as requisições. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Função para aplicar filtros
  const aplicarFiltros = () => {
    setPaginaAtual(1); // Voltar para a primeira página ao aplicar filtros
    carregarRequisicoes();
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltros({
      filial: undefined,
      caixa: undefined,
      data_inicio: undefined,
      data_fim: undefined,
      status: undefined
    });
    setPaginaAtual(1);
    carregarRequisicoes();
  };

  // Função para atualizar filtros
  const atualizarFiltro = (campo: keyof RequisicaoFiltros, valor: any) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor === '' ? undefined : valor
    }));
  };

  // Função para abrir modal de cadastro
  const abrirModalCadastro = () => {
    setModoEdicao(false);
    setFormData({
      filial: 0,
      caixa: 0,
      datavendas: format(new Date(), 'yyyy-MM-dd'),
      nregistros: undefined,
      initial: false
    });
    setShowModal(true);
  };

  // Função para abrir modal de edição
  const abrirModalEdicao = (requisicao: Requisicao) => {
    setModoEdicao(true);
    setFormData({
      id: requisicao.id,
      filial: requisicao.filial,
      caixa: requisicao.caixa,
      datavendas: requisicao.datavendas.split('T')[0], // Extrair apenas a data
      nregistros: requisicao.nregistros,
      initial: requisicao.initial,
      completed: requisicao.completed,
      processando: requisicao.processando,
      error: requisicao.error,
      message: requisicao.message
    });
    setShowModal(true);
  };

  // Função para atualizar dados do formulário
  const handleFormChange = (campo: string, valor: any) => {
    setFormData(prev => ({
      ...prev,
      [campo]: valor === '' ? undefined : valor
    }));
  };

  // Função para salvar requisição (cadastro ou edição)
  const salvarRequisicao = async () => {
    try {
      if (!formData.filial || !formData.caixa || !formData.datavendas) {
        setError('Filial, caixa e data de vendas são obrigatórios.');
        return;
      }

      if (modoEdicao && formData.id) {
        // Atualizar requisição existente
        const { id, ...dadosAtualizacao } = formData;
        await atualizarRequisicao(id, dadosAtualizacao);
        setSuccess('Requisição atualizada com sucesso!');
      } else {
        // Cadastrar nova requisição
        await cadastrarRequisicao(formData as any);
        setSuccess('Requisição cadastrada com sucesso!');
      }

      setShowModal(false);
      carregarRequisicoes();
    } catch (error) {
      console.error('Erro ao salvar requisição:', error);
      setError('Ocorreu um erro ao salvar a requisição. Tente novamente.');
    }
  };

  // Função para confirmar exclusão
  const confirmarExclusao = (id: number) => {
    setIdExcluir(id);
    setShowConfirmDelete(true);
  };

  // Função para excluir requisição
  const excluirRequisicao = async () => {
    try {
      if (idExcluir) {
        await deletarRequisicao(idExcluir);
        setSuccess('Requisição excluída com sucesso!');
        setShowConfirmDelete(false);
        carregarRequisicoes();
      }
    } catch (error) {
      console.error('Erro ao excluir requisição:', error);
      setError('Ocorreu um erro ao excluir a requisição. Tente novamente.');
    }
  };

  // Função para renderizar o status da requisição
  const renderizarStatus = (requisicao: Requisicao) => {
    if (requisicao.error) {
      return <Badge bg="danger">Erro</Badge>;
    } else if (requisicao.processando) {
      return <Badge bg="warning" text="dark">Processando</Badge>;
    } else if (requisicao.completed) {
      return <Badge bg="success">Concluída</Badge>;
    } else if (requisicao.initial) {
      return <Badge bg="info">Inicial</Badge>;
    } else {
      return <Badge bg="secondary">Pendente</Badge>;
    }
  };

  // Definir colunas da tabela
  const columns = [
    { header: 'ID', accessor: 'id' },
    { header: 'Filial', accessor: 'filial' },
    { header: 'Caixa', accessor: 'caixa' },
    { 
      header: 'Data Vendas', 
      accessor: 'datavendas',
      cell: (row: Requisicao) => format(parseISO(row.datavendas), 'dd/MM/yyyy', { locale: ptBR })
    },
    { 
      header: 'Registros', 
      accessor: 'nregistros',
      cell: (row: Requisicao) => row.nregistros || 'N/A'
    },
    { 
      header: 'Status', 
      accessor: 'status',
      cell: (row: Requisicao) => renderizarStatus(row)
    },
    { 
      header: 'Data Criação', 
      accessor: 'created_at',
      cell: (row: Requisicao) => format(parseISO(row.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    },
    { 
      header: 'Ações', 
      accessor: 'actions',
      cell: (row: Requisicao) => (
        <div className="d-flex gap-1">
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => abrirModalEdicao(row)}
          >
            <i className="bi bi-pencil"></i>
          </Button>
          <Button 
            variant="danger" 
            size="sm" 
            onClick={() => confirmarExclusao(row.id)}
          >
            <i className="bi bi-trash"></i>
          </Button>
        </div>
      )
    }
  ];

  // Componente de carregamento
  const loadingComponent = (
    <div className="text-center py-4">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Carregando...</span>
      </div>
      <p className="mt-2">Carregando requisições...</p>
    </div>
  );

  // Componente para quando não há dados
  const emptyComponent = (
    <div className="text-center py-4">
      <i className="bi bi-exclamation-circle text-muted" style={{ fontSize: '2rem' }}></i>
      <p className="mt-2">Nenhuma requisição encontrada</p>
    </div>
  );

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <Button variant="primary" onClick={abrirModalCadastro}>
          <i className="bi bi-plus-circle me-1"></i> Nova Requisição
        </Button>
      </div>

      <FilterAccordion
        title="Filtros"
        onApply={aplicarFiltros}
        onClear={limparFiltros}
        defaultOpen={true}
      >
        <Row className="filter-row">
          <Col md={6} lg={3}>
            <Form.Group className="mb-3">
              <Form.Label>Filial</Form.Label>
              <Form.Control
                type="number"
                placeholder="Número da filial"
                value={filtros.filial || ''}
                onChange={(e) => atualizarFiltro('filial', e.target.value ? parseInt(e.target.value) : '')}
              />
            </Form.Group>
          </Col>
          <Col md={6} lg={3}>
            <Form.Group className="mb-3">
              <Form.Label>Caixa</Form.Label>
              <Form.Control
                type="number"
                placeholder="Número do caixa"
                value={filtros.caixa || ''}
                onChange={(e) => atualizarFiltro('caixa', e.target.value ? parseInt(e.target.value) : '')}
              />
            </Form.Group>
          </Col>
          <Col md={6} lg={3}>
            <Form.Group className="mb-3">
              <Form.Label>Data Início</Form.Label>
              <Form.Control
                type="date"
                value={filtros.data_inicio || ''}
                onChange={(e) => atualizarFiltro('data_inicio', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={6} lg={3}>
            <Form.Group className="mb-3">
              <Form.Label>Data Fim</Form.Label>
              <Form.Control
                type="date"
                value={filtros.data_fim || ''}
                onChange={(e) => atualizarFiltro('data_fim', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={6} lg={3}>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={filtros.status || ''}
                onChange={(e) => atualizarFiltro('status', e.target.value)}
              >
                <option value="">Todos</option>
                <option value="completed">Concluídas</option>
                <option value="pending">Pendentes</option>
                <option value="processing">Processando</option>
                <option value="error">Erro</option>
                <option value="initial">Inicial</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
      </FilterAccordion>

      <Card className="mt-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Lista de Requisições de Sincronização</h5>
        </Card.Header>
        <Card.Body className="p-0 p-md-3">
          <ResponsiveTable 
            columns={columns}
            data={requisicoes}
            isLoading={loading}
            loadingComponent={loadingComponent}
            emptyComponent={emptyComponent}
          />
          
          <TablePagination
            currentPage={paginaAtual}
            totalPages={totalPaginas}
            totalRecords={totalRegistros}
            recordsPerPage={registrosPorPagina}
            onPageChange={setPaginaAtual}
            onRecordsPerPageChange={setRegistrosPorPagina}
          />
        </Card.Body>
      </Card>

      {/* Modal de Cadastro/Edição */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{modoEdicao ? 'Editar Requisição' : 'Nova Requisição'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Filial*</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="Número da filial"
                    value={formData.filial || ''}
                    onChange={(e) => handleFormChange('filial', e.target.value ? parseInt(e.target.value) : '')}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Caixa*</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="Número do caixa"
                    value={formData.caixa || ''}
                    onChange={(e) => handleFormChange('caixa', e.target.value ? parseInt(e.target.value) : '')}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Data de Vendas*</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.datavendas || ''}
                    onChange={(e) => handleFormChange('datavendas', e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Número de Registros</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="Número de registros"
                    value={formData.nregistros || ''}
                    onChange={(e) => handleFormChange('nregistros', e.target.value ? parseInt(e.target.value) : '')}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Sincronização Inicial"
                checked={formData.initial || false}
                onChange={(e) => handleFormChange('initial', e.target.checked)}
              />
            </Form.Group>

            {modoEdicao && (
              <>
                <hr />
                <h6>Status da Requisição</h6>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        label="Concluída"
                        checked={formData.completed || false}
                        onChange={(e) => handleFormChange('completed', e.target.checked)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        label="Processando"
                        checked={formData.processando || false}
                        onChange={(e) => handleFormChange('processando', e.target.checked)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        label="Erro"
                        checked={formData.error || false}
                        onChange={(e) => handleFormChange('error', e.target.checked)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>Mensagem</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Mensagem de erro ou informações adicionais"
                    value={formData.message || ''}
                    onChange={(e) => handleFormChange('message', e.target.value)}
                  />
                </Form.Group>
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={salvarRequisicao}>
            {modoEdicao ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        show={showConfirmDelete}
        onHide={() => setShowConfirmDelete(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirmar Exclusão</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Tem certeza que deseja excluir esta requisição de sincronização? Esta ação não pode ser desfeita.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmDelete(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={excluirRequisicao}>
            Excluir
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default RequisicoesSync; 