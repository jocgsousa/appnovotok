<?php
require_once 'cors_config.php';
require_once 'database.php';
require_once 'config.php';

header('Content-Type: application/json');

// Função para verificar status do banco de dados
function checkDatabaseStatus() {
    try {
        $database = new Database();
        $conn = $database->getConnection();
        
        if ($conn) {
            // Testar uma consulta simples
            $stmt = $conn->query("SELECT 1 as test");
            $result = $stmt->fetch();
            
            if ($result && $result['test'] == 1) {
                return [
                    'status' => 'online',
                    'message' => 'Conexão com banco de dados estabelecida',
                    'response_time' => null
                ];
            }
        }
        
        return [
            'status' => 'error',
            'message' => 'Falha na consulta de teste',
            'response_time' => null
        ];
        
    } catch (Exception $e) {
        return [
            'status' => 'error',
            'message' => 'Erro na conexão: ' . $e->getMessage(),
            'response_time' => null
        ];
    }
}



// Função para verificar componentes básicos do sistema (versão discreta)
function checkBasicSystemHealth() {
    $health = [];
    
    // Verificações básicas sem expor detalhes
    $health['auth_system'] = file_exists(__DIR__ . '/jwt_utils.php');
    $health['cors_config'] = file_exists(__DIR__ . '/cors_config.php');
    $health['core_modules'] = (
        file_exists(__DIR__ . '/database.php') && 
        file_exists(__DIR__ . '/config.php')
    );
    
    return $health;
}

// Função para obter informações do servidor
function getServerInfo() {
    return [
        'php_version' => phpversion(),
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'N/A',
        'server_time' => date('Y-m-d H:i:s'),
        'timezone' => date_default_timezone_get(),
        'memory_limit' => ini_get('memory_limit'),
        'max_execution_time' => ini_get('max_execution_time'),
        'upload_max_filesize' => ini_get('upload_max_filesize'),
        'post_max_size' => ini_get('post_max_size')
    ];
}

// Verificar método HTTP
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido. Use GET.']);
    exit;
}

try {
    $startTime = microtime(true);
    
    // Obter informações do sistema
    $databaseStatus = checkDatabaseStatus();
    $basicHealth = checkBasicSystemHealth();
    $serverInfo = getServerInfo();
    
    $endTime = microtime(true);
    $responseTime = round(($endTime - $startTime) * 1000, 2); // em milissegundos
    
    // Determinar status geral da API
    $overallStatus = 'online';
    if ($databaseStatus['status'] === 'error') {
        $overallStatus = 'degraded';
    }
    
    $response = [
        'api_status' => $overallStatus,
        'version' => '1.0.0',
        'timestamp' => date('Y-m-d H:i:s'),
        'response_time_ms' => $responseTime,
        'database' => $databaseStatus,
        'server' => [
            'php_version' => $serverInfo['php_version'],
            'server_time' => $serverInfo['server_time'],
            'timezone' => $serverInfo['timezone']
        ],
        'system_health' => [
            'database_connection' => $databaseStatus['status'] === 'online',
            'authentication' => $basicHealth['auth_system'],
            'configuration' => $basicHealth['cors_config'],
            'core_modules' => $basicHealth['core_modules']
        ]
    ];
    
    // Definir código de status HTTP baseado no status geral
    if ($overallStatus === 'online') {
        http_response_code(200);
    } else {
        http_response_code(503); // Service Unavailable
    }
    
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'api_status' => 'error',
        'error' => 'Erro interno do servidor',
        'message' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT);
}
?>
