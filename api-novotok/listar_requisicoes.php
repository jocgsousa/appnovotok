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
    $status = $_GET['status'] ?? null;
    
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
        $where_conditions[] = "DATE(datavendas) >= ?";
        $params[] = $data_inicio;
    }
    
    if ($data_fim !== null) {
        $where_conditions[] = "DATE(datavendas) <= ?";
        $params[] = $data_fim;
    }
    
    if ($status !== null) {
        switch ($status) {
            case 'pendente':
                $where_conditions[] = "completed = 0 AND processando = 0 AND error = 0";
                break;
            case 'processando':
                $where_conditions[] = "processando = 1";
                break;
            case 'concluida':
                $where_conditions[] = "completed = 1";
                break;
            case 'erro':
                $where_conditions[] = "error = 1";
                break;
        }
    }
    
    $where_clause = empty($where_conditions) ? '' : 'WHERE ' . implode(' AND ', $where_conditions);
    
    // Consulta para contar total de registros
    $count_query = "SELECT COUNT(*) as total FROM requisicoes_sync $where_clause";
    $count_stmt = $db->prepare($count_query);
    $count_stmt->execute($params);
    $total_records = $count_stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Consulta principal com paginação
    $query = "SELECT 
                id,
                filial,
                caixa,
                datavendas,
                nregistros,
                initial,
                completed,
                processando,
                error,
                message,
                created_at,
                updated_at
              FROM requisicoes_sync 
              $where_clause 
              ORDER BY created_at DESC 
              LIMIT ? OFFSET ?";
    
    $params[] = $per_page;
    $params[] = $offset;
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $requisicoes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Processar dados das requisições
    foreach ($requisicoes as &$requisicao) {
        // Converter valores booleanos
        $requisicao['initial'] = (bool)$requisicao['initial'];
        $requisicao['completed'] = (bool)$requisicao['completed'];
        $requisicao['processando'] = (bool)$requisicao['processando'];
        $requisicao['error'] = (bool)$requisicao['error'];
        
        // Converter valores numéricos
        $requisicao['id'] = (int)$requisicao['id'];
        $requisicao['filial'] = (int)$requisicao['filial'];
        $requisicao['caixa'] = (int)$requisicao['caixa'];
        $requisicao['nregistros'] = $requisicao['nregistros'] ? (int)$requisicao['nregistros'] : null;
    }
    
    // Calcular paginação
    $total_pages = ceil($total_records / $per_page);
    
    echo json_encode([
        'success' => true,
        'data' => $requisicoes,
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
        'error' => 'Erro ao listar requisições: ' . $e->getMessage()
    ]);
}
?>
