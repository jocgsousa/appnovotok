<?php
require_once 'cors_config.php';
require_once 'database.php';
include_once 'jwt_utils.php';

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

    // Inicializar conexão com o banco de dados
    $database = new Database();
    $conn = $database->getConnection();

    // Receber dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Verificar se os dados necessários foram fornecidos
    if (!isset($data['status']) || !isset($data['mensagem'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dados incompletos']);
        exit;
    }
    
    // Validar os dados
    $status = (int) $data['status'];
    $mensagem = trim($data['mensagem']);
    $tipo_manutencao = isset($data['tipo_manutencao']) ? trim($data['tipo_manutencao']) : 'geral';
    $data_inicio = isset($data['data_inicio']) && $data['data_inicio'] ? $data['data_inicio'] : null;
    $data_fim = isset($data['data_fim']) && $data['data_fim'] ? $data['data_fim'] : null;
    
    // Verificar se o tipo de manutenção é válido
    $tipos_validos = ['geral', 'correcao_bugs', 'atualizacao', 'melhoria_performance', 'backup', 'outro'];
    if (!in_array($tipo_manutencao, $tipos_validos)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Tipo de manutenção inválido']);
        exit;
    }
    
    // Verificar se o status é válido (0 ou 1)
    if ($status !== 0 && $status !== 1) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Status inválido']);
        exit;
    }
    
    // Se o sistema estiver em manutenção, a mensagem é obrigatória
    if ($status === 1 && empty($mensagem)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Mensagem de manutenção é obrigatória']);
        exit;
    }
    
    // Se o sistema estiver em manutenção, a data de início é obrigatória
    if ($status === 1 && empty($data_inicio)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Data de início da manutenção é obrigatória']);
        exit;
    }
    
    // Se a data de fim for definida, verificar se é posterior à data de início
    if ($status === 1 && $data_fim && strtotime($data_fim) <= strtotime($data_inicio)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'A data de fim deve ser posterior à data de início']);
        exit;
    }
    
    try {
        // Iniciar transação
        $conn->beginTransaction();
        
        // Inserir novo registro de manutenção
        $stmt = $conn->prepare("
            INSERT INTO sistema_manutencao (status, tipo_manutencao, mensagem, data_inicio, data_fim) 
            VALUES (:status, :tipo_manutencao, :mensagem, :data_inicio, :data_fim)
        ");
        
        $stmt->execute([
            'status' => $status,
            'tipo_manutencao' => $tipo_manutencao,
            'mensagem' => $mensagem,
            'data_inicio' => $data_inicio,
            'data_fim' => $data_fim
        ]);
        
        // Confirmar transação
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Status de manutenção atualizado com sucesso'
        ]);
        
    } catch (PDOException $e) {
        // Reverter transação em caso de erro
        $conn->rollBack();
        
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Erro ao atualizar status de manutenção: ' . $e->getMessage()
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 