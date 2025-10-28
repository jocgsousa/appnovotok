import React, { useState, useEffect } from 'react';
import { Button, Dropdown } from 'react-bootstrap';

interface ActionButton {
  label: string;
  icon: string;
  variant: string;
  onClick: () => void;
}

interface ActionButtonsProps {
  buttons: ActionButton[];
  isMobile?: boolean;
  showLabels?: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  buttons, 
  isMobile = false,
  showLabels = false
}) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Se estiver em modo mobile ou a tela for menor que 768px, exibe dropdown
  const shouldUseDropdown = isMobile || windowWidth < 768;

  // Calcular largura mínima baseada no texto mais longo
  const getMinWidth = (label: string) => {
    // Tamanhos mínimos por comprimento do texto
    if (label.length <= 5) return 90; // Textos curtos como "Editar"
    if (label.length <= 10) return 110; // Textos médios como "Permissões"
    return 130; // Textos longos como "Desvincular"
  };

  if (shouldUseDropdown) {
    return (
      <Dropdown>
        <Dropdown.Toggle variant="primary" size="sm" id="action-dropdown" className="action-dropdown-toggle">
          <i className="bi bi-three-dots"></i> Ações
        </Dropdown.Toggle>

        <Dropdown.Menu>
          {buttons.map((button, index) => (
            <Dropdown.Item 
              key={index} 
              onClick={button.onClick}
              className={`text-${button.variant}`}
            >
              <i className={`bi bi-${button.icon} me-2`}></i> {button.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  // Em telas maiores, exibe os botões normalmente
  return (
    <div className="action-buttons">
      {buttons.map((button, index) => (
        <Button
          key={index}
          variant={button.variant}
          size="sm"
          onClick={button.onClick}
          className={`${index < buttons.length - 1 ? 'me-1' : ''} ${showLabels ? 'action-button-with-label' : ''}`}
          style={showLabels ? { minWidth: getMinWidth(button.label) } : {}}
          title={button.label} // Adiciona tooltip para ajudar na identificação
        >
          <i className={`bi bi-${button.icon} ${showLabels ? 'me-1' : ''}`}></i>
          {showLabels && button.label}
        </Button>
      ))}
    </div>
  );
};

export default ActionButtons; 