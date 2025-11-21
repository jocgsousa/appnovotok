<?php
require_once 'config.php';

class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    private $charset;
    public $conn;
    
    public function __construct() {
        $config = Config::get();
        $this->host = $config['database']['host'];
        $this->db_name = $config['database']['name'];
        $this->username = $config['database']['username'];
        $this->password = $config['database']['password'];
        $this->charset = $config['database']['charset'];
    }

    public function getConnection() {
        $this->conn = null;
        $dsn = "mysql:host={$this->host};dbname={$this->db_name};charset={$this->charset}";

        try {
            $this->conn = new PDO($dsn, $this->username, $this->password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, // Throw exceptions on errors
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, // Set default fetch mode to associative array
                PDO::ATTR_PERSISTENT => false, // Use non-persistent connections
                PDO::ATTR_STRINGIFY_FETCHES => false, // Don't convert numeric values to strings
                PDO::ATTR_EMULATE_PREPARES => false // Use real prepared statements for better type handling
            ]);
            
            // Configurações para preservar a precisão decimal
            $this->conn->setAttribute(PDO::MYSQL_ATTR_INIT_COMMAND, "SET SESSION sql_mode='TRADITIONAL,NO_ENGINE_SUBSTITUTION'");
            
            // Unificar collation da conexão para evitar mix de collations em comparações
            $this->conn->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
            $this->conn->exec("SET SESSION collation_connection = 'utf8mb4_unicode_ci'");
            
            // Configurar formato numérico para garantir que decimais sejam preservados
            // $this->conn->exec("SET SESSION DECIMAL_POINT='.'");  // Remover - variável não suportada
            // $this->conn->exec("SET SESSION lc_numeric='en_US'");  // Remover - variável não suportada
            
            return $this->conn;
        } catch (PDOException $exception) {
            // Use a more secure error message in production environments
            error_log("Connection error: " . $exception->getMessage()); // Log the error
            throw new PDOException("Connection error: Unable to connect to the database. " . $exception->getMessage());
        }
    }
}
?>

