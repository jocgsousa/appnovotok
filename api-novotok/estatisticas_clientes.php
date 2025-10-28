<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

include 'database.php';
include 'jwt_utils.php';

// Verificar se é uma requisição OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("HTTP/1.1 200 OK");
    exit();
}

// Verificar token JWT
$token = get_bearer_token();
if (!$token || !is_jwt_valid($token)) {
    echo json_encode(['success' => false, 'message' => 'Token inválido ou expirado']);
    exit();
}

// Obter parâmetros da requisição
$data_inicio = isset($_GET['data_inicio']) ? $_GET['data_inicio'] : null;
$data_fim = isset($_GET['data_fim']) ? $_GET['data_fim'] : null;
$filial = isset($_GET['filial']) ? intval($_GET['filial']) : null;
$rca = isset($_GET['rca']) ? $_GET['rca'] : null;
$agrupar_por = isset($_GET['agrupar_por']) ? $_GET['agrupar_por'] : 'mes';

// Validar o parâmetro agrupar_por
$opcoes_validas = ['dia', 'semana', 'mes', 'ano'];
if (!in_array($agrupar_por, $opcoes_validas)) {
    $agrupar_por = 'mes';
}

try {
    $database = new Database();
    $pdo = $database->getConnection();
    
    // Consulta para total de clientes
    $sql_total = "SELECT COUNT(*) as total FROM clientes WHERE 1=1";
    $params_total = [];
    
    // Consulta para clientes por status
    $sql_status = "SELECT 
                    SUM(CASE WHEN novo = 1 THEN 1 ELSE 0 END) as novos,
                    SUM(CASE WHEN atualizado = 1 THEN 1 ELSE 0 END) as atualizados,
                    SUM(CASE WHEN recused = 1 THEN 1 ELSE 0 END) as recusados,
                    SUM(CASE WHEN registered = 1 THEN 1 ELSE 0 END) as registrados,
                    SUM(CASE WHEN authorized = 1 THEN 1 ELSE 0 END) as autorizados
                  FROM clientes WHERE 1=1";
    $params_status = [];
    
    // Consulta para clientes por tipo
    $sql_tipo = "SELECT 
                  SUM(CASE WHEN corporate = 0 THEN 1 ELSE 0 END) as fisica,
                  SUM(CASE WHEN corporate = 1 THEN 1 ELSE 0 END) as juridica
                FROM clientes WHERE 1=1";
    $params_tipo = [];
    
    // Consulta para clientes por filial
    $sql_filial = "SELECT 
                    f.id, 
                    f.nome_fantasia as nome, 
                    COUNT(c.id) as total
                  FROM filiais f
                  LEFT JOIN clientes c ON c.filial = f.id
                  WHERE 1=1";
    $params_filial = [];
    
    // Consulta para clientes por vendedor
    $sql_vendedor = "SELECT 
                      v.rca, 
                      v.nome, 
                      COUNT(c.id) as total
                    FROM vendedores v
                    LEFT JOIN clientes c ON c.rca = v.rca
                    WHERE 1=1";
    $params_vendedor = [];
    
    // Consulta para clientes por ramo de atividade
    $sql_atividade = "SELECT 
                      a.id, 
                      a.ramo, 
                      COUNT(c.id) as total
                    FROM pcativi a
                    LEFT JOIN clientes c ON c.activity_id = a.id
                    WHERE 1=1";
    $params_atividade = [];
    
    // Consulta para clientes por período
    $sql_periodo = "SELECT ";
    
    // Definir o formato de data de acordo com o agrupamento
    switch ($agrupar_por) {
        case 'dia':
            $sql_periodo .= "DATE_FORMAT(clientes.created_at, '%Y-%m-%d') as periodo";
            break;
        case 'semana':
            $sql_periodo .= "CONCAT(YEAR(clientes.created_at), '-W', WEEK(clientes.created_at)) as periodo";
            break;
        case 'mes':
            $sql_periodo .= "DATE_FORMAT(clientes.created_at, '%Y-%m') as periodo";
            break;
        case 'ano':
            $sql_periodo .= "YEAR(clientes.created_at) as periodo";
            break;
    }
    
    $sql_periodo .= ", COUNT(*) as total FROM clientes WHERE 1=1";
    $params_periodo = [];
    
    // Aplicar filtros em todas as consultas
    if ($data_inicio) {
        $where_date_with_alias = " AND DATE(c.created_at) >= :data_inicio";
        $where_date_without_alias = " AND DATE(created_at) >= :data_inicio";
        
        $sql_total .= $where_date_without_alias;
        $sql_status .= $where_date_without_alias;
        $sql_tipo .= $where_date_without_alias;
        $sql_filial .= $where_date_with_alias;
        $sql_vendedor .= $where_date_with_alias;
        $sql_atividade .= $where_date_with_alias;
        $sql_periodo .= $where_date_without_alias;
        
        $params_total[':data_inicio'] = $data_inicio;
        $params_status[':data_inicio'] = $data_inicio;
        $params_tipo[':data_inicio'] = $data_inicio;
        $params_filial[':data_inicio'] = $data_inicio;
        $params_vendedor[':data_inicio'] = $data_inicio;
        $params_atividade[':data_inicio'] = $data_inicio;
        $params_periodo[':data_inicio'] = $data_inicio;
    }
    
    if ($data_fim) {
        $where_date_with_alias = " AND DATE(c.created_at) <= :data_fim";
        $where_date_without_alias = " AND DATE(created_at) <= :data_fim";
        
        $sql_total .= $where_date_without_alias;
        $sql_status .= $where_date_without_alias;
        $sql_tipo .= $where_date_without_alias;
        $sql_filial .= $where_date_with_alias;
        $sql_vendedor .= $where_date_with_alias;
        $sql_atividade .= $where_date_with_alias;
        $sql_periodo .= $where_date_without_alias;
        
        $params_total[':data_fim'] = $data_fim;
        $params_status[':data_fim'] = $data_fim;
        $params_tipo[':data_fim'] = $data_fim;
        $params_filial[':data_fim'] = $data_fim;
        $params_vendedor[':data_fim'] = $data_fim;
        $params_atividade[':data_fim'] = $data_fim;
        $params_periodo[':data_fim'] = $data_fim;
    }
    
    if ($filial) {
        $where_filial_with_alias = " AND c.filial = :filial";
        $where_filial_without_alias = " AND filial = :filial";
        
        $sql_total .= $where_filial_without_alias;
        $sql_status .= $where_filial_without_alias;
        $sql_tipo .= $where_filial_without_alias;
        $sql_filial .= $where_filial_with_alias;
        $sql_vendedor .= $where_filial_with_alias;
        $sql_atividade .= $where_filial_with_alias;
        $sql_periodo .= $where_filial_without_alias;
        
        $params_total[':filial'] = $filial;
        $params_status[':filial'] = $filial;
        $params_tipo[':filial'] = $filial;
        $params_filial[':filial'] = $filial;
        $params_vendedor[':filial'] = $filial;
        $params_atividade[':filial'] = $filial;
        $params_periodo[':filial'] = $filial;
    }
    
    if ($rca) {
        $where_rca_with_alias = " AND c.rca = :rca";
        $where_rca_without_alias = " AND rca = :rca";
        
        $sql_total .= $where_rca_without_alias;
        $sql_status .= $where_rca_without_alias;
        $sql_tipo .= $where_rca_without_alias;
        $sql_filial .= $where_rca_with_alias;
        $sql_vendedor .= $where_rca_with_alias;
        $sql_atividade .= $where_rca_with_alias;
        $sql_periodo .= $where_rca_without_alias;
        
        $params_total[':rca'] = $rca;
        $params_status[':rca'] = $rca;
        $params_tipo[':rca'] = $rca;
        $params_filial[':rca'] = $rca;
        $params_vendedor[':rca'] = $rca;
        $params_atividade[':rca'] = $rca;
        $params_periodo[':rca'] = $rca;
    }
    
    // Finalizar consultas com GROUP BY quando necessário
    $sql_filial .= " GROUP BY f.id ORDER BY total DESC";
    $sql_vendedor .= " GROUP BY v.rca ORDER BY total DESC";
    $sql_atividade .= " GROUP BY a.id ORDER BY total DESC";
    $sql_periodo .= " GROUP BY periodo ORDER BY periodo ASC";
    
    // Executar consultas
    $stmt_total = $pdo->prepare($sql_total);
    $stmt_total->execute($params_total);
    $total = $stmt_total->fetch(PDO::FETCH_ASSOC);
    
    $stmt_status = $pdo->prepare($sql_status);
    $stmt_status->execute($params_status);
    $status = $stmt_status->fetch(PDO::FETCH_ASSOC);
    
    $stmt_tipo = $pdo->prepare($sql_tipo);
    $stmt_tipo->execute($params_tipo);
    $tipo = $stmt_tipo->fetch(PDO::FETCH_ASSOC);
    
    $stmt_filial = $pdo->prepare($sql_filial);
    $stmt_filial->execute($params_filial);
    $filiais = $stmt_filial->fetchAll(PDO::FETCH_ASSOC);
    
    $stmt_vendedor = $pdo->prepare($sql_vendedor);
    $stmt_vendedor->execute($params_vendedor);
    $vendedores = $stmt_vendedor->fetchAll(PDO::FETCH_ASSOC);
    
    $stmt_atividade = $pdo->prepare($sql_atividade);
    $stmt_atividade->execute($params_atividade);
    $atividades = $stmt_atividade->fetchAll(PDO::FETCH_ASSOC);
    
    $stmt_periodo = $pdo->prepare($sql_periodo);
    $stmt_periodo->execute($params_periodo);
    $periodos = $stmt_periodo->fetchAll(PDO::FETCH_ASSOC);
    
    // Montar resposta
    $estatisticas = [
        'totalClientes' => (int)$total['total'],
        'clientesPorStatus' => [
            'novos' => (int)$status['novos'],
            'atualizados' => (int)$status['atualizados'],
            'recusados' => (int)$status['recusados'],
            'registrados' => (int)$status['registrados'],
            'autorizados' => (int)$status['autorizados']
        ],
        'clientesPorTipo' => [
            'fisica' => (int)$tipo['fisica'],
            'juridica' => (int)$tipo['juridica']
        ],
        'clientesPorFilial' => $filiais,
        'clientesPorVendedor' => $vendedores,
        'clientesPorAtividade' => $atividades,
        'clientesPorPeriodo' => $periodos
    ];
    
    echo json_encode([
        'success' => true,
        'estatisticas' => $estatisticas
    ]);
    
} catch (PDOException $e) {
    error_log("Erro ao obter estatísticas de clientes: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao obter estatísticas de clientes: ' . $e->getMessage()
    ]);
} 