import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Form, Button, Modal, Spinner, Alert, Tabs, Tab, Badge, Pagination } from 'react-bootstrap';
import { 
  listarMetas, 
  cadastrarMeta, 
  atualizarMeta, 
  deletarMeta, 
  obterProgressoMeta,
  listarHistoricoMetas,
  MetaVendas,
  MetaCadastroClientes,
  ProgressoMeta,
  HistoricoMeta,
  HistoricoMetaResponse
} from '../services/vendasService';
import { listarVendedores } from '../services/funcionariosService';

interface Vendedor {
  id: number;
  nome: string;
  rca: string;
}

const VendasMetas: React.FC = () => {
  // Estados
  const [metasVendas, setMetasVendas] = useState<MetaVendas[]>([]);
  const [metasCadastro, setMetasCadastro] = useState<MetaCadastroClientes[]>([]);
  const [historicoMetas, setHistoricoMetas] = useState<HistoricoMeta[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [metaSelecionada, setMetaSelecionada] = useState<MetaVendas | MetaCadastroClientes | null>(null);
  const [tipoMetaSelecionada, setTipoMetaSelecionada] = useState<'vendas' | 'cadastro_clientes'>('vendas');
  const [progressoMeta, setProgressoMeta] = useState<ProgressoMeta | null>(null);
  
  // Estados para paginação
  const [paginaAtualHistorico, setPaginaAtualHistorico] = useState<number>(1);
  const [totalPaginasHistorico, setTotalPaginasHistorico] = useState<number>(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState<number>(10);
  const [totalRegistrosHistorico, setTotalRegistrosHistorico] = useState<number>(0);
  
  const [mesFiltro, setMesFiltro] = useState<number>(new Date().getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState<number>(new Date().getFullYear());
  const [vendedorIdFiltro, setVendedorIdFiltro] = useState<number | ''>('');
  
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showProgressoModal, setShowProgressoModal] = useState<boolean>(false);
  const [modoEdicao, setModoEdicao] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [tipoMetaAtiva, setTipoMetaAtiva] = useState<'vendas' | 'cadastro_clientes' | 'historico'>('vendas');

  // Carregar vendedores e metas ao iniciar
  useEffect(() => {
    carregarVendedores();
    carregarMetas();
    carregarHistoricoMetas();
  }, []);

  // Carregar vendedores
  const carregarVendedores = async () => {
    try {
      const response = await listarVendedores();
      setVendedores(response);
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error);
      setError('Erro ao carregar lista de vendedores.');
    }
  };

  // Carregar metas com base nos filtros
  const carregarMetas = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const params: any = {
        mes: mesFiltro || undefined,
        ano: anoFiltro || undefined,
        vendedor_id: vendedorIdFiltro || undefined
      };

      const response = await listarMetas(params);
      
      if (response.status === 1) {
        setMetasVendas(response.metas_vendas || []);
        setMetasCadastro(response.metas_cadastro_clientes || []);
      } else {
        setError(response.message || 'Erro ao carregar metas.');
      }
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
      setError('Erro ao carregar metas. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar histórico de metas com base nos filtros e paginação
  const carregarHistoricoMetas = async (pagina: number = paginaAtualHistorico) => {
    setLoading(true);
    setError('');

    try {
      const params: any = {
        mes: mesFiltro || undefined,
        ano: anoFiltro || undefined,
        vendedor_id: vendedorIdFiltro || undefined,
        pagina: pagina,
        por_pagina: registrosPorPagina
      };

      const response = await listarHistoricoMetas(params);
      
      if (response.status === 1) {
        setHistoricoMetas(response.historico || []);
        setTotalPaginasHistorico(response.total_paginas || 1);
        setPaginaAtualHistorico(response.pagina_atual || 1);
        setTotalRegistrosHistorico(response.total_registros || 0);
      } else {
        setError(response.message || 'Erro ao carregar histórico de metas.');
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de metas:', error);
      setError('Erro ao carregar histórico de metas. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal para adicionar nova meta
  const handleNovaMeta = () => {
    setMetaSelecionada({
      vendedor_id: '',
      mes: mesFiltro,
      ano: anoFiltro,
      valor_meta: 0,
      quantidade_meta: 0,
      tipo_meta: tipoMetaAtiva === 'historico' ? 'vendas' : tipoMetaAtiva
    } as any);
    setTipoMetaSelecionada(tipoMetaAtiva === 'historico' ? 'vendas' : tipoMetaAtiva as 'vendas' | 'cadastro_clientes');
    setModoEdicao(false);
    setShowModal(true);
  };

  // Abrir modal para editar meta
  const handleEditarMeta = (meta: MetaVendas | MetaCadastroClientes, tipo: 'vendas' | 'cadastro_clientes') => {
    setMetaSelecionada({...meta});
    setTipoMetaSelecionada(tipo);
    setModoEdicao(true);
    setShowModal(true);
  };

  // Visualizar progresso da meta
  const handleVerProgresso = async (meta: MetaVendas | MetaCadastroClientes, tipo: 'vendas' | 'cadastro_clientes') => {
    setLoading(true);
    setError('');

    try {
      const response = await obterProgressoMeta(
        meta.vendedor_id, 
        meta.mes, 
        meta.ano, 
        tipo
      );
      
      if (response && response.status === 1) {
        setProgressoMeta(response);
        setShowProgressoModal(true);
      } else {
        setError(response?.message || 'Erro ao carregar progresso da meta.');
      }
    } catch (error) {
      console.error('Erro ao carregar progresso:', error);
      setError('Erro ao carregar progresso da meta. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Excluir meta
  const handleExcluirMeta = async (id: number, tipo: 'vendas' | 'cadastro_clientes') => {
    if (!window.confirm('Tem certeza que deseja excluir esta meta?')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await deletarMeta(id, tipo);
      
      if (response.status === 1) {
        setSuccess('Meta excluída com sucesso!');
        // Recarregar metas
        carregarMetas();
        carregarHistoricoMetas(); // Recarregar histórico após exclusão
      } else {
        setError(response.message || 'Erro ao excluir meta.');
      }
    } catch (error) {
      console.error('Erro ao excluir meta:', error);
      setError('Erro ao excluir meta. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Salvar meta (criar ou atualizar)
  const handleSalvarMeta = async () => {
    if (!metaSelecionada) return;

    // Validar dados
    if (!metaSelecionada.vendedor_id) {
      setError('Selecione um vendedor.');
      return;
    }

    if (tipoMetaSelecionada === 'vendas' && (metaSelecionada as MetaVendas).valor_meta <= 0) {
      setError('O valor da meta deve ser maior que zero.');
      return;
    }

    if (tipoMetaSelecionada === 'cadastro_clientes' && (metaSelecionada as MetaCadastroClientes).quantidade_meta <= 0) {
      setError('A quantidade da meta deve ser maior que zero.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Adicionar o tipo de meta ao objeto
      const metaParaEnviar = {
        ...metaSelecionada,
        tipo_meta: tipoMetaSelecionada
      };

      let response;
      if (modoEdicao) {
        response = await atualizarMeta(metaParaEnviar as any);
      } else {
        response = await cadastrarMeta(metaParaEnviar as any);
      }
      
      if (response.status === 1) {
        setSuccess(modoEdicao ? 'Meta atualizada com sucesso!' : 'Meta cadastrada com sucesso!');
        setShowModal(false);
        // Recarregar metas
        carregarMetas();
        carregarHistoricoMetas(); // Recarregar histórico após salvar
      } else {
        setError(response.message || 'Erro ao salvar meta.');
      }
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      setError('Erro ao salvar meta. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Atualizar campo da meta selecionada
  const handleChangeMeta = (campo: string, valor: any) => {
    if (!metaSelecionada) return;

    // Garantir que valores numéricos sejam tratados corretamente
    let valorProcessado = valor;
    
    if (['valor_meta', 'quantidade_meta'].includes(campo)) {
      valorProcessado = valor === '' ? 0 : parseFloat(valor);
      if (isNaN(valorProcessado)) valorProcessado = 0;
    }

    setMetaSelecionada({
      ...metaSelecionada,
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

  // Formatar percentual
  const formatarPercentual = (percentual: number | undefined | null) => {
    if (percentual === undefined || percentual === null) {
      percentual = 0;
    }
    // Converter para número para garantir que toFixed() funcione
    const valorNumerico = Number(percentual);
    return `${valorNumerico.toFixed(2)}%`;
  };

  // Obter nome do mês
  const getNomeMes = (mes: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1] || '';
  };

  // Obter cor do status
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'concluida':
        return 'success';
      case 'em_andamento':
        return 'primary';
      case 'nao_atingida':
        return 'danger';
      default:
        return 'warning';
    }
  };

  // Formatar status
  const formatarStatus = (status?: string) => {
    switch (status) {
      case 'concluida':
        return 'Concluída';
      case 'em_andamento':
        return 'Em andamento';
      case 'nao_atingida':
        return 'Não atingida';
      case 'pendente':
      default:
        return 'Pendente';
    }
  };

  // Formatar data
  const formatarData = (dataString?: string) => {
    if (!dataString) return 'N/A';
    return dataString;
  };

  // Mudar página do histórico
  const handlePaginaHistoricoChange = (pagina: number) => {
    carregarHistoricoMetas(pagina);
  };

  // Mudar registros por página
  const handleRegistrosPorPaginaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const valor = parseInt(e.target.value);
    setRegistrosPorPagina(valor);
    setPaginaAtualHistorico(1); // Voltar para a primeira página ao mudar o número de registros
    carregarHistoricoMetas(1);
  };

  return (
    <Container fluid>
      <h2 className="mb-4">Gerenciamento de Metas</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      
      <Card className="mb-4">
        <Card.Header>Filtros</Card.Header>
        <Card.Body>
          <Row>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Mês</Form.Label>
                <Form.Select
                  value={mesFiltro}
                  onChange={(e) => setMesFiltro(parseInt(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {getNomeMes(i + 1)}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Ano</Form.Label>
                <Form.Control
                  type="number"
                  value={anoFiltro}
                  onChange={(e) => setAnoFiltro(parseInt(e.target.value))}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Vendedor</Form.Label>
                <Form.Select
                  value={vendedorIdFiltro}
                  onChange={(e) => setVendedorIdFiltro(e.target.value ? parseInt(e.target.value) : '')}
                >
                  <option value="">Todos os vendedores</option>
                  {vendedores.map((vendedor) => (
                    <option key={vendedor.id} value={vendedor.id}>
                      {vendedor.nome} ({vendedor.rca})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2} className="d-flex align-items-end">
              <Button 
                variant="primary" 
                className="mb-3 w-100" 
                onClick={() => {
                  carregarMetas();
                  carregarHistoricoMetas();
                }}
                disabled={loading}
              >
                {loading ? <Spinner animation="border" size="sm" /> : 'Filtrar'}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Lista de Metas</h3>
        <Button variant="success" onClick={handleNovaMeta}>
          Nova Meta
        </Button>
      </div>

      <Tabs
        activeKey={tipoMetaAtiva}
        onSelect={(k) => k && setTipoMetaAtiva(k as 'vendas' | 'cadastro_clientes' | 'historico')}
        className="mb-3"
      >
        <Tab eventKey="vendas" title="Metas de Vendas">
          {loading ? (
            <div className="text-center my-5">
              <Spinner animation="border" />
            </div>
          ) : metasVendas.length > 0 ? (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Período</th>
                  <th>Valor da Meta</th>
                  <th>Valor Realizado</th>
                  <th>% Atingido</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {metasVendas.map((meta) => (
                  <tr key={meta.id}>
                    <td>{meta.nome_vendedor}</td>
                    <td>{meta.periodo}</td>
                    <td>{formatarValor(meta.valor_meta)}</td>
                    <td>{formatarValor(meta.valor_realizado)}</td>
                    <td>{formatarPercentual(meta.percentual_atingido)}</td>
                    <td>
                      <Badge bg={getStatusColor(meta.status)}>
                        {formatarStatus(meta.status)}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="info"
                        size="sm"
                        className="me-2"
                        onClick={() => handleVerProgresso(meta, 'vendas')}
                      >
                        Progresso
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="me-2"
                        onClick={() => handleEditarMeta(meta, 'vendas')}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleExcluirMeta(meta.id!, 'vendas')}
                      >
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Alert variant="info">Nenhuma meta de vendas encontrada para os filtros selecionados.</Alert>
          )}
        </Tab>
        <Tab eventKey="cadastro_clientes" title="Metas de Cadastro de Clientes">
          {loading ? (
            <div className="text-center my-5">
              <Spinner animation="border" />
            </div>
          ) : metasCadastro.length > 0 ? (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Período</th>
                  <th>Quantidade da Meta</th>
                  <th>Quantidade Realizada</th>
                  <th>% Atingido</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {metasCadastro.map((meta) => (
                  <tr key={meta.id}>
                    <td>{meta.nome_vendedor}</td>
                    <td>{meta.periodo}</td>
                    <td>{meta.quantidade_meta}</td>
                    <td>{meta.quantidade_realizada}</td>
                    <td>{formatarPercentual(meta.percentual_atingido)}</td>
                    <td>
                      <Badge bg={getStatusColor(meta.status)}>
                        {formatarStatus(meta.status)}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="info"
                        size="sm"
                        className="me-2"
                        onClick={() => handleVerProgresso(meta, 'cadastro_clientes')}
                      >
                        Progresso
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="me-2"
                        onClick={() => handleEditarMeta(meta, 'cadastro_clientes')}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleExcluirMeta(meta.id!, 'cadastro_clientes')}
                      >
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Alert variant="info">Nenhuma meta de cadastro de clientes encontrada para os filtros selecionados.</Alert>
          )}
        </Tab>
        <Tab eventKey="historico" title="Histórico de Atualizações">
          {loading ? (
            <div className="text-center my-5">
              <Spinner animation="border" />
            </div>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <span>Total de registros: {totalRegistrosHistorico}</span>
                </div>
                <div className="d-flex align-items-center">
                  <span className="me-2">Registros por página:</span>
                  <Form.Select 
                    size="sm" 
                    value={registrosPorPagina} 
                    onChange={handleRegistrosPorPaginaChange}
                    style={{ width: '80px' }}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </Form.Select>
                </div>
              </div>

              {historicoMetas.length > 0 ? (
                <>
                  <Table striped bordered hover responsive>
                    <thead>
                      <tr>
                        <th>Data/Hora</th>
                        <th>Vendedor</th>
                        <th>Período</th>
                        <th>Tipo de Meta</th>
                        <th>Valor/Quantidade Anterior</th>
                        <th>Valor/Quantidade Nova</th>
                        <th>Usuário</th>
                        <th>Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoMetas.map((historico) => (
                        <tr key={historico.id}>
                          <td>{formatarData(historico.data_atualizacao)}</td>
                          <td>{historico.nome_vendedor}</td>
                          <td>{getNomeMes(historico.mes)}/{historico.ano}</td>
                          <td>
                            {historico.tipo_meta === 'vendas' 
                              ? 'Meta de Vendas' 
                              : 'Meta de Cadastro de Clientes'}
                          </td>
                          <td>
                            {historico.tipo_meta === 'vendas' 
                              ? formatarValor(historico.valor_anterior)
                              : historico.quantidade_anterior}
                          </td>
                          <td>
                            {historico.tipo_meta === 'vendas' 
                              ? formatarValor(historico.valor_novo)
                              : historico.quantidade_nova}
                          </td>
                          <td>{historico.usuario}</td>
                          <td>{historico.observacoes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  
                  <div className="d-flex justify-content-center mt-4">
                    <Pagination>
                      <Pagination.First 
                        onClick={() => handlePaginaHistoricoChange(1)}
                        disabled={paginaAtualHistorico === 1}
                      />
                      <Pagination.Prev 
                        onClick={() => handlePaginaHistoricoChange(paginaAtualHistorico - 1)}
                        disabled={paginaAtualHistorico === 1}
                      />
                      
                      {/* Mostrar páginas anteriores */}
                      {paginaAtualHistorico > 2 && (
                        <Pagination.Item onClick={() => handlePaginaHistoricoChange(1)}>
                          1
                        </Pagination.Item>
                      )}
                      
                      {paginaAtualHistorico > 3 && <Pagination.Ellipsis />}
                      
                      {paginaAtualHistorico > 1 && (
                        <Pagination.Item onClick={() => handlePaginaHistoricoChange(paginaAtualHistorico - 1)}>
                          {paginaAtualHistorico - 1}
                        </Pagination.Item>
                      )}
                      
                      {/* Página atual */}
                      <Pagination.Item active>{paginaAtualHistorico}</Pagination.Item>
                      
                      {/* Mostrar páginas posteriores */}
                      {paginaAtualHistorico < totalPaginasHistorico && (
                        <Pagination.Item onClick={() => handlePaginaHistoricoChange(paginaAtualHistorico + 1)}>
                          {paginaAtualHistorico + 1}
                        </Pagination.Item>
                      )}
                      
                      {paginaAtualHistorico < totalPaginasHistorico - 2 && <Pagination.Ellipsis />}
                      
                      {paginaAtualHistorico < totalPaginasHistorico - 1 && (
                        <Pagination.Item onClick={() => handlePaginaHistoricoChange(totalPaginasHistorico)}>
                          {totalPaginasHistorico}
                        </Pagination.Item>
                      )}
                      
                      <Pagination.Next 
                        onClick={() => handlePaginaHistoricoChange(paginaAtualHistorico + 1)}
                        disabled={paginaAtualHistorico === totalPaginasHistorico}
                      />
                      <Pagination.Last 
                        onClick={() => handlePaginaHistoricoChange(totalPaginasHistorico)}
                        disabled={paginaAtualHistorico === totalPaginasHistorico}
                      />
                    </Pagination>
                  </div>
                </>
              ) : (
                <Alert variant="info">Nenhum histórico de metas encontrado para os filtros selecionados.</Alert>
              )}
            </>
          )}
        </Tab>
      </Tabs>

      {/* Modal para adicionar/editar meta */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {modoEdicao ? 'Editar Meta' : 'Nova Meta'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Tipo de Meta</Form.Label>
              <Form.Select
                value={tipoMetaSelecionada}
                onChange={(e) => setTipoMetaSelecionada(e.target.value as 'vendas' | 'cadastro_clientes')}
                disabled={modoEdicao}
              >
                <option value="vendas">Meta de Vendas</option>
                <option value="cadastro_clientes">Meta de Cadastro de Clientes</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Vendedor</Form.Label>
              <Form.Select
                value={metaSelecionada?.vendedor_id}
                onChange={(e) => handleChangeMeta('vendedor_id', parseInt(e.target.value))}
              >
                <option value="">Selecione um vendedor</option>
                {vendedores.map((vendedor) => (
                  <option key={vendedor.id} value={vendedor.id}>
                    {vendedor.nome} ({vendedor.rca})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Mês</Form.Label>
                  <Form.Select
                    value={metaSelecionada?.mes}
                    onChange={(e) => handleChangeMeta('mes', parseInt(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {getNomeMes(i + 1)}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ano</Form.Label>
                  <Form.Control
                    type="number"
                    value={metaSelecionada?.ano}
                    onChange={(e) => handleChangeMeta('ano', parseInt(e.target.value))}
                  />
                </Form.Group>
              </Col>
            </Row>

            {tipoMetaSelecionada === 'vendas' ? (
              <Form.Group className="mb-3">
                <Form.Label>Valor da Meta (R$)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={(metaSelecionada as MetaVendas)?.valor_meta || 0}
                  onChange={(e) => handleChangeMeta('valor_meta', parseFloat(e.target.value))}
                />
              </Form.Group>
            ) : (
              <Form.Group className="mb-3">
                <Form.Label>Quantidade de Clientes</Form.Label>
                <Form.Control
                  type="number"
                  value={(metaSelecionada as MetaCadastroClientes)?.quantidade_meta || 0}
                  onChange={(e) => handleChangeMeta('quantidade_meta', parseInt(e.target.value))}
                />
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Observações</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={metaSelecionada?.observacoes || ''}
                onChange={(e) => handleChangeMeta('observacoes', e.target.value)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSalvarMeta}
            disabled={loading}
          >
            {loading ? <Spinner animation="border" size="sm" /> : 'Salvar'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para visualizar progresso da meta */}
      <Modal show={showProgressoModal} onHide={() => setShowProgressoModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Progresso da Meta - {progressoMeta?.vendedor?.nome}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {progressoMeta && (
            <>
              <Card className="mb-4">
                <Card.Header>Informações da Meta</Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <p><strong>Período:</strong> {progressoMeta.meta.periodo}</p>
                      <p>
                        <strong>Tipo de Meta:</strong> {
                          progressoMeta.meta.tipo_meta === 'vendas' 
                            ? 'Meta de Vendas' 
                            : 'Meta de Cadastro de Clientes'
                        }
                      </p>
                      {progressoMeta.meta.tipo_meta === 'vendas' ? (
                        <>
                          <p><strong>Valor da Meta:</strong> {formatarValor(progressoMeta.meta.valor_meta)}</p>
                          <p><strong>Valor Realizado:</strong> {formatarValor(progressoMeta.meta.valor_realizado)}</p>
                        </>
                      ) : (
                        <>
                          <p><strong>Quantidade da Meta:</strong> {progressoMeta.meta.valor_meta}</p>
                          <p><strong>Quantidade Realizada:</strong> {progressoMeta.meta.valor_realizado}</p>
                        </>
                      )}
                    </Col>
                    <Col md={6}>
                      <p><strong>Percentual Atingido:</strong> {formatarPercentual(progressoMeta.progresso.percentual)}</p>
                      <p>
                        <strong>Status:</strong>{' '}
                        <Badge bg={getStatusColor(progressoMeta.progresso.status)}>
                          {formatarStatus(progressoMeta.progresso.status)}
                        </Badge>
                      </p>
                      {progressoMeta.meta.tipo_meta === 'vendas' ? (
                        <p><strong>Valor Faltante:</strong> {formatarValor(progressoMeta.progresso.valor_faltante)}</p>
                      ) : (
                        <p><strong>Quantidade Faltante:</strong> {progressoMeta.progresso.quantidade_faltante}</p>
                      )}
                      <p><strong>Média Diária Necessária:</strong> {
                        progressoMeta.meta.tipo_meta === 'vendas' 
                          ? formatarValor(progressoMeta.progresso.media_diaria_necessaria)
                          : progressoMeta.progresso.media_diaria_necessaria.toFixed(1)
                      }</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card>
                <Card.Header>Detalhes do Progresso</Card.Header>
                <Card.Body>
                  {progressoMeta.meta.tipo_meta === 'vendas' ? (
                    <>
                      <p><strong>Total de Vendas:</strong> {formatarValor(progressoMeta.dados.total_vendas)}</p>
                      <p><strong>Dias com Venda:</strong> {progressoMeta.dados.dias_com_venda}</p>
                      <p><strong>Última Venda:</strong> {progressoMeta.dados.ultima_venda || 'N/A'}</p>
                      <p><strong>Dias Úteis Totais:</strong> {progressoMeta.progresso.dias_uteis_totais}</p>
                      <p><strong>Dias Úteis Passados:</strong> {progressoMeta.progresso.dias_uteis_passados}</p>
                      <p><strong>Dias Úteis Restantes:</strong> {progressoMeta.progresso.dias_uteis_restantes}</p>
                    </>
                  ) : (
                    <>
                      <p><strong>Total de Cadastros:</strong> {progressoMeta.dados.total_cadastros}</p>
                      <p><strong>Último Cadastro:</strong> {progressoMeta.dados.ultimo_cadastro || 'N/A'}</p>
                      <p><strong>Dias Restantes:</strong> {progressoMeta.progresso.dias_restantes}</p>
                    </>
                  )}
                </Card.Body>
              </Card>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProgressoModal(false)}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default VendasMetas;