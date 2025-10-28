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

// Verificar se o ID do vendedor foi fornecido
if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
    echo json_encode(['success' => false, 'message' => 'ID do vendedor é obrigatório']);
    exit();
}

$vendedor_id = intval($_GET['id']);

try {
    $database = new Database();
    $pdo = $database->getConnection();
    
    // Primeiro, verificar se o vendedor existe
    $stmt_vendedor = $pdo->prepare("SELECT id FROM vendedores WHERE id = :id");
    $stmt_vendedor->bindParam(':id', $vendedor_id);
    $stmt_vendedor->execute();
    
    if ($stmt_vendedor->rowCount() === 0) {
        echo json_encode(['success' => false, 'message' => 'Vendedor não encontrado']);
        exit();
    }
    
    // Obter todas as funcionalidades do aplicativo
    $stmt_funcionalidades = $pdo->prepare("SELECT * FROM app_funcionalidades WHERE ativo = 1 ORDER BY ordem ASC");
    $stmt_funcionalidades->execute();
    $funcionalidades = $stmt_funcionalidades->fetchAll(PDO::FETCH_ASSOC);
    
    // Obter as permissões do vendedor
    $stmt_permissoes = $pdo->prepare("
        SELECT * FROM vendedor_permissoes 
        WHERE vendedor_id = :vendedor_id
    ");
    $stmt_permissoes->bindParam(':vendedor_id', $vendedor_id);
    $stmt_permissoes->execute();
    $permissoes_existentes = $stmt_permissoes->fetchAll(PDO::FETCH_ASSOC);
    
    // Mapear as permissões existentes por funcionalidade_id para fácil acesso
    $permissoes_map = [];
    foreach ($permissoes_existentes as $permissao) {
        $permissoes_map[$permissao['funcionalidade_id']] = $permissao;
    }
    
    // Construir o array de permissões com todas as funcionalidades
    $permissoes = [];
    foreach ($funcionalidades as $funcionalidade) {
        $permissao = [
            'vendedor_id' => $vendedor_id,
            'funcionalidade_id' => $funcionalidade['id'],
            'permitido' => false,
            'funcionalidade' => $funcionalidade
        ];
        
        // Se existir uma permissão para esta funcionalidade, usar os valores existentes
        if (isset($permissoes_map[$funcionalidade['id']])) {
            $permissao['id'] = $permissoes_map[$funcionalidade['id']]['id'];
            $permissao['permitido'] = (bool)$permissoes_map[$funcionalidade['id']]['permitido'];
        } else {
            // Permissões padrão: home e config sempre permitidos
            if (in_array($funcionalidade['codigo'], ['home', 'config'])) {
                $permissao['permitido'] = true;
            }
        }
        
        $permissoes[] = $permissao;
    }
    
    echo json_encode([
        'success' => true,
        'permissoes' => $permissoes
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao obter permissões: ' . $e->getMessage()
    ]);
}
?> 