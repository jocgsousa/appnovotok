<?php
// Incluir configurações CORS globais primeiro
require_once 'cors_config.php';
header("Access-Control-Allow-Methods: POST, PUT, OPTIONS");
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

    // Verificar se o ID da filial foi enviado
    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(["message" => "ID da filial não fornecido."]);
        exit;
    }

    $filial_id = $data['id'];

    // Verificar se a filial existe
    $stmt = $db->prepare("SELECT COUNT(*) FROM filiais WHERE id = :id");
    $stmt->execute(['id' => $filial_id]);
    $filialExists = $stmt->fetchColumn();

    if (!$filialExists) {
        http_response_code(404);
        echo json_encode(["message" => "Filial não encontrada."]);
        exit;
    }

    // Verificar se todos os campos obrigatórios foram enviados
    if (isset($data['codigo'], $data['nome_fantasia'], $data['razao_social'], $data['cnpj'])) {
        $codigo = $data['codigo'];
        $nome_fantasia = $data['nome_fantasia'];
        $razao_social = $data['razao_social'];
        $cnpj = preg_replace('/\D/', '', $data['cnpj']); // Remove formatação do CNPJ
        $ie = isset($data['ie']) ? $data['ie'] : null;
        $telefone = isset($data['telefone']) ? $data['telefone'] : null;
        $email = isset($data['email']) ? $data['email'] : null;
        $cep = isset($data['cep']) ? preg_replace('/\D/', '', $data['cep']) : null; // Remove formatação do CEP
        $logradouro = isset($data['logradouro']) ? $data['logradouro'] : null;
        $numero = isset($data['numero']) ? $data['numero'] : null;
        $complemento = isset($data['complemento']) ? $data['complemento'] : null;

        // Validar email se fornecido
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["message" => "Email inválido."]);
            exit;
        }

        try {
            // Verificar se o código já existe para outra filial
            $stmt = $db->prepare("SELECT COUNT(*) FROM filiais WHERE codigo = :codigo AND id != :id");
            $stmt->execute(['codigo' => $codigo, 'id' => $filial_id]);
            $codigoExists = $stmt->fetchColumn();

            if ($codigoExists) {
                http_response_code(400);
                echo json_encode(["message" => "Código já está em uso por outra filial."]);
                exit;
            }

            // Verificar se o CNPJ já existe para outra filial
            $stmt = $db->prepare("SELECT COUNT(*) FROM filiais WHERE cnpj = :cnpj AND id != :id");
            $stmt->execute(['cnpj' => $cnpj, 'id' => $filial_id]);
            $cnpjExists = $stmt->fetchColumn();

            if ($cnpjExists) {
                http_response_code(400);
                echo json_encode(["message" => "CNPJ já está em uso por outra filial."]);
                exit;
            }

            // Atualizar a filial
            $sql = "UPDATE filiais SET 
                    codigo = :codigo, 
                    nome_fantasia = :nome_fantasia, 
                    razao_social = :razao_social, 
                    cnpj = :cnpj, 
                    ie = :ie, 
                    telefone = :telefone, 
                    email = :email, 
                    cep = :cep, 
                    logradouro = :logradouro, 
                    numero = :numero, 
                    complemento = :complemento 
                    WHERE id = :id";
            
            $stmt = $db->prepare($sql);
            $stmt->execute([
                'codigo' => $codigo,
                'nome_fantasia' => $nome_fantasia,
                'razao_social' => $razao_social,
                'cnpj' => $cnpj,
                'ie' => $ie,
                'telefone' => $telefone,
                'email' => $email,
                'cep' => $cep,
                'logradouro' => $logradouro,
                'numero' => $numero,
                'complemento' => $complemento,
                'id' => $filial_id
            ]);

            echo json_encode(["message" => "Filial atualizada com sucesso!"]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Erro ao atualizar filial: " . $e->getMessage()]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Dados incompletos. Código, Nome Fantasia, Razão Social e CNPJ são obrigatórios."]);
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(["message" => "Falha ao realizar requisição", "Erro:" => $e->getMessage()]);
}
?>