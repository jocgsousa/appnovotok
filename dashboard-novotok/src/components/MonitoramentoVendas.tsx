import React, { useState } from 'react';
import { Nav, Tab, Row, Col, Card, Alert } from 'react-bootstrap';
import PedidosVendas from './PedidosVendas';
import RequisicoesSync from './RequisicoesSync';
import RelatorioVendas from './RelatorioVendas';
import PageHeader from './PageHeader';

const MonitoramentoVendas: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('vendas');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <div className="containerview">
      <PageHeader title="Monitoramento de Vendas" />
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}
      <Card>
        <Card.Body>
          <Tab.Container activeKey={activeTab} onSelect={(k) => k && setActiveTab(k)}>
            <Row>
              <Col>
                <Nav variant="tabs" className="mb-3">
                  <Nav.Item>
                    <Nav.Link eventKey="vendas">Pedidos de Vendas</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="requisicoes">Requisições de Sincronização</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="relatorio">Relatório</Nav.Link>
                  </Nav.Item>
                </Nav>
              </Col>
            </Row>
            <Row>
              <Col>
                <Tab.Content>
                  <Tab.Pane eventKey="vendas">
                    <PedidosVendas 
                      setError={setError}
                      setSuccess={setSuccess}
                    />
                  </Tab.Pane>
                  <Tab.Pane eventKey="requisicoes">
                    <RequisicoesSync 
                      setError={setError}
                      setSuccess={setSuccess}
                    />
                  </Tab.Pane>
                  <Tab.Pane eventKey="relatorio">
                    <RelatorioVendas 
                      setError={setError}
                      setSuccess={setSuccess}
                    />
                  </Tab.Pane>
                </Tab.Content>
              </Col>
            </Row>
          </Tab.Container>
        </Card.Body>
      </Card>
    </div>
  );
};

export default MonitoramentoVendas; 