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
if (!$bearer_token) {
    http_response_code(401);
    echo json_encode(array("success" => false, "message" => "Token de acesso não fornecido"));
    exit;
}

try {
    // Obter o ID do usuário a partir do token
    $user_id = JwtUtils::validateToken($bearer_token);
    
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(array("success" => false, "message" => "Token de acesso inválido ou expirado"));
        exit;
    }
    
    // Conectar ao banco de dados
    $database = new Database();
    $db = $database->getConnection();
    
    // Obter informações do usuário
    $query_usuario = "SELECT id, nome, email, tipo_usuario, ativo FROM usuarios WHERE id = :id";
    $stmt_usuario = $db->prepare($query_usuario);
    $stmt_usuario->bindParam(':id', $user_id);
    $stmt_usuario->execute();
    
    if ($stmt_usuario->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("success" => false, "message" => "Usuário não encontrado"));
        exit;
    }
    
    $usuario = $stmt_usuario->fetch(PDO::FETCH_ASSOC);

    // Tentar obter filial_id do usuário, se a coluna existir
    $filial_id = null;
    try {
        $stmtCheck = $db->query("SHOW COLUMNS FROM usuarios LIKE 'filial_id'");
        if ($stmtCheck && $stmtCheck->rowCount() > 0) {
            $stmtFilial = $db->prepare("SELECT filial_id FROM usuarios WHERE id = :id");
            $stmtFilial->bindParam(':id', $user_id);
            $stmtFilial->execute();
            $fila = $stmtFilial->fetch(PDO::FETCH_ASSOC);
            if ($fila && isset($fila['filial_id'])) {
                $filial_id = $fila['filial_id'];
            }
        }
    } catch (Exception $e) {
        // Ignorar caso a coluna não exista ou outra falha ocorra
        $filial_id = null;
    }
    
    // Verificar se o usuário está ativo
    if (!$usuario['ativo']) {
        http_response_code(403);
        echo json_encode(array("success" => false, "message" => "Usuário inativo. Contate o administrador."));
        exit;
    }
    
    // Obter as permissões do usuário
    $query_permissoes = "SELECT p.menu_id, m.nome as menu_nome, m.descricao as menu_descricao, 
                        m.icone as menu_icone, m.rota as menu_rota, m.ordem as menu_ordem,
                        p.visualizar, p.criar, p.editar, p.excluir 
                        FROM permissoes_usuarios p
                        JOIN menus m ON p.menu_id = m.id
                        WHERE p.usuario_id = :usuario_id AND m.ativo = 1
                        ORDER BY m.ordem ASC";
    
    $stmt_permissoes = $db->prepare($query_permissoes);
    $stmt_permissoes->bindParam(':usuario_id', $user_id);
    $stmt_permissoes->execute();
    
    $menus_permitidos = array();
    
    while ($row_permissao = $stmt_permissoes->fetch(PDO::FETCH_ASSOC)) {
        // Só incluir menus que o usuário tem permissão para visualizar
        if ($row_permissao['visualizar']) {
            $menu = array(
                "id" => $row_permissao['menu_id'],
                "nome" => $row_permissao['menu_nome'],
                "descricao" => $row_permissao['menu_descricao'],
                "icone" => $row_permissao['menu_icone'],
                "rota" => $row_permissao['menu_rota'],
                "ordem" => $row_permissao['menu_ordem'],
                "permissoes" => array(
                    "visualizar" => (bool)$row_permissao['visualizar'],
                    "criar" => (bool)$row_permissao['criar'],
                    "editar" => (bool)$row_permissao['editar'],
                    "excluir" => (bool)$row_permissao['excluir']
                )
            );
            
            array_push($menus_permitidos, $menu);
        }
    }
    
    // Retornar as informações do usuário e suas permissões
    http_response_code(200);
    echo json_encode(array(
        "success" => true,
        "message" => "Permissões obtidas com sucesso",
        "usuario" => array(
            "id" => $usuario['id'],
            "nome" => $usuario['nome'],
            "email" => $usuario['email'],
            "tipo_usuario" => $usuario['tipo_usuario'],
            "filial_id" => $filial_id
        ),
        "menus" => $menus_permitidos
    ));
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Erro ao verificar permissões",
        "error" => $e->getMessage()
    ));
}
?>