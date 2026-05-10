# Plataforma SaaS de WhatsApp

Este repositório é um scaffold modular de SaaS para automação de WhatsApp, atendimento ao vivo, agentes internos, integrações MCP e acesso programático para agentes externos.

A aplicação raiz é o MVP atual em Express. O protótipo antigo em múltiplos serviços permanece em `backend/services/` apenas como referência.

## O Que Está Incluído

- Integração com WhatsApp Cloud API para texto, templates, botões e envio de mídia por URL.
- `/webhook` para verificação da Meta e ingestão de mensagens/status. Eventos brutos ficam em `WebhookEvent`; mensagens entram em `Message`.
- Modelos Sequelize para contatos, fluxos, sequências, transmissões, atendentes, conversas, agentes, documentos RAG e servidores MCP.
- Recursos de automação: fluxos JSON, sequências com atraso, transmissões com delay fixo ou inteligente e atendimento ao vivo com assumir/devolver/transferir.
- Assistente interno em `ai/assistant.js` com remoção de PII, checagens contra jailbreak, moderação opcional, classificação de intenção e contexto RAG.
- Camada de integrações em `integrations/` e `routes/integrations.js` para CRM, pagamentos, REST, GraphQL e servidores MCP externos.
- Servidor MCP Python em `mcp-server/` com backend mock e live para clientes de IA enviarem mensagens via WhatsApp pela API da plataforma.
- Painel React/Vite em `frontend/`, com interface em português, paleta de comandos e tema roxo escuro, preto e branco.

## Estrutura

```text
server.js                    Entrada Express, rotas, webhook e schedulers
webhookHandler.js            Interpreta mensagens/status do WhatsApp e persiste eventos
whatsapp.js                  Helpers da WhatsApp Cloud API
ai/assistant.js              Assistente com guardrails e RAG
ai/platformAssistant.js      Ajuda contextual para usar a plataforma
flowEngine.js                Interpretador de fluxos JSON
rag.js                       Scaffold Qdrant/RAG
models/                      Modelos Sequelize para Supabase/PostgreSQL ou SQLite local
routes/                      Rotas REST
tasks/                       Schedulers de sequências e transmissões
integrations/                Conectores externos e cliente MCP
mcp-server/                  Servidor MCP Python para clientes externos
examples/                    Exemplos JSON de fluxo, sequência e transmissão
frontend/                    Interface React/Vite
docs/supabase.sql            SQL complementar para índices, pgvector e RLS opcional
```

## Rodar Localmente

```bash
copy .env.example .env
npm install
npm install --prefix frontend
npm run dev
```

Frontend: `http://localhost:5173`

API: `http://localhost:3000`

Para personalizar o nome visível do produto:

```env
VITE_PROJECT_NAME={{PROJECT_NAME}}
DEFAULT_WORKSPACE_NAME={{PROJECT_NAME}} Demo
```

Rodar somente a API:

```bash
npm start
```

Rodar validações:

```bash
npm run check
npm test
npm run build:frontend
```

## Primeiro Admin

Use a tela de cadastro para criar o primeiro admin da área de trabalho, ou configure um usuário inicial no `.env`:

```env
ADMIN_NAME=
ADMIN_EMAIL=admin@example.local
ADMIN_PASSWORD=troque-por-uma-senha-local
```

## Ambiente

```env
PORT=3000
DATABASE_URL=
SQLITE_PATH=./data/zapbot-ai.sqlite
JWT_SECRET=troque-por-um-segredo-longo
SERVICE_TOKEN=troque-por-um-token-longo
API_INTEGRATION_KEY=dev-api-key

WHATSAPP_VERIFY_TOKEN=token-de-verificacao-do-webhook
WHATSAPP_API_TOKEN=token-da-whatsapp-cloud-api
WHATSAPP_PHONE_NUMBER_ID=id-do-numero
WHATSAPP_GRAPH_VERSION=v20.0

OPENAI_API_KEY=chave-openai
OPENAI_MODEL=gpt-4o-mini
OPENAI_AUTO_REPLY=true
OPENAI_MODERATION_ENABLED=false

OPENROUTER_API_KEY=chave-openrouter
OPENROUTER_DEFAULT_MODEL=openai/gpt-4o-mini

QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=zapbot_documents
```

Quando `DATABASE_URL` estiver vazio, o projeto usa SQLite local. Para produção, use Supabase/PostgreSQL com `DB_SSL=true`.

