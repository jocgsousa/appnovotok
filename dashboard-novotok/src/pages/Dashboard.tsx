import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Container, Row, Col, Nav, Navbar, Dropdown, Button } from 'react-bootstrap';
import Aparelhos from '../components/Aparelhos';
import RamosAtividades from '../components/RamosAtividades';
import MinhaConta from '../components/MinhaConta';
import Vendedores from '../components/Vendedores';
import Filiais from '../components/Filiais';
import Manutencao from '../components/Manutencao';
import Atualizacoes from '../components/Atualizacoes';
import Informativos from '../components/Informativos';
import Vendas from '../components/Vendas';
import MonitoramentoVendas from '../components/MonitoramentoVendas';
import MonitoramentoVendasMenu from '../components/MonitoramentoVendasMenu';
import ConfigCadastroClientes from '../components/ConfigCadastroClientes';
import Departamentos from '../components/Departamentos';
import Secoes from '../components/Secoes';
import Clientes from '../components/Clientes';
import Usuarios from '../components/Usuarios';
import NPSDashboard from '../components/NPSDashboard';
import NPSCampanhas from '../components/NPSCampanhas';
import MetaLojas from '../components/MetaLojas';

import WhatsAppInstances from '../components/WhatsAppInstances';
import { useAuth } from '../contexts/AuthContext';
import PrivateRoute from '../components/PrivateRoute';
import MobileMenu from '../components/MobileMenu';

