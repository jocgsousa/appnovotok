import React from 'react';
import { Row, Col, Form, Pagination } from 'react-bootstrap';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  recordsPerPage: number;
  onPageChange: (page: number) => void;
  onRecordsPerPageChange: (records: number) => void;
}

const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  totalRecords,
  recordsPerPage,
  onPageChange,
  onRecordsPerPageChange
}) => {
  // Função para gerar os itens de paginação
  const renderPaginationItems = () => {
    const items = [];

    // Primeira página e página anterior
    items.push(
      <Pagination.First 
        key="first" 
        onClick={() => onPageChange(1)} 
        disabled={currentPage === 1} 
      />
    );
    items.push(
      <Pagination.Prev 
        key="prev" 
        onClick={() => onPageChange(currentPage - 1)} 
        disabled={currentPage === 1} 
      />
    );

    // Páginas numéricas
    let startPage = 1;
    let endPage = totalPages;

    if (totalPages > 5) {
      if (currentPage <= 3) {
        // Próximo ao início
        endPage = 5;
      } else if (currentPage >= totalPages - 2) {
        // Próximo ao fim
        startPage = totalPages - 4;
      } else {
        // No meio
        startPage = currentPage - 2;
        endPage = currentPage + 2;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <Pagination.Item
          key={i}
          active={i === currentPage}
          onClick={() => onPageChange(i)}
        >
          {i}
        </Pagination.Item>
      );
    }

    // Próxima página e última página
    items.push(
      <Pagination.Next
        key="next"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      />
    );
    items.push(
      <Pagination.Last
        key="last"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
      />
    );

    return items;
  };

  return (
    <Row className="align-items-center mt-3">
      <Col xs={12} md={6} className="mb-3 mb-md-0 text-center text-md-start">
        <span className="d-inline-block me-2">Exibindo</span>
        <Form.Select
          style={{ width: 'auto', display: 'inline-block' }}
          value={recordsPerPage}
          onChange={(e) => onRecordsPerPageChange(Number(e.target.value))}
          className="me-2"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </Form.Select>
        <span>de {totalRecords} registros</span>
      </Col>
      <Col xs={12} md={6} className="d-flex justify-content-center justify-content-md-end">
        <Pagination className="mb-0 flex-wrap">
          {renderPaginationItems()}
        </Pagination>
      </Col>
    </Row>
  );
};

export default TablePagination; 