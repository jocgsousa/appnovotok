import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Form, Button, Modal, Spinner, Alert } from 'react-bootstrap';
import { listarVendasDiarias, atualizarVendaDiaria, deletarVendaDiaria, VendaDiaria } from '../services/vendasService';
import { listarVendedores } from '../services/funcionariosService';

interface Vendedor {
  id: number;
  nome: string;
  rca: string;
}

const VendasDiarias: React.FC = () => {
  // Estados
  const [vendasDiarias, setVendasDiarias] = useState<VendaDiaria[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendaSelecionada, setVendaSelecionada] = useState<VendaDiaria | null>(null);
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

  // Carregar vendas diárias com base nos filtros
  const carregarVendasDiarias = async () => {
    if (!dataInicio || !dataFim) {
      setError('Selecione um período válido.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await listarVendasDiarias({
        data_inicio: dataInicio,
        data_fim: dataFim,
        codusur: codusurFiltro
      });
      if (response.success && response.diasVendas) {
        console.log('Dados recebidos da API:', response.diasVendas);
        setVendasDiarias(response.diasVendas.map((venda: any) => {
          // Converter data do formato DD/MM/YYYY para YYYY-MM-DD para o formulário
          const partesData = venda.data ? venda.data.split('/') : ['', '', ''];
          
          // Garantir que todos os valores numéricos sejam números válidos
          return {
            ...venda,
            id: venda.id ? parseInt(venda.id) : undefined,
            data: partesData.length === 3 ? `${partesData[2]}-${partesData[1]}-${partesData[0]}` : '',
            media_itens: parseFloat(venda.media_itens || 0),
            ticket_medio: parseFloat(venda.ticket_medio || 0),
            vlcustofin: parseFloat(venda.vlcustofin || 0),
            qtcliente: parseInt(venda.qtcliente || 0),
            qtd_pedidos: parseInt(venda.qtd_pedidos || 0),
            via: parseFloat(venda.via || 0),
            vlvendadodia: parseFloat(venda.vlvendadodia || 0),
            vldevolucao: parseFloat(venda.vldevolucao || 0),
            valor_total: parseFloat(venda.valor_total || 0)
          };
        }));
      } else {
        setVendasDiarias([]);
        setError(response.message || 'Nenhuma venda encontrada para o período selecionado.');
      }
    } catch (error) {
      console.error('Erro ao carregar vendas diárias:', error);
      setError('Erro ao carregar vendas diárias. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal para editar venda
  const handleEditarVenda = (venda: VendaDiaria) => {
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
      const response = await atualizarVendaDiaria(vendaSelecionada);
      if (response.success) {
        setSuccess('Venda atualizada com sucesso!');
        setShowModal(false);
        // Recarregar dados
        carregarVendasDiarias();
      } else {
        setError(response.message || 'Erro ao atualizar venda.');
      }
    } catch (error) {
      console.error('Erro ao atualizar venda:', error);
      setError('Erro ao atualizar venda. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Excluir venda
  const handleExcluirVenda = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta venda?')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await deletarVendaDiaria(id);
      if (response.success) {
        setSuccess('Venda excluída com sucesso!');
        // Recarregar dados
        carregarVendasDiarias();
      } else {
        setError(response.message || 'Erro ao excluir venda.');
      }
    } catch (error) {
      console.error('Erro ao excluir venda:', error);
      setError('Erro ao excluir venda. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Atualizar campo da venda selecionada
  const handleChangeVenda = (campo: keyof VendaDiaria, valor: any) => {
    if (!vendaSelecionada) return;

    // Garantir que valores numéricos sejam tratados corretamente
    let valorProcessado = valor;
    
    // Converter para número se o campo for numérico
    if (['qtd_pedidos', 'qtcliente'].includes(campo)) {
      valorProcessado = valor === '' ? 0 : parseInt(valor);
      if (isNaN(valorProcessado)) valorProcessado = 0;
    } else if (['media_itens', 'ticket_medio', 'vlcustofin', 'via', 'vlvendadodia', 'vldevolucao', 'valor_total'].includes(campo)) {
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
      <h2 className="mb-4">Gerenciamento de Vendas Diárias</h2>
      
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
            onClick={carregarVendasDiarias}
            disabled={loading}
          >
            {loading ? <Spinner animation="border" size="sm" /> : 'Buscar'}
          </Button>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>Vendas Diárias</Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center p-5">
              <Spinner animation="border" />
              <p className="mt-2">Carregando dados...</p>
            </div>
          ) : vendasDiarias.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Vendedor</th>
                    <th>Pedidos</th>
                    <th>Média Itens</th>
                    <th>Ticket Médio</th>
                    <th>Valor Vendas</th>
                    <th>Devoluções</th>
                    <th>Valor Total</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasDiarias.map((venda) => (
                    <tr key={venda.id}>
                      <td>{formatarData(venda.data)}</td>
                      <td>{venda.nome} ({venda.codusur})</td>
                      <td>{venda.qtd_pedidos}</td>
                      <td>{typeof venda.media_itens === 'number' ? venda.media_itens.toFixed(2) : '0.00'}</td>
                      <td>{formatarValor(venda.ticket_medio || 0)}</td>
                      <td>{formatarValor(venda.vlvendadodia || 0)}</td>
                      <td>{formatarValor(venda.vldevolucao || 0)}</td>
                      <td>{formatarValor(venda.valor_total || 0)}</td>
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
                          onClick={() => venda.id && handleExcluirVenda(venda.id)}
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <p className="text-center p-5">Nenhuma venda encontrada para o período selecionado.</p>
          )}
        </Card.Body>
      </Card>

      {/* Modal de Edição */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Editar Venda Diária</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {vendaSelecionada && (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data</Form.Label>
                    <Form.Control
                      type="date"
                      value={vendaSelecionada.data}
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
                    <Form.Label>Quantidade de Pedidos</Form.Label>
                    <Form.Control
                      type="number"
                      value={vendaSelecionada.qtd_pedidos}
                      onChange={(e) => handleChangeVenda('qtd_pedidos', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Média de Itens</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.media_itens}
                      onChange={(e) => handleChangeVenda('media_itens', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Ticket Médio</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.ticket_medio}
                      onChange={(e) => handleChangeVenda('ticket_medio', e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Valor Vendas</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.vlvendadodia}
                      onChange={(e) => handleChangeVenda('vlvendadodia', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Devoluções</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.vldevolucao}
                      onChange={(e) => handleChangeVenda('vldevolucao', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Valor Total</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={vendaSelecionada.valor_total}
                      onChange={(e) => handleChangeVenda('valor_total', e.target.value)}
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
                      value={vendaSelecionada.vlcustofin}
                      onChange={(e) => handleChangeVenda('vlcustofin', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Quantidade de Clientes</Form.Label>
                    <Form.Control
                      type="number"
                      value={vendaSelecionada.qtcliente}
                      onChange={(e) => handleChangeVenda('qtcliente', e.target.value)}
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

export default VendasDiarias;