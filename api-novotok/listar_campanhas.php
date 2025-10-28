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
    $usuario_id = $payload->id;
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

try {
    // Parâmetros de filtro opcionais
    $ativo = isset($_GET['ativo']) ? $_GET['ativo'] : '';
    $busca = isset($_GET['busca']) ? trim($_GET['busca']) : '';
    $mes = isset($_GET['mes']) ? (int)$_GET['mes'] : null;
    $ano = isset($_GET['ano']) ? (int)$_GET['ano'] : null;

    // Construir a consulta SQL base
    $sql = "SELECT 
                id,
                nome,
                descricao,
                mes,
                ano,
                data_inicio,
                data_fim,
                data_criacao,
                ativo
            FROM campanhas_metas
            WHERE 1=1";

    $params = [];
    $paramIndex = 1;

    // Aplicar filtros
    if ($ativo !== '') {
        $sql .= " AND ativo = ?";
        $params[$paramIndex++] = $ativo === 'true' ? 1 : 0;
    }

    if ($mes !== null && $mes >= 1 && $mes <= 12) {
        $sql .= " AND mes = ?";
        $params[$paramIndex++] = $mes;
    }

    if ($ano !== null && $ano >= 2020) {
        $sql .= " AND ano = ?";
        $params[$paramIndex++] = $ano;
    }

    if (!empty($busca)) {
        $sql .= " AND (nome LIKE ? OR descricao LIKE ?)";
        $buscaParam = '%' . $busca . '%';
        $params[$paramIndex++] = $buscaParam;
        $params[$paramIndex++] = $buscaParam;
    }

    $sql .= " ORDER BY ano DESC, mes DESC, nome ASC";

    $stmt = $conn->prepare($sql);

    // Bind dos parâmetros
    foreach ($params as $index => $value) {
        $stmt->bindValue($index, $value);
    }

    $stmt->execute();
    $campanhas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Função para obter nome do mês
    function getNomeMes($mes) {
        $meses = [
            1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
            5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
            9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'
        ];
        return isset($meses[$mes]) ? $meses[$mes] : 'Mês inválido';
    }

    // Formatar os resultados
    $campanhasFormatadas = [];
    foreach ($campanhas as $campanha) {
        $campanhasFormatadas[] = [
            'id' => $campanha['id'],
            'nome' => $campanha['nome'],
            'descricao' => $campanha['descricao'],
            'mes' => (int)$campanha['mes'],
            'nomeMes' => getNomeMes((int)$campanha['mes']),
            'ano' => (int)$campanha['ano'],
            'periodo' => getNomeMes((int)$campanha['mes']) . '/' . $campanha['ano'],
            'dataInicio' => $campanha['data_inicio'],
            'dataFim' => $campanha['data_fim'],
            'dataCriacao' => $campanha['data_criacao'],
            'ativo' => (bool)$campanha['ativo']
        ];
    }

    http_response_code(200);
    echo json_encode([
        "status" => 1,
        "message" => "Campanhas listadas com sucesso",
        "data" => $campanhasFormatadas,
        "total" => count($campanhasFormatadas)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => 0,
        "message" => "Erro interno do servidor: " . $e->getMessage()
    ]);
}
?>