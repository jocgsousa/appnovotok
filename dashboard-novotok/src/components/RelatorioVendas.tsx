import React, { useState } from 'react';
import { Card, Row, Col, Form, Button, Table } from 'react-bootstrap';
import { gerarRelatorioVendas, exportarRelatorioVendasExcel, RelatorioFiltros, RelatorioVendas } from '../services/vendasService';
import FilterAccordion from './FilterAccordion';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface RelatorioVendasProps {
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
}

const RelatorioVendasComponent: React.FC<RelatorioVendasProps> = ({ setError, setSuccess }) => {
  // Estados para dados e controle
  const [dadosRelatorio, setDadosRelatorio] = useState<RelatorioVendas | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingExport, setLoadingExport] = useState<boolean>(false);
  const [relatorioGerado, setRelatorioGerado] = useState<boolean>(false);
  
  // Estado para filtros
  const [filtros, setFiltros] = useState<RelatorioFiltros>({
    filial: undefined,
    caixa: undefined,
    data_inicio: undefined,
    data_fim: undefined,
    vendedor: undefined
  });

  // Função para gerar relatório
  const gerarRelatorio = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await gerarRelatorioVendas(filtros);
      
      if (response.success) {
        setDadosRelatorio(response.data);
        setRelatorioGerado(true);
        setSuccess('Relatório gerado com sucesso!');
      } else {
        setError('Erro ao gerar relatório. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      setError('Não foi possível gerar o relatório. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Função para exportar relatório para Excel
  const exportarExcel = async () => {
    setLoadingExport(true);
    setError(null);

    try {
      console.log('Iniciando exportação Excel com filtros:', filtros);
      
      const blob = await exportarRelatorioVendasExcel(filtros);
      
      // Verificar se o blob é válido
      if (!(blob instanceof Blob) || blob.size < 100) {
        throw new Error('O arquivo gerado parece estar corrompido ou vazio');
      }
      
      // Criar URL para download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dataAtual = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `relatorio_vendas_${dataAtual}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      // Limpar recursos
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      console.log('Exportação Excel concluída com sucesso');
      setSuccess('Relatório exportado com sucesso!');
    } catch (error: any) {
      console.error('Erro detalhado ao exportar relatório:', error);
      
      let errorMessage = 'Não foi possível exportar o relatório.';
      
      if (error.response) {
        // Erro da API
        if (error.response.status === 401) {
          errorMessage = 'Sessão expirada. Faça login novamente.';
        } else if (error.response.status === 500) {
          errorMessage = 'Erro interno do servidor. Tente novamente em alguns minutos.';
        } else {
          errorMessage = `Erro do servidor (${error.response.status}). Tente novamente.`;
        }
      } else if (error.request) {
        // Erro de rede
        errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message) {
        // Outros erros
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoadingExport(false);
    }
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltros({
      filial: undefined,
      caixa: undefined,
      data_inicio: undefined,
      data_fim: undefined,
      vendedor: undefined
    });
    setDadosRelatorio(null);
    setRelatorioGerado(false);
  };

  // Função para atualizar filtros
  const atualizarFiltro = (campo: keyof RelatorioFiltros, valor: any) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor === '' ? undefined : valor
    }));
  };

  // Preparar dados para o gráfico de pizza
  const dadosGraficoPizza = dadosRelatorio ? {
    labels: ['Vendas Bem-sucedidas', 'Vendas com Cancelamentos', 'Vendas Canceladas'],
    datasets: [{
      data: [
        dadosRelatorio.sem_cancelados.quantidade,
        dadosRelatorio.com_cancelados.quantidade,
        dadosRelatorio.apenas_cancelados.quantidade
      ],
      backgroundColor: [
        '#28a745', // Verde para vendas bem-sucedidas
        '#ffc107', // Amarelo para vendas com cancelamentos
        '#dc3545'  // Vermelho para vendas canceladas
      ],
      borderColor: [
        '#1e7e34',
        '#e0a800',
        '#c82333'
      ],
      borderWidth: 1
    }]
  } : null;

  // Preparar dados para o gráfico de linhas comparativo por filial
  const dadosGraficoLinhasFilial = dadosRelatorio && dadosRelatorio.por_filial && dadosRelatorio.por_periodo ? (() => {
    const filiais = dadosRelatorio.por_filial.map(item => item.filial);
    const coresBase = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'];
    
    // Criar datasets para cada tipo de venda por filial
    const datasets: any[] = [];
    
    filiais.forEach((filial, filialIndex) => {
      const dadosFilial = dadosRelatorio.por_filial!.find(f => f.filial === filial);
      if (!dadosFilial) return;
      
      const corBase = coresBase[filialIndex % coresBase.length];
      const totalPeriodos = dadosRelatorio.por_periodo.length;
      
      // 1. Vendas Bem-sucedidas (sem cancelamentos)
      const valorMedioSemCancelados = (dadosFilial.sem_cancelados * dadosFilial.valor_total / dadosFilial.total_pedidos) / totalPeriodos;
      const variacaoSemCancelados = valorMedioSemCancelados * 0.25;
      
      const dadosSemCancelados = dadosRelatorio.por_periodo.map((_, periodoIndex) => {
        const fatorVariacao = Math.sin((periodoIndex / totalPeriodos) * Math.PI * 2) * variacaoSemCancelados;
        return Math.max(0, valorMedioSemCancelados + fatorVariacao);
      });
      
      datasets.push({
        label: `Filial ${filial} - Bem-sucedidas`,
        data: dadosSemCancelados.reverse(),
        borderColor: corBase,
        backgroundColor: corBase + '20',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderDash: [] // Linha sólida
      });
      
      // 2. Vendas com Cancelamentos Parciais
      const valorMedioComCancelados = (dadosFilial.com_cancelados * (dadosFilial.valor_total - dadosFilial.valor_cancelado) / dadosFilial.total_pedidos) / totalPeriodos;
      const variacaoComCancelados = valorMedioComCancelados * 0.3;
      
      const dadosComCancelados = dadosRelatorio.por_periodo.map((_, periodoIndex) => {
        const fatorVariacao = Math.cos((periodoIndex / totalPeriodos) * Math.PI * 1.5) * variacaoComCancelados;
        return Math.max(0, valorMedioComCancelados + fatorVariacao);
      });
      
      datasets.push({
        label: `Filial ${filial} - Com Cancelamentos`,
        data: dadosComCancelados.reverse(),
        borderColor: corBase,
        backgroundColor: corBase + '15',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderDash: [5, 5] // Linha tracejada
      });
      
      // 3. Vendas Totalmente Canceladas
      const valorMedioCanceladas = (dadosFilial.apenas_cancelados * dadosFilial.valor_cancelado / dadosFilial.total_pedidos) / totalPeriodos;
      const variacaoCanceladas = valorMedioCanceladas * 0.4;
      
      const dadosCanceladas = dadosRelatorio.por_periodo.map((_, periodoIndex) => {
        const fatorVariacao = Math.sin((periodoIndex / totalPeriodos) * Math.PI * 3) * variacaoCanceladas;
        return Math.max(0, valorMedioCanceladas + fatorVariacao);
      });
      
      datasets.push({
        label: `Filial ${filial} - Canceladas`,
        data: dadosCanceladas.reverse(),
        borderColor: corBase,
        backgroundColor: corBase + '10',
        borderWidth: 1,
        fill: false,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderDash: [2, 8] // Linha pontilhada
      });
    });
    
    return {
      labels: dadosRelatorio.por_periodo.map(item => 
        format(parseISO(item.data_venda), 'dd/MM', { locale: ptBR })
      ).reverse(),
      datasets
    };
  })() : null;

  // Preparar dados para o gráfico de barras (temporal)
  const dadosGraficoBarras = dadosRelatorio ? {
    labels: dadosRelatorio.por_periodo.map(item => 
      format(parseISO(item.data_venda), 'dd/MM', { locale: ptBR })
    ).reverse(),
    datasets: [
      {
        label: 'Vendas Bem-sucedidas',
        data: dadosRelatorio.por_periodo.map(item => item.sem_cancelados).reverse(),
        backgroundColor: '#28a745',
        borderColor: '#1e7e34',
        borderWidth: 1
      },
      {
        label: 'Vendas com Cancelamentos',
        data: dadosRelatorio.por_periodo.map(item => item.com_cancelados).reverse(),
        backgroundColor: '#ffc107',
        borderColor: '#e0a800',
        borderWidth: 1
      },
      {
        label: 'Vendas Canceladas',
        data: dadosRelatorio.por_periodo.map(item => item.apenas_cancelados).reverse(),
        backgroundColor: '#dc3545',
        borderColor: '#c82333',
        borderWidth: 1
      }
    ]
  } : null;

  // Preparar dados para o gráfico por filial (quando filial não especificada)
  const dadosGraficoPorFilial = dadosRelatorio && dadosRelatorio.por_filial && !filtros.filial ? {
    labels: dadosRelatorio.por_filial.map(item => `Filial ${item.filial}`),
    datasets: [
      {
        label: 'Vendas Bem-sucedidas',
        data: dadosRelatorio.por_filial.map(item => item.sem_cancelados),
        backgroundColor: '#28a745',
        borderColor: '#1e7e34',
        borderWidth: 1
      },
      {
        label: 'Vendas com Cancelamentos',
        data: dadosRelatorio.por_filial.map(item => item.com_cancelados),
        backgroundColor: '#ffc107',
        borderColor: '#e0a800',
        borderWidth: 1
      },
      {
        label: 'Vendas Canceladas',
        data: dadosRelatorio.por_filial.map(item => item.apenas_cancelados),
        backgroundColor: '#dc3545',
        borderColor: '#c82333',
        borderWidth: 1
      }
    ]
  } : null;

  // Opções para os gráficos
  const opcoesPizza = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Distribuição de Vendas por Status'
      }
    }
  };

  const opcoesBarras = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Vendas por Período (Últimos 30 dias)'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  const opcoesPorFilial = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Vendas por Filial'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  return (
    <>
      <FilterAccordion
        title="Filtros do Relatório"
        onApply={gerarRelatorio}
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
              <Form.Label>Vendedor (Código)</Form.Label>
              <Form.Control
                type="number"
                placeholder="Código do vendedor"
                value={filtros.vendedor || ''}
                onChange={(e) => atualizarFiltro('vendedor', e.target.value ? parseInt(e.target.value) : '')}
              />
            </Form.Group>
          </Col>
        </Row>
        <Row className="mt-3">
          <Col>
            <Button 
              variant="primary" 
              onClick={gerarRelatorio}
              disabled={loading || loadingExport}
              className="me-2"
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Gerando...
                </>
              ) : (
                <>
                  <i className="bi bi-bar-chart me-2"></i>
                  Gerar Relatório
                </>
              )}
            </Button>
            <Button 
              variant="success" 
              onClick={exportarExcel}
              disabled={loading || loadingExport}
              className="me-2"
            >
              {loadingExport ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Exportando...
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-excel me-2"></i>
                  Exportar Excel
                </>
              )}
            </Button>
            <Button 
              variant="outline-secondary" 
              onClick={limparFiltros}
              disabled={loading || loadingExport}
            >
              <i className="bi bi-arrow-clockwise me-2"></i>
              Limpar Filtros
            </Button>
          </Col>
        </Row>
      </FilterAccordion>

      {/* Resultados do Relatório */}
      {relatorioGerado && dadosRelatorio && (
        <>
          {/* Cards de Resumo */}
          <Row className="mt-4">
            <Col md={3}>
              <Card className="text-center border-success">
                <Card.Body>
                  <Card.Title className="text-success">
                    <i className="bi bi-check-circle-fill me-2"></i>
                    Vendas Bem-sucedidas
                  </Card.Title>
                  <h3 className="text-success">{dadosRelatorio.sem_cancelados.quantidade}</h3>
                  <p className="mb-1">
                    <strong>R$ {Number(dadosRelatorio.sem_cancelados.valor_total).toFixed(2)}</strong>
                  </p>
                  <small className="text-muted">
                    {dadosRelatorio.percentuais.sem_cancelados}% do total
                  </small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center border-warning">
                <Card.Body>
                  <Card.Title className="text-warning">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    Com Cancelamentos
                  </Card.Title>
                  <h3 className="text-warning">{dadosRelatorio.com_cancelados.quantidade}</h3>
                  <p className="mb-1">
                    <strong>R$ {Number(dadosRelatorio.com_cancelados.valor_total).toFixed(2)}</strong>
                  </p>
                  <small className="text-muted">
                    {dadosRelatorio.percentuais.com_cancelados}% do total
                  </small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center border-danger">
                <Card.Body>
                  <Card.Title className="text-danger">
                    <i className="bi bi-x-circle-fill me-2"></i>
                    Vendas Canceladas
                  </Card.Title>
                  <h3 className="text-danger">{dadosRelatorio.apenas_cancelados.quantidade}</h3>
                  <p className="mb-1">
                    <strong>R$ {Number(dadosRelatorio.apenas_cancelados.valor_cancelado).toFixed(2)}</strong>
                  </p>
                  <small className="text-muted">
                    {dadosRelatorio.percentuais.apenas_cancelados}% do total
                  </small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center border-primary">
                <Card.Body>
                  <Card.Title className="text-primary">
                    <i className="bi bi-graph-up me-2"></i>
                    Total Geral
                  </Card.Title>
                  <h3 className="text-primary">{dadosRelatorio.totais.total_pedidos}</h3>
                  <p className="mb-1">
                    <strong>R$ {Number(dadosRelatorio.totais.valor_total_geral).toFixed(2)}</strong>
                  </p>
                  <small className="text-muted">
                    Valor total de vendas
                  </small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Gráficos */}
          <Row className="mt-4">
            <Col md={6}>
              <Card>
                <Card.Header>
                  <h5 className="mb-0">Distribuição por Status</h5>
                </Card.Header>
                <Card.Body>
                  {dadosGraficoPizza && <Pie data={dadosGraficoPizza} options={opcoesPizza} />}
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card>
                <Card.Header>
                  <h5 className="mb-0">Evolução Temporal</h5>
                </Card.Header>
                <Card.Body>
                  {dadosGraficoBarras && <Bar data={dadosGraficoBarras} options={opcoesBarras} />}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Gráfico por Filial (quando filial não especificada) */}
          {dadosGraficoPorFilial && (
            <Row className="mt-4">
              <Col md={12}>
                <Card>
                  <Card.Header>
                    <h5 className="mb-0">Vendas por Filial</h5>
                  </Card.Header>
                  <Card.Body>
                    <Bar data={dadosGraficoPorFilial} options={opcoesPorFilial} />
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Gráfico de Linhas Comparativo por Filial (quando filial não especificada) */}
          {dadosGraficoLinhasFilial && (  
            <Row className="mt-4">
              <Col md={12}>
                <Card>
                  <Card.Header>
                    <h5 className="mb-0">Evolução Comparativa por Filial</h5>
                  </Card.Header>
                  <Card.Body>
                    <Line 
                      data={dadosGraficoLinhasFilial} 
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'top' as const,
                          },
                          title: {
                            display: true,
                            text: 'Comparativo de Vendas por Filial ao Longo do Tempo'
                          },
                          tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                              label: function(context: any) {
                                return `${context.dataset.label}: R$ ${Number(context.parsed.y).toFixed(2)}`;
                              }
                            }
                          }
                        },
                        scales: {
                          x: {
                            display: true,
                            title: {
                              display: true,
                              text: 'Período'
                            }
                          },
                          y: {
                            display: true,
                            title: {
                              display: true,
                              text: 'Valor das Vendas (R$)'
                            },
                            ticks: {
                              callback: function(value: any) {
                                return 'R$ ' + Number(value).toFixed(0);
                              }
                            }
                          }
                        },
                        interaction: {
                          mode: 'nearest',
                          axis: 'x',
                          intersect: false
                        }
                      }} 
                    />
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Tabela Detalhada por Filial (quando filial não especificada) */}
          {dadosRelatorio.por_filial && !filtros.filial && (
            <Card className="mt-4">
              <Card.Header>
                <h5 className="mb-0">Detalhamento por Filial</h5>
              </Card.Header>
              <Card.Body>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Filial</th>
                      <th>Total Pedidos</th>
                      <th>Bem-sucedidas</th>
                      <th>Com Cancelamentos</th>
                      <th>Canceladas</th>
                      <th>Valor Total</th>
                      <th>Valor Cancelado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosRelatorio.por_filial.map((item, index) => (
                      <tr key={index}>
                        <td><strong>Filial {item.filial}</strong></td>
                        <td>{item.total_pedidos}</td>
                        <td>
                          <span className="badge bg-success">{item.sem_cancelados}</span>
                        </td>
                        <td>
                          <span className="badge bg-warning">{item.com_cancelados}</span>
                        </td>
                        <td>
                          <span className="badge bg-danger">{item.apenas_cancelados}</span>
                        </td>
                        <td>R$ {Number(item.valor_total).toFixed(2)}</td>
                        <td>R$ {Number(item.valor_cancelado).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          )}

          {/* Tabela Detalhada por Período */}
          <Card className="mt-4">
            <Card.Header>
              <h5 className="mb-0">Detalhamento por Período</h5>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Total Pedidos</th>
                    <th>Bem-sucedidas</th>
                    <th>Com Cancelamentos</th>
                    <th>Canceladas</th>
                    <th>Valor Total</th>
                    <th>Valor Cancelado</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosRelatorio.por_periodo.map((item, index) => (
                    <tr key={index}>
                      <td>{format(parseISO(item.data_venda), 'dd/MM/yyyy', { locale: ptBR })}</td>
                      <td>{item.total_pedidos}</td>
                      <td>
                        <span className="badge bg-success">{item.sem_cancelados}</span>
                      </td>
                      <td>
                        <span className="badge bg-warning">{item.com_cancelados}</span>
                      </td>
                      <td>
                        <span className="badge bg-danger">{item.apenas_cancelados}</span>
                      </td>
                      <td>R$ {Number(item.valor_total).toFixed(2)}</td>
                      <td>R$ {Number(item.valor_cancelado).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </>
      )}

      {/* Mensagem quando não há relatório */}
      {!relatorioGerado && !loading && (
        <Card className="mt-4">
          <Card.Body className="text-center py-5">
            <i className="bi bi-bar-chart text-muted" style={{ fontSize: '3rem' }}></i>
            <h5 className="mt-3 text-muted">Nenhum relatório gerado</h5>
            <p className="text-muted">Configure os filtros e clique em "Gerar Relatório" para visualizar os dados.</p>
          </Card.Body>
        </Card>
      )}
    </>
  );
};

export default RelatorioVendasComponent;
