<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Verificar se a requisição é POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

    // Receber dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Log dos valores recebidos para diagnóstico
    error_log("===== VALORES RECEBIDOS EM cadastrar_venda_total.php =====");
    error_log("codusur: " . $data['codusur']);
    error_log("data_inicio: " . $data['data_inicio'] . ", data_fim: " . $data['data_fim']);
    error_log("total_vlcustofin: " . $data['total_vlcustofin'] . " (tipo: " . gettype($data['total_vlcustofin']) . ")");
    error_log("total_vlvendadodia: " . $data['total_vlvendadodia'] . " (tipo: " . gettype($data['total_vlvendadodia']) . ")");
    error_log("total_vldevolucao: " . $data['total_vldevolucao'] . " (tipo: " . gettype($data['total_vldevolucao']) . ")");
    error_log("total_valor: " . $data['total_valor'] . " (tipo: " . gettype($data['total_valor']) . ")");
    error_log("=====================================================");
    
    // Verificar se os dados necessários foram fornecidos
    $campos_obrigatorios = [
        'codusur', 'nome', 'data_inicio', 'data_fim', 'total_qtd_pedidos', 'total_media_itens', 
        'total_ticket_medio', 'total_vlcustofin', 'total_qtcliente', 'total_via', 
        'total_vlvendadodia', 'total_vldevolucao', 'total_valor'
    ];
    
    foreach ($campos_obrigatorios as $campo) {
        if (!isset($data[$campo])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Campo obrigatório não fornecido: $campo"]);
            exit;
        }
    }
    
    // Inicializar a conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();
    
    // Verificar se já existe um registro para este período e vendedor
    $stmt = $conn->prepare("
        SELECT COUNT(*) FROM vendas_totais 
        WHERE codusur = :codusur 
        AND data_inicio = :data_inicio 
        AND data_fim = :data_fim
    ");
    $stmt->execute([
        'codusur' => $data['codusur'],
        'data_inicio' => $data['data_inicio'],
        'data_fim' => $data['data_fim']
    ]);
    
    if ($stmt->fetchColumn() > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Já existe um registro para este período e vendedor']);
        exit;
    }
    
    // Preparar a inserção
    $stmt = $conn->prepare("
        INSERT INTO vendas_totais (
            codusur, nome, data_inicio, data_fim, total_qtd_pedidos, total_media_itens, 
            total_ticket_medio, total_vlcustofin, total_qtcliente, total_via, 
            total_vlvendadodia, total_vldevolucao, total_valor
        ) VALUES (
            :codusur, :nome, :data_inicio, :data_fim, :total_qtd_pedidos, :total_media_itens, 
            :total_ticket_medio, :total_vlcustofin, :total_qtcliente, :total_via, 
            :total_vlvendadodia, :total_vldevolucao, :total_valor
        )
    ");
    
    // Executar a inserção
    $stmt->execute([
        'codusur' => $data['codusur'],
        'nome' => $data['nome'],
        'data_inicio' => $data['data_inicio'],
        'data_fim' => $data['data_fim'],
        'total_qtd_pedidos' => (float) $data['total_qtd_pedidos'],
        'total_media_itens' => (float) $data['total_media_itens'],
        'total_ticket_medio' => (float) $data['total_ticket_medio'],
        'total_vlcustofin' => (float) $data['total_vlcustofin'],
        'total_qtcliente' => (int) $data['total_qtcliente'],
        'total_via' => (float) $data['total_via'],
        'total_vlvendadodia' => (float) $data['total_vlvendadodia'],
        'total_vldevolucao' => (float) $data['total_vldevolucao'],
        'total_valor' => (float) $data['total_valor']
    ]);
    
    // Obter o ID do registro inserido
    $id = $conn->lastInsertId();
    
    echo json_encode([
        'success' => true,
        'message' => 'Venda total cadastrada com sucesso',
        'id' => $id
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao cadastrar venda total: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 