<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'utils/authorization.php';

header('Content-Type: application/json');

// Verificar autorização
$auth = new Authorization();
$user_data = $auth->authorize();

if (!$user_data) {
    http_response_code(401);
    echo json_encode(['error' => 'Não autorizado']);
    exit();
}

// Conectar ao banco
$database = new Database();
$db = $database->getConnection();

try {
    // Parâmetros de filtro
    $filial = $_GET['filial'] ?? null;
    $caixa = $_GET['caixa'] ?? null;
    $data_inicio = $_GET['data_inicio'] ?? null;
    $data_fim = $_GET['data_fim'] ?? null;
    $pedido = $_GET['pedido'] ?? null;
    $vendedor = $_GET['vendedor'] ?? null;
    $status_cancelamento = $_GET['status_cancelamento'] ?? 'todos';
    
    // Parâmetros de paginação
    $page = (int)($_GET['page'] ?? 1);
    $per_page = (int)($_GET['per_page'] ?? 10);
    $offset = ($page - 1) * $per_page;
    
    // Construir consulta base
    $where_conditions = [];
    $params = [];
    
    if ($filial !== null) {
        $where_conditions[] = "filial = ?";
        $params[] = $filial;
    }
    
    if ($caixa !== null) {
        $where_conditions[] = "caixa = ?";
        $params[] = $caixa;
    }
    
    if ($data_inicio !== null) {
        $where_conditions[] = "DATE(data) >= ?";
        $params[] = $data_inicio;
    }
    
    if ($data_fim !== null) {
        $where_conditions[] = "DATE(data) <= ?";
        $params[] = $data_fim;
    }
    
    if ($pedido !== null) {
        $where_conditions[] = "pedido = ?";
        $params[] = $pedido;
    }
    
    if ($vendedor !== null) {
        $where_conditions[] = "funccx = ?";
        $params[] = $vendedor;
    }
    
    // Filtro por status de cancelamento
    if ($status_cancelamento !== 'todos') {
        switch ($status_cancelamento) {
            case 'sem_cancelamentos':
                $where_conditions[] = "(cancelados = '[]' OR cancelados IS NULL OR cancelados = '') AND (total_cancelados = 0 OR total_cancelados IS NULL)";
                break;
            case 'com_cancelamentos':
                $where_conditions[] = "((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') OR (total_cancelados > 0))";
                break;
            case 'cancelados':
                $where_conditions[] = "(cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') AND (itens = '[]' OR itens IS NULL OR itens = '')";
                break;
        }
    }
    
    $where_clause = empty($where_conditions) ? '' : 'WHERE ' . implode(' AND ', $where_conditions);
    
    // Consulta para contar total de registros
    $count_query = "SELECT COUNT(*) as total FROM pedidos $where_clause";
    $count_stmt = $db->prepare($count_query);
    $count_stmt->execute($params);
    $total_records = $count_stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Consulta principal com paginação
    $query = "SELECT 
                pedido,
                filial,
                caixa,
                data,
                data_registro_produto,
                funccx,
                codcob,
                itens,
                cancelados,
                total_itens,
                total_cancelados
              FROM pedidos 
              $where_clause 
              ORDER BY data DESC, pedido DESC 
              LIMIT ? OFFSET ?";
    
    $params[] = $per_page;
    $params[] = $offset;
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $pedidos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Processar dados dos pedidos
    foreach ($pedidos as &$pedido) {
        // Decodificar JSON dos itens e cancelados
        $pedido['itens'] = json_decode($pedido['itens'] ?? '[]', true) ?: [];
        $pedido['cancelados'] = json_decode($pedido['cancelados'] ?? '[]', true) ?: [];
        
        // Converter valores numéricos
        $pedido['total_itens'] = (float)($pedido['total_itens'] ?? 0);
        $pedido['total_cancelados'] = (float)($pedido['total_cancelados'] ?? 0);
        $pedido['filial'] = (int)$pedido['filial'];
        $pedido['caixa'] = (int)$pedido['caixa'];
        $pedido['pedido'] = (int)$pedido['pedido'];
    }
    
    // Calcular paginação
    $total_pages = ceil($total_records / $per_page);
    
    echo json_encode([
        'success' => true,
        'data' => $pedidos,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $per_page,
            'total_records' => (int)$total_records,
            'total_pages' => $total_pages
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Erro ao listar pedidos: ' . $e->getMessage()
    ]);
}
?>
