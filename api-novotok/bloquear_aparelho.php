<?php
require_once 'cors_config.php';
// Inclui as classes Database e JwtUtils
require_once 'database.php';
require_once 'jwt_utils.php';

// Verifica se a requisição é do tipo POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Lê o corpo da requisição JSON
    $inputJSON = file_get_contents('php://input');
    $input = json_decode($inputJSON, true);

    // Verifica se o JSON foi decodificado corretamente
    if ($input === null) {
        echo json_encode(['success' => false, 'message' => 'Erro ao decodificar JSON.']);
        exit;
    }

    // Obtém o bearer_token do cabeçalho Authorization
    $headers = apache_request_headers();
    $bearer_token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;

    // Valida o bearer_token
    $user_id = JwtUtils::validateToken($bearer_token);
    if ($user_id === null) {
        echo json_encode(['success' => false, 'message' => 'Token inválido.']);
        exit;
    }

    // Instancia a classe Database
    $database = new Database();
    $conn = $database->getConnection();

    // Verifica se o ID ou codaparelho foi enviado
    $id = isset($input['id']) ? intval($input['id']) : null;
    $codaparelho = isset($input['codaparelho']) ? $input['codaparelho'] : null;
    
    // Log para depuração
    error_log("Tentando bloquear aparelho - ID: " . ($id ?? 'não fornecido') . ", Código: " . ($codaparelho ?? 'não fornecido'));

    // Verifica se pelo menos um dos parâmetros foi enviado
    if ($id === null && $codaparelho === null) {
        echo json_encode(['success' => false, 'message' => 'Parâmetro id ou codaparelho é obrigatório.']);
        exit;
    }

    // Se o ID foi fornecido, verifica se existe
    if ($id !== null) {
        if (!idExists($conn, $id)) {
            echo json_encode(['success' => false, 'message' => 'ID do aparelho não encontrado na base de dados.']);
            exit;
        }
        
        // Atualiza o atributo autorized do aparelho para 0 usando o ID
        $sql = "UPDATE aparelhos SET autorized = 0 WHERE id = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':id', $id);
    } 
    // Se apenas o codaparelho foi fornecido
    else {
        // Verifica se o codaparelho existe na base de dados
        if (!codaparelhoExists($conn, $codaparelho)) {
            echo json_encode(['success' => false, 'message' => 'Codaparelho não encontrado na base de dados.']);
            exit;
        }
        
        // Atualiza o atributo autorized do aparelho para 0 usando o codaparelho
        $sql = "UPDATE aparelhos SET autorized = 0 WHERE codaparelho = :codaparelho";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':codaparelho', $codaparelho);
    }

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Aparelho bloqueado com sucesso.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro ao bloquear aparelho: ' . $stmt->errorInfo()[2]]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido. Use POST.']);
}

// Função para verificar se o codaparelho existe na base de dados
function codaparelhoExists($conn, $codaparelho) {
    $sql = "SELECT id FROM aparelhos WHERE codaparelho = :codaparelho";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':codaparelho', $codaparelho);
    $stmt->execute();
    return $stmt->rowCount() > 0;
}

// Função para verificar se o ID existe na base de dados
function idExists($conn, $id) {
    $sql = "SELECT id FROM aparelhos WHERE id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $id);
    $stmt->execute();
    return $stmt->rowCount() > 0;
}
?>