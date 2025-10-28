<?php
require_once 'cors_config.php';
require_once 'database.php';
include_once 'jwt_utils.php';

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Inicializar a conexão com o banco de dados
$database = new Database();
$conn = $database->getConnection();

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

    try {
        // Consultar todas as atualizações
        $stmt = $conn->prepare("
            SELECT id, versao, titulo, descricao, link_download, obrigatoria, ativa, data_lancamento 
            FROM sistema_atualizacoes 
            ORDER BY data_lancamento DESC
        ");
        $stmt->execute();
        $atualizacoes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Converter valores booleanos
        foreach ($atualizacoes as &$atualizacao) {
            $atualizacao['obrigatoria'] = (bool) $atualizacao['obrigatoria'];
            $atualizacao['ativa'] = (bool) $atualizacao['ativa'];
        }
        
        echo json_encode([
            'success' => true,
            'atualizacoes' => $atualizacoes
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Erro ao listar atualizações: ' . $e->getMessage()
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