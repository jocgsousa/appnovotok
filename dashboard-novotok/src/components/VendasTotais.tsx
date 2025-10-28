import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Form, Button, Modal, Spinner, Alert } from 'react-bootstrap';
import { listarVendasTotais, atualizarVendaTotal, deletarVendaTotal, calcularTotaisVendas, VendaTotal } from '../services/vendasService';
import { listarVendedores } from '../services/vendedorService';

interface Vendedor {
  id: number;
  nome: string;
  rca: string;
}

const VendasTotais: React.FC = () => {
  // Estados
  const [vendasTotais, setVendasTotais] = useState<VendaTotal[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendaSelecionada, setVendaSelecionada] = useState<VendaTotal | null>(null);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [codusurFiltro, setCodusurFiltro] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Carregar vendedores ao iniciar
  useEffect(() => {
    const carregarVendedores = async () => {
      try {
        const response = await listarVendedores();
        setVendedores(response);
      } catch (error) {
        console.error('Erro ao carregar vendedores:', error);
        setError('Erro ao carregar lista de vendedores.');
      }
    };

    carregarVendedores();

    // Definir datas padrão (mês atual)
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    setDataInicio(primeiroDia.toISOString().split('T')[0]);
    setDataFim(ultimoDia.toISOString().split('T')[0]);
  }, []);

  // Carregar vendas totais com base nos filtros
  const carregarVendasTotais = async () => {
    if (!dataInicio || !dataFim) {
      setError('Selecione um período válido.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await listarVendasTotais({
        data_inicio: dataInicio,
        data_fim: dataFim,
        codusur: codusurFiltro
      });
      if (response.success && response.vendas_totais) {
        console.log('Dados recebidos da API:', response.vendas_totais);
        setVendasTotais(response.vendas_totais.map((venda: any) => {
          // Converter datas do formato DD/MM/YYYY para YYYY-MM-DD para o formulário
          const partesDataInicio = venda.data_inicio ? venda.data_inicio.split('/') : ['', '', ''];
          const partesDataFim = venda.data_fim ? venda.data_fim.split('/') : ['', '', ''];
          
          // Garantir que todos os valores numéricos sejam números válidos
          return {
            ...venda,
            id: venda.id ? parseInt(venda.id) : undefined,
            data_inicio: partesDataInicio.length === 3 ? `${partesDataInicio[2]}-${partesDataInicio[1]}-${partesDataInicio[0]}` : '',
            data_fim: partesDataFim.length === 3 ? `${partesDataFim[2]}-${partesDataFim[1]}-${partesDataFim[0]}` : '',
            codusur: venda.codusur || '',
            total_qtd_pedidos: parseInt(venda.total_qtd_pedidos || 0),
            total_media_itens: parseFloat(venda.total_media_itens || 0),
            total_ticket_medio: parseFloat(venda.total_ticket_medio || 0),
            total_vlcustofin: parseFloat(venda.total_vlcustofin || 0),
            total_qtcliente: parseInt(venda.total_qtcliente || 0),
            total_via: parseFloat(venda.total_via || 0),
            total_vlvendadodia: parseFloat(venda.total_vlvendadodia || 0),
            total_vldevolucao: parseFloat(venda.total_vldevolucao || 0),
            total_valor: parseFloat(venda.total_valor || 0)
          };
        }));
      } else {
        setVendasTotais([]);
        setError(response.message || 'Nenhuma venda total encontrada para o período selecionado.');
      }
    } catch (error) {
      console.error('Erro ao carregar vendas totais:', error);
      setError('Erro ao carregar vendas totais. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal para editar venda
  const handleEditarVenda = (venda: VendaTotal) => {
    setVendaSelecionada(venda);
    setShowModal(true);
  };

  // Salvar alterações na venda
  const handleSalvarVenda = async () => {
    if (!vendaSelecionada) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await atualizarVendaTotal(vendaSelecionada);
      if (response.success) {
        setSuccess('Venda total atualizada com sucesso!');
        setShowModal(false);
        // Recarregar dados
        carregarVendasTotais();
      } else {
        setError(response.message || 'Erro ao atualizar venda total.');
      }
    } catch (error) {
      console.error('Erro ao atualizar venda total:', error);
      setError('Erro ao atualizar venda total. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Excluir venda
  const handleExcluirVenda = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta venda total?')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await deletarVendaTotal(id);
      if (response.success) {
        setSuccess('Venda total excluída com sucesso!');
        // Recarregar dados
        carregarVendasTotais();
      } else {
        setError(response.message || 'Erro ao excluir venda total.');
      }
    } catch (error) {
      console.error('Erro ao excluir venda total:', error);
      setError('Erro ao excluir venda total. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Recalcular totais
  const handleRecalcularTotais = async (codusur: string, dataInicio: string, dataFim: string) => {
    if (!window.confirm('Deseja recalcular os totais com base nas vendas diárias?')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await calcularTotaisVendas(dataInicio, dataFim, codusur);
      if (response.success) {
        setSuccess('Totais recalculados com sucesso!');
        // Recarregar dados
        carregarVendasTotais();
      } else {
        setError(response.message || 'Erro ao recalcular totais.');
      }
    } catch (error) {
      console.error('Erro ao recalcular totais:', error);
      setError('Erro ao recalcular totais. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Atualizar campo da venda selecionada
  const handleChangeVenda = (campo: keyof VendaTotal, valor: any) => {
    if (!vendaSelecionada) return;

    // Garantir que valores numéricos sejam tratados corretamente
    let valorProcessado = valor;
    
    // Converter para número se o campo for numérico
    if (['total_qtd_pedidos', 'total_qtcliente'].includes(campo)) {
      valorProcessado = valor === '' ? 0 : parseInt(valor);
      if (isNaN(valorProcessado)) valorProcessado = 0;
    } else if (['total_media_itens', 'total_ticket_medio', 'total_vlcustofin', 'total_via', 
                'total_vlvendadodia', 'total_vldevolucao', 'total_valor'].includes(campo)) {
      valorProcessado = valor === '' ? 0 : parseFloat(valor);
      if (isNaN(valorProcessado)) valorProcessado = 0;
    }

    setVendaSelecionada({
      ...vendaSelecionada,
      [campo]: valorProcessado
    });
  };

  // Formatar valor para exibição
  const formatarValor = (valor: number | undefined | null) => {
    if (valor === undefined || valor === null) {
      valor = 0;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Formatar data para exibição (DD/MM/YYYY)
  const formatarData = (dataStr: string | undefined | null) => {
    if (!dataStr) return '';
    
    // Se já estiver no formato DD/MM/YYYY, retorna como está
    if (dataStr.includes('/')) return dataStr;
    
    try {
      // Converter de YYYY-MM-DD para DD/MM/YYYY
      const [ano, mes, dia] = dataStr.split('-');
      if (!ano || !mes || !dia) return dataStr;
      return `${dia}/${mes}/${ano}`;
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return dataStr || '';
    }
  };

  return (
    <Container fluid>
      <h2 className="mb-4">Gerenciamento de Vendas Totais</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      
      <Card className="mb-4">
        <Card.Header>Filtros</Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Data Início</Form.Label>
                <Form.Control
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Data Fim</Form.Label>
                <Form.Control
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Vendedor</Form.Label>
                <Form.Select
                  value={codusurFiltro}
                  onChange={(e) => setCodusurFiltro(e.target.value)}
                >
                  <option value="">Todos os vendedores</option>
                  {vendedores.map((vendedor) => (
                    <option key={vendedor.id} value={vendedor.rca}>
                      {vendedor.nome} ({vendedor.rca})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Button 
            variant="primary" 
            onClick={carregarVendasTotais}
            disabled={loading}
            className="me-2"
          >
            {loading ? <Spinner animation="border" size="sm" /> : 'Buscar'}
          </Button>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>Vendas Totais</Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center p-5">
              <Spinner animation="border" />
              <p className="mt-2">Carregando dados...</p>
            </div>
          ) : vendasTotais.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Vendedor</th>
                    <th>Total Pedidos</th>
                    <th>Média Itens</th>
                    <th>Ticket Médio</th>
                    <th>Total Vendas</th>
                    <th>Total Devoluções</th>
                    <th>Valor Total</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasTotais.map((venda) => (
                    <tr key={venda.id}>
                      <td>{formatarData(venda.data_inicio)} a {formatarData(venda.data_fim)}</td>
                      <td>{venda.nome} ({venda.codusur})</td>
                      <td>{venda.total_qtd_pedidos}</td>
                      <td>{typeof venda.total_media_itens === 'number' ? venda.total_media_itens.toFixed(2) : '0.00'}</td>
                      <td>{formatarValor(venda.total_ticket_medio || 0)}</td>
                      <td>{formatarValor(venda.total_vlvendadodia || 0)}</td>
                      <td>{formatarValor(venda.total_vldevolucao || 0)}</td>
                      <td>{formatarValor(venda.total_valor || 0)}</td>
                      <td>
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="me-2"
                          onClick={() => handleEditarVenda(venda)}
                        >
                          <i className="bi bi-pencil"></i>
                        </Button>
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          className="me-2"
                          onClick={() => venda.id && handleExcluirVenda(venda.id)}
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                        <Button 
                          variant="outline-success" 
                          size="sm"
                          onClick={() => handleRecalcularTotais(venda.codusur, venda.data_inicio, venda.data_fim)}
                        >
                          <i className="bi bi-arrow-repeat"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <p className="text-center p-5">Nenhuma venda total encontrada para o período selecionado.</p>
          )}
        </Card.Body>
      </Card>

      {/* Modal de Edição */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Editar Venda Total</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {vendaSelecionada && (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Período</Form.Label>
                    <Form.Control
                      type="text"
                      value={`${formatarData(vendaSelecionada.data_inicio)} a ${formatarData(vendaSelecionada.data_fim)}`}
                      disabled
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Vendedor</Form.Label>
                    <Form.Control
                      type="text"
                      value={`${vendaSelecionada.nome} (${vendaSelecionada.codusur})`}
                      disabled
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Total de Pedidos</Form.Label>
                    <Form.Control
                      type="number"
                      value={vendaSelecionada.total_qtd_pedidos}
                      onChange={(e) => handleChangeVenda('total_qtd_pedidos', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Média de Itens</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.total_media_itens}
                      onChange={(e) => handleChangeVenda('total_media_itens', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Ticket Médio</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.total_ticket_medio}
                      onChange={(e) => handleChangeVenda('total_ticket_medio', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Total Vendas</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.total_vlvendadodia}
                      onChange={(e) => handleChangeVenda('total_vlvendadodia', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Total Devoluções</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.total_vldevolucao}
                      onChange={(e) => handleChangeVenda('total_vldevolucao', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Valor Total</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.total_valor}
                      onChange={(e) => handleChangeVenda('total_valor', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Custo Financeiro</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.total_vlcustofin}
                      onChange={(e) => handleChangeVenda('total_vlcustofin', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Total Clientes</Form.Label>
                    <Form.Control
                      type="number"
                      value={vendaSelecionada.total_qtcliente}
                      onChange={(e) => handleChangeVenda('total_qtcliente', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSalvarVenda}
            disabled={loading}
          >
            {loading ? <Spinner animation="border" size="sm" /> : 'Salvar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default VendasTotais; 