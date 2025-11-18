import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Form, Table, Button, Spinner, Alert } from 'react-bootstrap';
import FilterAccordion from './FilterAccordion';
import { listarDepartamentos, listarSecoes } from '../services/vendasService';
import { listarFiliais } from '../services/filiaisService';
import bijouFilialService, { BijouFilialTotal } from '../services/bijouFilialService';

interface Departamento { id: number; codpto: number; descricao: string; }
interface Secao { id: number; codpto: number; codsec: number; descricao: string; }
interface Filial { id: number; codigo: string; nome_fantasia: string; }

const pad = (n: number) => String(n).padStart(2, '0');
const formatDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const BijouMakeBolsaFilial: React.FC = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);

  const [selectedDepartamentos, setSelectedDepartamentos] = useState<number[]>([]);
  const [selectedSecoes, setSelectedSecoes] = useState<number[]>([]);
  const [selectedFiliais, setSelectedFiliais] = useState<string[]>([]);

  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [ano, setAno] = useState<number>(now.getFullYear());

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totais, setTotais] = useState<BijouFilialTotal[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [deptoResp, secResp, filiaisResp] = await Promise.all([
          listarDepartamentos(),
          listarSecoes(),
          listarFiliais()
        ]);

        if (deptoResp.success && deptoResp.departamentos) setDepartamentos(deptoResp.departamentos);
        if (secResp.success && secResp.secoes) setSecoes(secResp.secoes);
        if (filiaisResp.success && filiaisResp.filiais) setFiliais(filiaisResp.filiais);

        // Seleciona todas filiais por padrão
        setSelectedFiliais((filiaisResp.filiais || []).map((f: any) => String(f.codigo)));
      } catch (err) {
        console.error('Erro ao carregar filtros:', err);
        setError('Erro ao carregar filtros.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const periodLabel = useMemo(() => `${pad(mes)}/${ano}`, [mes, ano]);

  const aplicarFiltros = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await bijouFilialService.listarTotaisBijouFilial({
        filiais: selectedFiliais,
        departamentos: selectedDepartamentos,
        secoes: selectedSecoes,
        mes,
        ano
      });
      if (resp.success && resp.data) {
        setTotais(resp.data);
      } else {
        setTotais([]);
        setError(resp.message || 'Não foi possível carregar os totais.');
      }
    } catch (err) {
      console.error('Erro ao listar totais:', err);
      setError('Erro ao listar totais de Bijou/Make/Bolsas por filial.');
    } finally {
      setLoading(false);
    }
  };

  const limparFiltros = () => {
    setSelectedDepartamentos([]);
    setSelectedSecoes([]);
    setSelectedFiliais(filiais.map(f => String(f.codigo)));
    setMes(now.getMonth() + 1);
    setAno(now.getFullYear());
    setTotais([]);
  };

  return (
    <div>
      <Card className="mb-4">
        <Card.Body>
          <h5 className="mb-0">Bijou/Make/Bolsa Filial</h5>
          <small className="text-muted">Período selecionado: {periodLabel}</small>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      <FilterAccordion title="Filtros" onApply={aplicarFiltros} onClear={limparFiltros} defaultOpen>
        <Row>
          <Col md={3} className="mb-3">
            <Form.Label>Mês</Form.Label>
            <Form.Select value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{pad(m)}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={3} className="mb-3">
            <Form.Label>Ano</Form.Label>
            <Form.Control type="number" value={ano} onChange={(e) => setAno(parseInt(e.target.value || String(now.getFullYear())))} />
          </Col>
        </Row>
        <Row>
          <Col md={4} className="mb-3">
            <Form.Label>Filiais</Form.Label>
            <div className="border rounded p-2" style={{ maxHeight: 240, overflowY: 'auto' }}>
              {filiais.map(f => (
                <Form.Check key={f.id}
                  type="checkbox"
                  id={`filial-${f.id}`}
                  label={`${f.codigo} - ${f.nome_fantasia}`}
                  checked={selectedFiliais.includes(String(f.codigo))}
                  onChange={(e) => {
                    const code = String(f.codigo);
                    setSelectedFiliais(prev => e.target.checked ? [...prev, code] : prev.filter(c => c !== code));
                  }}
                />
              ))}
            </div>
            <div className="mt-2 d-flex gap-2">
              <Button size="sm" variant="outline-secondary" onClick={() => setSelectedFiliais(filiais.map(f => String(f.codigo)))}>Selecionar todas</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => setSelectedFiliais([])}>Limpar</Button>
            </div>
          </Col>
          <Col md={4} className="mb-3">
            <Form.Label>Departamentos</Form.Label>
            <div className="border rounded p-2" style={{ maxHeight: 240, overflowY: 'auto' }}>
              {departamentos.map(d => (
                <Form.Check key={d.codpto}
                  type="checkbox"
                  id={`depto-${d.codpto}`}
                  label={`${d.codpto} - ${d.descricao}`}
                  checked={selectedDepartamentos.includes(d.codpto)}
                  onChange={(e) => {
                    setSelectedDepartamentos(prev => e.target.checked ? [...prev, d.codpto] : prev.filter(c => c !== d.codpto));
                  }}
                />
              ))}
            </div>
            <div className="mt-2 d-flex gap-2">
              <Button size="sm" variant="outline-secondary" onClick={() => setSelectedDepartamentos(departamentos.map(d => d.codpto))}>Selecionar todos</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => setSelectedDepartamentos([])}>Limpar</Button>
            </div>
          </Col>
          <Col md={4} className="mb-3">
            <Form.Label>Seções</Form.Label>
            <div className="border rounded p-2" style={{ maxHeight: 240, overflowY: 'auto' }}>
              {secoes.map(s => (
                <Form.Check key={s.codsec}
                  type="checkbox"
                  id={`sec-${s.codsec}`}
                  label={`${s.codsec} - ${s.descricao}`}
                  checked={selectedSecoes.includes(s.codsec)}
                  onChange={(e) => {
                    setSelectedSecoes(prev => e.target.checked ? [...prev, s.codsec] : prev.filter(c => c !== s.codsec));
                  }}
                />
              ))}
            </div>
            <div className="mt-2 d-flex gap-2">
              <Button size="sm" variant="outline-secondary" onClick={() => setSelectedSecoes(secoes.map(s => s.codsec))}>Selecionar todos</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => setSelectedSecoes([])}>Limpar</Button>
            </div>
          </Col>
        </Row>
      </FilterAccordion>

      <Card>
        <Card.Body>
          <Row className="mb-3">
            <Col>
              <div className="d-flex align-items-center gap-3">
                <span className="text-muted">Período:</span>
                <Form.Control type="date" value={formatDateInput(new Date(ano, mes - 1, 1))} readOnly style={{ maxWidth: 180 }} />
                <Form.Control type="date" value={formatDateInput(new Date(ano, mes, 0))} readOnly style={{ maxWidth: 180 }} />
              </div>
            </Col>
            <Col className="text-end">
              <Button variant="primary" onClick={aplicarFiltros} disabled={loading}>
                {loading ? (<><Spinner as="span" animation="border" size="sm" /> Carregando...</>) : 'Consultar Totais'}
              </Button>
            </Col>
          </Row>

          <Table striped bordered hover size="sm">
            <thead>
              <tr>
                <th>Filial</th>
                <th>Período</th>
                <th>Valor Total Bijou/Make/Bolsas</th>
              </tr>
            </thead>
            <tbody>
              {totais.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-muted">Sem dados para os filtros selecionados.</td>
                </tr>
              ) : totais.map((t, idx) => (
                <tr key={`${t.codfilial}-${idx}`}>
                  <td>{t.codfilial}</td>
                  <td>{pad(t.mes)} / {t.ano}</td>
                  <td>R$ {Number(t.valor_total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default BijouMakeBolsaFilial;