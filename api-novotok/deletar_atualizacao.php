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
    
    // Verificar se o ID foi fornecido
    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID não fornecido']);
        exit;
    }
    
    $id = (int) $data['id'];
    
    try {
        // Inicializar a conexão com o banco de dados
        $database = new Database();
        $conn = $database->getConnection();
        
        if (!$conn) {
            throw new Exception('Falha ao obter conexão com o banco de dados');
        }
        
        // Iniciar transação
        $conn->beginTransaction();
        
        // Verificar se a atualização existe
        $stmt = $conn->prepare("SELECT link_download FROM sistema_atualizacoes WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $atualizacao = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$atualizacao) {
            $conn->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Atualização não encontrada']);
            exit;
        }
        
        // Tentar excluir o arquivo físico se for um arquivo local
        $link_download = $atualizacao['link_download'];
        $filename = basename($link_download);
        $filepath = __DIR__ . '/versoes/' . $filename;
        
        if (file_exists($filepath)) {
            // Tentar excluir o arquivo, mas não impedir a exclusão do registro se falhar
            @unlink($filepath);
        }
        
        // Excluir a atualização
        $stmt = $conn->prepare("DELETE FROM sistema_atualizacoes WHERE id = :id");
        $stmt->execute(['id' => $id]);
        
        // Confirmar transação
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Atualização excluída com sucesso'
        ]);
        
    } catch (PDOException $e) {
        // Reverter transação em caso de erro
        if (isset($conn)) {
            $conn->rollBack();
        }
        
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Erro ao excluir atualização: ' . $e->getMessage()
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