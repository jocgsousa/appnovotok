<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'jwt_utils.php';

header('Content-Type: application/json');

// Verificar método HTTP
$method = $_SERVER['REQUEST_METHOD'];

try {
    // Verificar token JWT
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token de autorização não fornecido']);
        exit;
    }
    
    $token = $matches[1];
    $user_id = JwtUtils::validateToken($token);
    
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['error' => 'Token inválido']);
        exit;
    }

    // Conectar ao banco
    $database = new Database();
    $db = $database->getConnection();

    switch ($method) {
        case 'GET':
            if (isset($_GET['id'])) {
                obterCampanha($db, $_GET['id']);
            } else {
                listarCampanhas($db);
            }
            break;
        case 'POST':
            criarCampanha($db);
            break;
        case 'PUT':
            atualizarCampanha($db);
            break;
        case 'DELETE':
            deletarCampanha($db);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método não permitido']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno do servidor: ' . $e->getMessage()]);
}

function listarCampanhas($db) {
    try {
        $query = "SELECT 
                    c.id,
                    c.nome,
                    c.descricao,
                    c.pergunta_principal,
                    c.mensagem_inicial,
                    c.mensagem_final,
                    c.dias_apos_compra,
                    c.disparo_imediato,
                    c.status,
                    c.data_inicio,
                    c.data_fim,
                    c.max_tentativas_envio,
                    c.intervalo_reenvio_dias,
                    c.horario_envio_inicio,
                    c.horario_envio_fim,
                    c.dias_semana_envio,
                    c.filiais_ativas,
                    c.timeout_conversa_minutos,
                    c.data_cadastro,
                    c.imagem,
                    c.imagem_tipo,
                    c.imagem_nome,
                    i.nome as instancia_nome,
                    i.numero_whatsapp
                  FROM campanhas_nps c
                  LEFT JOIN instancias_whatsapp i ON c.instancia_id = i.id
                  ORDER BY c.data_cadastro DESC";
        
        $stmt = $db->prepare($query);
        $stmt->execute();
        
        $campanhas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Processar dados das campanhas
        foreach ($campanhas as &$campanha) {
            // Decodificar JSON das filiais ativas
            $campanha['filiais_ativas'] = $campanha['filiais_ativas'] ? json_decode($campanha['filiais_ativas'], true) : [];
            
            // Converter imagem BLOB para base64 se existir
            if ($campanha['imagem']) {
                $campanha['imagem'] = 'data:' . $campanha['imagem_tipo'] . ';base64,' . base64_encode($campanha['imagem']);
            }
        }
        
        echo json_encode([
            'success' => true,
            'data' => $campanhas
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao listar campanhas: ' . $e->getMessage()]);
    }
}

function obterCampanha($db, $id) {
    try {
        $query = "SELECT 
                    c.*,
                    i.nome as instancia_nome,
                    i.numero_whatsapp
                  FROM campanhas_nps c
                  INNER JOIN instancias_whatsapp i ON c.instancia_id = i.id
                  WHERE c.id = ?";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$id]);
        
        $campanha = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$campanha) {
            http_response_code(404);
            echo json_encode(['error' => 'Campanha não encontrada']);
            return;
        }
        
        // Decodificar JSON das filiais ativas
        $campanha['filiais_ativas'] = $campanha['filiais_ativas'] ? json_decode($campanha['filiais_ativas'], true) : [];
        
        // Converter imagem BLOB para base64 se existir
        if ($campanha['imagem']) {
            $campanha['imagem'] = 'data:' . $campanha['imagem_tipo'] . ';base64,' . base64_encode($campanha['imagem']);
        }
        
        // Buscar perguntas da campanha
        $perguntasQuery = "SELECT * FROM perguntas_nps WHERE campanha_id = ? ORDER BY ordem";
        $perguntasStmt = $db->prepare($perguntasQuery);
        $perguntasStmt->execute([$id]);
        $campanha['perguntas'] = $perguntasStmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => $campanha
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao obter campanha: ' . $e->getMessage()]);
    }
}

function criarCampanha($db) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validar campos obrigatórios (instancia_id agora é opcional)
        $required = ['nome', 'pergunta_principal'];
        foreach ($required as $field) {
            if (!isset($input[$field]) || empty($input[$field])) {
                http_response_code(400);
                echo json_encode(['error' => "Campo '$field' é obrigatório"]);
                return;
            }
        }
        
        // Verificar se instância existe (apenas se foi informada)
        if (isset($input['instancia_id']) && $input['instancia_id'] !== null && $input['instancia_id'] !== '') {
            $checkQuery = "SELECT id FROM instancias_whatsapp WHERE id = ? AND status = 'ativa'";
            $checkStmt = $db->prepare($checkQuery);
            $checkStmt->execute([$input['instancia_id']]);
            
            if (!$checkStmt->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => 'Instância não encontrada ou inativa']);
                return;
            }
        }
        
        // Processar imagem se fornecida
        $imagemBlob = null;
        $imagemTipo = null;
        $imagemNome = null;
        
        if (isset($input['imagem']) && !empty($input['imagem'])) {
            // Verificar se é base64
            if (preg_match('/^data:image\/(\w+);base64,(.+)$/', $input['imagem'], $matches)) {
                $imagemTipo = 'image/' . $matches[1];
                $imagemBlob = base64_decode($matches[2]);
                $imagemNome = $input['imagem_nome'] ?? 'campanha_' . time() . '.' . $matches[1];
                
                // Validar tamanho da imagem (máx 5MB)
                if (strlen($imagemBlob) > 5 * 1024 * 1024) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Imagem muito grande. Tamanho máximo: 5MB']);
                    return;
                }
                
                // Validar tipo de imagem
                $tiposPermitidos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!in_array($imagemTipo, $tiposPermitidos)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Tipo de imagem não permitido. Use: JPEG, PNG, GIF ou WebP']);
                    return;
                }
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'Formato de imagem inválido. Use base64 com data URL']);
                return;
            }
        }

        $query = "INSERT INTO campanhas_nps 
                    (instancia_id, nome, descricao, pergunta_principal, mensagem_inicial, 
                     mensagem_final, dias_apos_compra, disparo_imediato, status, data_inicio, data_fim, 
                     max_tentativas_envio, intervalo_reenvio_dias, horario_envio_inicio, 
                     horario_envio_fim, dias_semana_envio, filiais_ativas, timeout_conversa_minutos,
                     imagem, imagem_tipo, imagem_nome) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $db->prepare($query);
        $stmt->execute([
            isset($input['instancia_id']) && $input['instancia_id'] !== '' ? $input['instancia_id'] : null,
            $input['nome'],
            $input['descricao'] ?? null,
            $input['pergunta_principal'],
            $input['mensagem_inicial'] ?? 'Olá! Sua opinião é muito importante para nós! 😊',
            $input['mensagem_final'] ?? 'Muito obrigado pelo seu feedback! Sua opinião nos ajuda a melhorar sempre! 🙏✨',
            $input['dias_apos_compra'] ?? 7,
            isset($input['disparo_imediato']) ? (bool)$input['disparo_imediato'] : false,
            $input['status'] ?? 'ativa',
            $input['data_inicio'] ?? null,
            $input['data_fim'] ?? null,
            $input['max_tentativas_envio'] ?? 3,
            $input['intervalo_reenvio_dias'] ?? 7,
            $input['horario_envio_inicio'] ?? '09:00:00',
            $input['horario_envio_fim'] ?? '18:00:00',
            $input['dias_semana_envio'] ?? '1,2,3,4,5,6',
            isset($input['filiais_ativas']) ? json_encode($input['filiais_ativas']) : null,
            $input['timeout_conversa_minutos'] ?? 30,
            $imagemBlob,
            $imagemTipo,
            $imagemNome
        ]);
        
        $campanhaId = $db->lastInsertId();
        
        // Criar perguntas adicionais se fornecidas
        if (isset($input['perguntas']) && is_array($input['perguntas'])) {
            foreach ($input['perguntas'] as $index => $pergunta) {
                $perguntaQuery = "INSERT INTO perguntas_nps (
                                    campanha_id, pergunta, tipo_resposta, opcoes_resposta,
                                    validacao_regex, mensagem_erro, obrigatoria, ordem, status
                                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                
                $perguntaStmt = $db->prepare($perguntaQuery);
                $perguntaStmt->execute([
                    $campanhaId,
                    $pergunta['pergunta'],
                    $pergunta['tipo_resposta'] ?? 'texto_livre',
                    isset($pergunta['opcoes_resposta']) ? json_encode($pergunta['opcoes_resposta']) : null,
                    $pergunta['validacao_regex'] ?? null,
                    $pergunta['mensagem_erro'] ?? 'Resposta inválida. Tente novamente.',
                    $pergunta['obrigatoria'] ?? false,
                    $index + 1,
                    $pergunta['status'] ?? 'ativa'
                ]);
            }
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Campanha criada com sucesso',
            'id' => $campanhaId
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao criar campanha: ' . $e->getMessage()]);
    }
}

