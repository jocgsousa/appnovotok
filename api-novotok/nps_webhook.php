<?php
require_once 'cors_config.php';
require_once 'database.php';

header('Content-Type: application/json');

// Verificar método HTTP
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

try {
    // Conectar ao banco
    $database = new Database();
    $db = $database->getConnection();

    // Receber dados do webhook
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Log da mensagem recebida
    logMensagem($db, $input, 'recebida');
    
    // Verificar se é uma mensagem de texto
    if (!isset($input['messages']) || !is_array($input['messages'])) {
        echo json_encode(['success' => true, 'message' => 'Nenhuma mensagem para processar']);
        exit;
    }
    
    foreach ($input['messages'] as $message) {
        if ($message['type'] === 'text') {
            $numero = limparNumero($message['from']);
            $texto = $message['body'];
            $messageId = $message['id'];
            $instanciaId = obterInstanciaPorWebhook($db, $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']);
            
            if ($instanciaId) {
                $resultado = processarMensagemNPS($db, $numero, $instanciaId, $texto, $messageId);
                
                // Se há uma resposta para enviar
                if ($resultado['enviar_resposta']) {
                    $resposta = [
                        'messaging_product' => 'whatsapp',
                        'to' => $numero,
                        'type' => 'text',
                        'text' => [
                            'body' => $resultado['mensagem']
                        ]
                    ];
                    
                    // Log da resposta enviada
                    logMensagem($db, [
                        'to' => $numero,
                        'message' => $resultado['mensagem'],
                        'type' => 'enviada'
                    ], 'enviada');
                    
                    echo json_encode($resposta);
                } else {
                    echo json_encode(['success' => true, 'message' => 'Mensagem processada']);
                }
            }
        }
    }
    
} catch (Exception $e) {
    error_log("Erro no webhook NPS: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno do servidor']);
}

function limparNumero($numero) {
    // Remove caracteres não numéricos e formata
    $numeroLimpo = preg_replace('/\D/', '', $numero);
    
    // Se não tem código do país, adiciona 55 (Brasil)
    if (strlen($numeroLimpo) === 11 && substr($numeroLimpo, 0, 1) === '9') {
        $numeroLimpo = '55' . $numeroLimpo;
    }
    
    return $numeroLimpo;
}

function obterInstanciaPorWebhook($db, $webhookUrl) {
    try {
        $query = "SELECT id FROM instancias_whatsapp WHERE url_webhook LIKE ? AND status = 'ativa'";
        $stmt = $db->prepare($query);
        $stmt->execute(['%' . $webhookUrl . '%']);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? $result['id'] : null;
        
    } catch (Exception $e) {
        error_log("Erro ao obter instância: " . $e->getMessage());
        return null;
    }
}

function processarMensagemNPS($db, $numero, $instanciaId, $texto, $messageId) {
    try {
        // Buscar conversa ativa
        $query = "SELECT 
                    ec.id as estado_id,
                    ec.controle_envio_id,
                    ec.pergunta_atual_id,
                    ec.aguardando_resposta,
                    ce.campanha_id,
                    ce.codcli,
                    ce.pedido_id,
                    ce.nome_cliente,
                    c.pergunta_principal,
                    c.mensagem_final
                  FROM estado_conversa_nps ec
                  INNER JOIN controle_envios_nps ce ON ec.controle_envio_id = ce.id
                  INNER JOIN campanhas_nps c ON ce.campanha_id = c.id
                  WHERE ec.celular = ? 
                    AND ec.instancia_id = ?
                    AND ec.aguardando_resposta = TRUE
                    AND ec.data_timeout > NOW()
                  ORDER BY ec.id DESC
                  LIMIT 1";
        
        $stmt = $db->prepare($query);
        $stmt->execute([$numero, $instanciaId]);
        $conversa = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$conversa) {
            return [
                'enviar_resposta' => false,
                'mensagem' => 'Conversa não encontrada ou expirada'
            ];
        }
        
        // Processar comandos especiais
        $textoLimpo = trim(strtolower($texto));
        
        if ($textoLimpo === '/parar') {
            finalizarConversa($db, $conversa['estado_id'], 'cancelado');
            return [
                'enviar_resposta' => true,
                'mensagem' => 'Pesquisa cancelada. Obrigado!'
            ];
        }
        
        if ($textoLimpo === '/reiniciar') {
            reiniciarConversa($db, $conversa['controle_envio_id'], $instanciaId);
            return [
                'enviar_resposta' => true,
                'mensagem' => 'Pesquisa reiniciada! ' . $conversa['pergunta_principal']
            ];
        }
        
        // Validar resposta NPS (assumindo pergunta principal)
        if ($conversa['pergunta_atual_id'] === null) {
            $nota = (int)$texto;
            
            if ($nota < 0 || $nota > 10 || !is_numeric($texto)) {
                return [
                    'enviar_resposta' => true,
                    'mensagem' => 'Por favor, responda com um número de 0 a 10. ' . $conversa['pergunta_principal']
                ];
            }
            
            // Classificar NPS
            $classificacao = 'neutro';
            if ($nota >= 9) $classificacao = 'promotor';
            elseif ($nota <= 6) $classificacao = 'detrator';
            
            // Salvar resposta
            $insertQuery = "INSERT INTO respostas_nps (
                              controle_envio_id, instancia_id, pedido_id, codcli, 
                              campanha_id, resposta_texto, nota_nps, classificacao_nps, 
                              message_id, ordem_resposta, data_resposta
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())";
            
            $insertStmt = $db->prepare($insertQuery);
            $insertStmt->execute([
                $conversa['controle_envio_id'],
                $instanciaId,
                $conversa['pedido_id'],
                $conversa['codcli'],
                $conversa['campanha_id'],
                $texto,
                $nota,
                $classificacao,
                $messageId
            ]);
            
            // Verificar se há perguntas adicionais
            $perguntasQuery = "SELECT id, pergunta FROM perguntas_nps 
                              WHERE campanha_id = ? AND status = 'ativa' 
                              ORDER BY ordem LIMIT 1";
            $perguntasStmt = $db->prepare($perguntasQuery);
            $perguntasStmt->execute([$conversa['campanha_id']]);
            $proximaPergunta = $perguntasStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($proximaPergunta) {
                // Atualizar estado para próxima pergunta
                $updateQuery = "UPDATE estado_conversa_nps 
                               SET pergunta_atual_id = ?, 
                                   data_timeout = DATE_ADD(NOW(), INTERVAL 30 MINUTE)
                               WHERE id = ?";
                $updateStmt = $db->prepare($updateQuery);
                $updateStmt->execute([$proximaPergunta['id'], $conversa['estado_id']]);
                
                return [
                    'enviar_resposta' => true,
                    'mensagem' => $proximaPergunta['pergunta']
                ];
            } else {
                // Finalizar conversa
                finalizarConversa($db, $conversa['estado_id'], 'finalizado');
                
                return [
                    'enviar_resposta' => true,
                    'mensagem' => $conversa['mensagem_final']
                ];
            }
        } else {
            // Processar pergunta adicional
            return processarPerguntaAdicional($db, $conversa, $texto, $messageId);
        }
        
    } catch (Exception $e) {
        error_log("Erro ao processar mensagem NPS: " . $e->getMessage());
        return [
            'enviar_resposta' => true,
            'mensagem' => 'Desculpe, ocorreu um erro. Tente novamente mais tarde.'
        ];
    }
}

