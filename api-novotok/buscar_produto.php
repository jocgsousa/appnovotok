<?php
require_once 'cors_config.php';
// Inclui a classe Database
require_once 'database.php';

// Verifica se a requisição é do tipo GET ou POST
if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'POST') {
    // Instancia a classe Database
    $database = new Database();
    $conn = $database->getConnection();

    // Obtém os valores de codauxiliar dependendo do método da requisição
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Lê o corpo da requisição JSON
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);

        // Verifica se o JSON foi decodificado corretamente
        if ($input === null) {
            echo json_encode(['success' => false, 'message' => 'Erro ao decodificar JSON.']);
            exit;
        }

        $codaparelho = isset($input['codaparelho']) ? $input['codaparelho'] : null;
        $codauxiliar = isset($input['codauxiliar']) ? $input['codauxiliar'] : null;
    } else {
        // Método GET - pega parâmetros da URL
        $codauxiliar = isset($_GET['codauxiliar']) ? $_GET['codauxiliar'] : null;
        $codaparelho = isset($_GET['codaparelho']) ? $_GET['codaparelho'] : null;
    }

    // Verifica se o codauxiliar foi enviado
    if ($codauxiliar === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Parâmetro codauxiliar é obrigatório.']);
        exit;
    }

    // Verifica se o codaparelho foi fornecido (para ambos os métodos)
    if ($codaparelho === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Parâmetro codaparelho é obrigatório.']);
        exit;
    }

    // Verifica se o codaparelho está autorizado (para ambos os métodos)
    if (!isCodaparelhoAuthorized($conn, $codaparelho)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Dispositivo não autorizado.']);
        exit;
    }

    // Busca o produto na tabela produtos usando o codauxiliar
    $produto = buscarProduto($conn, $codauxiliar);

    if ($produto) {
        // Formata a resposta para ser compatível com o frontend (array de produtos)
        $produtos = [$produto];
        echo json_encode(['success' => true, 'message' => 'Produto encontrado.', 'produtos' => $produtos]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Produto não encontrado.']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido. Use GET ou POST.']);
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

// Função para buscar o produto na tabela produtos usando o codauxiliar
function buscarProduto($conn, $codauxiliar) {
    // Adiciona log para debug
    error_log("Buscando produto com codauxiliar: " . $codauxiliar);
    
    // Limpa o código auxiliar de espaços extras
    $codauxiliar = trim($codauxiliar);
    
    // Tenta buscar o produto com o codauxiliar exato (case insensitive)
    $sql = "SELECT * FROM produtos WHERE LOWER(codauxiliar) = LOWER(:codauxiliar)";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':codauxiliar', $codauxiliar);
    $stmt->execute();
    $produto = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($produto) {
        error_log("Produto encontrado com codauxiliar exato: " . $codauxiliar);
        return $produto;
    }
    
    // Se não encontrou, tenta buscar ignorando espaços
    $codauxiliarSemEspacos = str_replace(' ', '', $codauxiliar);
    $sql = "SELECT * FROM produtos WHERE REPLACE(LOWER(codauxiliar), ' ', '') = :codauxiliarSemEspacos";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':codauxiliarSemEspacos', $codauxiliarSemEspacos);
    $stmt->execute();
    $produto = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($produto) {
        error_log("Produto encontrado ignorando espaços: " . $codauxiliar);
        return $produto;
    }
    
    // Se ainda não encontrou, tenta buscar com LIKE
    $sql = "SELECT * FROM produtos WHERE codauxiliar LIKE :codauxiliarLike LIMIT 1";
    $codauxiliarLike = '%' . $codauxiliar . '%';
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':codauxiliarLike', $codauxiliarLike);
    $stmt->execute();
    $produto = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($produto) {
        error_log("Produto encontrado com LIKE: " . $codauxiliar);
        return $produto;
    }
    
    error_log("Produto não encontrado com nenhum método: " . $codauxiliar);
    return null;
}
?>