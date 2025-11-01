<?php
// Incluir configurações CORS globais primeiro
require_once 'cors_config.php';
header("Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

// Se for uma requisição OPTIONS, retornar imediatamente
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Definir cabeçalho Content-Type após CORS
header("Content-Type: application/json");

// Incluir arquivos necessários
require_once 'cors_config.php';
require 'database.php';
include_once 'jwt_utils.php';

// Inicializar conexão com o banco de dados
$database = new Database();
$db = $database->getConnection();

// Função para validar o CPF
function validarCPF($cpf)
{
    // Adicionar a lógica de validação de CPF aqui
    return true; // Supondo que seja um CPF válido para fins de exemplo
}
$headers = getallheaders();
if (!isset($headers['Authorization'])) {
    http_response_code(401);
    echo json_encode(["message" => "Token não fornecido."]);
    exit;
}

try {

    // Valida o token
    $jwt = str_replace('Bearer ', '', $headers['Authorization']);
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(["message" => "Token inválido."]);
        exit;
    }

    // Ler os dados enviados no corpo da requisição
    $data = json_decode(file_get_contents("php://input"), true);

    if (isset($data['nome'], $data['email'], $data['cpf'])) {
        $id = $user_id;
        $nome = $data['nome'];
        $email = $data['email'];
        $cpf = preg_replace('/\D/', '', $data['cpf']); // Remove formatação do CPF
        $senha = isset($data['senha']) ? $data['senha'] : null;

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(["message" => "Email inválido."]);
            exit;
        }

        if (!validarCPF($cpf)) {
            echo json_encode(["message" => "CPF inválido."]);
            exit;
        }

        try {
            // Verifica se o email já está em uso por outro usuário
            $stmt = $db->prepare("SELECT COUNT(*) FROM usuarios WHERE email = :email AND id != :id");
            $stmt->execute(['email' => $email, 'id' => $id]);
            $emailExists = $stmt->fetchColumn();

            if ($emailExists) {
                http_response_code(401);
                echo json_encode(["message" => "Email já está em uso por outro usuário."]);
                exit;
            }

            // Verifica se a senha foi fornecida e se é diferente da atual
            $updatePassword = false;
            if ($senha) {
                $stmt = $db->prepare("SELECT senha FROM usuarios WHERE id = :id");
                $stmt->execute(['id' => $id]);
                $currentPasswordHash = $stmt->fetchColumn();

                if (!password_verify($senha, $currentPasswordHash)) {
                    $senha = password_hash($senha, PASSWORD_BCRYPT); // Hash seguro
                    $updatePassword = true;
                }
            }

            // Atualiza os dados do usuário
            $sql = "UPDATE usuarios SET nome = :nome, email = :email, cpf = :cpf";
            $params = ['nome' => $nome, 'email' => $email, 'cpf' => $cpf, 'id' => $id];

            if ($updatePassword) {
                $sql .= ", senha = :senha";
                $params['senha'] = $senha;
            }

            $sql .= " WHERE id = :id";

            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            echo json_encode(["message" => "Usuário atualizado com sucesso!"]);
        } catch (PDOException $e) {
            http_response_code(401);
            echo json_encode(["message" => "Erro ao atualizar usuário: " . $e->getMessage()]);
        }
    } else {
        http_response_code(401);
        echo json_encode(["message" => "Dados incompletos."]);
    }
} catch (\Throwable $e) {
    echo json_encode(["message" => "Falha ao realizar requisição", "Erro:" => $e->getMessage()]);
}
