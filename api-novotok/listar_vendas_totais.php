<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Verificar se a requisição é GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

// Verificar autenticação
$headers = getallheaders();
if (!isset($headers['Authorization'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
    exit;
}

try {
    // Validar o token
    $jwt = str_replace('Bearer ', '', $headers['Authorization']);
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token inválido']);
        exit;
    }

    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Obter parâmetros de filtro
    $codusur = isset($_GET['codusur']) ? $_GET['codusur'] : null;
    $data_inicio = isset($_GET['data_inicio']) ? $_GET['data_inicio'] : null;
    $data_fim = isset($_GET['data_fim']) ? $_GET['data_fim'] : null;

    // Construir a consulta SQL com base nos filtros
    $sql = "SELECT * FROM vendas_totais WHERE 1=1";
    $params = [];

    if ($codusur) {
        $sql .= " AND codusur = :codusur";
        $params['codusur'] = $codusur;
    }

    if ($data_inicio) {
        $sql .= " AND data_inicio >= :data_inicio";
        $params['data_inicio'] = $data_inicio;
    }

    if ($data_fim) {
        $sql .= " AND data_fim <= :data_fim";
        $params['data_fim'] = $data_fim;
    }

    $sql .= " ORDER BY data_inicio DESC";

    // Preparar e executar a consulta
    $stmt = $conn->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue(':' . $key, $value);
    }
    $stmt->execute();

    // Obter resultados
    $vendas_totais = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Formatar os dados para o formato esperado pelo frontend
    $resultados = [];
    foreach ($vendas_totais as $venda) {
        $resultados[] = [
            'id' => $venda['id'],
            'codusur' => $venda['codusur'],
            'nome' => $venda['nome'],
            'data_inicio' => date('d/m/Y', strtotime($venda['data_inicio'])),
            'data_fim' => date('d/m/Y', strtotime($venda['data_fim'])),
            'total_qtd_pedidos' => (int)$venda['total_qtd_pedidos'],
            'total_media_itens' => (float)$venda['total_media_itens'],
            'total_ticket_medio' => (float)$venda['total_ticket_medio'],
            'total_vlcustofin' => (float)$venda['total_vlcustofin'],
            'total_qtcliente' => (int)$venda['total_qtcliente'],
            'total_via' => (float)$venda['total_via'],
            'total_vlvendadodia' => (float)$venda['total_vlvendadodia'],
            'total_vldevolucao' => (float)$venda['total_vldevolucao'],
            'total_valor' => (float)$venda['total_valor']
        ];
    }

    echo json_encode([
        'success' => true,
        'vendas_totais' => $resultados
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao consultar banco de dados: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 