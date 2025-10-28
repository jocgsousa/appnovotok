<?php
require_once 'database.php';

try {
    echo "Testando conexão com banco de dados...\n";
    $db = new Database();
    $conn = $db->getConnection();
    echo "✅ Conexão com banco OK\n\n";
    
    echo "Verificando tabelas NPS...\n";
    $stmt = $conn->query('SHOW TABLES');
    $nps_tables = [];
    
    while($row = $stmt->fetch()) {
        if(strpos($row[0], 'nps') !== false) {
            $nps_tables[] = $row[0];
        }
    }
    
    if(empty($nps_tables)) {
        echo "❌ Nenhuma tabela NPS encontrada no banco de dados!\n";
        echo "As tabelas NPS precisam ser criadas usando o arquivo nps_database.sql\n";
    } else {
        echo "✅ Tabelas NPS encontradas:\n";
        foreach($nps_tables as $table) {
            echo "  - $table\n";
        }
    }
    
    echo "\nTestando estrutura da tabela instancias_whatsapp...\n";
    try {
        $stmt = $conn->query('DESCRIBE instancias_whatsapp');
        echo "✅ Tabela instancias_whatsapp existe\n";
    } catch(Exception $e) {
        echo "❌ Tabela instancias_whatsapp não existe: " . $e->getMessage() . "\n";
    }
    
} catch (Exception $e) {
    echo "❌ Erro: " . $e->getMessage() . "\n";
}
?>
