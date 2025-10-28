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

// Depuração dos headers recebidos
error_log("Headers recebidos em progresso_metas_vendedor: " . json_encode($headers));

$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
if (empty($authHeader) && isset($headers['authorization'])) {
    // Tentar com 'authorization' em minúsculas (alguns servidores modificam o case)
    $authHeader = $headers['authorization'];
}

error_log("Auth Header em progresso_metas_vendedor: " . $authHeader);

if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token de autenticação não fornecido ou inválido"
    ]);
    exit;
}

$jwt = $matches[1];
error_log("Token extraído em progresso_metas_vendedor: " . $jwt);

// Validar o token JWT
try {
    // Usar o método is_jwt_valid em vez de decodeJWT para verificação simples
    if (!is_jwt_valid($jwt)) {
        throw new Exception("Token inválido ou expirado");
    }
    
    $payload = decodeJWT($jwt);
    error_log("Token decodificado com sucesso em progresso_metas_vendedor");
} catch (Exception $e) {
    error_log("Erro na validação do token em progresso_metas_vendedor: " . $e->getMessage());
    http_response_code(401);
    echo json_encode([
        "status" => 0,
        "message" => "Token inválido: " . $e->getMessage()
    ]);
    exit;
}

// Verificar se o ID do vendedor foi fornecido
if (!isset($_GET['vendedor_id'])) {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "ID do vendedor não fornecido."
    ]);
    exit;
}

$vendedor_id = intval($_GET['vendedor_id']);
error_log("Processando requisição de progresso para vendedor ID: " . $vendedor_id);

// Parâmetros de filtro opcionais
$mes = isset($_GET['mes']) ? intval($_GET['mes']) : intval(date('m')); // Mês atual por padrão
$ano = isset($_GET['ano']) ? intval($_GET['ano']) : intval(date('Y')); // Ano atual por padrão
$tipo_meta = isset($_GET['tipo_meta']) ? $_GET['tipo_meta'] : 'vendas'; // 'vendas' por padrão
$meta_id = isset($_GET['meta_id']) ? intval($_GET['meta_id']) : null; // ID da meta específica (opcional)

error_log("Parâmetros: tipo_meta=$tipo_meta, mes=$mes, ano=$ano, meta_id=" . ($meta_id ?? 'null'));

// Validar o tipo de meta
if ($tipo_meta !== 'vendas' && $tipo_meta !== 'cadastro_clientes') {
    http_response_code(400);
    echo json_encode([
        "status" => 0,
        "message" => "Tipo de meta inválido. Use 'vendas' ou 'cadastro_clientes'."
    ]);
    exit;
}

// Conectar ao banco de dados
$database = new Database();
$conn = $database->getConnection();

// Verificar se o vendedor existe
$stmt = $conn->prepare("SELECT id, nome, rca FROM vendedores WHERE id = ?");
$stmt->bindParam(1, $vendedor_id, PDO::PARAM_INT);
$stmt->execute();

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode([
        "status" => 0,
        "message" => "Vendedor não encontrado."
    ]);
    exit;
}

$vendedor = $stmt->fetch(PDO::FETCH_ASSOC);
error_log("Vendedor encontrado: " . json_encode($vendedor));

// Determinar a tabela e campos com base no tipo de meta
$tabela = $tipo_meta === 'vendas' ? 'metas_vendas' : 'metas_cadastro_clientes';
$campo_valor = $tipo_meta === 'vendas' ? 'valor_meta' : 'quantidade_meta';
$campo_realizado = $tipo_meta === 'vendas' ? 'valor_realizado' : 'quantidade_realizada';

// Buscar a meta específica do vendedor
$sql = "SELECT * FROM {$tabela} WHERE vendedor_id = ?";
$params = [$vendedor_id];

// Se o ID da meta for fornecido, buscar por ID
if ($meta_id !== null) {
    $sql .= " AND id = ?";
    $params[] = $meta_id;
} else {
    // Caso contrário, buscar pelo período
    $sql .= " AND mes = ? AND ano = ?";
    $params[] = $mes;
    $params[] = $ano;
}

$stmt = $conn->prepare($sql);
for ($i = 0; $i < count($params); $i++) {
    $stmt->bindParam($i + 1, $params[$i]);
}
$stmt->execute();

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode([
        "status" => 0,
        "message" => "Meta não encontrada para este vendedor."
    ]);
    exit;
}

