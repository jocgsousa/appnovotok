import React, { useEffect, useMemo, useState } from 'react';
import { Container, Card, Form, Button, Alert, Spinner, Row, Col, ListGroup } from 'react-bootstrap';
import { listarSecoes } from '../services/vendasService';
import { obterBijouVendedorSecoesConfig, salvarBijouVendedorSecoesConfig } from '../services/bijouVendedorSecoesConfigService';
import { listarVendedores } from '../services/funcionariosService';

interface SecaoOpt {
  id: number;
  codpto: number;
  codsec: number;
  descricao: string;
  departamento_descricao?: string;
}

interface VendedorOpt {
  id: number;
  nome: string;
  rca: string;
}

type ConfigState = Record<number, { departamentos: string[]; secoes: string[] }>; // por vendedor

const BijouSecoesFiltrosVendedor: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'danger' | 'info' } | null>(null);

  const [vendedores, setVendedores] = useState<VendedorOpt[]>([]);
  const [secoes, setSecoes] = useState<SecaoOpt[]>([]);
  const [config, setConfig] = useState<ConfigState>({});
  const [selectedVendedorId, setSelectedVendedorId] = useState<number | null>(null);

  const secoesPorDepartamento = useMemo(() => {
    const map: Record<string, SecaoOpt[]> = {};
    secoes.forEach((s) => {
      const key = String(s.codpto);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [secoes]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setMessage(null);

      // Carregar vendedores
      try {
        const vendedoresResp = await listarVendedores();
        const listaVendedores: any[] = Array.isArray(vendedoresResp) ? vendedoresResp : (vendedoresResp?.vendedores || []);
        const vendedoresOpts: VendedorOpt[] = listaVendedores.map((v: any) => ({
          id: v.id,
          nome: v.nome,
          rca: v.rca
        }));
        setVendedores(vendedoresOpts);
        if (vendedoresOpts.length > 0 && selectedVendedorId === null) {
          setSelectedVendedorId(vendedoresOpts[0].id);
        }
      } catch (err) {
        console.error('Erro ao carregar vendedores:', err);
        setMessage({ text: 'Erro ao carregar vendedores. Tente novamente.', type: 'danger' });
      }

      // Carregar seções
      try {
        const secResp = await listarSecoes();
        const secOpts: SecaoOpt[] = secResp && secResp.secoes ? secResp.secoes : [];
        setSecoes(secOpts);
      } catch (err) {
        console.error('Erro ao carregar seções:', err);
        setMessage({ text: 'Erro ao carregar seções.', type: 'danger' });
      }

      // Carregar configuração existente do vendedor
      if (selectedVendedorId) {
        try {
          const cfgResp = await obterBijouVendedorSecoesConfig(selectedVendedorId);
          if (cfgResp && cfgResp.success) {
            const departamentos = (cfgResp.departamentos || []).map((d: any) => String(d.codpto));
            const secoesSel = (cfgResp.secoes || []).map((s: any) => String(s.codsec));
            setConfig((prev) => ({
              ...prev,
              [selectedVendedorId]: {
                departamentos,
                secoes: secoesSel,
              }
            }));
          }
        } catch (err) {
          console.warn('Aviso: falha ao obter filtros do vendedor:', err);
          setMessage(prev => prev ?? { text: 'Nenhuma configuração encontrada para o vendedor. Você pode salvar uma nova.', type: 'info' });
        }
      }

      setLoading(false);
    };
    loadAll();
  }, [selectedVendedorId]);

  const updateVendedorConfig = (vendedorId: number, patch: Partial<{ departamentos: string[]; secoes: string[] }>) => {
    setConfig((prev) => ({
      ...prev,
      [vendedorId]: {
        departamentos: prev[vendedorId]?.departamentos || [],
        secoes: prev[vendedorId]?.secoes || [],
        ...patch,
      },
    }));
  };

  const cfgAtual = selectedVendedorId ? (config[selectedVendedorId] || { departamentos: [], secoes: [] }) : { departamentos: [], secoes: [] };

  const toggleSecao = (codsec: number, codpto: number) => {
    if (!selectedVendedorId) return;
    const secStr = String(codsec);
    const deptStr = String(codpto);
    const isSelected = cfgAtual.secoes.includes(secStr);
    let novasSecoes: string[];
    let novosDepartamentos: string[] = [...cfgAtual.departamentos];

    if (isSelected) {
      novasSecoes = cfgAtual.secoes.filter(s => s !== secStr);
      const restantesDoDepto = novasSecoes.filter(s => {
        const sec = secoes.find(x => String(x.codsec) === s);
        return sec && String(sec.codpto) === deptStr;
      });
      if (restantesDoDepto.length === 0) {
        novosDepartamentos = novosDepartamentos.filter(d => d !== deptStr);
      }
    } else {
      novasSecoes = [...cfgAtual.secoes, secStr];
      if (!novosDepartamentos.includes(deptStr)) {
        novosDepartamentos.push(deptStr);
      }
    }

    updateVendedorConfig(selectedVendedorId, { secoes: novasSecoes, departamentos: novosDepartamentos });
  };

  const selecionarTodasSecoes = () => {
    if (!selectedVendedorId) return;
    const todasSecoes = secoes.map(s => String(s.codsec));
    const departamentosDerivados = Array.from(new Set(secoes.map(s => String(s.codpto))));
    updateVendedorConfig(selectedVendedorId, { secoes: todasSecoes, departamentos: departamentosDerivados });
  };

  const limparSecoes = () => {
    if (!selectedVendedorId) return;
    updateVendedorConfig(selectedVendedorId, { secoes: [] });
    updateVendedorConfig(selectedVendedorId, { departamentos: [] });
  };

  const handleSalvar = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (!selectedVendedorId) {
        setMessage({ text: 'Selecione um vendedor antes de salvar.', type: 'info' });
        return;
      }

      const current = config[selectedVendedorId] || { departamentos: [], secoes: [] };
      const departamentosNum = (current.departamentos || []).map((d) => Number(d)).filter((n) => !Number.isNaN(n));
      const secoesNum = (current.secoes || []).map((s) => Number(s)).filter((n) => !Number.isNaN(n));

      const resp = await salvarBijouVendedorSecoesConfig(selectedVendedorId, departamentosNum, secoesNum, true);
      if (resp && resp.success) {
        setMessage({ text: 'Filtros de vendedor salvos com sucesso.', type: 'success' });
      } else {
        setMessage({ text: resp?.message || 'Falha ao salvar filtros do vendedor.', type: 'danger' });
      }
    } catch (err) {
      console.error('Erro ao salvar filtros do vendedor:', err);
      setMessage({ text: 'Erro ao salvar filtros do vendedor.', type: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container fluid>
      <h2 className="mb-3">Configurar Filtros de Vendas por Seções Bijou</h2>

      {message && (
        <Alert 
          variant={message.type} 
          onClose={() => setMessage(null)} 
          dismissible
          className="mb-3"
        >
          {message.text}
        </Alert>
      )}

      {loading ? (
        <div className="text-center my-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Carregando dados...</p>
        </div>
      ) : (
        <Card className="mb-4">
          <Card.Header>
            <Row className="align-items-center g-3">
              <Col md={6} sm={12}>
                <Form.Group controlId="vendedor-select">
                  <Form.Label className="fw-semibold mb-1">Vendedor (Codusur)</Form.Label>
                  <Form.Select
                    size="sm"
                    value={selectedVendedorId ?? ''}
                    onChange={(e) => setSelectedVendedorId(Number(e.target.value) || null)}
                  >
                    <option value="">Selecione o vendedor</option>
                    {vendedores.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.nome} ({v.rca})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Card.Header>
          <Card.Body>
            {/* Resumo de seções selecionadas */}
            <Row className="mb-3">
              <Col>
                <Card className="bg-light">
                  <Card.Body>
                    <h6>Seções selecionadas ({cfgAtual.secoes.length}):</h6>
                    <p className="mb-0">
                      {cfgAtual.secoes.length > 0
                        ? [...cfgAtual.secoes].sort((a, b) => Number(a) - Number(b)).join(', ')
                        : 'Nenhuma seção selecionada'}
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Card className="mb-4">
              <Card.Header className="d-flex justify-content-between align-items-center bg-success text-white">
                <h5 className="mb-0">Seções</h5>
                <div>
                  <Button 
                    variant="light" 
                    size="sm" 
                    onClick={selecionarTodasSecoes}
                    className="me-2"
                    disabled={secoes.length === 0}
                  >
                    Selecionar Todas
                  </Button>
                  <Button 
                    variant="outline-light" 
                    size="sm" 
                    onClick={limparSecoes}
                    disabled={cfgAtual.secoes.length === 0}
                  >
                    Limpar
                  </Button>
                </div>
              </Card.Header>
              <Card.Body style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {secoes.length > 0 ? (
                  <ListGroup>
                    {secoes.map((s) => {
                      const pertenceAoDepartamentoSelecionado = cfgAtual.departamentos.includes(String(s.codpto));
                      const estaSelecionada = cfgAtual.secoes.includes(String(s.codsec));
                      return (
                        <ListGroup.Item 
                          key={s.id}
                          action
                          onClick={() => toggleSecao(s.codsec, s.codpto)}
                          className="d-flex justify-content-between align-items-center"
                          style={{
                            borderLeft: pertenceAoDepartamentoSelecionado ? '5px solid #0d6efd' : '',
                            backgroundColor: estaSelecionada ? '#d4edda' : 'inherit',
                            fontWeight: estaSelecionada ? 'bold' : 'normal'
                          }}
                        >
                          <div>
                            <strong>{s.codsec}</strong> - {s.descricao}
                            <div>
                              <small className={pertenceAoDepartamentoSelecionado ? 'text-primary fw-bold' : 'text-muted'}>
                                Depto: {s.departamento_descricao || s.codpto}
                              </small>
                            </div>
                          </div>
                          <Form.Check 
                            type="checkbox" 
                            checked={estaSelecionada}
                            onChange={() => {}}
                            onClick={e => e.stopPropagation()}
                          />
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                ) : (
                  <Alert variant="info">Não há seções disponíveis.</Alert>
                )}
              </Card.Body>
            </Card>
          </Card.Body>
          <Card.Footer>
            <div className="d-flex justify-content-end">
              <Button variant="primary" onClick={handleSalvar} disabled={saving || !selectedVendedorId}>
                {saving ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Configuração'
                )}
              </Button>
            </div>
          </Card.Footer>
        </Card>
      )}
    </Container>
  );
};

export default BijouSecoesFiltrosVendedor;