function atualizarCampanha($db) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'ID da campanha é obrigatório']);
            return;
        }
        
        // Verificar se campanha existe
        $checkQuery = "SELECT id FROM campanhas_nps WHERE id = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$input['id']]);
        
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Campanha não encontrada']);
            return;
        }
        
        // Verificar se instância existe (apenas se foi informada)
        if (isset($input['instancia_id']) && $input['instancia_id'] !== null && $input['instancia_id'] !== '') {
            $checkInstQuery = "SELECT id FROM instancias_whatsapp WHERE id = ? AND status = 'ativa'";
            $checkInstStmt = $db->prepare($checkInstQuery);
            $checkInstStmt->execute([$input['instancia_id']]);
            
            if (!$checkInstStmt->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => 'Instância não encontrada ou inativa']);
                return;
            }
        }
        
        // Processar imagem
        $imagemBlob = null;
        $imagemTipo = null;
        $imagemNome = null;
        $atualizarImagem = false;
        
        // Verificar se os campos de imagem foram enviados no payload
        if (array_key_exists('imagem', $input) || array_key_exists('imagem_tipo', $input) || array_key_exists('imagem_nome', $input)) {
            $atualizarImagem = true;
            
            // Se imagem foi fornecida e não é null
            if (isset($input['imagem']) && !empty($input['imagem']) && $input['imagem'] !== null) {
                // Verificar se é uma string base64 com data URL
                if (preg_match('/^data:image\/(\w+);base64,(.+)$/', $input['imagem'], $matches)) {
                    $imagemTipo = 'image/' . $matches[1];
                    $imagemBlob = base64_decode($matches[2]);
                    $imagemNome = $input['imagem_nome'] ?? 'campanha_' . time() . '.' . $matches[1];
                    
                    // Validar tamanho da imagem (máx 5MB)
                    if (strlen($imagemBlob) > 5 * 1024 * 1024) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Imagem muito grande. Tamanho máximo: 5MB']);
                        return;
                    }
                    
                    // Validar tipo de imagem
                    $tiposPermitidos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                    if (!in_array($imagemTipo, $tiposPermitidos)) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Tipo de imagem não permitido. Use: JPEG, PNG, GIF ou WebP']);
                        return;
                    }
                } else if ($input['imagem'] !== null) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Formato de imagem inválido. Use base64 com data URL']);
                    return;
                }
            }
            // Se imagem é null, os valores já estão definidos como null acima
        }
        
        // Construir query de atualização
        if ($atualizarImagem) {
            // Atualizar incluindo campos de imagem
            $query = "UPDATE campanhas_nps SET 
                        instancia_id = ?, nome = ?, descricao = ?, pergunta_principal = ?, mensagem_inicial = ?,
                        mensagem_final = ?, dias_apos_compra = ?, disparo_imediato = ?, status = ?, data_inicio = ?,
                        data_fim = ?, max_tentativas_envio = ?, intervalo_reenvio_dias = ?,
                        horario_envio_inicio = ?, horario_envio_fim = ?, dias_semana_envio = ?,
                        filiais_ativas = ?, timeout_conversa_minutos = ?, imagem = ?, imagem_tipo = ?, imagem_nome = ?
                      WHERE id = ?";
            
            $stmt = $db->prepare($query);
            $stmt->execute([
                isset($input['instancia_id']) && $input['instancia_id'] !== '' ? $input['instancia_id'] : null,
                $input['nome'],
                $input['descricao'],
                $input['pergunta_principal'],
                $input['mensagem_inicial'],
                $input['mensagem_final'],
                $input['dias_apos_compra'],
                isset($input['disparo_imediato']) ? (bool)$input['disparo_imediato'] : false,
                $input['status'],
                $input['data_inicio'],
                $input['data_fim'],
                $input['max_tentativas_envio'],
                $input['intervalo_reenvio_dias'],
                $input['horario_envio_inicio'],
                $input['horario_envio_fim'],
                $input['dias_semana_envio'],
                isset($input['filiais_ativas']) ? json_encode($input['filiais_ativas']) : null,
                $input['timeout_conversa_minutos'],
                $imagemBlob,
                $imagemTipo,
                $imagemNome,
                $input['id']
            ]);
        } else {
            // Atualizar sem campos de imagem (manter imagem existente)
            $query = "UPDATE campanhas_nps SET 
                        instancia_id = ?, nome = ?, descricao = ?, pergunta_principal = ?, mensagem_inicial = ?,
                        mensagem_final = ?, dias_apos_compra = ?, disparo_imediato = ?, status = ?, data_inicio = ?,
                        data_fim = ?, max_tentativas_envio = ?, intervalo_reenvio_dias = ?,
                        horario_envio_inicio = ?, horario_envio_fim = ?, dias_semana_envio = ?,
                        filiais_ativas = ?, timeout_conversa_minutos = ?
                      WHERE id = ?";
            
            $stmt = $db->prepare($query);
            $stmt->execute([
                isset($input['instancia_id']) && $input['instancia_id'] !== '' ? $input['instancia_id'] : null,
                $input['nome'],
                $input['descricao'],
                $input['pergunta_principal'],
                $input['mensagem_inicial'],
                $input['mensagem_final'],
                $input['dias_apos_compra'],
                isset($input['disparo_imediato']) ? (bool)$input['disparo_imediato'] : false,
                $input['status'],
                $input['data_inicio'],
                $input['data_fim'],
                $input['max_tentativas_envio'],
                $input['intervalo_reenvio_dias'],
                $input['horario_envio_inicio'],
                $input['horario_envio_fim'],
                $input['dias_semana_envio'],
                isset($input['filiais_ativas']) ? json_encode($input['filiais_ativas']) : null,
                $input['timeout_conversa_minutos'],
                $input['id']
            ]);
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Campanha atualizada com sucesso'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao atualizar campanha: ' . $e->getMessage()]);
    }
}

