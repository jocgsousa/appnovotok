import React, { useState } from 'react';
import { Container, Nav, Tab, Button, Modal } from 'react-bootstrap';
import VendasDiarias from './VendasDiarias';
import VendasTotais from './VendasTotais';
import VendasFiltros from './VendasFiltros';
import VendasMetas from './VendasMetas';
import { debugVendas } from '../services/vendasService';

const Vendas: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('diarias');
  const [debugData, setDebugData] = useState<any>(null);
  const [showDebugModal, setShowDebugModal] = useState<boolean>(false);

  const handleDebug = async () => {
    try {
      const tipo = activeTab === 'diarias' ? 'diarias' : 
                  activeTab === 'totais' ? 'totais' : 
                  activeTab === 'metas' ? 'metas' : 'filtros';
      const response = await debugVendas(tipo);
      setDebugData(response);
      setShowDebugModal(true);
    } catch (error) {
      console.error('Erro ao depurar vendas:', error);
      alert('Erro ao depurar vendas. Verifique o console para mais detalhes.');
    }
  };

  return (
    <Container fluid className="p-0">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Gerenciamento de Vendas</h1>
        <Button 
          variant="outline-info" 
          size="sm"
          onClick={handleDebug}
        >
          Depurar Dados
        </Button>
      </div>

      <Tab.Container activeKey={activeTab} onSelect={(k) => k && setActiveTab(k)}>
        <Nav variant="tabs" className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="diarias">Vendas Diárias</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="totais">Vendas Totais</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="metas">Metas</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="filtros">Configurar Filtros</Nav.Link>
          </Nav.Item>
        </Nav>
        <Tab.Content>
          <Tab.Pane eventKey="diarias">
            <VendasDiarias />
          </Tab.Pane>
          <Tab.Pane eventKey="totais">
            <VendasTotais />
          </Tab.Pane>
          <Tab.Pane eventKey="metas">
            <VendasMetas />
          </Tab.Pane>
          <Tab.Pane eventKey="filtros">
            <VendasFiltros />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      {/* Modal de Debug */}
      <Modal 
        show={showDebugModal} 
        onHide={() => setShowDebugModal(false)}
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Dados de Debug - {
              activeTab === 'diarias' ? 'Vendas Diárias' : 
              activeTab === 'totais' ? 'Vendas Totais' : 
              activeTab === 'metas' ? 'Metas de Vendedores' :
              'Configuração de Filtros'
            }
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <h5>Estrutura da Tabela:</h5>
          <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
            {debugData?.estrutura_tabela ? JSON.stringify(debugData.estrutura_tabela, null, 2) : 'Carregando...'}
          </pre>
          
          <h5>Dados:</h5>
          <pre style={{ maxHeight: '400px', overflow: 'auto' }}>
            {debugData?.dados ? JSON.stringify(debugData.dados, null, 2) : 'Carregando...'}
          </pre>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDebugModal(false)}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Vendas; 