import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Form, Button, Modal } from 'react-bootstrap';
import { listarPedidos, Pedido, PedidoFiltros } from '../services/vendasService';
import ResponsiveTable from './ResponsiveTable';
import FilterAccordion from './FilterAccordion';
import TablePagination from './TablePagination';
import { format, parseISO, subHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PedidosVendasProps {
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
}

const PedidosVendas: React.FC<PedidosVendasProps> = ({ setError, setSuccess }) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Estados para dados e paginação
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [totalPaginas, setTotalPaginas] = useState<number>(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState<number>(10);
  const [totalRegistros, setTotalRegistros] = useState<number>(0);
  
  // Estado para filtros
  const [filtros, setFiltros] = useState<PedidoFiltros>({
    filial: undefined,
    caixa: undefined,
    data_inicio: formatDateInput(firstDay),
    data_fim: formatDateInput(lastDay),
    pedido: undefined,
    vendedor: undefined,
    status_cancelamento: 'todos'
  });

  // Estado para modal de detalhes
  const [showDetalhes, setShowDetalhes] = useState<boolean>(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);

  // Carregar dados iniciais
  useEffect(() => {
    carregarPedidos();
  }, [paginaAtual, registrosPorPagina]);

  // Função para carregar pedidos
  const carregarPedidos = async () => {
    try {
      setLoading(true);
      const response = await listarPedidos({
        ...filtros,
        page: paginaAtual,
        per_page: registrosPorPagina
      });
      
      setPedidos(response.data);
      setTotalRegistros(response.pagination.total_records);
      setTotalPaginas(response.pagination.total_pages);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      setError('Não foi possível carregar os pedidos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Função para aplicar filtros
  const aplicarFiltros = () => {
    setPaginaAtual(1); // Voltar para a primeira página ao aplicar filtros
    carregarPedidos();
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltros({
      filial: undefined,
      caixa: undefined,
      data_inicio: formatDateInput(firstDay),
      data_fim: formatDateInput(lastDay),
      pedido: undefined,
      status_cancelamento: 'todos'
    });
    setPaginaAtual(1);
    carregarPedidos();
  };

  // Função para atualizar filtros
  const atualizarFiltro = (campo: keyof PedidoFiltros, valor: any) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor === '' ? undefined : valor
    }));
  };

  // Função para exibir detalhes do pedido
  const verDetalhesPedido = (pedido: Pedido) => {
    setPedidoSelecionado(pedido);
    setShowDetalhes(true);
  };

  // Função para obter status de cancelamento
  const obterStatusCancelamento = (pedido: Pedido) => {
    const temItensCancelados = pedido.cancelados && pedido.cancelados.length > 0;
    const temItensAtivos = pedido.itens && pedido.itens.length > 0;
    const totalCancelados = Number(pedido.total_cancelados) || 0;
    
    if (!temItensCancelados && totalCancelados === 0) {
      return { status: 'Sem cancelamentos', variant: 'success', icon: 'bi-check-circle' };
    } else if (temItensCancelados && !temItensAtivos) {
      // Pedido completamente cancelado: tem itens cancelados mas não tem itens ativos
      return { status: 'Cancelado', variant: 'danger', icon: 'bi-x-circle' };
    } else if (temItensCancelados || totalCancelados > 0) {
      return { status: 'Parcialmente cancelado', variant: 'warning', icon: 'bi-exclamation-triangle' };
    }
    return { status: 'Normal', variant: 'success', icon: 'bi-check-circle' };
  };

  // Função para somar quantidades de itens vendidos e cancelados
  const obterTotalItens = (pedido: Pedido) => {
    const somaVendidos = (pedido.itens || []).reduce((acc, item) => acc + Number(item.QT || 0), 0);
    const somaCancelados = (pedido.cancelados || []).reduce((acc, item) => acc + Number(item.QT || 0), 0);
    return somaVendidos + somaCancelados;
  };

  // Quantidade total de itens vendidos
  const obterQuantidadeVendidos = (pedido: Pedido) => {
    return (pedido.itens || []).reduce((acc, item) => acc + Number(item.QT || 0), 0);
  };

  // Valor total cancelado (R$) com fallback calculado
  const obterValorTotalCancelado = (pedido: Pedido) => {
    const valorInformado = Number(pedido.total_cancelados);
    if (!isNaN(valorInformado) && valorInformado > 0) {
      return valorInformado;
    }
    const somaCanceladosValor = (pedido.cancelados || []).reduce(
      (acc, item) => acc + Number(item.QT || 0) * Number(item.PVENDA || 0),
      0
    );
    return somaCanceladosValor;
  };

  // Quantidade total de itens cancelados
  const obterQuantidadeCancelados = (pedido: Pedido) => {
    return (pedido.cancelados || []).reduce((acc, item) => acc + Number(item.QT || 0), 0);
  };

  // Definir colunas da tabela
  const columns = [
    { header: 'Pedido', accessor: 'pedido' },
    { header: 'Filial', accessor: 'filial' },
    { header: 'Caixa', accessor: 'caixa' },
    { 
      header: 'Data', 
      accessor: 'data_registro_produto',
      cell: (row: Pedido) => row.data_registro_produto ? format(subHours(parseISO(row.data_registro_produto), 3), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'
    },
    { 
      header: 'Total Vendido', 
      accessor: 'total_itens',
       cell: (row: Pedido) => `R$ ${Number(row.total_itens).toFixed(2)}`
    },
    { 
      header: 'Total Cancelado', 
      accessor: 'total_cancelados',
      cell: (row: Pedido) => `R$ ${obterValorTotalCancelado(row).toFixed(2)}`
    },
    { 
      header: 'Itens Vendidos', 
      accessor: 'total_itens_vendidos',
      cell: (row: Pedido) => obterQuantidadeVendidos(row)
    },
    { 
      header: 'Itens Cancelados', 
      accessor: 'total_itens_cancelados',
      cell: (row: Pedido) => obterQuantidadeCancelados(row)
    },
    { 
      header: 'Total Itens', 
      accessor: 'total_itens_quantidade',
      cell: (row: Pedido) => obterTotalItens(row)
    },
    {
      header: 'Status',
      accessor: 'status_cancelamento',
      cell: (row: Pedido) => {
        const statusInfo = obterStatusCancelamento(row);
        return (
          <span className={`badge bg-${statusInfo.variant}`}>
            <i className={`bi ${statusInfo.icon} me-1`}></i>
            {statusInfo.status}
          </span>
        );
      }
    },
    { 
      header: 'Ações', 
      accessor: 'actions',
      cell: (row: Pedido) => (
        <Button 
          variant="info" 
          size="sm" 
          onClick={() => verDetalhesPedido(row)}
        >
          <i className="bi bi-eye"></i> Detalhes
        </Button>
      )
    }
  ];

  // Componente de carregamento
  const loadingComponent = (
    <div className="text-center py-4">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Carregando...</span>
      </div>
      <p className="mt-2">Carregando pedidos...</p>
    </div>
  );

  // Componente para quando não há dados
  const emptyComponent = (
    <div className="text-center py-4">
      <i className="bi bi-exclamation-circle text-muted" style={{ fontSize: '2rem' }}></i>
      <p className="mt-2">Nenhum pedido encontrado</p>
    </div>
  );

  return (
    <>
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
              <Form.Label>Número do Pedido</Form.Label>
              <Form.Control
                type="number"
                placeholder="Número do pedido"
                value={filtros.pedido || ''}
                onChange={(e) => atualizarFiltro('pedido', e.target.value ? parseInt(e.target.value) : '')}
              />
            </Form.Group>
          </Col>
          <Col md={6} lg={3}>
            <Form.Group className="mb-3">
              <Form.Label>Vendedor (Código)</Form.Label>
              <Form.Control
                type="number"
                placeholder="Código do vendedor"
                value={filtros.vendedor || ''}
                onChange={(e) => atualizarFiltro('vendedor', e.target.value ? parseInt(e.target.value) : '')}
              />
            </Form.Group>
          </Col>
          <Col md={6} lg={3}>
            <Form.Group className="mb-3">
              <Form.Label>Status de Cancelamento</Form.Label>
              <Form.Select
                value={filtros.status_cancelamento || 'todos'}
                onChange={(e) => atualizarFiltro('status_cancelamento', e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="sem_cancelados">Sem Cancelamentos</option>
                <option value="com_cancelados">Com Itens Cancelados</option>
                <option value="apenas_cancelados">Apenas Cancelados</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
      </FilterAccordion>

      <Card className="mt-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Lista de Pedidos</h5>
        </Card.Header>
        <Card.Body className="p-0 p-md-3">
          <ResponsiveTable 
            columns={columns}
            data={pedidos}
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

      {/* Modal de Detalhes do Pedido */}
      <Modal
        show={showDetalhes}
        onHide={() => setShowDetalhes(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Detalhes do Pedido #{pedidoSelecionado?.pedido}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pedidoSelecionado && (
            <div>
              <Row className="mb-3">
                <Col md={4}>
                  <strong>Filial:</strong> {pedidoSelecionado.filial}
                </Col>
                <Col md={4}>
                  <strong>Caixa:</strong> {pedidoSelecionado.caixa}
                </Col>
                <Col md={4}>
                  <strong>Data:</strong> { pedidoSelecionado.data_registro_produto ? format(subHours(parseISO(pedidoSelecionado.data_registro_produto), 3), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A' }
                </Col>
              </Row>
              <Row className="mb-3">
                <Col md={4}>
                  <strong>Funcionário:</strong> {pedidoSelecionado.funccx || 'N/A'}
                </Col>
                <Col md={4}>
                  <strong>Forma de Pagamento:</strong> {pedidoSelecionado.codcob || 'N/A'}
                </Col>
                <Col md={4}>
                  <strong>Total:</strong> R$ {Number(pedidoSelecionado.total_itens).toFixed(2)}
                </Col>
              </Row>

              <h5 className="mt-4">Itens do Pedido</h5>
              <table className="table table-striped table-sm">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th>Quantidade</th>
                    <th>Valor Unitário</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidoSelecionado.itens.map((item, index) => (
                    <tr key={index}>
                      <td>{item.CODPROD}</td>
                      <td>{item.DESCRICAOPAF}</td>
                      <td>{item.QT}</td>
                      <td>R$ {parseFloat(item.PVENDA.toString()).toFixed(2)}</td>
                      <td>R$ {(item.QT * item.PVENDA).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {pedidoSelecionado.cancelados.length > 0 && (
                <>
                  <h5 className="mt-4">Itens Cancelados</h5>
                  <table className="table table-striped table-sm">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>Quantidade</th>
                        <th>Valor Unitário</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidoSelecionado.cancelados.map((item, index) => (
                        <tr key={index}>
                          <td>{item.CODPROD}</td>
                          <td>{item.DESCRICAOPAF}</td>
                          <td>{item.QT}</td>
                          <td>R$ {parseFloat(item.PVENDA.toString()).toFixed(2)}</td>
                          <td>R$ {(item.QT * item.PVENDA).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetalhes(false)}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default PedidosVendas;