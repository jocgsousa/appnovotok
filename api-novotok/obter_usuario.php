<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once 'database.php';
include_once 'jwt_utils.php';
include_once 'cors_config.php';

// Verificar se a requisição é OPTIONS e retornar apenas os cabeçalhos
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Verificar se o token JWT está presente e é válido
$bearer_token = get_bearer_token();
if (!$bearer_token || !is_jwt_valid($bearer_token)) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Acesso não autorizado"));
    exit;
}

// Verificar se o ID do usuário foi fornecido
if (!isset($_GET['id'])) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "ID do usuário não fornecido"));
    exit;
}

$usuario_id = intval($_GET['id']);

try {
    // Conectar ao banco de dados
    $database = new Database();
    $db = $database->getConnection();
    
    // Consultar os dados do usuário
    $query = "SELECT id, nome, email, cpf, telefone, tipo_usuario, ativo, created_at, updated_at 
              FROM usuarios 
              WHERE id = :id";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $usuario_id);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Obter as permissões do usuário
        $query_permissoes = "SELECT p.menu_id, m.nome as menu_nome, m.descricao as menu_descricao, 
                            m.icone as menu_icone, m.rota as menu_rota, m.ordem as menu_ordem,
                            p.visualizar, p.criar, p.editar, p.excluir 
                            FROM permissoes_usuarios p
                            JOIN menus m ON p.menu_id = m.id
                            WHERE p.usuario_id = :usuario_id
                            ORDER BY m.ordem ASC";
        
        $stmt_permissoes = $db->prepare($query_permissoes);
        $stmt_permissoes->bindParam(':usuario_id', $usuario_id);
        $stmt_permissoes->execute();
        
        $permissoes = array();
        
        while ($row_permissao = $stmt_permissoes->fetch(PDO::FETCH_ASSOC)) {
            $permissao = array(
                "menu_id" => $row_permissao['menu_id'],
                "menu_nome" => $row_permissao['menu_nome'],
                "menu_descricao" => $row_permissao['menu_descricao'],
                "menu_icone" => $row_permissao['menu_icone'],
                "menu_rota" => $row_permissao['menu_rota'],
                "menu_ordem" => $row_permissao['menu_ordem'],
                "visualizar" => (bool)$row_permissao['visualizar'],
                "criar" => (bool)$row_permissao['criar'],
                "editar" => (bool)$row_permissao['editar'],
                "excluir" => (bool)$row_permissao['excluir']
            );
            
            array_push($permissoes, $permissao);
        }
        
        // Montar o objeto de resposta
        $usuario = array(
            "id" => $row['id'],
            "nome" => $row['nome'],
            "email" => $row['email'],
            "cpf" => $row['cpf'],
            "telefone" => $row['telefone'],
            "tipo_usuario" => $row['tipo_usuario'],
            "ativo" => (bool)$row['ativo'],
            "created_at" => $row['created_at'],
            "updated_at" => $row['updated_at'],
            "permissoes" => $permissoes
        );
        
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Usuário encontrado",
            "usuario" => $usuario
        ));
    } else {
        http_response_code(404);
        echo json_encode(array("success" => false, "message" => "Usuário não encontrado"));
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Erro ao buscar usuário",
        "error" => $e->getMessage()
    ));
}
?> 