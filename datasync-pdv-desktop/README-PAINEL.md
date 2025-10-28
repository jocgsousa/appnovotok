# 🏪 DataSync PDV - Painel de Gerenciamento Desktop

Painel desktop desenvolvido em Electron para gerenciar múltiplos caixas de PDV e sincronizar dados com a API central.

## 📋 Funcionalidades

### ✨ Principais Recursos
- **Gerenciamento de Múltiplos Caixas**: Cadastre e gerencie vários caixas simultaneamente
- **Interface Gráfica Moderna**: Interface desktop intuitiva e responsiva
- **Sincronização em Lote**: Processa pedidos de todos os caixas selecionados
- **Teste de Conexão**: Valide a conectividade com cada caixa antes da sincronização
- **Logs em Tempo Real**: Acompanhe o status e logs de cada operação
- **Armazenamento Local**: Configurações dos caixas salvas localmente

### 🔧 Configurações

#### Configurações Globais (Aplicadas a todos os caixas)
- **URL da API**: `https://novotokapi.online/api/v1`
- **Usuário da API**: `admin@gmail.com`
- **Senha da API**: `@Ntkti1793`

#### Configurações por Caixa
- **Nome do Caixa**: Identificação amigável
- **Host do Banco**: IP e porta do Oracle Database
- **Usuário/Senha do Banco**: Credenciais de acesso
- **Nome do Banco**: Nome da instância Oracle
- **Filial**: Código da filial
- **Número do Caixa**: Identificador único do caixa
- **Parâmetros de Sincronização**: Registros, intervalos, etc.

## 🚀 Como Usar

### 1. Instalação e Execução

```bash
# Instalar dependências (se ainda não instalado)
yarn install

# Executar o painel desktop
yarn electron
```

### 2. Cadastrar Caixas

1. **Preencha o formulário** com os dados do caixa:
   - Nome identificador
   - Configurações de conexão com o banco Oracle
   - Parâmetros específicos do caixa

2. **Teste a conexão** clicando em "🔍 Testar Conexão"

3. **Salve o caixa** clicando em "💾 Salvar Caixa"

### 3. Gerenciar Sincronização

1. **Selecione os caixas** que deseja sincronizar marcando as caixas de seleção

2. **Inicie a sincronização** clicando em "▶️ Iniciar Sincronização"

3. **Acompanhe os logs** na seção inferior da tela

4. **Pare a sincronização** quando necessário clicando em "⏹️ Parar Sincronização"

### 4. Funcionalidades Adicionais

- **✅ Selecionar Todos**: Marca todos os caixas de uma vez
- **❌ Desmarcar Todos**: Desmarca todos os caixas
- **🔍 Testar**: Testa conexão individual de cada caixa
- **🗑️ Excluir**: Remove um caixa da lista
- **🗑️ Limpar Logs**: Limpa o histórico de logs

## 🔄 Como Funciona a Sincronização Otimizada

### Processo de Sincronização Multi-Caixa (OTIMIZADO)

1. **Conexão Simultânea**: O sistema conecta a todos os caixas selecionados simultaneamente

2. **Coleta Paralela**: Busca pedidos de **TODOS os caixas ao mesmo tempo** usando `Promise.all()` para máxima eficiência

3. **Agregação Inteligente**: Todos os pedidos são agregados em um **único array**, mantendo a identificação de origem (caixa, filial)

4. **Envio em Lote Único**: **TODOS os pedidos são enviados para a API em uma única requisição**, reduzindo drasticamente o número de chamadas

5. **Monitoramento Contínuo**: O processo se repete automaticamente no intervalo configurado

### 🚀 Otimizações Implementadas

#### ⚡ Redução de Requisições à API
- **ANTES**: 1 requisição por caixa (ex: 10 caixas = 10 requisições)
- **AGORA**: 1 requisição única para todos os caixas (ex: 10 caixas = 1 requisição)
- **Resultado**: Redução de até 90% no tráfego de rede

#### 🔄 Coleta Simultânea
- **ANTES**: Coleta sequencial (caixa por caixa)
- **AGORA**: Coleta paralela usando `Promise.all()`
- **Resultado**: Tempo de coleta reduzido drasticamente

#### 📊 Exemplo Prático
```javascript
// Coleta simultânea de todos os caixas
const promises = caixas.map(caixa => fetchPedidosFromCaixa(caixa.id));
const resultados = await Promise.all(promises);

// Agregação em um único array
const todosPedidos = resultados.flat();

// Envio único para a API
await sendPedidosToAPI(todosPedidos);
```

### Vantagens do Sistema Otimizado

- **🚀 Performance**: Coleta e envio até 10x mais rápidos
- **📉 Menos Requisições**: Redução drástica no número de chamadas à API
- **⚡ Eficiência**: Processamento paralelo de múltiplos caixas
- **🔧 Escalabilidade**: Fácil adição de novos caixas sem impacto na performance
- **🛡️ Confiabilidade**: Tratamento individual de erros por caixa
- **👁️ Visibilidade**: Interface gráfica com logs detalhados em tempo real
- **🎛️ Flexibilidade**: Configuração independente para cada caixa

## 📁 Estrutura de Arquivos

```
datasync-pdv-202/
├── main.js                    # Processo principal do Electron
├── multi-caixa-manager.js     # Gerenciador de múltiplos caixas
├── index.js                   # Lógica original (mantida para compatibilidade)
├── renderer/
│   ├── index.html            # Interface do usuário
│   ├── styles.css            # Estilos da interface
│   └── renderer.js           # Lógica da interface
├── caixas-config.json        # Configurações dos caixas (criado automaticamente)
└── package.json              # Dependências e scripts
```

## 🔧 Configuração Técnica

### Dependências Principais
- **Electron**: Framework para aplicação desktop
- **OracleDB**: Driver para conexão com Oracle Database
- **Axios**: Cliente HTTP para comunicação com a API
- **Date-fns**: Manipulação de datas

### Scripts Disponíveis
```bash
# Executar em modo desenvolvimento (apenas sincronização)
yarn dev

# Executar painel desktop
yarn electron

# Executar painel em modo desenvolvimento
yarn electron-dev

# Construir aplicação para distribuição
yarn build
```

## 🐛 Solução de Problemas

### Problemas Comuns

1. **Erro de Conexão Oracle**
   - Verifique se o Oracle Client está instalado
   - Confirme as credenciais e host do banco
   - Teste a conectividade de rede

2. **Erro de API**
   - Verifique as credenciais da API
   - Confirme se a URL da API está correta
   - Verifique a conectividade com a internet

3. **Interface não Carrega**
   - Verifique se todos os arquivos estão presentes
   - Execute `yarn install` novamente
   - Verifique os logs no console do Electron

### Logs e Debugging

- Os logs aparecem em tempo real na interface
- Para debugging avançado, abra o DevTools (F12)
- Logs do processo principal aparecem no terminal

## 📞 Suporte

Para suporte técnico ou dúvidas sobre o sistema, consulte:
- Logs da aplicação
- Documentação da API
- Configurações do Oracle Database

---

**Desenvolvido por**: jocgsousa  
**Versão**: 1.0.0  
**Licença**: MIT