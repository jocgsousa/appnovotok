<?php
// Configurações de ambiente
// Detecta automaticamente se está em produção ou desenvolvimento

class Config {
    private static $config = null;
    
    public static function get() {
        if (self::$config === null) {
            self::$config = self::loadConfig();
        }
        return self::$config;
    }
    
    private static function loadConfig() {
        // Detectar ambiente baseado no host
        $isProduction = isset($_SERVER['HTTP_HOST']) && 
                       (strpos($_SERVER['HTTP_HOST'], 'novotokapi.online') !== false ||
                        strpos($_SERVER['HTTP_HOST'], 'localhost') === true); // Alterar aqui para false para produção
        
        if ($isProduction) {
            return [
                'environment' => 'production',
                'database' => [
                    'host' => 'srv1549.hstgr.io',
                    'name' => 'u875901804_novotok',
                    'username' => 'u875901804_novotok',
                    'password' => '@Toktos2025',
                    'charset' => 'utf8mb4'
                ],
                'debug' => false,
                'error_reporting' => false
            ];
        } else {
            return [
                'environment' => 'development',
                'database' => [
                    'host' => 'localhost',
                    'name' => 'novotok',
                    'username' => 'root',
                    'password' => '@Ntkti1793',
                    'charset' => 'utf8mb4'
                ],
                'debug' => true,
                'error_reporting' => true
            ];
        }
    }
}

// Configurar exibição de erros baseado no ambiente
$config = Config::get();
if ($config['error_reporting']) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}
?>
