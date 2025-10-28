import React, { useState } from 'react';
import { Card, Accordion, Button } from 'react-bootstrap';

interface FilterAccordionProps {
  title?: string;
  children: React.ReactNode;
  onApply: () => void;
  onClear: () => void;
  defaultOpen?: boolean;
}

const FilterAccordion: React.FC<FilterAccordionProps> = ({
  title = 'Filtros',
  children,
  onApply,
  onClear,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="mb-4">
      <Card.Header 
        className="d-flex justify-content-between align-items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h5 className="mb-0">{title}</h5>
        <Button 
          variant="link" 
          className="p-0 text-decoration-none"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`}></i>
        </Button>
      </Card.Header>
      <Accordion activeKey={isOpen ? '0' : ''}>
        <Accordion.Collapse eventKey="0">
          <Card.Body>
            {children}
            <div className="d-flex justify-content-end filter-buttons mt-3">
              <Button variant="secondary" className="me-2" onClick={onClear}>
                Limpar Filtros
              </Button>
              <Button variant="primary" onClick={onApply}>
                Aplicar Filtros
              </Button>
            </div>
          </Card.Body>
        </Accordion.Collapse>
      </Accordion>
    </Card>
  );
};

export default FilterAccordion; 