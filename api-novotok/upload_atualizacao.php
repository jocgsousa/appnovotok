<?php
// Habilitar exibição de erros para depuração
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Aumentar limites para arquivos grandes
ini_set('upload_max_filesize', '100M');
ini_set('post_max_size', '100M');
ini_set('memory_limit', '256M');
ini_set('max_execution_time', '300');
ini_set('max_input_time', '300');

// Definir cabeçalho para resposta JSON
header('Content-Type: application/json');

// Função para registrar logs
function logError($message) {
    $logFile = __DIR__ . '/logs/upload_errors.log';
    $dir = dirname($logFile);
    if (!file_exists($dir)) {
        mkdir($dir, 0755, true);
    }
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

try {
    require_once __DIR__ . '/cors_config.php';
    require_once __DIR__ . '/jwt_utils.php';

    // Log de início do processo
    logError("Iniciando processo de upload");
    
    // Log dos dados recebidos
    logError("POST: " . json_encode($_POST));
    logError("FILES: " . json_encode($_FILES));

    // Verificar se a requisição é POST
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método não permitido']);
        exit;
    }

    // Verificar autenticação
    $headers = getallheaders();
    if (!isset($headers['Authorization'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
        exit;
    }

    // Validar o token
    $jwt = str_replace('Bearer ', '', $headers['Authorization']);
    $user_id = JwtUtils::validateToken($jwt);

    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Token inválido']);
        exit;
    }

    // Verificar se o arquivo foi enviado
    if (!isset($_FILES['arquivo']) || $_FILES['arquivo']['error'] !== UPLOAD_ERR_OK) {
        $error = isset($_FILES['arquivo']) ? $_FILES['arquivo']['error'] : 'Nenhum arquivo enviado';
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE => 'O arquivo excede o tamanho máximo permitido pelo PHP (upload_max_filesize)',
            UPLOAD_ERR_FORM_SIZE => 'O arquivo excede o tamanho máximo permitido pelo formulário',
            UPLOAD_ERR_PARTIAL => 'O upload do arquivo foi feito parcialmente',
            UPLOAD_ERR_NO_FILE => 'Nenhum arquivo foi enviado',
            UPLOAD_ERR_NO_TMP_DIR => 'Pasta temporária ausente',
            UPLOAD_ERR_CANT_WRITE => 'Falha ao escrever arquivo em disco',
            UPLOAD_ERR_EXTENSION => 'Uma extensão PHP interrompeu o upload'
        ];
        
        $errorMessage = isset($errorMessages[$error]) ? $errorMessages[$error] : "Erro desconhecido ($error)";
        logError("Erro no upload: $errorMessage");
        
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Erro no upload do arquivo: ' . $errorMessage]);
        exit;
    }

    // Log do arquivo recebido
    logError("Arquivo recebido: " . $_FILES['arquivo']['name'] . ", tamanho: " . $_FILES['arquivo']['size']);

    // Verificar o tipo de arquivo (apenas APK permitido)
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime_type = $finfo->file($_FILES['arquivo']['tmp_name']);
    $allowed_types = [
        'application/vnd.android.package-archive', // APK
        'application/octet-stream', // Genérico para binários
        'application/java-archive', // JAR
        'application/zip' // ZIP (alguns APKs são detectados como ZIP)
    ];

    logError("Tipo MIME detectado: $mime_type");

    if (!in_array($mime_type, $allowed_types)) {
        logError("Tipo de arquivo não permitido: $mime_type");
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Tipo de arquivo não permitido. Apenas arquivos APK são aceitos.']);
        exit;
    }

    // Criar diretório de versões se não existir
    $upload_dir = __DIR__ . '/versoes/';
    if (!file_exists($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }

    // Gerar nome único para o arquivo
    $versao = isset($_POST['versao']) ? $_POST['versao'] : date('YmdHis');
    $filename = 'novotok_v' . $versao . '.apk';
    $filepath = $upload_dir . $filename;

    logError("Tentando mover arquivo para: $filepath");

    // Mover o arquivo para o diretório de destino
    if (!move_uploaded_file($_FILES['arquivo']['tmp_name'], $filepath)) {
        $moveError = error_get_last();
        logError("Falha ao mover o arquivo: " . json_encode($moveError));
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Falha ao mover o arquivo enviado']);
        exit;
    }

    logError("Arquivo movido com sucesso para: $filepath");

    // Gerar URL para download
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $path = dirname($_SERVER['PHP_SELF']);
    $download_url = $protocol . '://' . $host . $path . '/versoes/' . $filename;

    logError("URL de download gerada: $download_url");

    echo json_encode([
        'success' => true,
        'message' => 'Arquivo enviado com sucesso',
        'download_url' => $download_url,
        'filename' => $filename
    ]);

} catch (Exception $e) {
    logError("Exceção: " . $e->getMessage() . "\n" . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor: ' . $e->getMessage()
    ]);
}
?> 