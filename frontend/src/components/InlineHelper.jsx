import { CheckCircle2, Lightbulb, MessageCircle } from 'lucide-react';

const guidance = {
  admin: {
    title: 'Finalize a operacao',
    body: 'Conecte o WhatsApp, adicione um MCP e convide o primeiro atendente.',
    items: ['Validar webhook', 'Cadastrar MCP', 'Convidar equipe']
  },
  marketer: {
    title: 'Comece pelo publico',
    body: 'Crie um segmento limpo, conecte um fluxo curto e teste a primeira campanha com delay inteligente.',
    items: ['Revisar tags', 'Criar fluxo', 'Agendar campanha']
  },
  support: {
    title: 'Mantenha a fila clara',
    body: 'Comece pelos nao atribuidos, assuma o que puder resolver e transfira casos especializados.',
    items: ['Abrir fila', 'Assumir chat', 'Transferir se preciso']
  },
  attendant: {
    title: 'Mantenha a fila clara',
    body: 'Comece pelos nao atribuidos, assuma o que puder resolver e transfira casos especializados.',
    items: ['Abrir fila', 'Assumir chat', 'Transferir se preciso']
  }
};

export default function InlineHelper({ role = 'admin', activeTab }) {
  const content = guidance[role] || guidance.admin;
  const pageHint =
    activeTab === 'flows'
      ? 'Dica: mantenha cada ramo com uma decisao para facilitar leitura e metricas.'
      : activeTab === 'broadcasts'
        ? 'Dica: use um segmento pequeno antes de escalar uma campanha.'
        : activeTab === 'integrations'
          ? 'Dica: descubra as ferramentas depois de salvar credenciais e mapeie um evento por vez.'
          : null;

  return (
    <aside className="inline-helper">
      <div>
        <Lightbulb size={18} />
        <span>
          <strong>{content.title}</strong>
          <small>{pageHint || content.body}</small>
        </span>
      </div>
      <nav aria-label="Suggested next steps">
        {content.items.map((item) => (
          <span key={item}>
            <CheckCircle2 size={14} />
            {item}
          </span>
        ))}
      </nav>
      <MessageCircle size={18} className="helper-mark" />
    </aside>
  );
}
