<?php
require_once 'database.php';

try {
    echo "Iniciando importação das tabelas NPS...\n";
    
    $db = new Database();
    $conn = $db->getConnection();
    
    // Ler o arquivo SQL
    $sql = file_get_contents('nps_tables_simple.sql');
    
    if ($sql === false) {
        throw new Exception("Erro ao ler arquivo nps_tables_simple.sql");
    }
    
    // Dividir em comandos individuais
    $commands = explode(';', $sql);
    
    $success_count = 0;
    $error_count = 0;
    
    foreach ($commands as $command) {
        $command = trim($command);
        if (empty($command) || $command === '') {
            continue;
        }
        
        try {
            $conn->exec($command);
            $success_count++;
            echo "✅ Comando executado com sucesso\n";
        } catch (Exception $e) {
            $error_count++;
            echo "❌ Erro ao executar comando: " . $e->getMessage() . "\n";
            echo "Comando: " . substr($command, 0, 100) . "...\n";
        }
    }
    
    echo "\n=== RESULTADO ===\n";
    echo "Comandos executados com sucesso: $success_count\n";
    echo "Comandos com erro: $error_count\n";
    
    // Verificar se as tabelas foram criadas
    echo "\nVerificando tabelas criadas...\n";
    $stmt = $conn->query('SHOW TABLES');
    $nps_tables = [];
    
    while($row = $stmt->fetch()) {
        if(strpos($row[0], 'nps') !== false || strpos($row[0], 'whatsapp') !== false) {
            $nps_tables[] = $row[0];
        }
    }
    
    if(!empty($nps_tables)) {
        echo "✅ Tabelas NPS encontradas:\n";
        foreach($nps_tables as $table) {
            echo "  - $table\n";
        }
    } else {
        echo "❌ Nenhuma tabela NPS encontrada\n";
    }
    
} catch (Exception $e) {
    echo "❌ Erro geral: " . $e->getMessage() . "\n";
}
?>
