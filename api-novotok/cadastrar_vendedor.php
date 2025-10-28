<?php
// Definindo os cabeçalhos CORS explicitamente para este endpoint
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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

    // Verificar se todos os campos obrigatórios foram enviados
    if (isset($data['rca'], $data['nome'], $data['senha'])) {
        $rca = $data['rca'];
        $nome = $data['nome'];
        $senha = $data['senha'];
        $email = isset($data['email']) ? $data['email'] : null;
        $filial_id = isset($data['filial_id']) ? $data['filial_id'] : null;
        $ativo = isset($data['ativo']) ? (bool)$data['ativo'] : true;

        // Validar email se fornecido
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["message" => "Email inválido."]);
            exit;
        }

        // Validar filial_id se fornecido
        if ($filial_id) {
            $stmt = $db->prepare("SELECT COUNT(*) FROM filiais WHERE id = :id");
            $stmt->execute(['id' => $filial_id]);
            $filialExists = $stmt->fetchColumn();

            if (!$filialExists) {
                http_response_code(400);
                echo json_encode(["message" => "Filial não encontrada."]);
                exit;
            }
        }

        try {
            // Verificar se o RCA já existe
            $stmt = $db->prepare("SELECT COUNT(*) FROM vendedores WHERE rca = :rca");
            $stmt->execute(['rca' => $rca]);
            $rcaExists = $stmt->fetchColumn();

            if ($rcaExists) {
                http_response_code(400);
                echo json_encode(["message" => "RCA já está em uso."]);
                exit;
            }

            // Hash da senha
            $senha_hash = password_hash($senha, PASSWORD_BCRYPT);

            // Inserir o novo vendedor
            $sql = "INSERT INTO vendedores (rca, nome, email, senha, filial_id, ativo) VALUES (:rca, :nome, :email, :senha, :filial_id, :ativo)";
            $stmt = $db->prepare($sql);
            $stmt->execute([
                'rca' => $rca,
                'nome' => $nome,
                'email' => $email,
                'senha' => $senha_hash,
                'filial_id' => $filial_id,
                'ativo' => $ativo ? 1 : 0
            ]);

            $vendedor_id = $db->lastInsertId();

            http_response_code(201); // Created
            echo json_encode([
                "message" => "Vendedor cadastrado com sucesso!",
                "id" => $vendedor_id
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Erro ao cadastrar vendedor: " . $e->getMessage()]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["message" => "Dados incompletos. RCA, nome e senha são obrigatórios."]);
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(["message" => "Falha ao realizar requisição", "Erro:" => $e->getMessage()]);
}
?> 