import React, { useState, useEffect } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Badge,
  Alert,
  Spinner,
  Form,

} from 'react-bootstrap';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, LineElement, PointElement } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import npsService, { DashboardNPS, MetricaNPS, FiltrosRelatorio } from '../services/npsService';
import { listarFiliais } from '../services/filiaisService';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

interface FilialSimples {
  id: number;
  nome: string;
}

interface CampanhaSimples {
  id: number;
  nome: string;
}

const NPSDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardNPS | null>(null);
  const [metricas, setMetricas] = useState<MetricaNPS[]>([]);
  const [filiais, setFiliais] = useState<FilialSimples[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaSimples[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosRelatorio>({
    data_inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    data_fim: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    carregarDados();
    carregarFiliais();
    carregarCampanhas();
  }, [filtros]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardData, metricasData] = await Promise.all([
        npsService.obterDashboard(filtros),
        npsService.obterMetricas(filtros)
      ]);

      console.log('Dashboard data:', dashboardData);
      console.log('Metrics data:', metricasData);
      setDashboard(dashboardData);
      setMetricas(metricasData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do NPS');
    } finally {
      setLoading(false);
    }
  };

  const carregarFiliais = async () => {
    try {
      const response = await listarFiliais();
      if (response.success && response.filiais) {
        setFiliais(response.filiais.map(f => ({ id: f.id, nome: f.nome_fantasia })));
      }
    } catch (err) {
      console.error('Erro ao carregar filiais:', err);
    }
  };

  const carregarCampanhas = async () => {
    try {
      const campanhasData = await npsService.listarCampanhas();
      setCampanhas(campanhasData.map(c => ({ id: c.id!, nome: c.nome })));
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    }
  };

  const handleFiltroChange = (campo: keyof FiltrosRelatorio, valor: any) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const exportarRelatorio = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Usar o serviço NPS para exportar o relatório
      const blob = await npsService.exportarRelatorio(filtros);
      
      // Criar URL para download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Gerar nome do arquivo com timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `relatorio_nps_${timestamp}.xlsx`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      console.error('Erro ao exportar relatório:', err);
      setError(err.message || 'Erro ao exportar relatório');
    } finally {
      setLoading(false);
    }
  };

  const obterCorNPS = (score: number): string => {
    if (score >= 70) return '#4CAF50';
    if (score >= 50) return '#FF9800';
    if (score >= 0) return '#FFC107';
    return '#F44336';
  };

  const obterClassificacaoNPS = (score: number): string => {
    if (score >= 70) return 'Excelente';
    if (score >= 50) return 'Muito Bom';
    if (score >= 0) return 'Razoável';
    return 'Crítico';
  };

  // Dados para gráfico de barras (NPS por filial)
  const dadosGraficoFiliais = dashboard ? {
    labels: dashboard.por_filial.map(f => `Filial ${f.filial}`),
    datasets: [
      {
        label: 'Score NPS',
        data: dashboard.por_filial.map(f => f.score_nps),
        backgroundColor: dashboard.por_filial.map(f => obterCorNPS(f.score_nps)),
        borderColor: dashboard.por_filial.map(f => obterCorNPS(f.score_nps)),
        borderWidth: 1
      }
    ]
  } : null;

  // Dados para gráfico de linha (evolução temporal)
  const dadosGraficoTemporal = {
    labels: metricas.map(m => new Date(m.data).toLocaleDateString('pt-BR')),
    datasets: [
      {
        label: 'Score NPS',
        data: metricas.map(m => m.score_nps),
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        tension: 0.1
      },
      {
        label: 'Nota Média',
        data: metricas.map(m => {
          const notaMedia = m.nota_media;
          return (notaMedia != null && typeof notaMedia === 'number') ? notaMedia : 0;
        }),
        borderColor: '#FF9800',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        tension: 0.1,
        yAxisID: 'y1'
      }
    ]
  };

  const opcoesGraficoTemporal = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Evolução do NPS ao Longo do Tempo'
      }
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Score NPS'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Nota Média (0-10)'
        },
        grid: {
          drawOnChartArea: false,
        },
        min: 0,
        max: 10
      }
    }
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </Spinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert variant="danger">
          <Alert.Heading>Erro ao carregar dados</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" onClick={carregarDados}>
            Tentar novamente
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h2>Dashboard NPS</h2>
          <p className="text-muted">Acompanhe as métricas de satisfação dos seus clientes</p>
        </Col>
      </Row>

      {/* Filtros */}
      <Row className="mb-4">
        <Col md={3}>
          <Form.Group>
            <Form.Label>Data Início</Form.Label>
            <Form.Control
              type="date"
              value={filtros.data_inicio || ''}
              onChange={(e) => handleFiltroChange('data_inicio', e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label>Data Fim</Form.Label>
            <Form.Control
              type="date"
              value={filtros.data_fim || ''}
              onChange={(e) => handleFiltroChange('data_fim', e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label>Filial</Form.Label>
            <Form.Select
              value={filtros.filial || ''}
              onChange={(e) => handleFiltroChange('filial', e.target.value ? parseInt(e.target.value) : undefined)}
            >
              <option value="">Todas as filiais</option>
              {filiais.map(filial => (
                <option key={filial.id} value={filial.id}>
                  {filial.nome}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group>
            <Form.Label>Campanha</Form.Label>
            <Form.Select
              value={filtros.campanha || ''}
              onChange={(e) => handleFiltroChange('campanha', e.target.value ? parseInt(e.target.value) : undefined)}
            >
              <option value="">Todas as campanhas</option>
              {campanhas.map(campanha => (
                <option key={campanha.id} value={campanha.id}>
                  {campanha.nome}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>
      <Row className="mb-4">
        <Col className="d-flex justify-content-end gap-2">
          <Button variant="success" onClick={exportarRelatorio} disabled={loading}>
            {loading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                Exportando...
              </>
            ) : (
              'Exportar Excel'
            )}
          </Button>
          <Button variant="primary" onClick={carregarDados}>
            Atualizar
          </Button>
        </Col>
      </Row>

      {dashboard && (
        <>
          {/* Cards de estatísticas */}
          <Row className="mb-4">
            <Col md={2}>
              <Card className="text-center">
                <Card.Body>
                  <h3 className="text-primary">{dashboard.estatisticas.total_envios}</h3>
                  <p className="mb-0">Total Envios</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="text-center">
                <Card.Body>
                  <h3 className="text-success">{dashboard.estatisticas.enviados}</h3>
                  <p className="mb-0">Enviados</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="text-center">
                <Card.Body>
                  <h3 className="text-info">{dashboard.estatisticas.finalizados}</h3>
                  <p className="mb-0">Finalizados</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="text-center">
                <Card.Body>
                  <h3 className="text-warning">{dashboard.estatisticas.cancelados}</h3>
                  <p className="mb-0">Cancelados</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="text-center">
                <Card.Body>
                  <h3 className="text-danger">{dashboard.estatisticas.erros}</h3>
                  <p className="mb-0">Erros</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="text-center">
                <Card.Body>
                  <h3 style={{ color: obterCorNPS(dashboard.nps.score_nps) }}>
                    {dashboard.nps.score_nps}
                  </h3>
                  <p className="mb-0">Score NPS</p>
                  <Badge bg="secondary">
                    {obterClassificacaoNPS(dashboard.nps.score_nps)}
                  </Badge>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Detalhes do NPS */}
          <Row className="mb-4">
            <Col md={6}>
              <Card>
                <Card.Header>
                  <h5>Distribuição NPS</h5>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={4} className="text-center">
                      <h4 className="text-success">{dashboard.nps.promotores}</h4>
                      <p>Promotores (9-10)</p>
                      <small className="text-muted">
                        {npsService.formatarPorcentagem(dashboard.nps.promotores, dashboard.nps.total_respostas)}
                      </small>
                    </Col>
                    <Col md={4} className="text-center">
                      <h4 className="text-warning">{dashboard.nps.neutros}</h4>
                      <p>Neutros (7-8)</p>
                      <small className="text-muted">
                        {npsService.formatarPorcentagem(dashboard.nps.neutros, dashboard.nps.total_respostas)}
                      </small>
                    </Col>
                    <Col md={4} className="text-center">
                      <h4 className="text-danger">{dashboard.nps.detratores}</h4>
                      <p>Detratores (0-6)</p>
                      <small className="text-muted">
                        {npsService.formatarPorcentagem(dashboard.nps.detratores, dashboard.nps.total_respostas)}
                      </small>
                    </Col>
                  </Row>
                  <hr />
                  <Row>
                    <Col className="text-center">
                      <h5>Nota Média: {dashboard.nps.nota_media != null ? parseFloat(dashboard.nps.nota_media.toString()).toFixed(1) : '0.0'}</h5>
                      <p className="text-muted">Total de {dashboard.nps.total_respostas} respostas</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card>
                <Card.Header>
                  <h5>NPS por Filial</h5>
                </Card.Header>
                <Card.Body>
                  {dadosGraficoFiliais && (
                    <Bar 
                      data={dadosGraficoFiliais}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            display: false
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            title: {
                              display: true,
                              text: 'Score NPS'
                            }
                          }
                        }
                      }}
                    />
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Gráfico temporal */}
          {metricas.length > 0 && (
            <Row className="mb-4">
              <Col>
                <Card>
                  <Card.Header>
                    <h5>Evolução Temporal</h5>
                  </Card.Header>
                  <Card.Body>
                    <Line data={dadosGraficoTemporal} options={opcoesGraficoTemporal} />
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Gráfico e tabela por campanha */}
          {dashboard.por_campanha && dashboard.por_campanha.length > 0 && (
            <>
              <Row className="mb-4">
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <h5>NPS por Campanha</h5>
                    </Card.Header>
                    <Card.Body>
                      <Bar 
                        data={{
                          labels: dashboard.por_campanha.map(c => c.campanha_nome),
                          datasets: [
                            {
                              label: 'Score NPS',
                              data: dashboard.por_campanha.map(c => c.score_nps),
                              backgroundColor: dashboard.por_campanha.map(c => obterCorNPS(c.score_nps)),
                              borderColor: dashboard.por_campanha.map(c => obterCorNPS(c.score_nps)),
                              borderWidth: 1
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              display: false
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Score NPS'
                              }
                            }
                          }
                        }}
                      />
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card>
                    <Card.Header>
                      <h5>Detalhes por Campanha</h5>
                    </Card.Header>
                    <Card.Body>
                      <div className="table-responsive">
                        <table className="table table-striped">
                          <thead>
                            <tr>
                              <th>Campanha</th>
                              <th>Envios</th>
                              <th>Respostas</th>
                              <th>Taxa Resposta</th>
                              <th>Nota Média</th>
                              <th>Score NPS</th>
                              <th>Classificação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboard.por_campanha.map(campanha => (
                              <tr key={campanha.campanha_id}>
                                <td>{campanha.campanha_nome}</td>
                                <td>{campanha.total_envios}</td>
                                <td>{campanha.total_respostas}</td>
                                <td>
                                  {campanha.total_envios > 0 
                                    ? `${((campanha.total_respostas / campanha.total_envios) * 100).toFixed(1)}%`
                                    : '0%'
                                  }
                                </td>
                                <td>{campanha.nota_media != null ? parseFloat(campanha.nota_media.toString()).toFixed(1) : '0.0'}</td>
                                <td>
                                  <span style={{ color: obterCorNPS(campanha.score_nps) }}>
                                    {campanha.score_nps}
                                  </span>
                                </td>
                                <td>
                                  <Badge bg="secondary">
                                    {obterClassificacaoNPS(campanha.score_nps)}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </>
          )}

          {/* Tabela por filial */}
          <Row>
            <Col>
              <Card>
                <Card.Header>
                  <h5>Detalhes por Filial</h5>
                </Card.Header>
                <Card.Body>
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Filial</th>
                          <th>Envios</th>
                          <th>Respostas</th>
                          <th>Taxa Resposta</th>
                          <th>Nota Média</th>
                          <th>Promotores</th>
                          <th>Detratores</th>
                          <th>Score NPS</th>
                          <th>Classificação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.por_filial.map(filial => (
                          <tr key={filial.filial}>
                            <td>Filial {filial.filial}</td>
                            <td>{filial.total_envios}</td>
                            <td>{filial.total_respostas}</td>
                            <td>
                              {filial.total_envios > 0 
                                ? `${((filial.total_respostas / filial.total_envios) * 100).toFixed(1)}%`
                                : '0%'
                              }
                            </td>
                            <td>{filial.nota_media != null ? parseFloat(filial.nota_media.toString()).toFixed(1) : '0.0'}</td>
                            <td className="text-success">{filial.promotores}</td>
                            <td className="text-danger">{filial.detratores}</td>
                            <td>
                              <span style={{ color: obterCorNPS(filial.score_nps) }}>
                                {filial.score_nps}
                              </span>
                            </td>
                            <td>
                              <Badge bg="secondary">
                                {obterClassificacaoNPS(filial.score_nps)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Score de Vendedores */}
          {dashboard.por_vendedor && dashboard.por_vendedor.length > 0 && (
            <Row className="mt-4">
              <Col>
                <Card>
                  <Card.Header>
                    <h5>Score de Vendedores</h5>
                  </Card.Header>
                  <Card.Body>
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>Ranking</th>
                            <th>Vendedor</th>
                            <th>Envios</th>
                            <th>Respostas</th>
                            <th>Taxa Resposta</th>
                            <th>Nota Média</th>
                            <th>Promotores</th>
                            <th>Neutros</th>
                            <th>Detratores</th>
                            <th>Score NPS</th>
                            <th>Classificação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.por_vendedor.map((vendedor, index) => (
                            <tr key={vendedor.vendedor}>
                              <td>
                                <Badge 
                                  bg={index === 0 ? 'warning' : index === 1 ? 'secondary' : index === 2 ? 'dark' : 'light'}
                                  text={index > 2 ? 'dark' : 'white'}
                                >
                                  {vendedor.ranking}º
                                </Badge>
                              </td>
                              <td>
                                <strong>{vendedor.nome_vendedor || vendedor.vendedor}</strong>
                                {vendedor.nome_vendedor && vendedor.vendedor && (
                                  <div className="small text-muted">ID: {vendedor.vendedor}</div>
                                )}
                              </td>
                              <td>{vendedor.total_envios}</td>
                              <td>{vendedor.total_respostas}</td>
                              <td>
                                <Badge bg="info">
                                  {vendedor.taxa_resposta}%
                                </Badge>
                              </td>
                              <td>
                                <span className="fw-bold">
                                  {vendedor.nota_media}
                                </span>
                              </td>
                              <td className="text-success">
                                {vendedor.promotores}
                                <small className="text-muted d-block">
                                  ({vendedor.percentual_promotores}%)
                                </small>
                              </td>
                              <td className="text-warning">
                                {vendedor.neutros}
                                <small className="text-muted d-block">
                                  ({vendedor.percentual_neutros}%)
                                </small>
                              </td>
                              <td className="text-danger">
                                {vendedor.detratores}
                                <small className="text-muted d-block">
                                  ({vendedor.percentual_detratores}%)
                                </small>
                              </td>
                              <td>
                                <span 
                                  className="fw-bold fs-5" 
                                  style={{ color: obterCorNPS(vendedor.score_nps) }}
                                >
                                  {vendedor.score_nps}
                                </span>
                              </td>
                              <td>
                                <Badge 
                                  bg={vendedor.score_nps >= 50 ? 'success' : vendedor.score_nps >= 0 ? 'warning' : 'danger'}
                                >
                                  {obterClassificacaoNPS(vendedor.score_nps)}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {dashboard.por_vendedor.length === 0 && (
                      <Alert variant="info">
                        <i className="fas fa-info-circle me-2"></i>
                        Nenhum vendedor encontrado no período selecionado.
                      </Alert>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}
    </Container>
  );
};

export default NPSDashboard;
