<?php
// Teste direto do endpoint NPS para diagnosticar erros
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== TESTE DE ENDPOINT NPS ===\n\n";

try {
    echo "1. Testando dependências...\n";
    
    // Testar cors_config.php
    if (file_exists('cors_config.php')) {
        require_once 'cors_config.php';
        echo "✅ cors_config.php carregado\n";
    } else {
        echo "❌ cors_config.php não encontrado\n";
    }
    
    // Testar database.php
    if (file_exists('database.php')) {
        require_once 'database.php';
        echo "✅ database.php carregado\n";
    } else {
        echo "❌ database.php não encontrado\n";
    }
    
    // Testar jwt_utils.php
    if (file_exists('jwt_utils.php')) {
        require_once 'jwt_utils.php';
        echo "✅ jwt_utils.php carregado\n";
    } else {
        echo "❌ jwt_utils.php não encontrado\n";
    }
    
    echo "\n2. Testando conexão com banco...\n";
    $database = new Database();
    $db = $database->getConnection();
    echo "✅ Conexão com banco OK\n";
    
    echo "\n3. Testando classe JwtUtils...\n";
    if (class_exists('JwtUtils')) {
        echo "✅ Classe JwtUtils existe\n";
        
        // Testar método validateToken
        if (method_exists('JwtUtils', 'validateToken')) {
            echo "✅ Método validateToken existe\n";
        } else {
            echo "❌ Método validateToken não existe\n";
        }
    } else {
        echo "❌ Classe JwtUtils não existe\n";
    }
    
    echo "\n4. Testando tabelas NPS...\n";
    $tables_to_check = [
        'instancias_whatsapp',
        'campanhas_nps',
        'controle_envios_nps',
        'respostas_nps'
    ];
    
    foreach ($tables_to_check as $table) {
        try {
            $stmt = $db->query("SELECT COUNT(*) FROM $table");
            $count = $stmt->fetchColumn();
            echo "✅ Tabela $table existe ($count registros)\n";
        } catch (Exception $e) {
            echo "❌ Tabela $table não existe ou erro: " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n5. Simulando validação JWT...\n";
    try {
        $token = "test_token";
        $result = JwtUtils::validateToken($token);
        echo "✅ Validação JWT executada (resultado: " . ($result ? "válido" : "inválido") . ")\n";
    } catch (Exception $e) {
        echo "❌ Erro na validação JWT: " . $e->getMessage() . "\n";
    }
    
    echo "\n6. Testando query básica NPS...\n";
    try {
        $stmt = $db->query("SELECT COUNT(*) as total FROM instancias_whatsapp");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        echo "✅ Query básica funcionou: " . $result['total'] . " instâncias\n";
    } catch (Exception $e) {
        echo "❌ Erro na query: " . $e->getMessage() . "\n";
    }
    
    echo "\n=== TESTE CONCLUÍDO ===\n";
    
} catch (Exception $e) {
    echo "❌ ERRO GERAL: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}
?>
