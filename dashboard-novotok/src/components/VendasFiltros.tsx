import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, ListGroup } from 'react-bootstrap';
import { listarDepartamentos, listarSecoes, salvarFiltrosVendedor, obterFiltrosVendedor } from '../services/vendasService';
import { listarVendedores } from '../services/vendedorService';

interface Departamento {
  id: number;
  codpto: number;
  descricao: string;
}

interface Secao {
  id: number;
  codpto: number;
  codsec: number;
  descricao: string;
  departamento_descricao: string;
}

interface Vendedor {
  id: number;
  nome: string;
  rca: string;
  ativo: boolean; // Adicionado para refletir a estrutura da API
}

const VendasFiltros: React.FC = () => {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [filteredSecoes, setFilteredSecoes] = useState<Secao[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState<number | null>(null);
  const [selectedDepartamentos, setSelectedDepartamentos] = useState<number[]>([]);
  const [selectedSecoes, setSelectedSecoes] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'danger' | 'info' } | null>(null);

  // Função auxiliar para verificar se todas as seções de um departamento estão selecionadas
  const todasSecoesDoDeptoSelecionadas = (codpto: number): boolean => {
    const secoesDoDepto = secoes.filter(s => s.codpto === codpto);
    if (secoesDoDepto.length === 0) return false;
    
    return secoesDoDepto.every(secao => selectedSecoes.includes(secao.codsec));
  };
  
  // Carregar vendedores, departamentos e seções ao montar o componente
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        console.log('Iniciando carregamento de dados...');
        
        // Carregar vendedores - seguindo o mesmo padrão de VendasDiarias.tsx
        console.log('Carregando vendedores...');
        try {
          const response = await listarVendedores();
          console.log('Resposta da API de vendedores:', response);
          
          if (Array.isArray(response)) {
            const vendedoresAtivos = response.filter((vendedor: Vendedor) => vendedor.ativo);
            console.log('Vendedores ativos:', vendedoresAtivos);
            setVendedores(vendedoresAtivos);
          } else {
            console.error('Resposta da API de vendedores não é um array:', response);
            // Usar dados mockados para desenvolvimento
            const vendedoresMock = [
              { id: 1, nome: 'Vendedor 1', rca: '001', ativo: true },
              { id: 2, nome: 'Vendedor 2', rca: '002', ativo: true },
              { id: 3, nome: 'Vendedor 3', rca: '003', ativo: true }
            ];
            setVendedores(vendedoresMock);
            console.log('Usando dados mockados:', vendedoresMock);
          }
        } catch (vendedoresError) {
          console.error('Erro ao carregar vendedores:', vendedoresError);
          // Usar dados mockados para desenvolvimento
          const vendedoresMock = [
            { id: 1, nome: 'Vendedor 1', rca: '001', ativo: true },
            { id: 2, nome: 'Vendedor 2', rca: '002', ativo: true },
            { id: 3, nome: 'Vendedor 3', rca: '003', ativo: true }
          ];
          setVendedores(vendedoresMock);
          console.log('Usando dados mockados após erro:', vendedoresMock);
        }

        // Carregar departamentos
        console.log('Carregando departamentos...');
        const departamentosResponse = await listarDepartamentos();
        console.log('Resposta da API de departamentos:', departamentosResponse);
        if (departamentosResponse.success && departamentosResponse.departamentos) {
          setDepartamentos(departamentosResponse.departamentos);
        }

        // Carregar todas as seções
        console.log('Carregando seções...');
        const secoesResponse = await listarSecoes();
        console.log('Resposta da API de seções:', secoesResponse);
        if (secoesResponse.success && secoesResponse.secoes) {
          setSecoes(secoesResponse.secoes);
          setFilteredSecoes(secoesResponse.secoes);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setMessage({
          text: 'Erro ao carregar dados. Por favor, tente novamente.',
          type: 'danger'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Efeito para verificar se todas as seções de um departamento estão selecionadas
  useEffect(() => {
    // Criar uma cópia dos departamentos selecionados para evitar modificar durante a iteração
    let departamentosParaAdicionar: number[] = [];
    
    departamentos.forEach(departamento => {
      // Se o departamento já está selecionado, não precisa verificar
      if (selectedDepartamentos.includes(departamento.codpto)) return;
      
      const secoesDoDepto = secoes.filter(s => s.codpto === departamento.codpto);
      if (secoesDoDepto.length === 0) return;
      
      // Verificar se todas as seções deste departamento estão selecionadas
      const todasSelecionadas = secoesDoDepto.every(secao => 
        selectedSecoes.includes(secao.codsec)
      );
      
      // Se todas as seções estiverem selecionadas, mas o departamento não estiver,
      // adicionar o departamento à lista para atualizar depois
      if (todasSelecionadas) {
        departamentosParaAdicionar.push(departamento.codpto);
      }
    });
    
    // Se houver departamentos para adicionar, atualizar o estado uma única vez
    if (departamentosParaAdicionar.length > 0) {
      setSelectedDepartamentos(prev => [...prev, ...departamentosParaAdicionar]);
    }
  }, [selectedSecoes, departamentos, secoes, selectedDepartamentos]);

  // Filtrar seções quando departamentos selecionados mudarem
  useEffect(() => {
    // Não vamos mais filtrar as seções, apenas marcar quais pertencem aos departamentos selecionados
    setFilteredSecoes(secoes);
  }, [selectedDepartamentos, secoes]);

  // Carregar filtros do vendedor selecionado
  useEffect(() => {
    const loadVendedorFiltros = async () => {
      if (selectedVendedor) {
        setLoading(true);
        try {
          const response = await obterFiltrosVendedor(selectedVendedor);
          if (response.success) {
            setSelectedDepartamentos(response.departamentos.map((d: any) => d.codpto));
            setSelectedSecoes(response.secoes.map((s: any) => s.codsec));
          }
        } catch (error) {
          console.error('Erro ao carregar filtros do vendedor:', error);
          setMessage({
            text: 'Erro ao carregar filtros do vendedor.',
            type: 'danger'
          });
        } finally {
          setLoading(false);
        }
      } else {
        // Limpar seleções quando nenhum vendedor estiver selecionado
        setSelectedDepartamentos([]);
        setSelectedSecoes([]);
      }
    };

    loadVendedorFiltros();
  }, [selectedVendedor]);

  const handleVendedorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vendedorId = parseInt(e.target.value);
    setSelectedVendedor(vendedorId || null);
  };

  const handleDepartamentoToggle = (codpto: number) => {
    const isSelected = selectedDepartamentos.includes(codpto);
    
    if (isSelected) {
      // Se já estiver selecionado, remover
      setSelectedDepartamentos(prev => prev.filter(id => id !== codpto));
      
      // Remover também todas as seções deste departamento
      const secoesDoDepto = secoes.filter(s => s.codpto === codpto);
      const secoesCodigos = secoesDoDepto.map(s => s.codsec);
      
      setSelectedSecoes(prevSecoes => 
        prevSecoes.filter(secaoId => !secoesCodigos.includes(secaoId))
      );
    } else {
      // Se não estiver selecionado, adicionar
      setSelectedDepartamentos(prev => [...prev, codpto]);
      
      // Selecionar automaticamente todas as seções deste departamento
      const secoesDoDepto = secoes.filter(s => s.codpto === codpto);
      const secoesCodigos = secoesDoDepto.map(s => s.codsec);
      
      setSelectedSecoes(prevSecoes => {
        // Adicionar apenas as seções que ainda não estão selecionadas
        const novasSecoes = secoesCodigos.filter(codigo => !prevSecoes.includes(codigo));
        return [...prevSecoes, ...novasSecoes];
      });
    }
  };

  const handleSecaoToggle = (codsec: number) => {
    // Encontrar a seção que está sendo alternada
    const secao = secoes.find(s => s.codsec === codsec);
    
    if (!secao) return; // Se não encontrar a seção, não faz nada
    
    const isSelected = selectedSecoes.includes(codsec);
    
    if (isSelected) {
      // Se já estiver selecionado, remover
      setSelectedSecoes(prev => prev.filter(id => id !== codsec));
    } else {
      // Se não estiver selecionado, adicionar
      setSelectedSecoes(prev => [...prev, codsec]);
      
      // Garantir que o departamento correspondente seja marcado
      if (!selectedDepartamentos.includes(secao.codpto)) {
        setSelectedDepartamentos(prev => [...prev, secao.codpto]);
      }
    }
  };

  const handleSelectAllDepartamentos = () => {
    setSelectedDepartamentos(departamentos.map(d => d.codpto));
    // Selecionar todas as seções também
    setSelectedSecoes(secoes.map(s => s.codsec));
  };

  const handleDeselectAllDepartamentos = () => {
    setSelectedDepartamentos([]);
    setSelectedSecoes([]);
  };

  const handleSelectAllSecoes = () => {
    setSelectedSecoes(secoes.map(s => s.codsec));
  };

  const handleDeselectAllSecoes = () => {
    setSelectedSecoes([]);
  };

  const handleSubmit = async () => {
    if (!selectedVendedor) {
      setMessage({
        text: 'Por favor, selecione um vendedor.',
        type: 'danger'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await salvarFiltrosVendedor(
        selectedVendedor,
        selectedDepartamentos,
        selectedSecoes
      );

      if (response.success) {
        setMessage({
          text: 'Filtros salvos com sucesso!',
          type: 'success'
        });
      } else {
        setMessage({
          text: response.message || 'Erro ao salvar filtros.',
          type: 'danger'
        });
      }
    } catch (error) {
      console.error('Erro ao salvar filtros:', error);
      setMessage({
        text: 'Erro ao salvar filtros. Por favor, tente novamente.',
        type: 'danger'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container fluid>
      <h2 className="mb-4">Configurar Filtros de Vendas</h2>
      
      {message && (
        <Alert 
          variant={message.type} 
          onClose={() => setMessage(null)} 
          dismissible
          className="mb-4"
        >
          {message.text}
        </Alert>
      )}

      <Form>
        <Form.Group className="mb-4">
          <Form.Label>Selecione o Vendedor</Form.Label>
          <Form.Select 
            value={selectedVendedor || ''}
            onChange={(e) => handleVendedorChange(e)}
            disabled={loading}
          >
            <option value="">Selecione um vendedor...</option>
            {vendedores.map(vendedor => (
              <option key={vendedor.id} value={vendedor.id}>
                {vendedor.nome} ({vendedor.rca})
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Form>

      {loading ? (
        <div className="text-center my-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Carregando dados...</p>
        </div>
      ) : selectedVendedor ? (
        <>
          <Row className="mb-3">
            <Col>
              <Card className="bg-light">
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <h6>Departamentos selecionados ({selectedDepartamentos.length}):</h6>
                      <p className="mb-0">
                        {selectedDepartamentos.length > 0 
                          ? selectedDepartamentos.sort((a, b) => a - b).join(', ')
                          : 'Nenhum departamento selecionado'}
                      </p>
                    </Col>
                    <Col md={6}>
                      <h6>Seções selecionadas ({selectedSecoes.length}):</h6>
                      <p className="mb-0">
                        {selectedSecoes.length > 0 
                          ? selectedSecoes.sort((a, b) => a - b).join(', ')
                          : 'Nenhuma seção selecionada'}
                      </p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <Card className="mb-4">
                <Card.Header className="d-flex justify-content-between align-items-center bg-primary text-white">
                  <h5 className="mb-0">Departamentos</h5>
                  <div>
                    <Button 
                      variant="light" 
                      size="sm" 
                      onClick={handleSelectAllDepartamentos}
                      className="me-2"
                    >
                      Selecionar Todos
                    </Button>
                    <Button 
                      variant="outline-light" 
                      size="sm" 
                      onClick={handleDeselectAllDepartamentos}
                    >
                      Limpar
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <ListGroup>
                    {departamentos.map(departamento => {
                      // Definir uma cor única para cada departamento
                      const departamentoIndex = departamento.id % 10; // Usar modulo para limitar a 10 cores
                      const corDepartamento = [
                        '#e6f2ff', // Azul claro
                        '#d4edda', // Verde claro
                        '#fff3cd', // Amarelo claro
                        '#f8d7da', // Vermelho claro
                        '#e2e3e5', // Cinza claro
                        '#d1ecf1', // Ciano claro
                        '#f5e0cb', // Laranja claro
                        '#e6d9ec', // Roxo claro
                        '#ffeeba', // Amarelo âmbar claro
                        '#c3e6cb'  // Verde médio claro
                      ][departamentoIndex];
                      
                      const isSelected = selectedDepartamentos.includes(departamento.codpto);
                      const todasSecoesSelected = todasSecoesDoDeptoSelecionadas(departamento.codpto);
                      
                      return (
                        <ListGroup.Item 
                          key={departamento.id}
                          action
                          onClick={() => handleDepartamentoToggle(departamento.codpto)}
                          className="d-flex justify-content-between align-items-center"
                          style={{
                            backgroundColor: isSelected ? corDepartamento : 'inherit',
                            borderLeft: isSelected ? '5px solid #0d6efd' : '',
                            fontWeight: isSelected ? 'bold' : 'normal'
                          }}
                        >
                          <div>
                            <strong>{departamento.codpto}</strong> - {departamento.descricao}
                            {todasSecoesSelected && (
                              <span className="ms-2 badge bg-success">Todas seções selecionadas</span>
                            )}
                          </div>
                          <Form.Check 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {}} // Controlado pelo onClick do ListGroup.Item
                            onClick={e => e.stopPropagation()}
                          />
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="mb-4">
                <Card.Header className="d-flex justify-content-between align-items-center bg-success text-white">
                  <h5 className="mb-0">Seções</h5>
                  <div>
                    <Button 
                      variant="light" 
                      size="sm" 
                      onClick={handleSelectAllSecoes}
                      className="me-2"
                      disabled={secoes.length === 0}
                    >
                      Selecionar Todas
                    </Button>
                    <Button 
                      variant="outline-light" 
                      size="sm" 
                      onClick={handleDeselectAllSecoes}
                      disabled={selectedSecoes.length === 0}
                    >
                      Limpar
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {secoes.length > 0 ? (
                    <ListGroup>
                      {secoes.map(secao => {
                        // Encontrar o departamento correspondente a esta seção
                        const departamento = departamentos.find(d => d.codpto === secao.codpto);
                        const departamentoIndex = departamento ? departamento.id % 10 : 0;
                        
                        // Usar a mesma cor do departamento para suas seções
                        const corDepartamento = [
                          '#e6f2ff', // Azul claro
                          '#d4edda', // Verde claro
                          '#fff3cd', // Amarelo claro
                          '#f8d7da', // Vermelho claro
                          '#e2e3e5', // Cinza claro
                          '#d1ecf1', // Ciano claro
                          '#f5e0cb', // Laranja claro
                          '#e6d9ec', // Roxo claro
                          '#ffeeba', // Amarelo âmbar claro
                          '#c3e6cb'  // Verde médio claro
                        ][departamentoIndex];
                        
                        const pertenceAoDepartamentoSelecionado = selectedDepartamentos.includes(secao.codpto);
                        const estaSelecionada = selectedSecoes.includes(secao.codsec);
                        
                        return (
                          <ListGroup.Item 
                            key={secao.id}
                            action
                            onClick={() => handleSecaoToggle(secao.codsec)}
                            className={`d-flex justify-content-between align-items-center`}
                            style={{
                              borderLeft: pertenceAoDepartamentoSelecionado ? '5px solid #0d6efd' : '',
                              backgroundColor: pertenceAoDepartamentoSelecionado 
                                ? estaSelecionada 
                                  ? corDepartamento // Usar a mesma cor do departamento, mas mais intensa
                                  : `${corDepartamento}80` // Cor do departamento com transparência (50%)
                                : estaSelecionada 
                                  ? '#d4edda' // Verde claro para seções selecionadas sem departamento
                                  : 'inherit',
                              fontWeight: estaSelecionada ? 'bold' : 'normal'
                            }}
                          >
                            <div>
                              <strong>{secao.codsec}</strong> - {secao.descricao}
                              <div>
                                <small 
                                  className={pertenceAoDepartamentoSelecionado ? "text-primary fw-bold" : "text-muted"}
                                >
                                  Depto: {secao.departamento_descricao}
                                </small>
                              </div>
                            </div>
                            <Form.Check 
                              type="checkbox" 
                              checked={estaSelecionada}
                              onChange={() => {}} // Controlado pelo onClick do ListGroup.Item
                              onClick={e => e.stopPropagation()}
                            />
                          </ListGroup.Item>
                        );
                      })}
                    </ListGroup>
                  ) : (
                    <Alert variant="info">
                      Não há seções disponíveis.
                    </Alert>
                  )}
                </Card.Body>
              </Card>
              
            </Col>
            <Col xs={12} className="text-end mt-3">
              <Button 
                variant="primary" 
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                    Salvando...
                  </>
                ) : 'Salvar Configurações'}
              </Button>
            </Col>
          </Row>
        </>
      ) : (
        <Alert variant="info" className="text-center">
          Selecione um vendedor para configurar os filtros.
        </Alert>
      )}
    </Container>
  );
};

export default VendasFiltros; 