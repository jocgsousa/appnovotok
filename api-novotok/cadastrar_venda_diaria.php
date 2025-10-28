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
    error_log("===== VALORES RECEBIDOS EM cadastrar_venda_diaria.php =====");
    error_log("data: " . $data['data']);
    error_log("codusur: " . $data['codusur']);
    error_log("vlcustofin: " . $data['vlcustofin'] . " (tipo: " . gettype($data['vlcustofin']) . ")");
    error_log("vlvendadodia: " . $data['vlvendadodia'] . " (tipo: " . gettype($data['vlvendadodia']) . ")");
    error_log("vldevolucao: " . $data['vldevolucao'] . " (tipo: " . gettype($data['vldevolucao']) . ")");
    error_log("valor_total: " . $data['valor_total'] . " (tipo: " . gettype($data['valor_total']) . ")");
    error_log("=====================================================");
    
    // Verificar se os dados necessários foram fornecidos
    $campos_obrigatorios = ['data', 'codusur', 'nome', 'media_itens', 'ticket_medio', 'vlcustofin', 
                           'qtcliente', 'qtd_pedidos', 'via', 'vlvendadodia', 'vldevolucao', 'valor_total'];
    
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
    
    // Verificar se já existe um registro para esta data e vendedor
    $stmt = $conn->prepare("SELECT COUNT(*) FROM vendas_diarias WHERE data = :data AND codusur = :codusur");
    $stmt->execute([
        'data' => $data['data'],
        'codusur' => $data['codusur']
    ]);
    
    if ($stmt->fetchColumn() > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Já existe um registro para esta data e vendedor']);
        exit;
    }
    
    // Preparar a inserção
    $stmt = $conn->prepare("
        INSERT INTO vendas_diarias (
            data, codusur, nome, media_itens, ticket_medio, vlcustofin, 
            qtcliente, qtd_pedidos, via, vlvendadodia, vldevolucao, valor_total
        ) VALUES (
            :data, :codusur, :nome, :media_itens, :ticket_medio, :vlcustofin, 
            :qtcliente, :qtd_pedidos, :via, :vlvendadodia, :vldevolucao, :valor_total
        )
    ");
    
    // Executar a inserção
    $stmt->execute([
        'data' => $data['data'],
        'codusur' => $data['codusur'],
        'nome' => $data['nome'],
        'media_itens' => (float) $data['media_itens'],
        'ticket_medio' => (float) $data['ticket_medio'],
        'vlcustofin' => (float) $data['vlcustofin'],
        'qtcliente' => (int) $data['qtcliente'],
        'qtd_pedidos' => (int) $data['qtd_pedidos'],
        'via' => (float) $data['via'],
        'vlvendadodia' => (float) $data['vlvendadodia'],
        'vldevolucao' => (float) $data['vldevolucao'],
        'valor_total' => (float) $data['valor_total']
    ]);
    
    // Obter o ID do registro inserido
    $id = $conn->lastInsertId();
    
    echo json_encode([
        'success' => true,
        'message' => 'Venda diária cadastrada com sucesso',
        'id' => $id
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao cadastrar venda diária: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 