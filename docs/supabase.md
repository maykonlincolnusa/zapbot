# Supabase/PostgreSQL

## Escolha recomendada

Use Supabase como banco principal da plataforma. Ele entrega PostgreSQL gerenciado,
painel administrativo, backups, extensões e, se necessário, `pgvector` para RAG.

Você não cria tabela por cliente. A plataforma é multiempresa:

```text
Workspaces
Contacts
Flows
Sequences
Broadcasts
Attendants
Chats
Messages
AiAgents
```

Cada registro de negócio tem `workspaceId`. Um cliente novo vira uma linha em
`Workspaces`, e os dados dele ficam isolados por esse identificador.

## Variável de conexão

No `.env`:

```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
DB_SYNC_ALTER=false
```

Use a connection string do **Transaction pooler** do Supabase para aplicações web.
Para migrações longas, prefira a conexão direta informada no painel do projeto.

## Criação de schema

Para MVP, a aplicação usa Sequelize para criar as tabelas. Em produção, rode com:

```env
DB_SYNC_ALTER=true
```

na primeira implantação controlada, valide as tabelas e depois volte para:

```env
DB_SYNC_ALTER=false
```

Para produção mais rigorosa, substitua `sync` por migrações versionadas antes de
abrir a plataforma a clientes reais.

## Row Level Security

O backend já filtra por `workspaceId`, mas o Supabase também pode ter RLS para
acessos diretos via PostgREST/Auth no futuro. Veja `docs/supabase.sql`.

## RAG

Comece com `pgvector` no Supabase para embeddings e chunks. Só migre para Qdrant
quando houver alto volume, necessidade de busca vetorial dedicada ou custo melhor
em infraestrutura separada.

## Escala

Quando a plataforma crescer:

- separar jobs em Redis/BullMQ;
- mover transmissões e sequências para workers;
- usar índices por `workspaceId`, status e datas;
- particionar mensagens/eventos se o volume exigir;
- configurar backups, PITR e alertas no Supabase.
