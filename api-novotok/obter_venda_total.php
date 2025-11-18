<?php
// Endpoint: obter_venda_total.php
// Objetivo: Retornar um único registro de vendas_totais por igualdade de codusur, data_inicio e data_fim

require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

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

    // Obter parâmetros obrigatórios
    $codusur = isset($_GET['codusur']) ? $_GET['codusur'] : null;
    $data_inicio = isset($_GET['data_inicio']) ? $_GET['data_inicio'] : null;
    $data_fim = isset($_GET['data_fim']) ? $_GET['data_fim'] : null;

    if (!$codusur || !$data_inicio || !$data_fim) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Parâmetros obrigatórios: codusur, data_inicio, data_fim'
        ]);
        exit;
    }

    // Consulta por igualdade exata
    $sql = "SELECT * FROM vendas_totais
            WHERE codusur = :codusur AND data_inicio = :data_inicio AND data_fim = :data_fim
            LIMIT 1";

    $stmt = $conn->prepare($sql);
    $stmt->bindValue(':codusur', $codusur);
    $stmt->bindValue(':data_inicio', $data_inicio);
    $stmt->bindValue(':data_fim', $data_fim);
    $stmt->execute();

    $venda = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$venda) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Registro não encontrado',
            'venda_total' => null
        ]);
        exit;
    }

    // Formatar campos como no listar_vendas_totais
    $resultado = [
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

    echo json_encode([
        'success' => true,
        'venda_total' => $resultado
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