// Interface para os menus
interface MenuConfig {
  rota: string;
  nome: string;
  icone: string;
  componente: React.ReactNode;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, usuario, menus } = useAuth();
  const currentPath = location.pathname;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Efeito para monitorar o tamanho da janela
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth >= 992) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Inicializa com o tamanho atual

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Configuração de todos os menus disponíveis
  const menuConfigs: MenuConfig[] = [
    { rota: '/aparelhos', nome: 'Aparelhos', icone: 'phone', componente: <Aparelhos /> },
    { rota: '/ramos-atividades', nome: 'Ramos de Atividades', icone: 'list-check', componente: <RamosAtividades /> },
    { rota: '/clientes', nome: 'Clientes', icone: 'people-fill', componente: <Clientes /> },
    { rota: '/vendedores', nome: 'Vendedores', icone: 'people', componente: <Vendedores /> },
    { rota: '/filiais', nome: 'Filiais', icone: 'building', componente: <Filiais /> },
    { rota: '/departamentos', nome: 'Departamentos', icone: 'folder', componente: <Departamentos /> },
    { rota: '/secoes', nome: 'Seções', icone: 'folder-symlink', componente: <Secoes /> },
    { rota: '/vendas', nome: 'Vendas', icone: 'graph-up', componente: <Vendas /> },
    { rota: '/monitoramento-vendas', nome: 'Vendas PDV', icone: 'display', componente: <MonitoramentoVendas /> },
    { rota: '/monitoramento-vendas-menu', nome: 'Atualizar Menu', icone: 'arrow-clockwise', componente: <MonitoramentoVendasMenu /> },
    { rota: '/informativos', nome: 'Informativos', icone: 'megaphone', componente: <Informativos /> },
    { rota: '/config-cadastro-clientes', nome: 'Cadastro Clientes', icone: 'gear', componente: <ConfigCadastroClientes /> },
    { rota: '/manutencao', nome: 'Manutenção', icone: 'tools', componente: <Manutencao /> },
    { rota: '/atualizacoes', nome: 'Atualizações', icone: 'arrow-up-circle', componente: <Atualizacoes /> },
    { rota: '/minha-conta', nome: 'Minha Conta', icone: 'person-circle', componente: <MinhaConta /> },
    { rota: '/usuarios', nome: 'Usuários', icone: 'people-fill', componente: <Usuarios /> },
    { rota: '/nps/dashboard', nome: 'NPS Dashboard', icone: 'graph-up-arrow', componente: <NPSDashboard /> },
    { rota: '/nps/campanhas', nome: 'NPS Campanhas', icone: 'megaphone-fill', componente: <NPSCampanhas /> },
    { rota: '/whatsapp/instances', nome: 'WhatsApp Instâncias', icone: 'chat-dots', componente: <WhatsAppInstances /> },
    { rota: '/meta-lojas', nome: 'Meta de Lojas', icone: 'shop', componente: <MetaLojas /> },
  ];

  // Filtrar apenas os menus que o usuário tem permissão para visualizar
  const menusPermitidos = menuConfigs.filter(menu => {
    // Verificar se o menu está na lista de menus permitidos do usuário
    return menus.some(m => m.rota === menu.rota);
  });

  // Função para fazer logout
  const handleLogout = () => {
    signOut();
  };

  // Função para fechar o sidebar após clicar em um item do menu (em dispositivos móveis)
  const handleNavLinkClick = () => {
    if (windowWidth < 992) {
      setSidebarOpen(false);
      setShowMobileMenu(false);
    }
  };

  return (
    <Container fluid className="dashboard-container p-0">
      {/* Header */}
      <Navbar bg="dark" variant="dark" expand="lg" className="header px-3">
        <Button 
          variant="outline-light" 
          className="d-lg-none me-2 sidebar-toggle"
          onClick={() => setShowMobileMenu(true)}
          aria-controls="sidebar-nav"
        >
          <i className="bi bi-list"></i>
        </Button>
        <Navbar.Brand className="me-auto">NovoTok</Navbar.Brand>
        <Dropdown align="end">
          <Dropdown.Toggle variant="dark" id="user-dropdown">
            <i className="bi bi-person-circle me-2"></i>
            <span className="d-none d-sm-inline">{usuario?.nome || 'Usuário'}</span>
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item as={Link} to="/dashboard/minha-conta">
              <i className="bi bi-person me-2"></i>
              Minha Conta
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item onClick={handleLogout}>
              <i className="bi bi-box-arrow-right me-2"></i>
              Sair
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </Navbar>
      
      {/* Menu Mobile */}
      <MobileMenu
        show={showMobileMenu}
        handleClose={() => setShowMobileMenu(false)}
        menus={menusPermitidos}
        currentPath={currentPath}
        handleNavLinkClick={handleNavLinkClick}
        handleLogout={handleLogout}
      />
      
      <Row className="g-0 flex-nowrap position-relative">
        {/* Sidebar Desktop */}
        <Col 
          md={3} 
          lg={2} 
          className={`sidebar d-none d-lg-block ${sidebarOpen ? 'show' : 'hide'}`}
        >
          <Nav className="flex-column" id="sidebar-nav">
            {menusPermitidos.map((menu) => (
              <Nav.Link 
                key={menu.rota}
                as={Link} 
                to={`/dashboard${menu.rota}`}
                className={currentPath.includes(menu.rota) ? 'active' : ''}
                onClick={handleNavLinkClick}
              >
                <i className={`bi bi-${menu.icone} me-2`}></i> {menu.nome}
              </Nav.Link>
            ))}
            <Nav.Link onClick={handleLogout} className="mt-2 border-top pt-2">
              <i className="bi bi-box-arrow-right me-2"></i> Sair
            </Nav.Link>
          </Nav>
        </Col>

        {/* Conteúdo principal */}
        <Col className="content-area">
          <Routes>
            <Route path="/" element={
              menusPermitidos.length > 0 ? 
              <div className="text-center p-3 p-md-5">
                <h2>Bem-vindo ao Dashboard NovoTok</h2>
                <p>Selecione uma opção no menu lateral para começar.</p>
              </div> : 
              <div className="text-center p-3 p-md-5">
                <h2>Sem permissões</h2>
                <p>Você não possui permissões para acessar nenhum módulo do sistema.</p>
                <p>Entre em contato com o administrador.</p>
              </div>
            } />
            
            {/* Rotas dinâmicas baseadas nas permissões */}
            {menuConfigs.map((menu) => (
              <Route 
                key={menu.rota}
                path={menu.rota} 
                element={
                  <PrivateRoute>
                    {menu.componente}
                  </PrivateRoute>
                } 
              />
            ))}
          </Routes>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;