<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

try {
    // Verificar token JWT
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token de autorização não fornecido']);
        exit;
    }
    
    $token = $matches[1];
    $user_id = JwtUtils::validateToken($token);
    
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['error' => 'Token inválido']);
        exit;
    }

    // Inicializar banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Filtros
    $filial = isset($_GET['filial']) ? $_GET['filial'] : null;
    $caixa = isset($_GET['caixa']) ? $_GET['caixa'] : null;
    $data_inicio = isset($_GET['data_inicio']) ? $_GET['data_inicio'] : null;
    $data_fim = isset($_GET['data_fim']) ? $_GET['data_fim'] : null;
    $vendedor = isset($_GET['vendedor']) ? $_GET['vendedor'] : null;

    // Construir a consulta SQL base
    $base_where = "WHERE 1=1";
    $params = [];
    
    // Adicionar filtros à consulta
    if ($filial !== null) {
        $base_where .= " AND filial = :filial";
        $params[':filial'] = $filial;
    }
    
    if ($caixa !== null) {
        $base_where .= " AND caixa = :caixa";
        $params[':caixa'] = $caixa;
    }
    
    if ($data_inicio !== null) {
        $base_where .= " AND DATE(data) >= :data_inicio";
        $params[':data_inicio'] = $data_inicio;
    }
    
    if ($data_fim !== null) {
        $base_where .= " AND DATE(data) <= :data_fim";
        $params[':data_fim'] = $data_fim;
    }
    
    if ($vendedor !== null) {
        $base_where .= " AND vendedor = :vendedor";
        $params[':vendedor'] = $vendedor;
    }
    
    // 1. Consulta para vendas sem cancelamentos (vendas bem-sucedidas)
    $query_sem_cancelados = "
        SELECT 
            COUNT(*) as quantidade,
            COALESCE(SUM(CAST(total_itens AS DECIMAL(10,2))), 0) as valor_total
        FROM pedidos 
        $base_where 
        AND (cancelados = '[]' OR cancelados IS NULL OR cancelados = '') 
        AND (total_cancelados = 0 OR total_cancelados IS NULL)
    ";
    
    // 2. Consulta para vendas com itens cancelados (parcialmente canceladas)
    $query_com_cancelados = "
        SELECT 
            COUNT(*) as quantidade,
            COALESCE(SUM(CAST(total_itens AS DECIMAL(10,2))), 0) as valor_total,
            COALESCE(SUM(CAST(total_cancelados AS DECIMAL(10,2))), 0) as valor_cancelado
        FROM pedidos 
        $base_where 
        AND ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') OR (total_cancelados > 0))
        AND NOT ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') AND (itens = '[]' OR itens IS NULL OR itens = ''))
    ";
    
    // 3. Consulta para vendas apenas canceladas (completamente canceladas)
    $query_apenas_cancelados = "
        SELECT 
            COUNT(*) as quantidade,
            COALESCE(SUM(CAST(total_cancelados AS DECIMAL(10,2))), 0) as valor_cancelado
        FROM pedidos 
        $base_where 
        AND (cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') 
        AND (itens = '[]' OR itens IS NULL OR itens = '')
    ";
    
    // 4. Consulta para totais gerais
    $query_totais = "
        SELECT 
            COUNT(*) as total_pedidos,
            COALESCE(SUM(CAST(total_itens AS DECIMAL(10,2))), 0) as valor_total_geral,
            COALESCE(SUM(CAST(total_cancelados AS DECIMAL(10,2))), 0) as valor_cancelado_geral
        FROM pedidos 
        $base_where
    ";
    
    // 5. Consulta para dados por período (para gráfico temporal)
    $query_por_periodo = "
        SELECT 
            DATE(data) as data_venda,
            COUNT(*) as total_pedidos,
            SUM(CASE 
                WHEN (cancelados = '[]' OR cancelados IS NULL OR cancelados = '') 
                AND (total_cancelados = 0 OR total_cancelados IS NULL) 
                THEN 1 ELSE 0 END) as sem_cancelados,
            SUM(CASE 
                WHEN ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') OR (total_cancelados > 0))
                AND NOT ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') AND (itens = '[]' OR itens IS NULL OR itens = ''))
                THEN 1 ELSE 0 END) as com_cancelados,
            SUM(CASE 
                WHEN (cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') 
                AND (itens = '[]' OR itens IS NULL OR itens = '')
                THEN 1 ELSE 0 END) as apenas_cancelados,
            COALESCE(SUM(CAST(total_itens AS DECIMAL(10,2))), 0) as valor_total,
            COALESCE(SUM(CAST(total_cancelados AS DECIMAL(10,2))), 0) as valor_cancelado
        FROM pedidos 
        $base_where
        GROUP BY DATE(data)
        ORDER BY data_venda DESC
        LIMIT 30
    ";
    
    // 6. Consulta para dados agrupados por filial (quando filial não especificada)
    $query_por_filial = null;
    if ($filial === null) {
        $query_por_filial = "
            SELECT 
                filial,
                COUNT(*) as total_pedidos,
                SUM(CASE 
                    WHEN (cancelados = '[]' OR cancelados IS NULL OR cancelados = '') 
                    AND (total_cancelados = 0 OR total_cancelados IS NULL) 
                    THEN 1 ELSE 0 END) as sem_cancelados,
                SUM(CASE 
                    WHEN ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') OR (total_cancelados > 0))
                    AND NOT ((cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') AND (itens = '[]' OR itens IS NULL OR itens = ''))
                    THEN 1 ELSE 0 END) as com_cancelados,
                SUM(CASE 
                    WHEN (cancelados != '[]' AND cancelados IS NOT NULL AND cancelados != '') 
                    AND (itens = '[]' OR itens IS NULL OR itens = '')
                    THEN 1 ELSE 0 END) as apenas_cancelados,
                COALESCE(SUM(CAST(total_itens AS DECIMAL(10,2))), 0) as valor_total,
                COALESCE(SUM(CAST(total_cancelados AS DECIMAL(10,2))), 0) as valor_cancelado
            FROM pedidos 
            $base_where
            GROUP BY filial
            ORDER BY filial ASC
        ";
    }
    
    // Executar consultas
    $resultado = [];
    
    // Vendas sem cancelamentos
    $stmt = $conn->prepare($query_sem_cancelados);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $resultado['sem_cancelados'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Vendas com cancelamentos
    $stmt = $conn->prepare($query_com_cancelados);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $resultado['com_cancelados'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Vendas apenas canceladas
    $stmt = $conn->prepare($query_apenas_cancelados);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $resultado['apenas_cancelados'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Totais gerais
    $stmt = $conn->prepare($query_totais);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $resultado['totais'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Dados por período
    $stmt = $conn->prepare($query_por_periodo);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $resultado['por_periodo'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Dados por filial (quando filial não especificada)
    if ($query_por_filial !== null) {
        $stmt = $conn->prepare($query_por_filial);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $resultado['por_filial'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Calcular percentuais
    $total_pedidos = (int)$resultado['totais']['total_pedidos'];
    if ($total_pedidos > 0) {
        $resultado['percentuais'] = [
            'sem_cancelados' => round(((int)$resultado['sem_cancelados']['quantidade'] / $total_pedidos) * 100, 2),
            'com_cancelados' => round(((int)$resultado['com_cancelados']['quantidade'] / $total_pedidos) * 100, 2),
            'apenas_cancelados' => round(((int)$resultado['apenas_cancelados']['quantidade'] / $total_pedidos) * 100, 2)
        ];
    } else {
        $resultado['percentuais'] = [
            'sem_cancelados' => 0,
            'com_cancelados' => 0,
            'apenas_cancelados' => 0
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $resultado
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => true,
        'message' => 'Erro ao gerar relatório: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => true,
        'message' => 'Erro interno: ' . $e->getMessage()
    ]);
}
?>