function deletarCampanha($db) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'ID da campanha é obrigatório']);
            return;
        }
        
        // Verificar se a campanha existe e obter seu status
        $campanhaQuery = "SELECT status FROM campanhas_nps WHERE id = ?";
        $campanhaStmt = $db->prepare($campanhaQuery);
        $campanhaStmt->execute([$input['id']]);
        $campanha = $campanhaStmt->fetch();
        
        if (!$campanha) {
            http_response_code(404);
            echo json_encode(['error' => 'Campanha não encontrada']);
            return;
        }
        
        // Se a campanha está ativa, verificar se há envios ativos
        if ($campanha['status'] === 'ativo') {
            $checkQuery = "SELECT COUNT(*) as count FROM controle_envios_nps WHERE campanha_id = ? AND status_envio IN ('pendente', 'enviado')";
            $checkStmt = $db->prepare($checkQuery);
            $checkStmt->execute([$input['id']]);
            $result = $checkStmt->fetch();
            
            if ($result['count'] > 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Não é possível deletar campanha ativa com envios pendentes. Desative a campanha primeiro.']);
                return;
            }
        }
        
        // Iniciar transação para garantir integridade
        $db->beginTransaction();
        
        try {
            // 1. Deletar respostas NPS relacionadas aos controles de envio desta campanha
            $deleteRespostas = "DELETE r FROM respostas_nps r 
                               INNER JOIN controle_envios_nps ce ON r.controle_envio_id = ce.id 
                               WHERE ce.campanha_id = ?";
            $stmtRespostas = $db->prepare($deleteRespostas);
            $stmtRespostas->execute([$input['id']]);
            
            // 2. Deletar estados de conversa relacionados aos controles de envio desta campanha
            $deleteEstados = "DELETE ec FROM estado_conversa_nps ec 
                             INNER JOIN controle_envios_nps ce ON ec.controle_envio_id = ce.id 
                             WHERE ce.campanha_id = ?";
            $stmtEstados = $db->prepare($deleteEstados);
            $stmtEstados->execute([$input['id']]);
            
            // 3. Deletar controles de envio desta campanha
            $deleteControles = "DELETE FROM controle_envios_nps WHERE campanha_id = ?";
            $stmtControles = $db->prepare($deleteControles);
            $stmtControles->execute([$input['id']]);
            
            // 4. Deletar perguntas relacionadas à campanha
            $deletePerguntas = "DELETE FROM perguntas_nps WHERE campanha_id = ?";
            $stmtPerguntas = $db->prepare($deletePerguntas);
            $stmtPerguntas->execute([$input['id']]);
            
            // 5. Finalmente, deletar a campanha
            $query = "DELETE FROM campanhas_nps WHERE id = ?";
            $stmt = $db->prepare($query);
            $stmt->execute([$input['id']]);
            
            if ($stmt->rowCount() === 0) {
                throw new Exception('Campanha não encontrada');
            }
            
            // Confirmar transação
            $db->commit();
            
        } catch (Exception $e) {
            // Reverter transação em caso de erro
            $db->rollback();
            throw $e;
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Campanha deletada com sucesso'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao deletar campanha: ' . $e->getMessage()]);
    }
}
?>
