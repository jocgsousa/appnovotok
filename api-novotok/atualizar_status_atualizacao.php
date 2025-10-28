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

    // Receber dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Verificar se os dados necessários foram fornecidos
    if (!isset($data['id']) || !isset($data['ativa'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dados incompletos']);
        exit;
    }
    
    $id = (int) $data['id'];
    $ativa = (bool) $data['ativa'];
    
    try {
        // Iniciar transação
        $conn->beginTransaction();
        
        // Verificar se a atualização existe
        $stmt = $conn->prepare("SELECT COUNT(*) FROM sistema_atualizacoes WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $atualizacaoExiste = $stmt->fetchColumn();
        
        if (!$atualizacaoExiste) {
            $conn->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Atualização não encontrada']);
            exit;
        }
        
        // Atualizar o status
        $stmt = $conn->prepare("UPDATE sistema_atualizacoes SET ativa = :ativa WHERE id = :id");
        $stmt->execute([
            'id' => $id,
            'ativa' => $ativa ? 1 : 0
        ]);
        
        // Confirmar transação
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Status da atualização alterado com sucesso'
        ]);
        
    } catch (PDOException $e) {
        // Reverter transação em caso de erro
        $conn->rollBack();
        
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Erro ao alterar status da atualização: ' . $e->getMessage()
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