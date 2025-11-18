import React, { useEffect, useMemo, useState } from 'react';
import { Container, Card, Form, Button, Alert, Spinner, Row, Col, ListGroup } from 'react-bootstrap';
import { listarSecoes } from '../services/vendasService';
import { listarFiliais } from '../services/filiaisService';
import bijouSecoesFilialConfigService, { BijouSecoesFilialConfigItem } from '../services/bijouSecoesFilialConfigService';

interface SecaoOpt {
  id: number;
  codpto: number;
  codsec: number;
  descricao: string;
  departamento_descricao?: string;
}

interface FilialOpt {
  id: number;
  codigo: string;
  nome_fantasia: string;
}

type ConfigState = Record<number, { departamentos: string[]; secoes: string[]; ativo: boolean }>;

const BijouSecoesFiltrosConfig: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'danger' | 'info' } | null>(null);

  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [secoes, setSecoes] = useState<SecaoOpt[]>([]);
  const [config, setConfig] = useState<ConfigState>({});
  const [selectedFilialId, setSelectedFilialId] = useState<number | null>(null);

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

      // Carregar filiais
      try {
        const filiaisResp = await listarFiliais();
        const listaFiliais = (filiaisResp && filiaisResp.filiais) ? filiaisResp.filiais : [];
        const filiaisOpts: FilialOpt[] = listaFiliais.map((f: any) => ({
          id: f.id,
          codigo: f.codigo,
          nome_fantasia: f.nome_fantasia || f.nome || f.razao_social || `Filial ${f.codigo}`
        }));
        setFiliais(filiaisOpts);
        if (filiaisOpts.length > 0 && selectedFilialId === null) {
          setSelectedFilialId(filiaisOpts[0].id);
        }
      } catch (err) {
        console.error('Erro ao carregar filiais:', err);
        setMessage({ text: 'Erro ao carregar filiais. Tente novamente.', type: 'danger' });
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

      // Carregar configuração exclusiva de Seções Bijou por Filial (nova tabela)
      try {
        const cfgResp = await bijouSecoesFilialConfigService.listarBijouSecoesFilialConfig();
        if (cfgResp && cfgResp.success && Array.isArray(cfgResp.data)) {
          const init: ConfigState = {};
          cfgResp.data.forEach((item: BijouSecoesFilialConfigItem) => {
            init[item.filial_id] = {
              departamentos: (item.departamentos || []).map(String),
              secoes: (item.secoes || []).map(String),
              ativo: !!item.ativo,
            };
          });
          setConfig(init);
        }
      } catch (err) {
        console.warn('Aviso: falha ao obter configuração de seções por filial (nova):', err);
        setMessage(prev => prev ?? { text: 'Nenhuma configuração exclusiva encontrada. Você pode salvar uma nova.', type: 'info' });
      }

      setLoading(false);
    };
    loadAll();
  }, [selectedFilialId]);

  const updateFilialConfig = (filialId: number, patch: Partial<{ departamentos: string[]; secoes: string[]; ativo: boolean }>) => {
    setConfig((prev) => ({
      ...prev,
      [filialId]: {
        departamentos: prev[filialId]?.departamentos || [],
        secoes: prev[filialId]?.secoes || [],
        ativo: prev[filialId]?.ativo || false,
        ...patch,
      },
    }));
  };

  const cfgAtual = selectedFilialId ? (config[selectedFilialId] || { departamentos: [], secoes: [], ativo: false }) : { departamentos: [], secoes: [], ativo: false };

  const toggleSecao = (codsec: number, codpto: number) => {
    if (!selectedFilialId) return;
    const secStr = String(codsec);
    const deptStr = String(codpto);
    const isSelected = cfgAtual.secoes.includes(secStr);
    let novasSecoes: string[];
    let novosDepartamentos: string[] = [...cfgAtual.departamentos];

    if (isSelected) {
      novasSecoes = cfgAtual.secoes.filter(s => s !== secStr);
      // Se nenhuma seção restante do departamento, remover o departamento
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

    updateFilialConfig(selectedFilialId, { secoes: novasSecoes, departamentos: novosDepartamentos });
  };

  const selecionarTodasSecoes = () => {
    if (!selectedFilialId) return;
    const todasSecoes = secoes.map(s => String(s.codsec));
    const departamentosDerivados = Array.from(new Set(secoes.map(s => String(s.codpto))));
    updateFilialConfig(selectedFilialId, { secoes: todasSecoes, departamentos: departamentosDerivados });
  };

  const limparSecoes = () => {
    if (!selectedFilialId) return;
    updateFilialConfig(selectedFilialId, { secoes: [] });
    updateFilialConfig(selectedFilialId, { departamentos: [] });
  };

  const handleSalvar = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (!selectedFilialId) {
        setMessage({ text: 'Selecione uma filial antes de salvar.', type: 'info' });
        return;
      }

      const current = config[selectedFilialId] || { departamentos: [], secoes: [], ativo: false };
      const items: BijouSecoesFilialConfigItem[] = [{
        filial_id: selectedFilialId,
        departamentos: (current.departamentos || []),
        secoes: (current.secoes || []),
        ativo: !!(current.ativo),
      }];

      const resp = await bijouSecoesFilialConfigService.salvarBijouSecoesFilialConfig(items);
      if (resp && resp.success) {
        setMessage({ text: 'Configurações salvas com sucesso.', type: 'success' });
      } else {
        setMessage({ text: resp?.message || 'Falha ao salvar configurações.', type: 'danger' });
      }
    } catch (err) {
      console.error('Erro ao salvar configuração Bijou:', err);
      setMessage({ text: 'Erro ao salvar configurações.', type: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container fluid>
      <h2 className="mb-3">Configurar Filtros de Seções Bijou por Filial</h2>

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
              <Col md={5} sm={12}>
                <Form.Group controlId="filial-select">
                  <Form.Label className="fw-semibold mb-1">Filial</Form.Label>
                  <Form.Select
                    size="sm"
                    value={selectedFilialId ?? ''}
                    onChange={(e) => setSelectedFilialId(Number(e.target.value) || null)}
                  >
                    <option value="">Selecione a filial</option>
                    {filiais.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.codigo} - {f.nome_fantasia}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3} sm={6} className="d-flex align-items-end">
                <Form.Check
                  type="switch"
                  id="ativo-switch"
                  label="Ativo"
                  checked={cfgAtual.ativo}
                  onChange={(e) => selectedFilialId && updateFilialConfig(selectedFilialId, { ativo: e.target.checked })}
                />
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
              <Button variant="primary" onClick={handleSalvar} disabled={saving || !selectedFilialId}>
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

export default BijouSecoesFiltrosConfig;