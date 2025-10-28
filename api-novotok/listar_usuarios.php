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

try {
    // Conectar ao banco de dados
    $database = new Database();
    $db = $database->getConnection();
    
    // Parâmetros de paginação
    $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
    $per_page = isset($_GET['per_page']) ? intval($_GET['per_page']) : 10;
    $offset = ($page - 1) * $per_page;
    
    // Parâmetros de filtro
    $nome = isset($_GET['nome']) ? $_GET['nome'] : null;
    $email = isset($_GET['email']) ? $_GET['email'] : null;
    $tipo_usuario = isset($_GET['tipo_usuario']) ? $_GET['tipo_usuario'] : null;
    $ativo = isset($_GET['ativo']) ? $_GET['ativo'] : null;
    
    // Construir a consulta SQL base
    $sql = "SELECT id, nome, email, cpf, telefone, tipo_usuario, ativo, created_at, updated_at 
            FROM usuarios 
            WHERE 1=1";
    
    // Adicionar filtros à consulta
    $params = array();
    
    if ($nome) {
        $sql .= " AND nome LIKE :nome";
        $params[':nome'] = "%$nome%";
    }
    
    if ($email) {
        $sql .= " AND email LIKE :email";
        $params[':email'] = "%$email%";
    }
    
    if ($tipo_usuario) {
        $sql .= " AND tipo_usuario = :tipo_usuario";
        $params[':tipo_usuario'] = $tipo_usuario;
    }
    
    if ($ativo !== null) {
        $sql .= " AND ativo = :ativo";
        $params[':ativo'] = $ativo;
    }
    
    // Consulta para contar o total de registros
    $count_sql = str_replace("SELECT id, nome, email, cpf, telefone, tipo_usuario, ativo, created_at, updated_at", "SELECT COUNT(*) as total", $sql);
    $count_stmt = $db->prepare($count_sql);
    
    // Vincular parâmetros para a consulta de contagem
    foreach ($params as $param => $value) {
        $count_stmt->bindValue($param, $value);
    }
    
    $count_stmt->execute();
    $total_results = $count_stmt->fetch(PDO::FETCH_ASSOC)['total'];
    $total_pages = ceil($total_results / $per_page);
    
    // Adicionar ordenação e paginação à consulta principal
    $sql .= " ORDER BY nome ASC LIMIT :offset, :per_page";
    
    $stmt = $db->prepare($sql);
    
    // Vincular parâmetros para a consulta principal
    foreach ($params as $param => $value) {
        $stmt->bindValue($param, $value);
    }
    
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->bindValue(':per_page', $per_page, PDO::PARAM_INT);
    
    $stmt->execute();
    
    // Verificar se há resultados
    if ($stmt->rowCount() > 0) {
        $usuarios = array();
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // Remover a senha por segurança
            $usuario = array(
                "id" => $row['id'],
                "nome" => $row['nome'],
                "email" => $row['email'],
                "cpf" => $row['cpf'],
                "telefone" => $row['telefone'],
                "tipo_usuario" => $row['tipo_usuario'],
                "ativo" => (bool)$row['ativo'],
                "created_at" => $row['created_at'],
                "updated_at" => $row['updated_at']
            );
            
            array_push($usuarios, $usuario);
        }
        
        // Retornar os resultados com informações de paginação
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Usuários encontrados",
            "current_page" => $page,
            "per_page" => $per_page,
            "total_results" => intval($total_results),
            "total_pages" => $total_pages,
            "usuarios" => $usuarios
        ));
    } else {
        // Nenhum usuário encontrado
        http_response_code(200);
        echo json_encode(array(
            "success" => true,
            "message" => "Nenhum usuário encontrado",
            "current_page" => $page,
            "per_page" => $per_page,
            "total_results" => 0,
            "total_pages" => 0,
            "usuarios" => array()
        ));
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Erro ao buscar usuários",
        "error" => $e->getMessage()
    ));
}
?> 