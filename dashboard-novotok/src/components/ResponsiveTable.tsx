import React, { useState, useEffect } from 'react';
import { Table, Card } from 'react-bootstrap';

interface Column {
  header: string;
  accessor: string;
  cell?: (row: any) => React.ReactNode;
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps {
  columns: Column[];
  data: any[];
  isLoading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
}

const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  columns,
  data,
  isLoading = false,
  loadingComponent,
  emptyComponent
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

  const isMobile = windowWidth < 768;

  // Renderização para dispositivos móveis (cards)
  if (isMobile) {
    if (isLoading && loadingComponent) {
      return <>{loadingComponent}</>;
    }

    if (data.length === 0 && emptyComponent) {
      return <>{emptyComponent}</>;
    }

    return (
      <div className="mobile-table">
        {data.map((row, rowIndex) => (
          <Card key={rowIndex} className="mb-3">
            <Card.Body className="p-3">
              {columns
                .filter(col => !col.hideOnMobile)
                .map((column, colIndex) => (
                  <div key={colIndex} className="mb-2">
                    <strong>{column.header}: </strong>
                    <span>
                      {column.cell ? column.cell(row) : row[column.accessor]}
                    </span>
                  </div>
                ))}
            </Card.Body>
          </Card>
        ))}
      </div>
    );
  }

  // Renderização para desktop (tabela)
  return (
    <div className="table-responsive">
      <Table striped bordered hover>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading && loadingComponent ? (
            <tr>
              <td colSpan={columns.length} className="text-center">
                {loadingComponent}
              </td>
            </tr>
          ) : data.length === 0 && emptyComponent ? (
            <tr>
              <td colSpan={columns.length} className="text-center">
                {emptyComponent}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column, colIndex) => (
                  <td key={colIndex}>
                    {column.cell ? column.cell(row) : row[column.accessor]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default ResponsiveTable; 