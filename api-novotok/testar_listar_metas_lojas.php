<?php
// Script para testar o endpoint listar_metas_lojas.php via cURL
require_once 'config.php';
require_once 'database.php';
require_once 'jwt_utils.php';
require_once 'jwt_utils_fix.php';

try {
    echo "=== TESTE DO ENDPOINT LISTAR_METAS_LOJAS.PHP ===\n\n";
    
    // Gerar um token JWT válido
    $payload = ['id' => '1'];
    $jwt = generateJWT($payload);
    
    echo "1. Token JWT gerado para teste\n";
    echo "   Token: " . substr($jwt, 0, 50) . "...\n\n";
    
    // URL do endpoint (assumindo que está rodando localmente)
    $url = "http://192.168.10.112:8000/listar_metas_lojas.php";
    
    echo "2. Fazendo requisição GET para: {$url}\n\n";
    
    // Configurar cURL
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $jwt,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    // Executar a requisição
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    echo "3. Resposta da requisição:\n";
    echo "   - HTTP Code: {$httpCode}\n";
    
    if ($error) {
        echo "   - Erro cURL: {$error}\n";
        echo "   ❌ TESTE FALHOU - Erro de conexão\n";
        return;
    }
    
    echo "   - Resposta: " . $response . "\n\n";
    
    // Tentar decodificar o JSON
    $responseData = json_decode($response, true);
    
    if ($responseData !== null) {
        echo "4. Análise da resposta:\n";
        echo "   ✅ JSON válido\n";
        echo "   - Status: " . ($responseData['status'] ?? 'N/A') . "\n";
        echo "   - Message: " . ($responseData['message'] ?? 'N/A') . "\n";
        
        if (isset($responseData['data'])) {
            echo "   - Total de metas: " . count($responseData['data']) . "\n";
            
            if (!empty($responseData['data'])) {
                echo "   - Primeira meta:\n";
                $primeiraMeta = $responseData['data'][0];
                foreach ($primeiraMeta as $key => $value) {
                    echo "     * {$key}: " . (is_bool($value) ? ($value ? 'true' : 'false') : $value) . "\n";
                }
            }
        }
        
        if ($httpCode == 200 && $responseData['status'] == 1) {
            echo "\n✅ TESTE PASSOU - Endpoint funcionando corretamente!\n";
        } else {
            echo "\n❌ TESTE FALHOU - HTTP {$httpCode}: " . ($responseData['message'] ?? 'Erro desconhecido') . "\n";
        }
    } else {
        echo "4. Análise da resposta:\n";
        echo "   ❌ JSON inválido ou resposta vazia\n";
        echo "   - HTTP Code: {$httpCode}\n";
        echo "   - Resposta bruta: " . $response . "\n";
    }
    
} catch (Exception $e) {
    echo "Erro durante o teste: " . $e->getMessage() . "\n";
}

echo "\n=== TESTE CONCLUÍDO ===\n";
?>