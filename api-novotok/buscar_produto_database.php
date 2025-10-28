<?php
require_once 'cors_config.php';
// Inclui a classe Database
require_once 'database.php';

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

    // Instancia a classe Database
    $database = new Database();
    $conn = $database->getConnection();

    // Obtém os valores de codaparelho da requisição JSON
    $codaparelho = isset($input['codaparelho']) ? $input['codaparelho'] : null;

    // Verifica se os valores foram enviados
    if ($codaparelho === null) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Parâmetros codaparelho são obrigatórios.']);
        exit;
    }

    // Verifica se o codaparelho está autorizado
    if (!isCodaparelhoAuthorized($conn, $codaparelho)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Dispositivo não autorizado.']);
        exit;
    }

    // Busca os produtos na tabela produtos
    $produtos = buscarProdutos($conn);

    if ($produtos) {
        // Registrar log de sincronização
        registrarSincronizacao($conn, $codaparelho, count($produtos));
        
        echo json_encode(['success' => true, 'message' => 'Produtos encontrados.', 'produtos' => $produtos]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Nenhum produto encontrado.']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido. Use POST.']);
}

// Função para verificar se o codaparelho está autorizado
function isCodaparelhoAuthorized($conn, $codaparelho) {
    try {
        error_log("Verificando autorização para codaparelho: " . $codaparelho);
        
        // Verificar se o aparelho existe e está autorizado
        $query = "SELECT * FROM aparelhos WHERE codaparelho = :codaparelho";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(':codaparelho', $codaparelho);
        $stmt->execute();
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            error_log("Aparelho não encontrado: " . $codaparelho);
            return false;
        }
        
        // Log detalhado dos valores
        error_log("Valores do aparelho - ID: " . $result['id'] . 
                  ", codaparelho: " . $result['codaparelho'] . 
                  ", autorized: " . $result['autorized'] . 
                  ", tipo autorized: " . gettype($result['autorized']));
        
        // Verificar se está autorizado
        // Usando comparação não estrita para funcionar com string '1' ou número 1
        $autorizado = ($result['autorized'] == 1);
        error_log("Aparelho " . ($autorizado ? "está autorizado" : "não está autorizado"));
        
        return $autorizado;
    } catch (PDOException $e) {
        error_log("Erro ao verificar autorização: " . $e->getMessage());
        return false;
    }
}

// Função para buscar todos os produtos na tabela produtos
function buscarProdutos($conn) {
    $sql = "SELECT * FROM produtos";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// Função para registrar a sincronização
function registrarSincronizacao($conn, $codaparelho, $qtdProdutos) {
    $sql = "INSERT INTO sincronizacoes (codaparelho, quantidade_produtos, data_sincronizacao) VALUES (:codaparelho, :quantidade_produtos, NOW())";
    try {
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':codaparelho', $codaparelho);
        $stmt->bindParam(':quantidade_produtos', $qtdProdutos);
        $stmt->execute();
        return true;
    } catch (PDOException $e) {
        // Se a tabela não existir, não registra o log mas continua o processo
        error_log("Erro ao registrar sincronização: " . $e->getMessage());
        return false;
    }
}
?>