## Supabase

1. Crie um projeto no Supabase.
2. Copie a connection string PostgreSQL para `DATABASE_URL`.
3. Mantenha `DB_SSL=true`.
4. Inicie a API para o Sequelize criar as tabelas.
5. Rode `docs/supabase.sql` para índices extras, pgvector e políticas RLS opcionais.

## WhatsApp Cloud API

Configure a URL de webhook da Meta como:

```text
https://seu-dominio.com/webhook
```

Em desenvolvimento local, use um túnel HTTPS apontando para:

```text
http://localhost:3000/webhook
```

O handler espera payloads oficiais da Cloud API: mensagens chegam em `messages[]` e eventos de entrega em `statuses[]`.

## Endpoints REST

Autenticação:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Automação:

- `GET /api/contacts`
- `POST /api/contacts`
- `GET /api/automation/flows`
- `POST /api/automation/flows`
- `POST /api/automation/flows/:id/start`
- `GET /api/automation/sequences`
- `POST /api/automation/sequences`
- `POST /api/automation/sequences/:id/enroll`
- `GET /api/automation/transmissions`
- `POST /api/automation/transmissions`
- `POST /api/automation/transmissions/:id/start`

Atendimento ao vivo:

- `GET /api/chats?filter=all|mine|unassigned`
- `GET /api/chats/:id`
- `GET /api/chats/:id/messages`
- `POST /api/chats/:id/claim`
- `POST /api/chats/:id/unclaim`
- `POST /api/chats/:id/messages`
- `GET /api/chats/events?token=<jwt-ou-service-token>` para snapshots SSE

Integrações:

- `GET /api/integrations`
- `GET /api/integrations/servers`
- `POST /api/integrations/servers`
- `POST /api/integrations/servers/:id/discover`
- `POST /api/integrations/servers/:id/invoke`
- `POST /api/integrations/crm/sync-contact`
- `POST /api/integrations/payments/link`
- `POST /api/integrations/rest`
- `POST /api/integrations/graphql`

API MCP usada pelo servidor Python:

- `GET /api/mcp/tools`
- `GET /api/mcp/contacts/search?q=lead`
- `POST /api/mcp/contacts`
- `GET /api/mcp/chats`
- `GET /api/mcp/chats/:id`
- `GET /api/mcp/chats/:id/messages`
- `POST /api/mcp/messages`
- `POST /api/mcp/files`

## Servidor MCP

Instale as dependências Python:

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

Backend mock:

```bash
set MCP_BACKEND=mock
.venv\Scripts\python mcp-server\main.py
```

Backend live:

```bash
set MCP_BACKEND=live
set ZAPBOT_API_BASE_URL=http://localhost:3000
set ZAPBOT_API_TOKEN=troque-por-service-token-ou-jwt
.venv\Scripts\python mcp-server\main.py
```

No modo live, o MCP chama endpoints da API da plataforma. A API envia pelo WhatsApp usando `WHATSAPP_API_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`; clientes MCP não precisam receber credenciais diretas da Meta.

Exemplo para registrar em clientes MCP:

```json
{
  "mcpServers": {
    "zapbot-ai-whatsapp": {
      "command": "python",
      "args": ["mcp-server/main.py"],
      "env": {
        "MCP_BACKEND": "live",
        "ZAPBOT_API_BASE_URL": "http://localhost:3000",
        "ZAPBOT_API_TOKEN": "troque-por-service-token"
      }
    }
  }
}
```

O mesmo formato está em `mcp-server/client-config.example.json`.

## Exemplos JSON

- Fluxo: `examples/flow.sample.json`
- Sequência: `examples/sequence.sample.json`
- Transmissão: `examples/transmission.sample.json`

## Notas De Produção

- Troque `JWT_SECRET`, `SERVICE_TOKEN`, senhas admin e chaves de API antes de expor o serviço.
- Use HTTPS para webhook da Meta e para acesso live ao MCP.
- Respeite opt-in, opt-out e política de templates do WhatsApp antes de transmissões grandes.
- Adicione allowlists por conector antes de liberar REST/GraphQL genérico para usuários não confiáveis.
- Integrações MCP externas usam JSON-RPC `tools/list` e `tools/call`; armazene apenas tokens escopados.
- Substitua `node-cron` por uma fila durável quando o volume de transmissões e sequências crescer.
- Complete a geração de embeddings em `rag.js` antes de depender da qualidade do RAG em produção.
