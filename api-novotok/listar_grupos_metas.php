<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: access");
header("Access-Control-Allow-Methods: GET");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require 'database.php';
require 'jwt_utils.php';
require 'cors_config.php';

// Verificar se o método da requisição é GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        "status" => 0,
        "message" => "Método não permitido. Apenas GET é aceito."
    ]);
    exit;
}

// Verificar se o token JWT foi fornecido
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token de autenticação não fornecido ou inválido"
    ]);
    exit;
}

$jwt = $matches[1];

// Validar o token JWT
try {
    $payload = decodeJWT($jwt);
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

// Parâmetros de filtro opcionais
$ativo = isset($_GET['ativo']) ? filter_var($_GET['ativo'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) : null;
$busca = isset($_GET['busca']) ? trim($_GET['busca']) : null;

try {
    // Construir a consulta SQL para grupos de metas
    $sql = "SELECT g.*, 
                   COUNT(m.id) as total_metas
            FROM grupos_metas_produtos g 
            LEFT JOIN metas_produtos_grupo m ON g.id = m.grupo_id 
            WHERE 1=1";

    $params = [];

    // Filtro por status ativo
    if ($ativo !== null) {
        $sql .= " AND g.ativo = ?";
        $params[] = $ativo ? 1 : 0;
    }

    // Filtro por busca (nome ou descrição)
    if ($busca !== null && $busca !== '') {
        $sql .= " AND (g.nome LIKE ? OR g.descricao LIKE ?)";
        $params[] = "%{$busca}%";
        $params[] = "%{$busca}%";
    }

    $sql .= " GROUP BY g.id ORDER BY g.ativo DESC, g.data_criacao DESC";

    // Preparar e executar a consulta
    $stmt = $conn->prepare($sql);
    
    // Vincular parâmetros
    $paramIndex = 1;
    foreach ($params as $param) {
        $stmt->bindValue($paramIndex++, $param);
    }

    $stmt->execute();
    $grupos = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Buscar as metas do grupo
        $sqlMetas = "SELECT * FROM metas_produtos_grupo WHERE grupo_id = ? ORDER BY nome_produto_marca";
        $stmtMetas = $conn->prepare($sqlMetas);
        $stmtMetas->bindValue(1, $row['id']);
        $stmtMetas->execute();
        
        $metas = [];
        while ($meta = $stmtMetas->fetch(PDO::FETCH_ASSOC)) {
            $metas[] = [
                'id' => $meta['id'],
                'nomeProdutoMarca' => $meta['nome_produto_marca'],
                'qtdMeta' => (int)$meta['qtd_meta'],
                'percentualSobreVenda' => (float)$meta['percentual_sobre_venda']
            ];
        }

        $grupos[] = [
            'id' => $row['id'],
            'nome' => $row['nome'],
            'descricao' => $row['descricao'],
            'metas' => $metas,
            'dataCriacao' => $row['data_criacao'],
            'ativo' => (bool)$row['ativo'],
            'totalMetas' => (int)$row['total_metas']
        ];
    }

    // Retornar os resultados
    http_response_code(200);
    echo json_encode([
        'status' => 1,
        'message' => 'Grupos de metas listados com sucesso',
        'data' => $grupos,
        'total' => count($grupos)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>