<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: PUT, OPTIONS");
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

// Verificar se o ID do usuário foi fornecido
if (!isset($data->id)) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "ID do usuário não fornecido"));
    exit;
}

$usuario_id = intval($data->id);

try {
    // Conectar ao banco de dados
    $database = new Database();
    $db = $database->getConnection();
    
    // Verificar se o usuário existe
    $check_usuario = "SELECT id FROM usuarios WHERE id = :id";
    $stmt_check = $db->prepare($check_usuario);
    $stmt_check->bindParam(':id', $usuario_id);
    $stmt_check->execute();
    
    if ($stmt_check->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(array("success" => false, "message" => "Usuário não encontrado"));
        exit;
    }
    
    // Iniciar a construção da consulta SQL
    $sql = "UPDATE usuarios SET ";
    $params = array();
    $campos = array();
    
    // Verificar quais campos foram fornecidos para atualização
    if (isset($data->nome)) {
        $campos[] = "nome = :nome";
        $params[':nome'] = $data->nome;
    }
    
    if (isset($data->email)) {
        // Verificar se o email já está em uso por outro usuário
        $check_email = "SELECT id FROM usuarios WHERE email = :email AND id != :id";
        $stmt_email = $db->prepare($check_email);
        $stmt_email->bindParam(':email', $data->email);
        $stmt_email->bindParam(':id', $usuario_id);
        $stmt_email->execute();
        
        if ($stmt_email->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => "Email já está em uso por outro usuário"));
            exit;
        }
        
        $campos[] = "email = :email";
        $params[':email'] = $data->email;
    }
    
    if (isset($data->cpf)) {
        // Limpar o CPF, mantendo apenas números
        $cpf_limpo = preg_replace('/[^0-9]/', '', $data->cpf);
        
        // Verificar se o CPF já está em uso por outro usuário
        $check_cpf = "SELECT id FROM usuarios WHERE cpf = :cpf AND id != :id";
        $stmt_cpf = $db->prepare($check_cpf);
        $stmt_cpf->bindParam(':cpf', $cpf_limpo);
        $stmt_cpf->bindParam(':id', $usuario_id);
        $stmt_cpf->execute();
        
        if ($stmt_cpf->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(array("success" => false, "message" => "CPF já está em uso por outro usuário"));
            exit;
        }
        
        $campos[] = "cpf = :cpf";
        $params[':cpf'] = $cpf_limpo;
    }
    
    if (isset($data->telefone)) {
        $campos[] = "telefone = :telefone";
        $params[':telefone'] = $data->telefone;
    }
    
    if (isset($data->tipo_usuario)) {
        $campos[] = "tipo_usuario = :tipo_usuario";
        $params[':tipo_usuario'] = $data->tipo_usuario;
    }
    
    if (isset($data->ativo)) {
        $campos[] = "ativo = :ativo";
        $params[':ativo'] = $data->ativo ? 1 : 0;
    }
    
    if (isset($data->senha) && !empty($data->senha)) {
        // Criptografar a nova senha
        $senha_hash = password_hash($data->senha, PASSWORD_DEFAULT);
        $campos[] = "senha = :senha";
        $params[':senha'] = $senha_hash;
    }
    
    // Se não houver campos para atualizar
    if (empty($campos)) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "Nenhum campo fornecido para atualização"));
        exit;
    }
    
    // Completar a consulta SQL
    $sql .= implode(", ", $campos);
    $sql .= " WHERE id = :id";
    $params[':id'] = $usuario_id;
    
    // Preparar e executar a consulta
    $stmt = $db->prepare($sql);
    
    // Vincular parâmetros
    foreach ($params as $param => $value) {
        $stmt->bindValue($param, $value);
    }
    
    // Atualizar permissões se fornecidas
    if (isset($data->permissoes) && is_array($data->permissoes)) {
        // Iniciar uma transação
        $db->beginTransaction();
        
        try {
            // Executar a atualização do usuário
            $stmt->execute();
            
            // Atualizar as permissões
            foreach ($data->permissoes as $permissao) {
                if (isset($permissao->menu_id)) {
                    $menu_id = intval($permissao->menu_id);
                    
                    $visualizar = isset($permissao->visualizar) ? ($permissao->visualizar ? 1 : 0) : 0;
                    $criar = isset($permissao->criar) ? ($permissao->criar ? 1 : 0) : 0;
                    $editar = isset($permissao->editar) ? ($permissao->editar ? 1 : 0) : 0;
                    $excluir = isset($permissao->excluir) ? ($permissao->excluir ? 1 : 0) : 0;
                    
                    $sql_permissao = "UPDATE permissoes_usuarios 
                                     SET visualizar = :visualizar, criar = :criar, editar = :editar, excluir = :excluir 
                                     WHERE usuario_id = :usuario_id AND menu_id = :menu_id";
                    
                    $stmt_permissao = $db->prepare($sql_permissao);
                    $stmt_permissao->bindParam(':visualizar', $visualizar);
                    $stmt_permissao->bindParam(':criar', $criar);
                    $stmt_permissao->bindParam(':editar', $editar);
                    $stmt_permissao->bindParam(':excluir', $excluir);
                    $stmt_permissao->bindParam(':usuario_id', $usuario_id);
                    $stmt_permissao->bindParam(':menu_id', $menu_id);
                    $stmt_permissao->execute();
                }
            }
            
            // Confirmar a transação
            $db->commit();
            
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "Usuário atualizado com sucesso"
            ));
        } catch (Exception $e) {
            // Reverter a transação em caso de erro
            $db->rollBack();
            throw $e;
        }
    } else {
        // Executar apenas a atualização do usuário
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "Usuário atualizado com sucesso"
            ));
        } else {
            http_response_code(500);
            echo json_encode(array("success" => false, "message" => "Erro ao atualizar usuário"));
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Erro ao atualizar usuário",
        "error" => $e->getMessage()
    ));
}
?> 