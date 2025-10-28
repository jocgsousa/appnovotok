<?php
// Habilitar exibição de erros para depuração
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

try {
    // Obter lista de arquivos APK
    $files = glob(__DIR__ . '/*.apk');
    $apkFiles = [];
    
    foreach ($files as $file) {
        $filename = basename($file);
        $filesize = filesize($file);
        $modified = filemtime($file);
        
        // Extrair versão do nome do arquivo (assumindo formato buscapreco_vX.Y.Z.apk ou novotok_vX.Y.Z.apk)
        preg_match('/(buscapreco|novotok)_v([0-9\.]+)\.apk/', $filename, $matches);
        $version = isset($matches[2]) ? $matches[2] : 'desconhecida';
        
        // Gerar URL para download
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'];
        $path = dirname($_SERVER['PHP_SELF']);
        $download_url = $protocol . '://' . $host . $path . '/' . $filename;
        
        $apkFiles[] = [
            'filename' => $filename,
            'version' => $version,
            'size' => $filesize,
            'size_formatted' => formatBytes($filesize),
            'modified' => date('Y-m-d H:i:s', $modified),
            'download_url' => $download_url
        ];
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Arquivos disponíveis para download',
        'files' => $apkFiles
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}

/**
 * Formata o tamanho em bytes para uma representação legível
 */
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= (1 << (10 * $pow));
    
    return round($bytes, $precision) . ' ' . $units[$pow];
}
?> 