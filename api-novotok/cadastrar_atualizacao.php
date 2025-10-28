<?php
// Habilitar exibição de erros para depuração
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

try {
    require_once __DIR__ . '/cors_config.php';
    require_once __DIR__ . '/database.php';
    require_once __DIR__ . '/jwt_utils.php';

    // Verificar se a requisição é POST
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método não permitido']);
        exit;
    }

    // Verificar autenticação
    $headers = getallheaders();
    if (!isset($headers['Authorization'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
        exit;
    }

    // Validar o token
    $jwt = str_replace('Bearer ', '', $headers['Authorization']);
    
    // Verificar se o JWT Utils está funcionando
    if (!class_exists('JwtUtils')) {
        throw new Exception('Classe JwtUtils não encontrada');
    }
    
    // Verificar se o Firebase JWT está funcionando
    if (!class_exists('Firebase\JWT\JWT')) {
        throw new Exception('Classe Firebase\JWT\JWT não encontrada');
    }
    
    if (!class_exists('Firebase\JWT\Key')) {
        throw new Exception('Classe Firebase\JWT\Key não encontrada');
    }
    
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token inválido']);
        exit;
    }

    // Receber dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Verificar se os dados necessários foram fornecidos
    if (!isset($data['versao']) || !isset($data['titulo']) || !isset($data['descricao']) || !isset($data['link_download'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Dados incompletos']);
        exit;
    }
    
    // Validar os dados
    $versao = trim($data['versao']);
    $titulo = trim($data['titulo']);
    $descricao = trim($data['descricao']);
    $link_download = trim($data['link_download']);
    $obrigatoria = isset($data['obrigatoria']) ? (bool) $data['obrigatoria'] : false;
    $ativa = isset($data['ativa']) ? (bool) $data['ativa'] : true;
    
    // Validar formato da versão (x.y.z)
    if (!preg_match('/^\d+\.\d+\.\d+$/', $versao)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Formato de versão inválido. Use o formato x.y.z']);
        exit;
    }
    
    // Validar URL do link de download
    if (!filter_var($link_download, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Link de download inválido']);
        exit;
    }
    
    try {
        // Inicializar a conexão com o banco de dados
        $database = new Database();
        $conn = $database->getConnection();
        
        if (!$conn) {
            throw new Exception('Falha ao obter conexão com o banco de dados');
        }
        
        // Iniciar transação
        $conn->beginTransaction();
        
        // Verificar se já existe uma versão igual
        $stmt = $conn->prepare("SELECT COUNT(*) FROM sistema_atualizacoes WHERE versao = :versao");
        $stmt->execute(['versao' => $versao]);
        $versaoExiste = $stmt->fetchColumn();
        
        if ($versaoExiste) {
            $conn->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Já existe uma atualização com esta versão']);
            exit;
        }
        
        // Inserir nova atualização - removendo a coluna usuario_id que não existe na tabela
        $stmt = $conn->prepare("
            INSERT INTO sistema_atualizacoes 
            (versao, titulo, descricao, link_download, obrigatoria, ativa, data_lancamento) 
            VALUES (:versao, :titulo, :descricao, :link_download, :obrigatoria, :ativa, NOW())
        ");
        
        $stmt->execute([
            'versao' => $versao,
            'titulo' => $titulo,
            'descricao' => $descricao,
            'link_download' => $link_download,
            'obrigatoria' => $obrigatoria ? 1 : 0,
            'ativa' => $ativa ? 1 : 0
        ]);
        
        // Confirmar transação
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Atualização cadastrada com sucesso'
        ]);
        
    } catch (PDOException $e) {
        // Reverter transação em caso de erro
        if (isset($conn)) {
            $conn->rollBack();
        }
        
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Erro ao cadastrar atualização: ' . $e->getMessage()
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 