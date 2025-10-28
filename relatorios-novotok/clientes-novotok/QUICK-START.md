# 🚀 Quick Start - Clientes NovoTok

## ⚡ Instalação Rápida

### 1. Instalar Dependências
```bash
# Frontend (Electron)
npm install

# Backend (API)
cd backend
npm install
```

### 2. Configurar Banco de Dados
```bash
cd backend
node setup-db.js
```

### 3. Iniciar Sistema

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm start
```

### 4. Fazer Login
- **Email:** admin@novotok.com
- **Senha:** admin123

## ✅ Verificações

- [ ] MySQL rodando
- [ ] Backend na porta 3001
- [ ] Electron app aberto
- [ ] Login funcionando

## 🆘 Problemas Comuns

**MySQL não encontrado:**
- Instale MySQL Server
- Configure usuário root sem senha

**Backend não conecta:**
- Verifique se MySQL está rodando
- Execute: `cd backend && node setup-db.js`

**Electron não abre:**
- Execute: `npm install` na raiz
- Certifique-se de ter Node.js 16+

---
**✨ Sistema pronto para uso!**