# Arquitetura da Plataforma

## Decisão atual

O MVP usa um monólito modular em Node.js/Express. A ideia é manter uma única API
operável, mas com fronteiras claras por domínio:

```text
routes/        contratos HTTP
models/        persistência Supabase/PostgreSQL via Sequelize, com SQLite apenas local
tasks/         jobs de sequências e transmissões
whatsapp.js    integração WhatsApp Cloud API
openai.js      integração OpenAI
flowEngine.js  execução de fluxos
frontend/      interface operacional
```

Essa abordagem reduz custo operacional, facilita debug e evita que o projeto
comece com muitos serviços pequenos antes de ter tráfego real.

## Módulos de produto

```text
Operação
  Painel
  Contatos
  Atendimento

Automação
  Fluxos
  Sequências
  Transmissões

Gestão
  Financeiro
  Configurações
```

Na API, os endpoints novos seguem a mesma organização:

```text
/api/contacts
/api/automation/flows
/api/automation/sequences
/api/automation/broadcasts
/api/ai/agents
/api/ai/models
/api/inbox/chats/*
/api/team
/api/auth
/api/rag
```

Os endpoints antigos (`/api/flows`, `/api/sequences`, `/api/broadcasts`,
`/api/attendants`) continuam ativos por compatibilidade.

## Elasticidade

Para este estágio, a elasticidade deve vir de fronteiras simples:

- jobs de transmissão e sequências isolados em `tasks/`;
- tabelas separadas para destinatários, inscrições e mensagens;
- aliases REST por domínio;
- webhooks e envio WhatsApp concentrados em módulos próprios;
- agentes de IA persistidos, com OpenRouter como gateway de múltiplos modelos;
- frontend separado e pronto para consumir uma API versionada.

O próximo passo natural é trocar `node-cron` por uma fila persistente, como
BullMQ/Redis, e separar workers para:

- broadcasts;
- sequências;
- processamento de webhooks;
- geração de IA/RAG.

## Sobre arquitetura em espaço

Arquitetura em espaço, no sentido de space-based architecture, é útil quando há
alto volume, muitos picos e necessidade de escalar unidades de processamento com
particionamento de estado. Ela pode fazer sentido no futuro para envio massivo,
webhooks e atendimento em tempo real.

Para o MVP, aplicar esse padrão por completo agora criaria complexidade antes de
existir carga suficiente. A decisão pragmática é preparar o desenho para essa
evolução sem pagar o custo operacional desde o início.

## Caminho recomendado

1. Consolidar o monólito modular.
2. Usar Supabase/PostgreSQL como banco operacional.
3. Introduzir fila persistente para envios e follow-ups.
4. Separar workers escaláveis por domínio.
5. Particionar por empresa, número de WhatsApp ou segmento de envio.
6. Avaliar arquitetura em espaço apenas quando o volume justificar.
