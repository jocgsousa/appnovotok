import React from 'react';
import { Offcanvas, Nav } from 'react-bootstrap';
import { Link } from 'react-router-dom';

interface MobileMenuProps {
  show: boolean;
  handleClose: () => void;
  menus: {
    rota: string;
    nome: string;
    icone: string;
  }[];
  currentPath: string;
  handleNavLinkClick: () => void;
  handleLogout: () => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  show,
  handleClose,
  menus,
  currentPath,
  handleNavLinkClick,
  handleLogout
}) => {
  return (
    <Offcanvas 
      show={show} 
      onHide={handleClose} 
      placement="start"
      className="mobile-sidebar"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Menu NovoTok</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="p-0">
        <Nav className="flex-column">
          {menus.map((menu) => (
            <Nav.Link 
              key={menu.rota}
              as={Link} 
              to={`/dashboard${menu.rota}`}
              className={currentPath.includes(menu.rota) ? 'active' : ''}
              onClick={() => {
                handleNavLinkClick();
                handleClose();
              }}
            >
              <i className={`bi bi-${menu.icone} me-2`}></i> {menu.nome}
            </Nav.Link>
          ))}
          <Nav.Link onClick={() => {
            handleLogout();
            handleClose();
          }} className="mt-2 border-top pt-2">
            <i className="bi bi-box-arrow-right me-2"></i> Sair
          </Nav.Link>
        </Nav>
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default MobileMenu; 