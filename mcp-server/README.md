# ZapBot AI WhatsApp MCP Server

This MCP server exposes ZapBot AI WhatsApp tools to MCP clients such as Claude Desktop, ChatGPT MCP-capable clients, local agent runners and IDE agents.

## Tools

- `search_contacts`
- `create_contact`
- `list_chats`
- `get_chat`
- `list_messages`
- `send_whatsapp_message`
- `send_file`

## Backends

`MCP_BACKEND=mock` keeps all data in memory for local client testing.

`MCP_BACKEND=live` proxies every tool call to the ZapBot API under `/api/mcp/*`. The ZapBot API then sends through the official WhatsApp Cloud API using `WHATSAPP_API_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`.

## Run

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
set MCP_BACKEND=mock
.venv\Scripts\python mcp-server\main.py
```

For live mode:

```bash
set MCP_BACKEND=live
set ZAPBOT_API_BASE_URL=http://localhost:3000
set ZAPBOT_API_TOKEN=replace-with-service-token
.venv\Scripts\python mcp-server\main.py
```

Use `mcp-server/client-config.example.json` as the starting point for MCP client configuration.
