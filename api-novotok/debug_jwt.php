<?php
require_once 'config.php';
require_once 'jwt_utils.php';
require_once 'jwt_utils_fix.php';

echo "=== DEBUG JWT ===\n\n";

// Gerar um token JWT
$payload = ['id' => '1'];
$jwt = generateJWT($payload);

echo "1. Payload original:\n";
var_dump($payload);
echo "\n";

echo "2. JWT gerado:\n";
echo $jwt . "\n\n";

// Decodificar o JWT
echo "3. Decodificando JWT:\n";
try {
    $decoded = decodeJWT($jwt);
    echo "Tipo do payload decodificado: " . gettype($decoded) . "\n";
    echo "Conteúdo do payload decodificado:\n";
    var_dump($decoded);
    
    echo "\nPropriedades disponíveis:\n";
    if (is_object($decoded)) {
        foreach ($decoded as $key => $value) {
            echo "- {$key}: {$value}\n";
        }
    }
    
    echo "\nTentando acessar 'id':\n";
    echo "isset(\$decoded->id): " . (isset($decoded->id) ? 'true' : 'false') . "\n";
    if (isset($decoded->id)) {
        echo "Valor de \$decoded->id: " . $decoded->id . "\n";
    }
    
} catch (Exception $e) {
    echo "Erro ao decodificar: " . $e->getMessage() . "\n";
}

echo "\n=== FIM DEBUG ===\n";
?>