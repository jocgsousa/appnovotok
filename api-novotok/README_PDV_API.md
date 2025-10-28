# API Novotok - PDV Integration

This document describes the API endpoints created to support the PDV (Point of Sale) integration with the Novotok system.

## Authentication

### Login

**Endpoint:** `/login.php`

**Method:** POST

**Description:** Authenticates a user and returns a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login bem-sucedido.",
  "token": "JWT_TOKEN",
  "usuario": {
    "id": 1,
    "nome": "User Name",
    "email": "user@example.com",
    "tipo_usuario": "admin"
  },
  "menus": [...]
}
```

## PDV Integration Endpoints

### 1. List Pending Requests

**Endpoint:** `/request_index.php`

**Method:** POST

**Description:** Lists pending requests for a specific branch and cash register.

**Authentication:** Bearer Token

**Request Body:**
```json
{
  "filial": "1",
  "caixa": "1"
}
```

**Response:**
```json
[
  {
    "id": 1,
    "filial": "1",
    "caixa": "1",
    "datavendas": "2024-07-15",
    "nregistros": 0,
    "completed": false,
    "processando": false,
    "error": false,
    "initial": false,
    "message": null,
    "created_at": "2024-07-15T10:30:00"
  },
  ...
]
```

### 2. Create Initial Request

**Endpoint:** `/request_initial.php`

**Method:** POST

**Description:** Creates a new request for data synchronization.

**Authentication:** Bearer Token

**Request Body:**
```json
{
  "filial": "1",
  "caixa": "1",
  "datavendas": "2024-07-15T00:00:00",
  "processando": false,
  "completed": false,
  "error": false,
  "initial": true,
  "message": "Sincronização inicial",
  "nregistros": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Requisição inserida com sucesso.",
  "id": 1
}
```

### 3. Update Request Status

**Endpoint:** `/request_update.php`

**Method:** POST

**Description:** Updates the status of a request.

**Authentication:** Bearer Token

**Request Body:**
```json
{
  "id": 1,
  "processando": true,
  "completed": false,
  "error": false,
  "message": "Processando...",
  "nregistros": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Status da requisição atualizado com sucesso."
}
```

### 4. Register Sale

**Endpoint:** `/pedido_register.php`

**Method:** POST

**Description:** Registers a sale in the system.

**Authentication:** Bearer Token

**Request Body:**
```json
{
  "pedido": "12345",
  "filial": "1",
  "caixa": "1",
  "data": "2024-07-15T10:30:00",
  "funccx": "101",
  "itens": [...],
  "cancelados": [...],
  "codcob": "01",
  "total_itens": 150.50,
  "total_cancelados": 0.00,
  "data_registro_produto": "2024-07-15T10:30:00"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pedido registrado com sucesso.",
  "pedido": "12345"
}
```

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error message description",
  "error": "Detailed error information (only in development)"
}
```

HTTP status codes:
- 400: Bad Request (invalid JSON, missing required fields)
- 401: Unauthorized (invalid or expired token)
- 500: Server Error (database errors, unexpected exceptions) 