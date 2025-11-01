import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Form, Button, Modal, Spinner, Alert, Pagination, Badge, Tabs, Tab } from 'react-bootstrap';
import { 
  listarClientes, 
  obterCliente, 
  cadastrarCliente, 
  atualizarCliente, 
  deletarCliente,
  listarRamosAtividade,
  listarCidades,
  Cliente, 
  ClienteResponse,
  ClienteFiltros,
  obterEstatisticasClientes,
  exportarRelatorioClientes,
  EstatisticasClientes,
  RelatorioFiltros
} from '../services/clienteService';
import { listarFiliais } from '../services/filiaisService';
import { listarVendedores } from '../services/funcionariosService';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

// Registrar componentes do Chart.js
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Filial {
  id: number;
  codigo: string;
  nome_fantasia: string;
}

interface Vendedor {
  id: number;
  rca: string;
  nome: string;
}

interface Atividade {
  id: number;
  codativi: string;
  ramo: string;
}

interface Cidade {
  id: number;
  codcidade: string;
  nomecidade: string;
  uf: string;
}

const Clientes: React.FC = () => {
  // Estados existentes
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [totalPaginas, setTotalPaginas] = useState<number>(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState<number>(10);
  const [totalRegistros, setTotalRegistros] = useState<number>(0);
  
  // Estados para filtros
  const [busca, setBusca] = useState<string>('');
  const [rcaFiltro, setRcaFiltro] = useState<string>('');
  const [filialFiltro, setFilialFiltro] = useState<number | ''>('');
  const [novoFiltro, setNovoFiltro] = useState<boolean | null>(null);
  const [atualizadoFiltro, setAtualizadoFiltro] = useState<boolean | null>(null);
  const [recusadoFiltro, setRecusadoFiltro] = useState<boolean | null>(null);
  const [dataInicioFiltro, setDataInicioFiltro] = useState<string>('');
  const [dataFimFiltro, setDataFimFiltro] = useState<string>('');

  const [showModal, setShowModal] = useState<boolean>(false);
  const [modoEdicao, setModoEdicao] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Estados para modal de mensagem de recusa
  const [showModalRecusa, setShowModalRecusa] = useState<boolean>(false);
  const [mensagemRecusa, setMensagemRecusa] = useState<string>('');
  const [clienteRecusado, setClienteRecusado] = useState<Cliente | null>(null);

  // Novos estados para a aba de relatórios
  const [tabAtiva, setTabAtiva] = useState<string>('lista');
  const [estatisticas, setEstatisticas] = useState<EstatisticasClientes | null>(null);
  const [filtrosRelatorio, setFiltrosRelatorio] = useState<RelatorioFiltros>({
    data_inicio: '',
    data_fim: '',
    filial: undefined,
    rca: '',
    agrupar_por: 'mes'
  });
  const [loadingRelatorio, setLoadingRelatorio] = useState<boolean>(false);
  const [errorRelatorio, setErrorRelatorio] = useState<string>('');

  // Carregar dados iniciais
  useEffect(() => {
    carregarClientes();
    carregarFiliais();
    carregarVendedores();
    carregarAtividades();
    carregarCidades();
  }, []);

  // Carregar clientes quando os filtros ou paginação mudam
  useEffect(() => {
    carregarClientes();
  }, [paginaAtual, registrosPorPagina, rcaFiltro, filialFiltro, novoFiltro, atualizadoFiltro, recusadoFiltro, dataInicioFiltro, dataFimFiltro]);

  // Carregar estatísticas quando a aba de relatórios é selecionada
  useEffect(() => {
    if (tabAtiva === 'relatorios') {
      carregarEstatisticas();
    }
  }, [tabAtiva]);

  // Carregar lista de clientes
  const carregarClientes = async () => {
    setLoading(true);
    setError('');

    try {
      const filtros: ClienteFiltros = {
        busca: busca || undefined,
        rca: rcaFiltro || undefined,
        filial: filialFiltro || undefined,
        limit: registrosPorPagina,
        offset: (paginaAtual - 1) * registrosPorPagina,
        novo: novoFiltro === true ? true : undefined,
        atualizado: atualizadoFiltro === true ? true : undefined,
        recused: recusadoFiltro === true ? true : undefined,
        data_inicio: dataInicioFiltro || undefined,
        data_fim: dataFimFiltro || undefined
      };

      const response = await listarClientes(filtros);
      
      if (response.success) {
        console.log('Clientes recebidos da API:', response.clientes);
        setClientes(response.clientes || []);
        setTotalRegistros(response.total || 0);
        setTotalPaginas(Math.ceil((response.total || 0) / registrosPorPagina));
      } else {
        setError(response.message || 'Erro ao carregar clientes.');
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setError('Erro ao carregar clientes. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar filiais
  const carregarFiliais = async () => {
    try {
      const response = await listarFiliais();
      if (response && response.filiais) {
        setFiliais(response.filiais);
      }
    } catch (error) {
      console.error('Erro ao carregar filiais:', error);
    }
  };

  // Carregar vendedores
  const carregarVendedores = async () => {
    try {
      const response = await listarVendedores();
      setVendedores(response);
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error);
    }
  };

  // Carregar atividades
  const carregarAtividades = async () => {
    try {
      const response = await listarRamosAtividade();
      if (response && response.success) {
        setAtividades(response.atividades);
      }
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    }
  };

  // Carregar cidades
  const carregarCidades = async () => {
    try {
      const response = await listarCidades();
      if (response && response.success) {
        setCidades(response.cidades);
      }
    } catch (error) {
      console.error('Erro ao carregar cidades:', error);
    }
  };

  // Carregar estatísticas para relatórios
  const carregarEstatisticas = async () => {
    setLoadingRelatorio(true);
    setErrorRelatorio('');

    try {
      const response = await obterEstatisticasClientes(filtrosRelatorio);
      
      if (response.success && response.estatisticas) {
        setEstatisticas(response.estatisticas);
      } else {
        setErrorRelatorio(response.message || 'Erro ao carregar estatísticas.');
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      setErrorRelatorio('Erro ao carregar estatísticas. Verifique sua conexão e tente novamente.');
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // Exportar relatório para Excel
  const handleExportarRelatorio = async () => {
    setLoadingRelatorio(true);
    setErrorRelatorio('');

    try {
      const blob = await exportarRelatorioClientes(filtrosRelatorio);
      
      // Verificar se o blob é válido
      if (!(blob instanceof Blob) || blob.size < 100) {
        throw new Error('O arquivo gerado parece estar corrompido ou vazio');
      }
      
      // Criar URL para download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dataAtual = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `relatorio_clientes_${dataAtual}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      // Limpar recursos
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      setErrorRelatorio('Erro ao exportar relatório. Verifique sua conexão e tente novamente.');
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // Aplicar filtros de relatório
  const aplicarFiltrosRelatorio = () => {
    carregarEstatisticas();
  };

  // Limpar filtros de relatório
  const limparFiltrosRelatorio = () => {
    setFiltrosRelatorio({
      data_inicio: '',
      data_fim: '',
      filial: undefined,
      rca: '',
      agrupar_por: 'mes'
    });
    
    // Recarregar estatísticas após limpar filtros
    setTimeout(() => carregarEstatisticas(), 0);
  };

  // Atualizar filtros de relatório
  const handleChangeFiltroRelatorio = (campo: keyof RelatorioFiltros, valor: any) => {
    setFiltrosRelatorio({
      ...filtrosRelatorio,
      [campo]: valor
    });
  };

  // Abrir modal de mensagem de recusa
  const handleVerMensagemRecusa = (cliente: Cliente) => {
    setClienteRecusado(cliente);
    setMensagemRecusa(cliente.recused_msg || 'Nenhuma mensagem de recusa disponível.');
    setShowModalRecusa(true);
  };

  // Abrir modal para adicionar novo cliente
  const handleNovoCliente = () => {
    setClienteSelecionado({
      corporate: false,
      name: '',
      person_identification_number: '',
      commercial_address: '',
      commercial_address_number: '',
      business_district: '',
      billingPhone: '',
      email: '',
      business_city: ''
    });
    setModoEdicao(false);
    setShowModal(true);
  };

  // Abrir modal para editar cliente
  const handleEditarCliente = async (id: number) => {
    setLoading(true);
    setError('');

    try {
      const response = await obterCliente(id);
      
      if (response.success && response.cliente) {
        // Garantir que corporate é tratado como booleano
        const cliente = {
          ...response.cliente,
          corporate: Boolean(response.cliente.corporate),
          registered: Boolean(response.cliente.registered),
          authorized: Boolean(response.cliente.authorized),
          recused: Boolean(response.cliente.recused)
        };
        setClienteSelecionado(cliente);
        setModoEdicao(true);
        setShowModal(true);
      } else {
        setError(response.message || 'Erro ao obter dados do cliente.');
      }
    } catch (error) {
      console.error('Erro ao obter cliente:', error);
      setError('Erro ao obter dados do cliente. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Excluir cliente
  const handleExcluirCliente = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await deletarCliente(id);
      
      if (response.success) {
        setSuccess('Cliente excluído com sucesso!');
        carregarClientes();
      } else {
        setError(response.message || 'Erro ao excluir cliente.');
      }
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      setError('Erro ao excluir cliente. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Salvar cliente (novo ou edição)
  const handleSalvarCliente = async () => {
    if (!clienteSelecionado) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let response;
      
      // Preparar dados para envio, garantindo que o CPF/CNPJ contenha apenas números
      const clienteParaEnvio = {
        ...clienteSelecionado,
        person_identification_number: clienteSelecionado.person_identification_number.replace(/[^\d]/g, '')
      };
      
      console.log('Dados do cliente a serem enviados para atualização:', clienteParaEnvio);
      
      if (modoEdicao) {
        response = await atualizarCliente(clienteParaEnvio);
      } else {
        response = await cadastrarCliente(clienteParaEnvio);
      }
      
      if (response.success) {
        setSuccess(`Cliente ${modoEdicao ? 'atualizado' : 'cadastrado'} com sucesso!`);
        setShowModal(false);
        carregarClientes();
      } else {
        setError(response.message || `Erro ao ${modoEdicao ? 'atualizar' : 'cadastrar'} cliente.`);
      }
    } catch (error) {
      console.error(`Erro ao ${modoEdicao ? 'atualizar' : 'cadastrar'} cliente:`, error);
      setError(`Erro ao ${modoEdicao ? 'atualizar' : 'cadastrar'} cliente. Verifique sua conexão e tente novamente.`);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar campo do cliente selecionado
  const handleChangeCliente = (campo: string, valor: any) => {
    if (!clienteSelecionado) return;

    setClienteSelecionado({
      ...clienteSelecionado,
      [campo]: valor
    });
  };

  // Aplicar filtros
  const aplicarFiltros = () => {
    setPaginaAtual(1); // Voltar para a primeira página ao aplicar filtros
    carregarClientes();
  };

  // Limpar filtros
  const limparFiltros = () => {
    setBusca('');
    setRcaFiltro('');
    setFilialFiltro('');
    setNovoFiltro(null);
    setAtualizadoFiltro(null);
    setRecusadoFiltro(null);
    setDataInicioFiltro('');
    setDataFimFiltro('');
    setPaginaAtual(1);
    carregarClientes();
  };

  // Função para selecionar um único filtro de status
  const selecionarFiltroStatus = (tipo: 'novo' | 'atualizado' | 'recusado', valor: boolean) => {
    // Se está desmarcando o filtro atual, apenas desmarca
    if (!valor) {
      if (tipo === 'novo') setNovoFiltro(null);
      if (tipo === 'atualizado') setAtualizadoFiltro(null);
      if (tipo === 'recusado') setRecusadoFiltro(null);
      return;
    }
    
    // Se está marcando um filtro, desmarca os outros
    setNovoFiltro(tipo === 'novo' ? true : null);
    setAtualizadoFiltro(tipo === 'atualizado' ? true : null);
    setRecusadoFiltro(tipo === 'recusado' ? true : null);
  };

  // Formatar CPF/CNPJ
  const formatarCpfCnpj = (cpfCnpj: string) => {
    return cpfCnpj || '-';
  };

  // Formatar data
  const formatarData = (dataString?: string) => {
    if (!dataString) return '-';
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
  };

  // Mudar página
  const handlePaginaChange = (pagina: number) => {
    setPaginaAtual(pagina);
  };

  // Mudar registros por página
  const handleRegistrosPorPaginaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRegistrosPorPagina(Number(e.target.value));
    setPaginaAtual(1);
  };

  // Preparar dados para gráfico de status
  const prepararDadosGraficoStatus = () => {
    if (!estatisticas) return { labels: [], datasets: [] };

    return {
      labels: ['Novos', 'Atualizados', 'Recusados', 'Registrados', 'Autorizados'],
      datasets: [
        {
          data: [
            estatisticas.clientesPorStatus.novos,
            estatisticas.clientesPorStatus.atualizados,
            estatisticas.clientesPorStatus.recusados,
            estatisticas.clientesPorStatus.registrados,
            estatisticas.clientesPorStatus.autorizados
          ],
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
  };

  // Preparar dados para gráfico de tipo de pessoa
  const prepararDadosGraficoTipo = () => {
    if (!estatisticas) return { labels: [], datasets: [] };

    return {
      labels: ['Pessoa Física', 'Pessoa Jurídica'],
      datasets: [
        {
          data: [
            estatisticas.clientesPorTipo.fisica,
            estatisticas.clientesPorTipo.juridica
          ],
          backgroundColor: [
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 99, 132, 0.6)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
  };

  // Preparar dados para gráfico de clientes por período
  const prepararDadosGraficoPeriodo = () => {
    if (!estatisticas || !estatisticas.clientesPorPeriodo.length) return { labels: [], datasets: [] };

    const labels = estatisticas.clientesPorPeriodo.map(item => {
      // Formatar o período para exibição amigável
      if (filtrosRelatorio.agrupar_por === 'mes' && item.periodo.includes('-')) {
        const [ano, mes] = item.periodo.split('-');
        return `${mes}/${ano}`;
      }
      return item.periodo;
    });

    const data = estatisticas.clientesPorPeriodo.map(item => item.total);

    return {
      labels,
      datasets: [
        {
          label: 'Quantidade de Clientes',
          data,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }
      ]
    };
  };

  return (
    <Container fluid>
      <h2 className="mb-4">Gestão de Clientes</h2>
      
      <Tabs
        activeKey={tabAtiva}
        onSelect={(k) => setTabAtiva(k || 'lista')}
        className="mb-4"
      >
        <Tab eventKey="lista" title="Lista de Clientes">
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
          
          <Card className="mb-4">
            <Card.Header>
              <h5>Filtros</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Busca</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="Nome, CPF/CNPJ, E-mail, Telefone" 
                      value={busca} 
                      onChange={(e) => setBusca(e.target.value)} 
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>RCA (Vendedor)</Form.Label>
                    <Form.Select 
                      value={rcaFiltro} 
                      onChange={(e) => setRcaFiltro(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {vendedores.map(vendedor => (
                        <option key={vendedor.id} value={vendedor.rca}>{vendedor.nome} ({vendedor.rca})</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Filial</Form.Label>
                    <Form.Select 
                      value={filialFiltro} 
                      onChange={(e) => setFilialFiltro(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Todas</option>
                      {filiais.map(filial => (
                        <option key={filial.id} value={filial.id}>{filial.nome_fantasia}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Status do Cadastro</Form.Label>
                    <div className="d-flex border rounded p-2">
                      <div className="d-flex align-items-center">
                        <Form.Check
                          type="checkbox"
                          id="filtro-novo"
                          label="Novos"
                          className="me-3"
                          checked={novoFiltro === true}
                          onChange={(e) => selecionarFiltroStatus('novo', e.target.checked)}
                        />
                        <Form.Check
                          type="checkbox"
                          id="filtro-atualizado"
                          label="Atualizados"
                          className="me-3"
                          checked={atualizadoFiltro === true}
                          onChange={(e) => selecionarFiltroStatus('atualizado', e.target.checked)}
                        />
                        <Form.Check
                          type="checkbox"
                          id="filtro-recusado"
                          label="Recusados"
                          checked={recusadoFiltro === true}
                          onChange={(e) => selecionarFiltroStatus('recusado', e.target.checked)}
                        />
                      </div>
                      <small className="text-muted ms-auto">Selecione apenas uma opção</small>
                    </div>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Período de Cadastro</Form.Label>
                    <div className="d-flex border rounded p-2">
                      <div className="d-flex align-items-center w-100">
                        <div className="me-2">
                          <Form.Label className="small mb-0">De</Form.Label>
                          <Form.Control
                            type="date"
                            value={dataInicioFiltro}
                            onChange={(e) => setDataInicioFiltro(e.target.value)}
                          />
                        </div>
                        <div>
                          <Form.Label className="small mb-0">Até</Form.Label>
                          <Form.Control
                            type="date"
                            value={dataFimFiltro}
                            onChange={(e) => setDataFimFiltro(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </Form.Group>
                </Col>
              </Row>
              <div className="d-flex justify-content-end">
                <Button variant="secondary" className="me-2" onClick={limparFiltros}>
                  Limpar Filtros
                </Button>
                <Button variant="primary" onClick={aplicarFiltros}>
                  Aplicar Filtros
                </Button>
              </div>
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5>Lista de Clientes</h5>
              <Button variant="success" onClick={handleNovoCliente}>
                <i className="bi bi-plus-circle"></i> Novo Cliente
              </Button>
            </Card.Header>
            <Card.Body>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nome</th>
                      <th>CPF/CNPJ</th>
                      <th>Telefone</th>
                      <th>E-mail</th>
                      <th>Cidade/UF</th>
                      <th>Tipo</th>
                      <th>Cadastrado em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={9} className="text-center">
                          <Spinner animation="border" variant="primary" />
                        </td>
                      </tr>
                    )}
                    {!loading && clientes.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center">
                          Nenhum cliente encontrado.
                        </td>
                      </tr>
                    )}
                    {!loading && clientes.map(cliente => (
                      <tr 
                        key={cliente.id}
                        style={{
                          backgroundColor: cliente.recused_msg ? '#ffe6e6' : 'transparent',
                          borderLeft: cliente.recused_msg ? '4px solid #dc3545' : 'none'
                        }}
                      >
                        <td>{cliente.id}</td>
                        <td>
                          {cliente.name}
                          {cliente.novo && (
                            <Badge 
                              bg="success" 
                              className="ms-2" 
                              style={{ 
                                backgroundColor: '#28a745',
                                color: '#ffffff',
                                fontWeight: 'normal'
                              }}
                            >
                              Novo
                            </Badge>
                          )}
                          {cliente.atualizado && (
                            <Badge 
                              bg="info" 
                              className="ms-2" 
                              style={{ 
                                backgroundColor: '#cce5ff',
                                color: '#004085',
                                fontWeight: 'normal'
                              }}
                            >
                              Atualizado
                            </Badge>
                          )}
                          {cliente.recused && (
                            <Badge 
                              bg="danger" 
                              className="ms-2" 
                              style={{ 
                                backgroundColor: '#dc3545',
                                color: '#ffffff',
                                fontWeight: 'normal'
                              }}
                            >
                              Recusado
                            </Badge>
                          )}
                          {cliente.registered && (
                            <Badge 
                              bg="secondary" 
                              className="ms-2" 
                              style={{ 
                                backgroundColor: '#6c757d',
                                color: '#ffffff',
                                fontWeight: 'normal'
                              }}
                            >
                              Registrado
                            </Badge>
                          )}
                          {cliente.authorized && (
                            <Badge 
                              bg="primary" 
                              className="ms-2" 
                              style={{ 
                                backgroundColor: '#007bff',
                                color: '#ffffff',
                                fontWeight: 'normal'
                              }}
                            >
                              Autorizado
                            </Badge>
                          )}
                        </td>
                        <td>{cliente.person_identification_number}</td>
                        <td>{cliente.billingPhone}</td>
                        <td>{cliente.email}</td>
                        <td>{cliente.cidade_nome || cliente.business_city}/{cliente.uf}</td>
                        <td>
                          <Badge bg={cliente.corporate ? "primary" : "info"}>
                            {cliente.corporate ? "Jurídica" : "Física"}
                          </Badge>
                        </td>
                        <td>{formatarData(cliente.created_at)}</td>
                        <td>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            className="me-1"
                            onClick={() => cliente.id && handleEditarCliente(cliente.id)}
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          {cliente.recused_msg && (
                            <Button 
                              variant="warning" 
                              size="sm" 
                              className="me-1"
                              onClick={() => handleVerMensagemRecusa(cliente)}
                              title="Ver mensagem de recusa"
                            >
                              <i className="bi bi-exclamation-triangle"></i>
                            </Button>
                          )}
                          <Button 
                            variant="danger" 
                            size="sm"
                            onClick={() => cliente.id && handleExcluirCliente(cliente.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div>
                  <span>Exibindo </span>
                  <Form.Select 
                    style={{ width: 'auto', display: 'inline-block' }} 
                    value={registrosPorPagina}
                    onChange={handleRegistrosPorPaginaChange}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </Form.Select>
                  <span> de {totalRegistros} registros</span>
                </div>
                
                <Pagination>
                  <Pagination.First onClick={() => handlePaginaChange(1)} disabled={paginaAtual === 1} />
                  <Pagination.Prev onClick={() => handlePaginaChange(paginaAtual - 1)} disabled={paginaAtual === 1} />
                  
                  {[...Array(Math.min(5, totalPaginas))].map((_, i) => {
                    let pageNum: number;
                    
                    if (totalPaginas <= 5) {
                      pageNum = i + 1;
                    } else if (paginaAtual <= 3) {
                      pageNum = i + 1;
                    } else if (paginaAtual >= totalPaginas - 2) {
                      pageNum = totalPaginas - 4 + i;
                    } else {
                      pageNum = paginaAtual - 2 + i;
                    }
                    
                    return (
                      <Pagination.Item 
                        key={pageNum} 
                        active={pageNum === paginaAtual}
                        onClick={() => handlePaginaChange(pageNum)}
                      >
                        {pageNum}
                      </Pagination.Item>
                    );
                  })}
                  
                  <Pagination.Next onClick={() => handlePaginaChange(paginaAtual + 1)} disabled={paginaAtual === totalPaginas} />
                  <Pagination.Last onClick={() => handlePaginaChange(totalPaginas)} disabled={paginaAtual === totalPaginas} />
                </Pagination>
              </div>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="relatorios" title="Relatórios">
          {errorRelatorio && <Alert variant="danger">{errorRelatorio}</Alert>}
          
          <Card className="mb-4">
            <Card.Header>
              <h5>Filtros do Relatório</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data Início</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={filtrosRelatorio.data_inicio} 
                      onChange={(e) => handleChangeFiltroRelatorio('data_inicio', e.target.value)} 
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data Fim</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={filtrosRelatorio.data_fim} 
                      onChange={(e) => handleChangeFiltroRelatorio('data_fim', e.target.value)} 
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Filial</Form.Label>
                    <Form.Select 
                      value={filtrosRelatorio.filial || ''} 
                      onChange={(e) => handleChangeFiltroRelatorio('filial', e.target.value ? Number(e.target.value) : undefined)}
                    >
                      <option value="">Todas</option>
                      {filiais.map(filial => (
                        <option key={filial.id} value={filial.id}>{filial.nome_fantasia}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>RCA (Vendedor)</Form.Label>
                    <Form.Select 
                      value={filtrosRelatorio.rca || ''} 
                      onChange={(e) => handleChangeFiltroRelatorio('rca', e.target.value)}
                    >
                      <option value="">Todos</option>
                      {vendedores.map(vendedor => (
                        <option key={vendedor.id} value={vendedor.rca}>{vendedor.nome} ({vendedor.rca})</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Agrupar por</Form.Label>
                    <Form.Select 
                      value={filtrosRelatorio.agrupar_por} 
                      onChange={(e) => handleChangeFiltroRelatorio('agrupar_por', e.target.value)}
                    >
                      <option value="dia">Dia</option>
                      <option value="semana">Semana</option>
                      <option value="mes">Mês</option>
                      <option value="ano">Ano</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={8} className="d-flex align-items-end justify-content-end">
                  <Button variant="secondary" className="me-2" onClick={limparFiltrosRelatorio}>
                    Limpar Filtros
                  </Button>
                  <Button variant="primary" className="me-2" onClick={aplicarFiltrosRelatorio}>
                    Aplicar Filtros
                  </Button>
                  <Button 
                    variant="success" 
                    onClick={handleExportarRelatorio}
                    disabled={loadingRelatorio}
                  >
                    {loadingRelatorio ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                        <span className="ms-2">Exportando...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-file-earmark-excel me-2"></i>
                        Exportar para Excel
                      </>
                    )}
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
          
          {loadingRelatorio ? (
            <div className="text-center my-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Carregando estatísticas...</p>
            </div>
          ) : estatisticas ? (
            <>
              <Row className="mb-4">
                <Col md={12}>
                  <Card>
                    <Card.Header>
                      <h5>Resumo</h5>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={4} className="text-center">
                          <div className="border rounded p-3">
                            <h2 className="display-4">{estatisticas.totalClientes}</h2>
                            <p className="lead">Total de Clientes</p>
                          </div>
                        </Col>
                        <Col md={4} className="text-center">
                          <div className="border rounded p-3">
                            <h2 className="display-4">{estatisticas.clientesPorTipo.fisica}</h2>
                            <p className="lead">Pessoas Físicas</p>
                          </div>
                        </Col>
                        <Col md={4} className="text-center">
                          <div className="border rounded p-3">
                            <h2 className="display-4">{estatisticas.clientesPorTipo.juridica}</h2>
                            <p className="lead">Pessoas Jurídicas</p>
                          </div>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              
              <Row className="mb-4">
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <h5>Clientes por Status</h5>
                    </Card.Header>
                    <Card.Body>
                      <div style={{ height: '300px' }}>
                        <Pie 
                          data={prepararDadosGraficoStatus()} 
                          options={{ 
                            responsive: true, 
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom'
                              }
                            }
                          }} 
                        />
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <h5>Clientes por Tipo</h5>
                    </Card.Header>
                    <Card.Body>
                      <div style={{ height: '300px' }}>
                        <Pie 
                          data={prepararDadosGraficoTipo()} 
                          options={{ 
                            responsive: true, 
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom'
                              }
                            }
                          }} 
                        />
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              
              <Row className="mb-4">
                <Col md={12}>
                  <Card>
                    <Card.Header>
                      <h5>Clientes por Período</h5>
                    </Card.Header>
                    <Card.Body>
                      <div style={{ height: '300px' }}>
                        <Bar 
                          data={prepararDadosGraficoPeriodo()} 
                          options={{ 
                            responsive: true, 
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                display: false
                              },
                              title: {
                                display: true,
                                text: `Clientes agrupados por ${filtrosRelatorio.agrupar_por}`
                              }
                            }
                          }} 
                        />
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              
              <Row className="mb-4">
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <h5>Top 5 Filiais</h5>
                    </Card.Header>
                    <Card.Body>
                      <Table striped bordered hover>
                        <thead>
                          <tr>
                            <th>Filial</th>
                            <th className="text-center">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {estatisticas.clientesPorFilial.slice(0, 5).map((filial, index) => (
                            <tr key={index}>
                              <td>{filial.nome}</td>
                              <td className="text-center">{filial.total}</td>
                            </tr>
                          ))}
                          {estatisticas.clientesPorFilial.length === 0 && (
                            <tr>
                              <td colSpan={2} className="text-center">Nenhum dado disponível</td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <h5>Top 5 Vendedores</h5>
                    </Card.Header>
                    <Card.Body>
                      <Table striped bordered hover>
                        <thead>
                          <tr>
                            <th>Vendedor</th>
                            <th>RCA</th>
                            <th className="text-center">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {estatisticas.clientesPorVendedor.slice(0, 5).map((vendedor, index) => (
                            <tr key={index}>
                              <td>{vendedor.nome}</td>
                              <td>{vendedor.rca}</td>
                              <td className="text-center">{vendedor.total}</td>
                            </tr>
                          ))}
                          {estatisticas.clientesPorVendedor.length === 0 && (
                            <tr>
                              <td colSpan={3} className="text-center">Nenhum dado disponível</td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              
              <Row className="mb-4">
                <Col md={12}>
                  <Card>
                    <Card.Header>
                      <h5>Top 10 Ramos de Atividade</h5>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={6}>
                          <div style={{ height: '300px' }}>
                            <Bar 
                              data={{
                                labels: estatisticas.clientesPorAtividade.slice(0, 10).map(item => item.ramo),
                                datasets: [
                                  {
                                    label: 'Quantidade de Clientes',
                                    data: estatisticas.clientesPorAtividade.slice(0, 10).map(item => item.total),
                                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                                    borderColor: 'rgba(153, 102, 255, 1)',
                                    borderWidth: 1
                                  }
                                ]
                              }} 
                              options={{ 
                                responsive: true, 
                                maintainAspectRatio: false,
                                indexAxis: 'y',
                                plugins: {
                                  legend: {
                                    display: false
                                  }
                                }
                              }} 
                            />
                          </div>
                        </Col>
                        <Col md={6}>
                          <Table striped bordered hover>
                            <thead>
                              <tr>
                                <th>Ramo de Atividade</th>
                                <th className="text-center">Quantidade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {estatisticas.clientesPorAtividade.slice(0, 10).map((atividade, index) => (
                                <tr key={index}>
                                  <td>{atividade.ramo}</td>
                                  <td className="text-center">{atividade.total}</td>
                                </tr>
                              ))}
                              {estatisticas.clientesPorAtividade.length === 0 && (
                                <tr>
                                  <td colSpan={2} className="text-center">Nenhum dado disponível</td>
                                </tr>
                              )}
                            </tbody>
                          </Table>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </>
          ) : (
            <Alert variant="info">
              Selecione os filtros desejados e clique em "Aplicar Filtros" para visualizar as estatísticas.
            </Alert>
          )}
        </Tab>
      </Tabs>
      
      {/* Modal para adicionar/editar cliente */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{modoEdicao ? 'Editar Cliente' : 'Novo Cliente'} {clienteSelecionado?.codcli ? clienteSelecionado?.codcli : 'S/C'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {clienteSelecionado && (
            <Form>
              <Row>
                <Col md={12} className="mb-3">
                  <Form.Group>
                    <Form.Label>Tipo de Pessoa</Form.Label>
                    <div>
                      <Form.Check
                        inline
                        type="radio"
                        id="tipo-fisica"
                        label="Pessoa Física"
                        checked={!clienteSelecionado.corporate}
                        onChange={() => handleChangeCliente('corporate', false)}
                      />
                      <Form.Check
                        inline
                        type="radio"
                        id="tipo-juridica"
                        label="Pessoa Jurídica"
                        checked={clienteSelecionado.corporate}
                        onChange={() => handleChangeCliente('corporate', true)}
                      />
                    </div>
                  </Form.Group>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome {clienteSelecionado.corporate ? 'Razão Social' : 'Completo'}</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={clienteSelecionado.name || ''} 
                      onChange={(e) => handleChangeCliente('name', e.target.value)} 
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{clienteSelecionado.corporate ? 'Nome Fantasia' : 'Apelido'}</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={clienteSelecionado.trade_name || ''} 
                      onChange={(e) => handleChangeCliente('trade_name', e.target.value)} 
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{clienteSelecionado.corporate ? 'CNPJ' : 'CPF'}</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={clienteSelecionado.person_identification_number || ''} 
                      onChange={(e) => handleChangeCliente('person_identification_number', e.target.value)} 
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Inscrição Estadual</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={clienteSelecionado.state_inscription || ''} 
                      onChange={(e) => handleChangeCliente('state_inscription', e.target.value)} 
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Telefone</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={clienteSelecionado.billingPhone || ''} 
                      onChange={(e) => handleChangeCliente('billingPhone', e.target.value)} 
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>E-mail</Form.Label>
                    <Form.Control 
                      type="email" 
                      value={clienteSelecionado.email || ''} 
                      onChange={(e) => handleChangeCliente('email', e.target.value)} 
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>E-mail NFe</Form.Label>
                    <Form.Control 
                      type="email" 
                      value={clienteSelecionado.email_nfe || ''} 
                      onChange={(e) => handleChangeCliente('email_nfe', e.target.value)} 
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Data de Nascimento</Form.Label>
                    <Form.Control 
                      type="text" 
                      placeholder="DD/MM/AAAA"
                      value={clienteSelecionado.data_nascimento || ''} 
                      onChange={(e) => handleChangeCliente('data_nascimento', e.target.value)} 
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              {modoEdicao && (
                <Row className="mt-3">
                  <Col md={12}>
                    <h5 className="mb-3">Status do Cliente</h5>
                    <div className="border rounded p-3 mb-3">
                      <Row>
                        <Col md={4}>
                          <Form.Check
                            type="checkbox"
                            id="status-registered"
                            label="Registrado no Sistema"
                            className="mb-2"
                            checked={clienteSelecionado.registered || false}
                            onChange={(e) => handleChangeCliente('registered', e.target.checked)}
                          />
                        </Col>
                        <Col md={4}>
                          <Form.Check
                            type="checkbox"
                            id="status-authorized"
                            label="Autorizado"
                            className="mb-2"
                            checked={clienteSelecionado.authorized || false}
                            onChange={(e) => handleChangeCliente('authorized', e.target.checked)}
                          />
                        </Col>
                        <Col md={4}>
                          <Form.Check
                            type="checkbox"
                            id="status-recused-direct"
                            label="Recusado"
                            className="mb-2"
                            checked={clienteSelecionado.recused || false}
                            onChange={(e) => {
                              handleChangeCliente('recused', e.target.checked);
                              if (!e.target.checked) {
                                handleChangeCliente('recused_msg', '');
                              }
                            }}
                          />
                        </Col>
                      </Row>
                      {clienteSelecionado.recused && (
                        <Row className="mt-2">
                          <Col md={12}>
                            <Form.Group className="mb-0">
                              <Form.Label>Motivo da Recusa</Form.Label>
                              <Form.Control 
                                as="textarea" 
                                rows={2}
                                value={clienteSelecionado.recused_msg || ''} 
                                onChange={(e) => handleChangeCliente('recused_msg', e.target.value)} 
                              />
                            </Form.Group>
                          </Col>
                        </Row>
                      )}
                    </div>
                  </Col>
                </Row>
              )}
              
              <Row>
                <Col md={8}>
                  <Form.Group className="mb-3">
                    <Form.Label>Endereço</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={clienteSelecionado.commercial_address || ''} 
                      onChange={(e) => handleChangeCliente('commercial_address', e.target.value)} 
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Número</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={clienteSelecionado.commercial_address_number || ''} 
                      onChange={(e) => handleChangeCliente('commercial_address_number', e.target.value)} 
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Bairro</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={clienteSelecionado.business_district || ''} 
                      onChange={(e) => handleChangeCliente('business_district', e.target.value)} 
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>CEP</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={clienteSelecionado.commercial_zip_code || ''} 
                      onChange={(e) => handleChangeCliente('commercial_zip_code', e.target.value)} 
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Cidade</Form.Label>
                    <Form.Select 
                      value={clienteSelecionado.city_id || ''} 
                      onChange={(e) => handleChangeCliente('city_id', e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Selecione...</option>
                      {cidades.map(cidade => (
                        <option key={cidade.id} value={cidade.id}>
                          {cidade.nomecidade} - {cidade.uf}
                        </option>
                      ))}
                    </Form.Select>
                    {!clienteSelecionado.city_id && (
                      <Form.Control 
                        type="text"
                        placeholder="Nome da cidade (se não encontrar na lista)"
                        className="mt-2"
                        value={clienteSelecionado.business_city || ''} 
                        onChange={(e) => handleChangeCliente('business_city', e.target.value)}
                      />
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Ramo de Atividade</Form.Label>
                    <Form.Select 
                      value={clienteSelecionado.activity_id || ''} 
                      onChange={(e) => handleChangeCliente('activity_id', e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Selecione...</option>
                      {atividades.map(atividade => (
                        <option key={atividade.id} value={atividade.id}>{atividade.ramo}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Filial</Form.Label>
                    <Form.Select 
                      value={clienteSelecionado.filial || ''} 
                      onChange={(e) => handleChangeCliente('filial', e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Selecione...</option>
                      {filiais.map(filial => (
                        <option key={filial.id} value={filial.id}>{filial.nome_fantasia}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>RCA (Vendedor)</Form.Label>
                    <Form.Select 
                      value={clienteSelecionado.rca || ''} 
                      onChange={(e) => handleChangeCliente('rca', e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {vendedores.map(vendedor => (
                        <option key={vendedor.id} value={vendedor.rca}>
                          {vendedor.nome} ({vendedor.rca})
                        </option>
                      ))}
                    </Form.Select>
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
            onClick={handleSalvarCliente}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                <span className="ms-2">Salvando...</span>
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Mensagem de Recusa */}
      <Modal
        show={showModalRecusa}
        onHide={() => setShowModalRecusa(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-exclamation-triangle text-warning me-2"></i>
            Problema no Cadastro
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {clienteRecusado && (
            <div>
              <div className="alert alert-warning" role="alert">
                <h6 className="alert-heading">
                  <i className="bi bi-person-fill me-2"></i>
                  Cliente: {clienteRecusado.name}
                </h6>
                <hr />
                <p className="mb-1">
                  <strong>CPF/CNPJ:</strong> {clienteRecusado.person_identification_number}
                </p>
                <p className="mb-1">
                  <strong>E-mail:</strong> {clienteRecusado.email}
                </p>
                <p className="mb-0">
                  <strong>Telefone:</strong> {clienteRecusado.billingPhone}
                </p>
              </div>
              
              <div className="mt-3">
                <h6 className="text-danger">
                  <i className="bi bi-exclamation-circle me-2"></i>
                  Mensagem de Recusa:
                </h6>
                <div 
                  className="p-3 border rounded" 
                  style={{ 
                    backgroundColor: '#fff3cd', 
                    borderColor: '#ffeaa7',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem'
                  }}
                >
                  {mensagemRecusa}
                </div>
              </div>
              
              <div className="mt-3">
                <small className="text-muted">
                  <i className="bi bi-info-circle me-1"></i>
                  Esta mensagem indica problemas encontrados durante o processamento do cadastro. 
                  Entre em contato com o cliente para corrigir as informações necessárias.
                </small>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModalRecusa(false)}>
            Fechar
          </Button>
          {clienteRecusado && (
            <Button 
              variant="primary" 
              onClick={() => {
                setShowModalRecusa(false);
                if (clienteRecusado.id) {
                  handleEditarCliente(clienteRecusado.id);
                }
              }}
            >
              <i className="bi bi-pencil me-2"></i>
              Editar Cliente
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Clientes;