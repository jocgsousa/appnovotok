<?php

http_response_code(401);
echo json_encode(["message" => "Requisição não permitida", "error" => "Rota inválida"]);

?>