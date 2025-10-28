<?php
require_once 'config.php';
require_once 'database.php';

// Verifica se o método da requisição é POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('HTTP/1.1 405 Method Not Allowed');
    echo json_encode(['success' => false, 'message' => 'Método não permitido. Use POST.']);
    exit;
}

// Lê o conteúdo da requisição
$input = json_decode(file_get_contents('php://input'), true);

// Verifica se o JSON é válido
if (json_last_error() !== JSON_ERROR_NONE) {
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['success' => false, 'message' => 'JSON inválido.']);
    exit;
}

// Obtém os valores de codaparelho da requisição JSON
$codaparelho = isset($input['codaparelho']) ? $input['codaparelho'] : null;

// Verifica se codaparelho foi fornecido
if ($codaparelho === null) {
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['success' => false, 'message' => 'Parâmetro codaparelho é obrigatório.']);
    exit;
}

// Instancia a classe Database
$database = new Database();
$conn = $database->getConnection();

// Verifica se o codaparelho está autorizado
if (!isCodaparelhoAuthorized($conn, $codaparelho)) {
    header('HTTP/1.1 401 Unauthorized');
    echo json_encode(['success' => false, 'message' => 'Dispositivo não autorizado.']);
    exit;
}

// Busca os produtos
$produtos = buscarProdutos($conn);

// Registra a sincronização no banco de dados
registrarSincronizacao($conn, $codaparelho, count($produtos));

// Retorna os produtos
echo json_encode(['success' => true, 'message' => 'Produtos sincronizados com sucesso.', 'produtos' => $produtos]);

/**
 * Verifica se o código do aparelho está autorizado
 */
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

/**
 * Busca todos os produtos no banco de dados
 */
function buscarProdutos($conn) {
    try {
        $query = "SELECT * FROM produtos";
        $stmt = $conn->prepare($query);
        $stmt->execute();
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("Erro ao buscar produtos: " . $e->getMessage());
        return [];
    }
}

/**
 * Registra a sincronização no banco de dados
 */
function registrarSincronizacao($conn, $codaparelho, $qtdProdutos) {
    try {
        $query = "INSERT INTO sincronizacoes (codaparelho, quantidade_produtos, data_sincronizacao) VALUES (:codaparelho, :quantidade_produtos, NOW())";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(':codaparelho', $codaparelho);
        $stmt->bindParam(':quantidade_produtos', $qtdProdutos);
        $stmt->execute();
        
        return true;
    } catch (PDOException $e) {
        error_log("Erro ao registrar sincronização: " . $e->getMessage());
        return false;
    }
} 