$meta = $stmt->fetch(PDO::FETCH_ASSOC);
error_log("Meta encontrada: " . json_encode($meta));

// Extrair mês e ano da meta para calcular o período correto
$mes = $meta['mes'];
$ano = $meta['ano'];

// Calcular o primeiro e último dia do mês
$primeiro_dia = sprintf("%04d-%02d-01", $ano, $mes);
$ultimo_dia = date("Y-m-t", strtotime($primeiro_dia));

// Se for meta de vendas, calcular o progresso com base nas vendas realizadas
if ($tipo_meta === 'vendas') {
    // Buscar as vendas do vendedor no período
    $stmt = $conn->prepare("SELECT SUM(valor_total) as total_vendas, 
                                   COUNT(*) as dias_com_venda,
                                   MAX(data) as ultima_venda
                            FROM vendas_diarias 
                            WHERE codusur = ? AND data BETWEEN ? AND ?");
    $stmt->bindParam(1, $vendedor['rca'], PDO::PARAM_STR);
    $stmt->bindParam(2, $primeiro_dia, PDO::PARAM_STR);
    $stmt->bindParam(3, $ultimo_dia, PDO::PARAM_STR);
    $stmt->execute();
    $vendas = $stmt->fetch(PDO::FETCH_ASSOC);

    // Calcular o progresso
    $total_vendas = $vendas['total_vendas'] ? floatval($vendas['total_vendas']) : 0;
    $valor_meta = floatval($meta[$campo_valor]);
    $percentual = $valor_meta > 0 ? ($total_vendas / $valor_meta) * 100 : 0;
    $falta = $valor_meta - $total_vendas;
    $falta = $falta > 0 ? $falta : 0;

    // Calcular dias úteis no mês (excluindo sábados e domingos)
    $dias_uteis_totais = 0;
    $dias_uteis_passados = 0;
    $data_atual = date('Y-m-d');

    $data_temp = new DateTime($primeiro_dia);
    $ultimo_dia_obj = new DateTime($ultimo_dia);

    while ($data_temp <= $ultimo_dia_obj) {
        $dia_semana = $data_temp->format('N');
        
        // Dias 6 e 7 são sábado e domingo
        if ($dia_semana < 6) {
            $dias_uteis_totais++;
            
            // Se a data for menor ou igual à data atual, é um dia útil que já passou
            if ($data_temp->format('Y-m-d') <= $data_atual) {
                $dias_uteis_passados++;
            }
        }
        
        $data_temp->modify('+1 day');
    }

    // Calcular média diária necessária para atingir a meta
    $media_diaria_necessaria = 0;
    if ($dias_uteis_passados < $dias_uteis_totais) {
        $dias_uteis_restantes = $dias_uteis_totais - $dias_uteis_passados;
        $media_diaria_necessaria = $falta / $dias_uteis_restantes;
    }

    // Atualizar o valor realizado e percentual na tabela de metas
    $stmt = $conn->prepare("UPDATE metas_vendas SET valor_realizado = ?, percentual_atingido = ?, status = ? WHERE id = ?");
    $status = $percentual >= 100 ? 'concluida' : ($percentual > 0 ? 'em_andamento' : 'pendente');
    $stmt->bindParam(1, $total_vendas, PDO::PARAM_STR);
    $stmt->bindParam(2, $percentual, PDO::PARAM_STR);
    $stmt->bindParam(3, $status, PDO::PARAM_STR);
    $stmt->bindParam(4, $meta['id'], PDO::PARAM_INT);
    $stmt->execute();

    // Preparar os dados para retornar
    $progresso = [
        "percentual" => round($percentual, 2),
        "valor_faltante" => $falta,
        "dias_uteis_totais" => $dias_uteis_totais,
        "dias_uteis_passados" => $dias_uteis_passados,
        "dias_uteis_restantes" => $dias_uteis_totais - $dias_uteis_passados,
        "media_diaria_necessaria" => round($media_diaria_necessaria, 2),
        "status" => $status
    ];

    $vendas_info = [
        "total_vendas" => $total_vendas,
        "dias_com_venda" => intval($vendas['dias_com_venda']),
        "ultima_venda" => $vendas['ultima_venda']
    ];
} else {
    // Meta de cadastro de clientes
    // Buscar os clientes cadastrados pelo vendedor no período
    $stmt = $conn->prepare("SELECT 
                               COUNT(CASE WHEN (novo = 1 OR created_at = updated_at) THEN 1 END) as total_novos_clientes,
                               COUNT(CASE WHEN (atualizado = 1 OR created_at != updated_at) THEN 1 END) as total_clientes_atualizados,
                               MAX(created_at) as ultimo_cadastro
                            FROM clientes 
                            WHERE rca = ? AND created_at BETWEEN ? AND ?");
    $stmt->bindParam(1, $vendedor['rca'], PDO::PARAM_STR);
    $stmt->bindParam(2, $primeiro_dia, PDO::PARAM_STR);
    $stmt->bindParam(3, $ultimo_dia, PDO::PARAM_STR);
    $stmt->execute();
    $cadastros = $stmt->fetch(PDO::FETCH_ASSOC);

    // Calcular o progresso (apenas com clientes novos)
    $total_novos_cadastros = $cadastros['total_novos_clientes'] ? intval($cadastros['total_novos_clientes']) : 0;
    $total_clientes_atualizados = $cadastros['total_clientes_atualizados'] ? intval($cadastros['total_clientes_atualizados']) : 0;
    $quantidade_meta = intval($meta[$campo_valor]);
    $percentual = $quantidade_meta > 0 ? ($total_novos_cadastros / $quantidade_meta) * 100 : 0;
    $falta = $quantidade_meta - $total_novos_cadastros;
    $falta = $falta > 0 ? $falta : 0;

    // Calcular dias restantes no mês
    $data_atual = new DateTime();
    $ultimo_dia_obj = new DateTime($ultimo_dia);
    $dias_restantes = $data_atual <= $ultimo_dia_obj ? $data_atual->diff($ultimo_dia_obj)->days + 1 : 0;

    // Calcular média diária necessária para atingir a meta
    $media_diaria_necessaria = $dias_restantes > 0 ? $falta / $dias_restantes : 0;

    // Atualizar a quantidade realizada e percentual na tabela de metas
    $stmt = $conn->prepare("UPDATE metas_cadastro_clientes SET quantidade_realizada = ?, percentual_atingido = ?, status = ? WHERE id = ?");
    $status = $percentual >= 100 ? 'concluida' : ($percentual > 0 ? 'em_andamento' : 'pendente');
    $stmt->bindParam(1, $total_novos_cadastros, PDO::PARAM_INT);
    $stmt->bindParam(2, $percentual, PDO::PARAM_STR);
    $stmt->bindParam(3, $status, PDO::PARAM_STR);
    $stmt->bindParam(4, $meta['id'], PDO::PARAM_INT);
    $stmt->execute();

    // Preparar os dados para retornar
    $progresso = [
        "percentual" => round($percentual, 2),
        "quantidade_faltante" => $falta,
        "dias_restantes" => $dias_restantes,
        "media_diaria_necessaria" => round($media_diaria_necessaria, 2),
        "status" => $status
    ];

    $vendas_info = [
        "total_novos_cadastros" => $total_novos_cadastros,
        "total_clientes_atualizados" => $total_clientes_atualizados,
        "ultimo_cadastro" => $cadastros['ultimo_cadastro']
    ];
}

// Formatar o nome do mês
$meses = [
    1 => 'Janeiro',
    2 => 'Fevereiro',
    3 => 'Março',
    4 => 'Abril',
    5 => 'Maio',
    6 => 'Junho',
    7 => 'Julho',
    8 => 'Agosto',
    9 => 'Setembro',
    10 => 'Outubro',
    11 => 'Novembro',
    12 => 'Dezembro'
];

$nome_mes = $meses[$mes];

// Preparar o resultado
$resultado = [
    "status" => 1,
    "message" => "Progresso calculado com sucesso",
    "vendedor" => $vendedor,
    "meta" => [
        "id" => $meta['id'],
        "mes" => $meta['mes'],
        "ano" => $meta['ano'],
        "nome_mes" => $nome_mes,
        "periodo" => $nome_mes . '/' . $ano,
        "tipo_meta" => $tipo_meta,
        "valor_meta" => $meta[$campo_valor],
        "valor_realizado" => $meta[$campo_realizado],
        "observacoes" => $meta['observacoes']
    ],
    "dados" => $vendas_info,
    "progresso" => $progresso
];

// Retornar os resultados
http_response_code(200);
echo json_encode($resultado);
?> 