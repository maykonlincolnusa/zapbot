WhatsApp has 2 billion users.

Most businesses are still managing it manually.

I built the platform that changes that.

It's called a WhatsApp SaaS Platform — and it's the most complete automation + AI + live support system I've shipped.

Here's everything inside:

🤖 AUTOMATION
→ JSON-defined conversation flows with branching logic
→ Drip sequences with configurable delays
→ Smart and fixed-delay broadcast campaigns
→ Scheduler-driven execution — no manual triggers needed

💬 LIVE SUPPORT
→ Agents claim, unclaim, and transfer conversations
→ Full conversation history and SSE event stream
→ Unassigned queue with real-time visibility

🧠 AI ASSISTANT (with real guardrails)
→ PII detection and removal before any LLM call
→ Jailbreak attempt classification
→ Optional OpenAI moderation
→ Intent classification for smart routing
→ RAG context from Qdrant-indexed documents

🔌 INTEGRATIONS
→ CRM sync, payment link generation
→ Generic REST and GraphQL connectors
→ External MCP server connections

🛰️ MCP SERVER (Python)
→ External AI clients connect and send WhatsApp messages through the platform
→ No Meta credentials exposed to clients
→ Claude, Cursor, custom agents — all supported

🖥️ DASHBOARD
→ React + Vite + Tailwind
→ Dark purple theme, command palette
→ Full interface in Portuguese

The architecture:

┌───────────────────────────────────────┐
│  Meta Webhook                         │
│       │                               │
│       ▼                               │
│  Flow Engine / Sequences / Broadcasts │
│       │                               │
│       ▼                               │
│  AI Assistant + RAG (Qdrant)          │
│       │                               │
│       ▼                               │
│  Live Agents + Integrations           │
│       │                               │
│  MCP Server ◄── External AI Clients   │
└───────────────────────────────────────┘

Stack: Node.js · Express · Sequelize · PostgreSQL · Qdrant · OpenAI · OpenRouter · Python MCP · React · Vite · Tailwind

This isn't a chatbot template.
This is infrastructure for businesses that take WhatsApp seriously.

🔗 Repository coming soon — follow to be notified.

Are you using WhatsApp for customer engagement? I'd love to hear how you're handling automation at scale.

#WhatsApp #SaaS #Automation #AI #RAG #MCP #LLM #NodeJS #OpenSource #BackendEngineering #ChatbotDevelopment #CustomerEngagement #GenerativeAI #SoftwareArchitecture #ConversationalAI