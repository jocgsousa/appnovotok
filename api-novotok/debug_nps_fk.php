<?php
require_once 'database.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) { $id = 2; }

    $db = new Database();
    $conn = $db->getConnection();

    echo "=== Diagnóstico FK NPS ===\n";
    echo "Controle alvo: {$id}\n\n";

    // Mostrar variáveis relevantes
    $vars = $conn->query("SHOW VARIABLES LIKE 'foreign_key_checks'")->fetch(PDO::FETCH_ASSOC);
    echo "foreign_key_checks: " . ($vars['Value'] ?? 'n/a') . "\n";

    // Mostrar ENGINE das duas tabelas
    $engStmt = $conn->prepare("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('estado_conversa_nps','controle_envios_nps') ORDER BY TABLE_NAME");
    $engStmt->execute();
    $engs = $engStmt->fetchAll(PDO::FETCH_ASSOC);
    echo "\n-- ENGINES --\n";
    foreach ($engs as $e) {
        echo $e['TABLE_NAME'] . ": " . $e['ENGINE'] . "\n";
    }

    // Mostrar CREATE TABLE das duas tabelas
    $createEstado = $conn->query("SHOW CREATE TABLE estado_conversa_nps")->fetch(PDO::FETCH_ASSOC);
    $createControle = $conn->query("SHOW CREATE TABLE controle_envios_nps")->fetch(PDO::FETCH_ASSOC);
    echo "\n-- CREATE TABLE estado_conversa_nps --\n";
    echo ($createEstado['Create Table'] ?? 'n/a') . "\n";
    echo "\n-- CREATE TABLE controle_envios_nps --\n";
    echo ($createControle['Create Table'] ?? 'n/a') . "\n\n";

    // Conferir existência do controle
    $stmt = $conn->prepare("SELECT id, instancia_id, celular, campanha_id, pedido_id FROM controle_envios_nps WHERE id = ?");
    $stmt->execute([$id]);
    $controle = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Controle existente: " . ($controle ? 'SIM' : 'NAO') . "\n";
    if ($controle) {
        echo "instancia_id: " . ($controle['instancia_id'] ?? 'NULL') . ", celular: " . ($controle['celular'] ?? 'NULL') . ", campanha_id: " . ($controle['campanha_id'] ?? 'NULL') . ", pedido_id: " . ($controle['pedido_id'] ?? 'NULL') . "\n";
    }

    // Conferir se já existe estado para o controle
    $stmt = $conn->prepare("SELECT id FROM estado_conversa_nps WHERE controle_envio_id = ?");
    $stmt->execute([$id]);
    $estado = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Estado existente: " . ($estado ? ('SIM (id=' . $estado['id'] . ')') : 'NAO') . "\n\n";

    // Tentar inserir estado em transação e desfazer
    echo "Testando INSERT com transação e ROLLBACK...\n";
    $conn->beginTransaction();
    try {
        // Bloquear o controle
        $lock = $conn->prepare("SELECT id FROM controle_envios_nps WHERE id = ? FOR UPDATE");
        $lock->execute([$id]);
        $locked = $lock->fetch(PDO::FETCH_ASSOC);
        echo "FOR UPDATE: " . ($locked ? 'OK' : 'FALHOU') . "\n";

        $instanciaId = $controle['instancia_id'] ?? null;
        $celular = $controle['celular'] ?? null;
        if (!$celular) {
            $celular = '5599999999999@c.us';
        }

        $ins = $conn->prepare("INSERT INTO estado_conversa_nps (controle_envio_id, instancia_id, celular, pergunta_atual_id, ordem_resposta, aguardando_resposta, proxima_acao, data_timeout) VALUES (?, ?, ?, NULL, 0, TRUE, 'pergunta_principal', NULL)");
        $ins->execute([$id, $instanciaId, $celular]);
        echo "INSERT: SUCESSO (last_id=" . $conn->lastInsertId() . ")\n";
        $conn->rollBack();
        echo "ROLLBACK: OK\n";
    } catch (PDOException $e) {
        $code = $e->getCode();
        echo "INSERT: ERRO (code={$code})\n";
        echo $e->getMessage() . "\n";
        $conn->rollBack();
        echo "ROLLBACK: OK\n";
    }

    echo "\n=== Fim do diagnóstico ===\n";
} catch (Exception $e) {
    http_response_code(500);
    echo "Erro: " . $e->getMessage() . "\n";
}
?>