function processarPerguntaAdicional($db, $conversa, $texto, $messageId) {
    // Buscar detalhes da pergunta atual
    $query = "SELECT p.*, 
                     (SELECT COUNT(*) FROM perguntas_nps WHERE campanha_id = p.campanha_id AND ordem > p.ordem AND status = 'ativa') as proximas_perguntas
              FROM perguntas_nps p 
              WHERE p.id = ?";
    
    $stmt = $db->prepare($query);
    $stmt->execute([$conversa['pergunta_atual_id']]);
    $pergunta = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$pergunta) {
        return [
            'enviar_resposta' => true,
            'mensagem' => 'Erro ao processar pergunta. Tente novamente.'
        ];
    }
    
    // Validar resposta baseada no tipo
    $validacao = validarResposta($pergunta, $texto);
    
    if (!$validacao['valida']) {
        return [
            'enviar_resposta' => true,
            'mensagem' => $validacao['erro'] ?: $pergunta['mensagem_erro']
        ];
    }
    
    // Salvar resposta
    $insertQuery = "INSERT INTO respostas_nps (
                      controle_envio_id, instancia_id, pedido_id, codcli, 
                      campanha_id, pergunta_id, resposta_texto, message_id, 
                      ordem_resposta, data_resposta
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
    
    $insertStmt = $db->prepare($insertQuery);
    $insertStmt->execute([
        $conversa['controle_envio_id'],
        $conversa['instancia_id'],
        $conversa['pedido_id'],
        $conversa['codcli'],
        $conversa['campanha_id'],
        $pergunta['id'],
        $texto,
        $messageId,
        $pergunta['ordem'] + 1
    ]);
    
    // Verificar se há mais perguntas
    if ($pergunta['proximas_perguntas'] > 0) {
        // Buscar próxima pergunta
        $proximaQuery = "SELECT id, pergunta FROM perguntas_nps 
                        WHERE campanha_id = ? AND ordem > ? AND status = 'ativa' 
                        ORDER BY ordem LIMIT 1";
        $proximaStmt = $db->prepare($proximaQuery);
        $proximaStmt->execute([$conversa['campanha_id'], $pergunta['ordem']]);
        $proximaPergunta = $proximaStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($proximaPergunta) {
            // Atualizar estado
            $updateQuery = "UPDATE estado_conversa_nps 
                           SET pergunta_atual_id = ?, 
                               data_timeout = DATE_ADD(NOW(), INTERVAL 30 MINUTE)
                           WHERE id = ?";
            $updateStmt = $db->prepare($updateQuery);
            $updateStmt->execute([$proximaPergunta['id'], $conversa['estado_id']]);
            
            return [
                'enviar_resposta' => true,
                'mensagem' => $proximaPergunta['pergunta']
            ];
        }
    }
    
    // Finalizar conversa
    finalizarConversa($db, $conversa['estado_id'], 'finalizado');
    
    return [
        'enviar_resposta' => true,
        'mensagem' => $conversa['mensagem_final']
    ];
}

