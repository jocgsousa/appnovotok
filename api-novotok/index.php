<?php
// Define o diretório base do projeto
define('BASE_PATH', __DIR__);

// Obtém o caminho da URL
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Remove a barra inicial, se existir
$requestUri = ltrim($requestUri, '/');

// Define o caminho do arquivo a ser incluído
$filePath = BASE_PATH . '/' . $requestUri;

// Verifica se o arquivo existe e é um arquivo PHP
if (file_exists($filePath) && is_file($filePath) && pathinfo($filePath, PATHINFO_EXTENSION) === 'php' || pathinfo($filePath, PATHINFO_EXTENSION) === 'html') {
    // Inclui o arquivo
    include $filePath;
} else {
    // Redireciona para a página de erro se o arquivo não existir
    include BASE_PATH . '/error.php';
}
?>