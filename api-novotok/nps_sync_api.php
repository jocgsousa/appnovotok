<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'database.php';
require_once 'jwt_utils.php';

// Verificar autenticação JWT
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode(['error' => 'Token de acesso requerido']);
    exit();
}

$token = $matches[1];
if (!JwtUtils::validateToken($token)) {
    http_response_code(401);
    echo json_encode(['error' => 'Token inválido']);
    exit();
}

$database = new Database();
$pdo = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));

try {
    switch ($method) {
        case 'GET':
            if (isset($pathParts[3])) {
                switch ($pathParts[3]) {
                    case 'campanhas-ativas':
                        // GET /api/v1/nps_sync_api/campanhas-ativas - Buscar campanhas NPS ativas
                        $disparo_imediato = $_GET['disparo_imediato'] ?? null;
                        
                        $query = "SELECT id, instancia_id, filiais_ativas, dias_apos_compra, disparo_imediato, nome, mensagem_nps, horario_inicio, horario_fim FROM campanhas_nps WHERE status = 'ativa'";
                        $params = [];
                        
                        if ($disparo_imediato !== null) {
                            $query .= " AND disparo_imediato = ?";
                            $params[] = (int)$disparo_imediato;
                        }
                        
                        $stmt = $pdo->prepare($query);
                        $stmt->execute($params);
                        $campanhas = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        echo json_encode($campanhas);
                        break;
                        
                    case 'pedidos-recentes':
                        // GET /api/v1/nps_sync_api/pedidos-recentes - Buscar pedidos recentes para NPS (migrado para pedidos_vendas)
                        $minutos = $_GET['minutos'] ?? 5;
                        $filiais = $_GET['filiais'] ?? null;
                        $limit = $_GET['limit'] ?? 10;

                        $query = "
                            SELECT 
                                pv.numped AS NUMPED,
                                pv.codfilial AS CODFILIAL,
                                pv.numcaixa AS NUMCAIXA,
                                pv.data AS DATA,
                                pv.vltotal AS VLTOTAL
                            FROM pedidos_vendas pv
                            WHERE pv.data >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
                              AND pv.vltotal > 0
                        ";
                        $params = [$minutos];

                        if ($filiais) {
                            $filiaisArray = explode(',', $filiais);
                            $placeholders = str_repeat('?,', count($filiaisArray) - 1) . '?';
                            $query .= " AND pv.codfilial IN ($placeholders)";
                            $params = array_merge($params, $filiaisArray);
                        }

                        $query .= " ORDER BY pv.data DESC LIMIT ?";
                        $params[] = (int)$limit;

                        $stmt = $pdo->prepare($query);
                        $stmt->execute($params);
                        $pedidos = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        echo json_encode($pedidos);
                        break;
                        
                    case 'conversa-ativa':
                        // GET /api/v1/nps_sync_api/conversa-ativa - Buscar conversa NPS ativa
                        $numeros = $_GET['numeros'] ?? '';
                        $instancia_id = $_GET['instancia_id'] ?? null;
                        
                        if (empty($numeros) || !$instancia_id) {
                            http_response_code(400);
                            echo json_encode(['error' => 'Parâmetros numeros e instancia_id são obrigatórios']);
                            break;
                        }
                        
                        $numerosArray = explode(',', $numeros);
                        $placeholders = str_repeat('?,', count($numerosArray) - 1) . '?';
                        
                        $query = "
                            SELECT 
                                ec.id,
                                ec.controle_envio_id,
                                ec.pergunta_atual_id,
                                ec.aguardando_resposta,
                                ce.campanha_id,
                                ce.codcli,
                                ec.celular as celular_registrado
                            FROM estado_conversa_nps ec
                            INNER JOIN controle_envios_nps ce ON ec.controle_envio_id = ce.id
                            WHERE ec.celular IN ($placeholders)
                              AND ec.instancia_id = ?
                              AND ec.aguardando_resposta = TRUE
                            ORDER BY ec.id DESC
                            LIMIT 1
                        ";
                        
                        $params = array_merge($numerosArray, [$instancia_id]);
                        $stmt = $pdo->prepare($query);
                        $stmt->execute($params);
                        $conversa = $stmt->fetch(PDO::FETCH_ASSOC);
                        
                        echo json_encode($conversa ?: null);
                        break;
                        
                    case 'envios-agendados':
                        // GET /api/v1/nps_sync_api/envios-agendados - Buscar envios NPS agendados
                        $query = "
                            SELECT 
                                ce.id,
                                ce.codcli,
                                ce.campanha_id,
                                ce.data_agendamento,
                                ce.status,
                                c.nome as campanha_nome,
                                c.mensagem_nps,
                                c.instancia_id
                            FROM controle_envios_nps ce
                            INNER JOIN campanhas_nps c ON ce.campanha_id = c.id
                            WHERE ce.status = 'agendado'
                              AND ce.data_agendamento <= NOW()
                              AND c.status = 'ativa'
                            ORDER BY ce.data_agendamento ASC
                        ";
                        
                        $stmt = $pdo->prepare($query);
                        $stmt->execute();
                        $envios = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        echo json_encode($envios);
                        break;
                        
                    default:
                        http_response_code(404);
                        echo json_encode(['error' => 'Endpoint não encontrado']);
                        break;
                }
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'Endpoint específico é obrigatório']);
            }
            break;
            
        case 'POST':
            if (isset($pathParts[3])) {
                switch ($pathParts[3]) {
                    case 'controle-envio':
                        // POST /api/v1/nps_sync_api/controle-envio - Criar controle de envio NPS
                        $input = json_decode(file_get_contents('php://input'), true);
                        
                        $required = ['codcli', 'campanha_id', 'pedido_id', 'filial', 'valor_pedido'];
                        foreach ($required as $field) {
                            if (!isset($input[$field])) {
                                http_response_code(400);
                                echo json_encode(['error' => "Campo $field é obrigatório"]);
                                exit();
                            }
                        }
                        
                        // Verificar se já existe controle para este pedido/cliente/campanha
                        $stmt = $pdo->prepare("
                            SELECT id FROM controle_envios_nps 
                            WHERE pedido_id = ? AND codcli = ? AND campanha_id = ?
                        ");
                        $stmt->execute([$input['pedido_id'], $input['codcli'], $input['campanha_id']]);
                        
                        if ($stmt->fetch()) {
                            echo json_encode(['exists' => true, 'message' => 'Controle já existe']);
                            break;
                        }
                        
                        // Inserir novo controle
                        $stmt = $pdo->prepare("
                            INSERT INTO controle_envios_nps 
                            (codcli, campanha_id, pedido_id, filial, valor_pedido, data_criacao, status, data_agendamento)
                            VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)
                        ");
                        
                        $status = $input['status'] ?? 'pendente';
                        $data_agendamento = $input['data_agendamento'] ?? null;
                        
                        $success = $stmt->execute([
                            $input['codcli'],
                            $input['campanha_id'],
                            $input['pedido_id'],
                            $input['filial'],
                            $input['valor_pedido'],
                            $status,
                            $data_agendamento
                        ]);
                        
                        if ($success) {
                            $controle_id = $pdo->lastInsertId();
                            echo json_encode(['success' => true, 'controle_id' => $controle_id]);
                        } else {
                            http_response_code(500);
                            echo json_encode(['error' => 'Erro ao criar controle de envio']);
                        }
                        break;
                        
                    case 'estado-conversa':
                        // POST /api/v1/nps_sync_api/estado-conversa - Criar estado de conversa NPS
                        $input = json_decode(file_get_contents('php://input'), true);
                        
                        // Aceitar alias e preparar variáveis
                        $controleEnvioId = $input['controle_envio_id'] ?? $input['controle_id'] ?? null;
                        $instanciaId = $input['instancia_id'] ?? null;
                        $celular = $input['celular'] ?? null;

                        // Tentar localizar controle pelo ID fornecido
                        $controle = null;
                        if ($controleEnvioId) {
                            $stmt = $pdo->prepare("SELECT id, instancia_id, celular FROM controle_envios_nps WHERE id = ? LIMIT 1");
                            $stmt->execute([$controleEnvioId]);
                            $controle = $stmt->fetch(PDO::FETCH_ASSOC);
                        }

                        // Se ID inválido ou não informado, tentar fallback por pedido/campanha
                        if (!$controle) {
                            if (isset($input['pedido_id']) && isset($input['campanha_id'])) {
                                $stmt = $pdo->prepare("SELECT id, instancia_id, celular FROM controle_envios_nps WHERE pedido_id = ? AND campanha_id = ? LIMIT 1");
                                $stmt->execute([$input['pedido_id'], $input['campanha_id']]);
                                $controle = $stmt->fetch(PDO::FETCH_ASSOC);
                                if ($controle) {
                                    $controleEnvioId = $controle['id'];
                                }
                            }
                        }

                        // Se não encontrou controle, retornar 404
                        if (!$controleEnvioId || !$controle) {
                            http_response_code(404);
                            echo json_encode([
                                'error' => 'controle_envio_id não encontrado para estado-conversa',
                                'details' => [
                                    'controle_envio_id' => $input['controle_envio_id'] ?? $input['controle_id'] ?? null,
                                    'pedido_id' => $input['pedido_id'] ?? null,
                                    'campanha_id' => $input['campanha_id'] ?? null
                                ]
                            ]);
                            break;
                        }

                        // Preencher instancia/celular a partir do controle, se não vierem
                        if (!$instanciaId && !empty($controle['instancia_id'])) {
                            $instanciaId = $controle['instancia_id'];
                        }
                        if (!$celular && !empty($controle['celular'])) {
                            $celular = $controle['celular'];
                        }

                        // Validar campos mínimos
                        if (!$instanciaId || !$celular) {
                            http_response_code(400);
                            echo json_encode(['error' => 'instancia_id e celular são obrigatórios']);
                            break;
                        }

                        // Idempotência: se já existe estado para este controle, não duplicar
                        $stmt = $pdo->prepare("SELECT id FROM estado_conversa_nps WHERE controle_envio_id = ? LIMIT 1");
                        $stmt->execute([$controleEnvioId]);
                        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                        if ($existing) {
                            echo json_encode(['success' => true, 'existing' => true, 'estado_id' => $existing['id']]);
                            break;
                        }

                        // Inserir estado de conversa
                        $stmt = $pdo->prepare(
                            "INSERT INTO estado_conversa_nps 
                            (controle_envio_id, instancia_id, celular, pergunta_atual_id, aguardando_resposta, data_criacao)
                            VALUES (?, ?, ?, ?, ?, NOW())"
                        );
                        
                        $success = $stmt->execute([
                            $controleEnvioId,
                            $instanciaId,
                            $celular,
                            $input['pergunta_atual_id'] ?? 1,
                            $input['aguardando_resposta'] ?? true
                        ]);
                        
                        if ($success) {
                            $estado_id = $pdo->lastInsertId();
                            echo json_encode(['success' => true, 'estado_id' => $estado_id]);
                        } else {
                            http_response_code(500);
                            echo json_encode(['error' => 'Erro ao criar estado de conversa']);
                        }
                        break;
                        
                    case 'resposta-nps':
                        // POST /api/v1/nps_sync_api/resposta-nps - Salvar resposta NPS
                        $input = json_decode(file_get_contents('php://input'), true);
                        
                        $required = ['controle_envio_id'];
                        foreach ($required as $field) {
                            if (!isset($input[$field])) {
                                http_response_code(400);
                                echo json_encode(['error' => "Campo $field é obrigatório"]);
                                exit();
                            }
                        }
                        
                        $stmt = $pdo->prepare("
                            INSERT INTO respostas_nps 
                            (controle_envio_id, pergunta_id, resposta, tipo_resposta, categoria_nps, nota_nps, classificacao_nps, resposta_texto, data_resposta, message_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
                        ");
                        
                        $success = $stmt->execute([
                            $input['controle_envio_id'],
                            $input['pergunta_id'] ?? 1,
                            $input['resposta'] ?? $input['nota'] ?? $input['comentario'] ?? '',
                            $input['tipo_resposta'] ?? 'numerica',
                            $input['categoria_nps'] ?? null,
                            $input['nota_nps'] ?? $input['nota'] ?? null,
                            $input['classificacao_nps'] ?? $input['categoria_nps'] ?? null,
                            $input['resposta_texto'] ?? $input['comentario'] ?? $input['resposta'] ?? '',
                            $input['message_id'] ?? null
                        ]);
                        
                        if ($success) {
                            echo json_encode(['success' => true]);
                        } else {
                            http_response_code(500);
                            echo json_encode(['error' => 'Erro ao salvar resposta NPS']);
                        }
                        break;
                        
                    case 'enviar-mensagem':
                        // POST /api/v1/nps_sync_api/enviar-mensagem - Enviar mensagem NPS e atualizar controle
                        $input = json_decode(file_get_contents('php://input'), true);
                        
                        $required = ['controle_id', 'status_envio'];
                        foreach ($required as $field) {
                            if (!isset($input[$field])) {
                                http_response_code(400);
                                echo json_encode(['error' => "Campo $field é obrigatório"]);
                                exit();
                            }
                        }
                        
                        // Atualizar controle de envio
                        $stmt = $pdo->prepare("
                            UPDATE controle_envios_nps 
                            SET status_envio = ?, 
                                data_envio = NOW(), 
                                tentativas_envio = tentativas_envio + 1,
                                message_id = ?,
                                ultimo_erro = ?
                            WHERE id = ?
                        ");
                        
                        $success = $stmt->execute([
                            $input['status_envio'],
                            $input['message_id'] ?? null,
                            $input['ultimo_erro'] ?? null,
                            $input['controle_id']
                        ]);
                        
                        // Se enviado com sucesso, criar estado de conversa
                        if ($success && $input['status_envio'] === 'enviado') {
                            // Garantir que o controle existe; preencher celular/instância por fallback
                            $stmt = $pdo->prepare("SELECT id, instancia_id, celular FROM controle_envios_nps WHERE id = ? LIMIT 1");
                            $stmt->execute([$input['controle_id']]);
                            $controle = $stmt->fetch(PDO::FETCH_ASSOC);

                            if (!$controle) {
                                // Tentar fallback por pedido/campanha se fornecidos
                                if (isset($input['pedido_id']) && isset($input['campanha_id'])) {
                                    $stmt = $pdo->prepare("SELECT id, instancia_id, celular FROM controle_envios_nps WHERE pedido_id = ? AND campanha_id = ? LIMIT 1");
                                    $stmt->execute([$input['pedido_id'], $input['campanha_id']]);
                                    $controle = $stmt->fetch(PDO::FETCH_ASSOC);
                                }
                            }

                            if ($controle) {
                                $instanciaId = $input['instancia_id'] ?? $controle['instancia_id'] ?? null;
                                $celular = $input['celular'] ?? $controle['celular'] ?? null;

                                if ($instanciaId && $celular) {
                                    // Idempotência: não duplicar estado
                                    $stmt = $pdo->prepare("SELECT id FROM estado_conversa_nps WHERE controle_envio_id = ? LIMIT 1");
                                    $stmt->execute([$controle['id']]);
                                    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

                                    if (!$existing) {
                                        $stmt = $pdo->prepare("
                                            INSERT INTO estado_conversa_nps (
                                                controle_envio_id, instancia_id, celular, 
                                                aguardando_resposta, data_timeout
                                            ) VALUES (?, ?, ?, TRUE, DATE_ADD(NOW(), INTERVAL ? MINUTE))
                                        ");
                                        $stmt->execute([
                                            $controle['id'],
                                            $instanciaId,
                                            $celular,
                                            $input['timeout_minutos'] ?? 60
                                        ]);
                                    }
                                }
                            }
                        }
                        
                        if ($success) {
                            echo json_encode(['success' => true]);
                        } else {
                            http_response_code(500);
                            echo json_encode(['error' => 'Erro ao atualizar controle de envio']);
                        }
                        break;
                        
                    default:
                        http_response_code(404);
                        echo json_encode(['error' => 'Endpoint não encontrado']);
                        break;
                }
            }
            break;
            
        case 'PUT':
            if (isset($pathParts[3])) {
                switch ($pathParts[3]) {
                    case 'controle-envio':
                        // PUT /api/v1/nps_sync_api/controle-envio - Atualizar controle de envio
                        $input = json_decode(file_get_contents('php://input'), true);
                        
                        if (!isset($input['id'])) {
                            http_response_code(400);
                            echo json_encode(['error' => 'ID do controle é obrigatório']);
                            break;
                        }
                        
                        $updates = [];
                        $params = [];
                        
                        if (isset($input['status'])) {
                            $updates[] = "status = ?";
                            $params[] = $input['status'];
                        }
                        
                        if (isset($input['data_envio'])) {
                            $updates[] = "data_envio = ?";
                            $params[] = $input['data_envio'];
                        }
                        
                        if (isset($input['ultimo_erro'])) {
                            $updates[] = "ultimo_erro = ?";
                            $params[] = $input['ultimo_erro'];
                        }
                        
                        if (empty($updates)) {
                            http_response_code(400);
                            echo json_encode(['error' => 'Nenhum campo para atualizar']);
                            break;
                        }
                        
                        $params[] = $input['id'];
                        $query = "UPDATE controle_envios_nps SET " . implode(', ', $updates) . " WHERE id = ?";
                        
                        $stmt = $pdo->prepare($query);
                        $success = $stmt->execute($params);
                        
                        if ($success && $stmt->rowCount() > 0) {
                            echo json_encode(['success' => true]);
                        } else {
                            http_response_code(404);
                            echo json_encode(['error' => 'Controle não encontrado']);
                        }
                        break;
                        
                    case 'estado-conversa':
                        // PUT /api/v1/nps_sync_api/estado-conversa - Atualizar estado de conversa
                        $input = json_decode(file_get_contents('php://input'), true);
                        
                        if (!isset($input['id'])) {
                            http_response_code(400);
                            echo json_encode(['error' => 'ID do estado é obrigatório']);
                            break;
                        }
                        
                        $updates = [];
                        $params = [];
                        
                        if (isset($input['pergunta_atual_id'])) {
                            $updates[] = "pergunta_atual_id = ?";
                            $params[] = $input['pergunta_atual_id'];
                        }
                        
                        if (isset($input['aguardando_resposta'])) {
                            $updates[] = "aguardando_resposta = ?";
                            $params[] = $input['aguardando_resposta'];
                        }
                        
                        if (isset($input['status'])) {
                            $updates[] = "status = ?";
                            $params[] = $input['status'];
                        }
                        
                        if (empty($updates)) {
                            http_response_code(400);
                            echo json_encode(['error' => 'Nenhum campo para atualizar']);
                            break;
                        }
                        
                        $params[] = $input['id'];
                        $query = "UPDATE estado_conversa_nps SET " . implode(', ', $updates) . " WHERE id = ?";
                        
                        $stmt = $pdo->prepare($query);
                        $success = $stmt->execute($params);
                        
                        if ($success && $stmt->rowCount() > 0) {
                            echo json_encode(['success' => true]);
                        } else {
                            http_response_code(404);
                            echo json_encode(['error' => 'Estado não encontrado']);
                        }
                        break;
                        
                    default:
                        http_response_code(404);
                        echo json_encode(['error' => 'Endpoint não encontrado']);
                        break;
                }
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método não permitido']);
            break;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno do servidor: ' . $e->getMessage()]);
}
?>
