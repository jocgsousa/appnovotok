import React, { useState, useEffect } from 'react';
import { Card, Alert, Row, Col } from 'react-bootstrap';
import PageHeader from './PageHeader';
import ActionButtons from './ActionButtons';
import ResponsiveTable from './ResponsiveTable';
import FilterAccordion from './FilterAccordion';
import TablePagination from './TablePagination';

// Definir interfaces para os dados e filtros
interface ExemploItem {
  id: number;
  nome: string;
  // Adicionar outros campos conforme necessário
}

interface FiltrosExemplo {
  busca: string;
  // Adicionar outros filtros conforme necessário
}

const ComponenteExemplo: React.FC = () => {
  // Estados básicos
  const [itens, setItens] = useState<ExemploItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [totalPaginas, setTotalPaginas] = useState<number>(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState<number>(10);
  const [totalRegistros, setTotalRegistros] = useState<number>(0);
  
  // Estados para filtros
  const [filtros, setFiltros] = useState<FiltrosExemplo>({
    busca: ''
  });

  // Carregar dados iniciais
  useEffect(() => {
    carregarDados();
  }, [paginaAtual, registrosPorPagina]);

  // Função para carregar dados
  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Aqui você faria a chamada à API
      // const response = await suaAPI.listarItens(filtros, paginaAtual, registrosPorPagina);
      
      // Simulando dados para o exemplo
      const dadosSimulados: ExemploItem[] = [
        { id: 1, nome: 'Item 1' },
        { id: 2, nome: 'Item 2' },
      ];
      
      setItens(dadosSimulados);
      setTotalRegistros(100); // Exemplo
      setTotalPaginas(10); // Exemplo
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      setError('Não foi possível carregar os dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Função para aplicar filtros
  const aplicarFiltros = () => {
    setPaginaAtual(1); // Voltar para a primeira página ao aplicar filtros
    carregarDados();
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltros({
      busca: ''
    });
    setPaginaAtual(1);
    carregarDados();
  };

  // Função para atualizar filtros
  const atualizarFiltro = (campo: keyof FiltrosExemplo, valor: any) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  // Função para editar um item
  const editarItem = (id: number) => {
    // Implementar lógica de edição
    console.log(`Editar item ${id}`);
  };

  // Função para excluir um item
  const excluirItem = (id: number) => {
    // Implementar lógica de exclusão
    console.log(`Excluir item ${id}`);
  };

  // Definir colunas da tabela
  const columns = [
    { header: 'ID', accessor: 'id' },
    { header: 'Nome', accessor: 'nome' },
    { 
      header: 'Ações', 
      accessor: 'actions',
      cell: (row: ExemploItem) => {
        const actionButtons = [
          {
            label: 'Editar',
            icon: 'pencil',
            variant: 'primary',
            onClick: () => editarItem(row.id)
          },
          {
            label: 'Excluir',
            icon: 'trash',
            variant: 'danger',
            onClick: () => excluirItem(row.id)
          }
        ];

        return <ActionButtons buttons={actionButtons} />;
      }
    }
  ];

  // Componente de carregamento
  const loadingComponent = (
    <div className="text-center py-4">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Carregando...</span>
      </div>
      <p className="mt-2">Carregando dados...</p>
    </div>
  );

  // Componente para quando não há dados
  const emptyComponent = (
    <div className="text-center py-4">
      <i className="bi bi-exclamation-circle text-muted" style={{ fontSize: '2rem' }}></i>
      <p className="mt-2">Nenhum registro encontrado</p>
    </div>
  );

  return (
    <div className="containerview">
      <PageHeader 
        title="Título do Componente" 
        buttonText="Novo Item" 
        buttonIcon="plus-circle" 
        onButtonClick={() => console.log('Novo item')} 
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <FilterAccordion
        title="Filtros"
        onApply={aplicarFiltros}
        onClear={limparFiltros}
        defaultOpen={false}
      >
        <Row className="filter-row">
          <Col md={6} lg={4}>
            <div className="mb-3">
              <label className="form-label">Busca</label>
              <input
                type="text"
                className="form-control"
                placeholder="Digite para buscar..."
                value={filtros.busca}
                onChange={(e) => atualizarFiltro('busca', e.target.value)}
              />
            </div>
          </Col>
          {/* Adicionar outros filtros conforme necessário */}
        </Row>
      </FilterAccordion>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Lista de Itens</h5>
        </Card.Header>
        <Card.Body className="p-0 p-md-3">
          <ResponsiveTable 
            columns={columns}
            data={itens}
            isLoading={loading}
            loadingComponent={loadingComponent}
            emptyComponent={emptyComponent}
          />
          
          <TablePagination
            currentPage={paginaAtual}
            totalPages={totalPaginas}
            totalRecords={totalRegistros}
            recordsPerPage={registrosPorPagina}
            onPageChange={setPaginaAtual}
            onRecordsPerPageChange={setRegistrosPorPagina}
          />
        </Card.Body>
      </Card>
    </div>
  );
};

export default ComponenteExemplo; 