function validarResposta($pergunta, $texto) {
    switch ($pergunta['tipo_resposta']) {
        case 'sim_nao':
            $textoLimpo = strtolower(trim($texto));
            if (!in_array($textoLimpo, ['sim', 'não', 'nao', 's', 'n', 'yes', 'no'])) {
                return ['valida' => false, 'erro' => 'Responda com "sim" ou "não"'];
            }
            break;
            
        case 'numero':
            if (!is_numeric($texto)) {
                return ['valida' => false, 'erro' => 'Responda com um número'];
            }
            break;
            
        case 'multipla_escolha':
            if ($pergunta['opcoes_resposta']) {
                $opcoes = json_decode($pergunta['opcoes_resposta'], true);
                $textoLimpo = strtolower(trim($texto));
                $opcoesValidas = array_map('strtolower', $opcoes);
                
                if (!in_array($textoLimpo, $opcoesValidas)) {
                    return ['valida' => false, 'erro' => 'Escolha uma das opções: ' . implode(', ', $opcoes)];
                }
            }
            break;
            
        case 'texto_livre':
        default:
            // Validação por regex se definida
            if ($pergunta['validacao_regex'] && !preg_match($pergunta['validacao_regex'], $texto)) {
                return ['valida' => false, 'erro' => null];
            }
            break;
    }
    
    return ['valida' => true];
}

function finalizarConversa($db, $estadoId, $status) {
    try {
        // Atualizar estado da conversa
        $updateEstado = "UPDATE estado_conversa_nps 
                        SET aguardando_resposta = FALSE, 
                            data_finalizacao = NOW()
                        WHERE id = ?";
        $stmtEstado = $db->prepare($updateEstado);
        $stmtEstado->execute([$estadoId]);
        
        // Atualizar controle de envio
        $updateControle = "UPDATE controle_envios_nps 
                          SET status_envio = ?
                          WHERE id = (
                              SELECT controle_envio_id 
                              FROM estado_conversa_nps 
                              WHERE id = ?
                          )";
        $stmtControle = $db->prepare($updateControle);
        $stmtControle->execute([$status, $estadoId]);
        
    } catch (Exception $e) {
        error_log("Erro ao finalizar conversa: " . $e->getMessage());
    }
}

function reiniciarConversa($db, $controleEnvioId, $instanciaId) {
    try {
        $updateQuery = "UPDATE estado_conversa_nps 
                       SET pergunta_atual_id = NULL,
                           aguardando_resposta = TRUE,
                           data_timeout = DATE_ADD(NOW(), INTERVAL 30 MINUTE)
                       WHERE controle_envio_id = ? AND instancia_id = ?";
        
        $stmt = $db->prepare($updateQuery);
        $stmt->execute([$controleEnvioId, $instanciaId]);
        
    } catch (Exception $e) {
        error_log("Erro ao reiniciar conversa: " . $e->getMessage());
    }
}

function logMensagem($db, $dados, $tipo) {
    try {
        $insertQuery = "INSERT INTO log_mensagens_whatsapp (
                          numero_whatsapp, message_id, tipo_mensagem, 
                          conteudo_mensagem, status_entrega, data_mensagem
                        ) VALUES (?, ?, ?, ?, 'entregue', NOW())";
        
        $stmt = $db->prepare($insertQuery);
        $stmt->execute([
            $dados['from'] ?? $dados['to'] ?? '',
            $dados['id'] ?? uniqid(),
            $tipo,
            json_encode($dados)
        ]);
        
    } catch (Exception $e) {
        error_log("Erro ao registrar log: " . $e->getMessage());
    }
}
?>
