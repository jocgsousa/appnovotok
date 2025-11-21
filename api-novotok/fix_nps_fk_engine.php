<?php
require_once 'database.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $db = new Database();
    $conn = $db->getConnection();

    echo "=== Fix Engine FK NPS ===\n";

    // Ver engines atuais
    $engStmt = $conn->prepare("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('controle_envios_nps','estado_conversa_nps','respostas_nps','instancias_whatsapp') ORDER BY TABLE_NAME");
    $engStmt->execute();
    $engs = $engStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($engs as $e) {
        echo $e['TABLE_NAME'] . ": " . $e['ENGINE'] . "\n";
    }

    $parentEngine = null;
    foreach ($engs as $e) {
        if ($e['TABLE_NAME'] === 'controle_envios_nps') { $parentEngine = $e['ENGINE']; }
    }

    if (strtoupper($parentEngine) === 'INNODB') {
        echo "\ncontrole_envios_nps já está em InnoDB. Nada a fazer.\n";
        exit;
    }

    echo "\nAlterando ENGINE de controle_envios_nps para InnoDB...\n";
    // Temporariamente desabilitar verificação para permitir alteração
    $conn->exec("SET FOREIGN_KEY_CHECKS=0");
    $conn->exec("ALTER TABLE controle_envios_nps ENGINE=InnoDB");
    $conn->exec("SET FOREIGN_KEY_CHECKS=1");
    echo "✓ ENGINE convertido para InnoDB\n";

    // Revalidar engines
    $engStmt->execute();
    $engs2 = $engStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($engs2 as $e) {
        echo $e['TABLE_NAME'] . ": " . $e['ENGINE'] . "\n";
    }

    echo "\n=== Conclusão ===\n";
    echo "Se o erro 1452 persistir, reavalie a constraint em estado_conversa_nps e recrie-a.\n";

} catch (Exception $e) {
    http_response_code(500);
    echo "Erro: " . $e->getMessage() . "\n";
}
?>