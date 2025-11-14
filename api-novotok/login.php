<?php

// Definindo os cabeçalhos CORS
require_once 'cors_config.php';
include_once 'database.php';
include_once 'jwt_utils.php';

// Decodificando o JSON recebido
$input_data = file_get_contents("php://input");
$data = json_decode($input_data);

// Verificando se o JSON foi decodificado corretamente
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "JSON inválido.", 
        "error" => json_last_error_msg()
    ]);
    exit;
}

// Verificando se o email e a senha foram fornecidos
if (!isset($data->email) || !isset($data->password)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Email e senha são obrigatórios."
    ]);
    exit;
}

try {
    // Conectando ao banco de dados
    $database = new Database();
    $db = $database->getConnection();

    // Consulta SQL para verificar o email
    $query = "SELECT id, nome, email, cpf, telefone, tipo_usuario, ativo, senha FROM usuarios WHERE email = :email LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':email', $data->email);

    $stmt->execute();

    // Verifica se o usuário existe
    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Verifica se o usuário está ativo
        if (!$row['ativo']) {
            http_response_code(401);
            echo json_encode([
                "success" => false,
                "message" => "Usuário inativo. Contate o administrador."
            ]);
            exit;
        }
        
        // Verifica se a senha está correta
        if (password_verify($data->password, $row['senha'])) {
            // Gera o token JWT
            $jwt = JwtUtils::createToken($row['id']);
            
            // Obter as permissões do usuário
            $query_permissoes = "SELECT p.menu_id, m.nome as menu_nome, m.descricao as menu_descricao, 
                                m.icone as menu_icone, m.rota as menu_rota, m.ordem as menu_ordem,
                                p.visualizar, p.criar, p.editar, p.excluir 
                                FROM permissoes_usuarios p
                                JOIN menus m ON p.menu_id = m.id
                                WHERE p.usuario_id = :usuario_id AND m.ativo = 1
                                ORDER BY m.ordem ASC";
            
            $stmt_permissoes = $db->prepare($query_permissoes);
            $stmt_permissoes->bindParam(':usuario_id', $row['id']);
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
            
            // Tentar obter filial_id do usuário, se a coluna existir
            $filial_id = null;
            try {
                $stmtCheck = $db->query("SHOW COLUMNS FROM usuarios LIKE 'filial_id'");
                if ($stmtCheck && $stmtCheck->rowCount() > 0) {
                    $stmtFilial = $db->prepare("SELECT filial_id FROM usuarios WHERE id = :id");
                    $stmtFilial->bindParam(':id', $row['id']);
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

            echo json_encode([
                "success" => true,
                "message" => "Login bem-sucedido.", 
                "token" => $jwt,
                "usuario" => [
                    "id" => $row['id'],
                    "nome" => $row['nome'],
                    "email" => $row['email'],
                    "tipo_usuario" => $row['tipo_usuario'],
                    "filial_id" => $filial_id
                ],
                "menus" => $menus_permitidos
            ]);
        } else {
            http_response_code(401);
            echo json_encode([
                "success" => false,
                "message" => "Senha incorreta."
            ]);
        }
    } else {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Email não encontrado."
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Erro no servidor.", 
        "error" => $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Erro inesperado.", 
        "error" => $e->getMessage()
    ]);
}