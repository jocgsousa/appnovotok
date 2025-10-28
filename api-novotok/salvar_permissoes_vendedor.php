<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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

// Verificar se é uma requisição POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit();
}

// Obter dados da requisição
$data = json_decode(file_get_contents("php://input"));

// Verificar se os dados necessários foram fornecidos
if (!isset($data->vendedor_id) || !is_numeric($data->vendedor_id) || !isset($data->permissoes) || !is_array($data->permissoes)) {
    echo json_encode(['success' => false, 'message' => 'Dados inválidos']);
    exit();
}

$vendedor_id = intval($data->vendedor_id);

try {
    $database = new Database();
    $pdo = $database->getConnection();
    
    // Verificar se o vendedor existe
    $stmt_vendedor = $pdo->prepare("SELECT id FROM vendedores WHERE id = :id");
    $stmt_vendedor->bindParam(':id', $vendedor_id);
    $stmt_vendedor->execute();
    
    if ($stmt_vendedor->rowCount() === 0) {
        echo json_encode(['success' => false, 'message' => 'Vendedor não encontrado']);
        exit();
    }
    
    // Iniciar transação
    $pdo->beginTransaction();
    
    // Obter todas as funcionalidades do aplicativo para validação
    $stmt_funcionalidades = $pdo->prepare("SELECT id FROM app_funcionalidades WHERE ativo = 1");
    $stmt_funcionalidades->execute();
    $funcionalidades = $stmt_funcionalidades->fetchAll(PDO::FETCH_COLUMN);
    
    // Remover permissões existentes do vendedor
    $stmt_delete = $pdo->prepare("DELETE FROM vendedor_permissoes WHERE vendedor_id = :vendedor_id");
    $stmt_delete->bindParam(':vendedor_id', $vendedor_id);
    $stmt_delete->execute();
    
    // Preparar a instrução para inserir novas permissões
    $stmt_insert = $pdo->prepare("
        INSERT INTO vendedor_permissoes (vendedor_id, funcionalidade_id, permitido) 
        VALUES (:vendedor_id, :funcionalidade_id, :permitido)
    ");
    
    // Inserir novas permissões
    foreach ($data->permissoes as $permissao) {
        // Validar se a funcionalidade existe
        if (!isset($permissao->funcionalidade_id) || !in_array($permissao->funcionalidade_id, $funcionalidades)) {
            continue; // Pular funcionalidades inválidas
        }
        
        $funcionalidade_id = intval($permissao->funcionalidade_id);
        $permitido = isset($permissao->permitido) ? (bool)$permissao->permitido : false;
        
        // Para funcionalidades essenciais (home e config), forçar permitido = true
        $stmt_check = $pdo->prepare("SELECT codigo FROM app_funcionalidades WHERE id = :id");
        $stmt_check->bindParam(':id', $funcionalidade_id);
        $stmt_check->execute();
        $codigo = $stmt_check->fetchColumn();
        
        if (in_array($codigo, ['home', 'config'])) {
            $permitido = true;
        }
        
        $stmt_insert->bindParam(':vendedor_id', $vendedor_id);
        $stmt_insert->bindParam(':funcionalidade_id', $funcionalidade_id);
        $stmt_insert->bindParam(':permitido', $permitido, PDO::PARAM_BOOL);
        $stmt_insert->execute();
    }
    
    // Confirmar transação
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Permissões atualizadas com sucesso'
    ]);
    
} catch (PDOException $e) {
    // Reverter transação em caso de erro
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao salvar permissões: ' . $e->getMessage()
    ]);
}
?> 