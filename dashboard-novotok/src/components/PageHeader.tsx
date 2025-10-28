import React from 'react';
import { Row, Col, Button } from 'react-bootstrap';

interface PageHeaderProps {
  title: string;
  buttonText?: string;
  buttonIcon?: string;
  onButtonClick?: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  buttonText,
  buttonIcon = 'plus-circle',
  onButtonClick
}) => {
  return (
    <Row className="mb-4 align-items-center">
      <Col>
        <h2 className="mb-0">{title}</h2>
      </Col>
      {buttonText && onButtonClick && (
        <Col xs="auto" className="mt-3 mt-md-0">
          <Button variant="success" onClick={onButtonClick} className="w-100">
            <i className={`bi bi-${buttonIcon} me-2`}></i>
            {buttonText}
          </Button>
        </Col>
      )}
    </Row>
  );
};

export default PageHeader; 