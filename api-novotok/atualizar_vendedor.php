<?php

// Definindo os cabeçalhos CORS
require_once 'cors_config.php';
include_once 'database.php';
include_once 'jwt_utils.php';

// Verificar se o usuário está autenticado
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $authHeader = $headers['Authorization'];
    $token = str_replace('Bearer ', '', $authHeader);
}

if (!$token || !JwtUtils::validateToken($token)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Não autorizado"]);
    exit;
}

// Decodificando o JSON recebido
$input_data = file_get_contents("php://input");
$data = json_decode($input_data);

// Verificando se o JSON foi decodificado corretamente
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "JSON inválido.", "error" => json_last_error_msg()]);
    exit;
}

// Verificando se os campos obrigatórios foram fornecidos
if (!isset($data->id) || !isset($data->rca) || !isset($data->nome)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "ID, RCA e nome são obrigatórios."]);
    exit;
}

try {
    // Conectando ao banco de dados
    $database = new Database();
    $db = $database->getConnection();

    // Verificar se o vendedor existe
    $query = "SELECT id FROM vendedores WHERE id = :id LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $data->id);
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Vendedor não encontrado."]);
        exit;
    }

    // Verificar se o RCA já existe para outro vendedor
    $query = "SELECT id FROM vendedores WHERE rca = :rca AND id != :id LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':rca', $data->rca);
    $stmt->bindParam(':id', $data->id);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "RCA já está em uso por outro vendedor."]);
        exit;
    }

    // Verificar se a filial existe, se fornecida
    if (isset($data->filial_id) && $data->filial_id) {
        $query = "SELECT id FROM filiais WHERE id = :id LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $data->filial_id);
        $stmt->execute();

        if ($stmt->rowCount() == 0) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Filial não encontrada."]);
            exit;
        }
    }

    // Preparar os campos para atualização
    $fields = [];
    $params = [];

    // Campos obrigatórios
    $fields[] = "rca = :rca";
    $params[':rca'] = $data->rca;
    
    $fields[] = "nome = :nome";
    $params[':nome'] = $data->nome;

    // Campos opcionais
    if (isset($data->email)) {
        $fields[] = "email = :email";
        $params[':email'] = $data->email;
    }

    if (isset($data->filial_id)) {
        $fields[] = "filial_id = :filial_id";
        $params[':filial_id'] = $data->filial_id;
    }

    if (isset($data->ativo)) {
        $fields[] = "ativo = :ativo";
        $params[':ativo'] = $data->ativo;
    }

    // Atualizar senha apenas se fornecida
    if (isset($data->senha) && !empty($data->senha)) {
        $fields[] = "senha = :senha";
        $params[':senha'] = password_hash($data->senha, PASSWORD_BCRYPT);
    }

    // Atualizar timestamp
    $fields[] = "updated_at = NOW()";

    // Montar a query de atualização
    $query = "UPDATE vendedores SET " . implode(", ", $fields) . " WHERE id = :id";
    $params[':id'] = $data->id;

    // Executar a atualização
    $stmt = $db->prepare($query);
    
    if ($stmt->execute($params)) {
        echo json_encode([
            "success" => true, 
            "message" => "Vendedor atualizado com sucesso."
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Erro ao atualizar vendedor."]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro no servidor.", "error" => $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro inesperado.", "error" => $e->getMessage()]);
} 