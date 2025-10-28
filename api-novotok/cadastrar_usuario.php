<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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

// Obter dados da requisição
$data = json_decode(file_get_contents("php://input"));

// Verificar se os dados necessários foram fornecidos
if (!isset($data->nome) || !isset($data->email) || !isset($data->senha) || !isset($data->cpf)) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Dados incompletos. Nome, email, senha e CPF são obrigatórios."));
    exit;
}

try {
    // Conectar ao banco de dados
    $database = new Database();
    $db = $database->getConnection();
    
    // Verificar se o email já existe
    $check_email = "SELECT id FROM usuarios WHERE email = :email";
    $stmt_email = $db->prepare($check_email);
    $stmt_email->bindParam(':email', $data->email);
    $stmt_email->execute();
    
    if ($stmt_email->rowCount() > 0) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "Email já cadastrado."));
        exit;
    }
    
    // Verificar se o CPF já existe
    $check_cpf = "SELECT id FROM usuarios WHERE cpf = :cpf";
    $stmt_cpf = $db->prepare($check_cpf);
    $stmt_cpf->bindParam(':cpf', $data->cpf);
    $stmt_cpf->execute();
    
    if ($stmt_cpf->rowCount() > 0) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "CPF já cadastrado."));
        exit;
    }
    
    // Limpar o CPF, mantendo apenas números
    $cpf_limpo = preg_replace('/[^0-9]/', '', $data->cpf);
    
    // Preparar a consulta SQL para inserir o usuário
    $query = "INSERT INTO usuarios (nome, email, senha, cpf, telefone, tipo_usuario, ativo) 
              VALUES (:nome, :email, :senha, :cpf, :telefone, :tipo_usuario, :ativo)";
    
    $stmt = $db->prepare($query);
    
    // Criptografar a senha
    $senha_hash = password_hash($data->senha, PASSWORD_DEFAULT);
    
    // Definir valores padrão para campos opcionais
    $telefone = isset($data->telefone) ? $data->telefone : null;
    $tipo_usuario = isset($data->tipo_usuario) ? $data->tipo_usuario : 'operador';
    $ativo = isset($data->ativo) ? $data->ativo : 1;
    
    // Vincular parâmetros
    $stmt->bindParam(':nome', $data->nome);
    $stmt->bindParam(':email', $data->email);
    $stmt->bindParam(':senha', $senha_hash);
    $stmt->bindParam(':cpf', $cpf_limpo);
    $stmt->bindParam(':telefone', $telefone);
    $stmt->bindParam(':tipo_usuario', $tipo_usuario);
    $stmt->bindParam(':ativo', $ativo);
    
    // Executar a consulta
    if ($stmt->execute()) {
        $usuario_id = $db->lastInsertId();
        
        // Inserir permissões padrão para o usuário (sem acesso a nenhum menu)
        $query_menus = "SELECT id FROM menus";
        $stmt_menus = $db->prepare($query_menus);
        $stmt_menus->execute();
        
        while ($menu = $stmt_menus->fetch(PDO::FETCH_ASSOC)) {
            $query_permissao = "INSERT INTO permissoes_usuarios (usuario_id, menu_id, visualizar, criar, editar, excluir) 
                               VALUES (:usuario_id, :menu_id, 0, 0, 0, 0)";
            $stmt_permissao = $db->prepare($query_permissao);
            $stmt_permissao->bindParam(':usuario_id', $usuario_id);
            $stmt_permissao->bindParam(':menu_id', $menu['id']);
            $stmt_permissao->execute();
        }
        
        http_response_code(201);
        echo json_encode(array(
            "success" => true,
            "message" => "Usuário cadastrado com sucesso",
            "usuario_id" => $usuario_id
        ));
    } else {
        http_response_code(500);
        echo json_encode(array("success" => false, "message" => "Erro ao cadastrar usuário."));
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Erro ao cadastrar usuário",
        "error" => $e->getMessage()
    ));
}
?> 