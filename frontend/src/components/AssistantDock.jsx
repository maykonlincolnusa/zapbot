import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { api } from '../api';

export default function AssistantDock({ activeTab, role, setStatus }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState(['Como comecar?', 'Configurar Supabase', 'Adicionar MCP famoso']);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Posso te guiar pela plataforma. Pergunte sobre WhatsApp, campanhas, MCPs, Supabase, fluxos ou atendimento.'
    }
  ]);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  async function ask(text = message) {
    const content = text.trim();
    if (!content) return;

    setMessage('');
    setMessages((current) => [...current, { role: 'user', content }]);

    try {
      const payload = await api('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ message: content, activeTab })
      });
      setMessages((current) => [...current, { role: 'assistant', content: payload.response }]);
      setSuggestions(payload.suggestions || suggestions);
    } catch (error) {
      setStatus(error.message, 'error');
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'Nao consegui responder agora. Verifique a sessao e tente novamente.' }
      ]);
    }
  }

  return (
    <div className={open ? 'assistant-dock open' : 'assistant-dock'}>
      {open && (
        <section className="assistant-panel" aria-label="Assistente interno">
          <header>
            <span>
              <Bot size={18} />
              Guia da plataforma
            </span>
            <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Fechar assistente">
              <X size={16} />
            </button>
          </header>

          <div className="assistant-messages" ref={listRef}>
            {messages.map((item, index) => (
              <article key={`${item.role}-${index}`} className={item.role}>
                {item.content}
              </article>
            ))}
          </div>

          <div className="assistant-suggestions">
            {suggestions.slice(0, 3).map((item) => (
              <button key={item} type="button" onClick={() => ask(item)}>
                {item}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask().catch((error) => setStatus(error.message, 'error'));
            }}
          >
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Pergunte como fazer algo..." />
            <button type="submit" aria-label="Enviar pergunta">
              <Send size={16} />
            </button>
          </form>
        </section>
      )}

      <button type="button" className="assistant-launcher" onClick={() => setOpen((value) => !value)}>
        <Bot size={19} />
        <span>{role === 'attendant' ? 'Ajuda no atendimento' : 'Ajuda da plataforma'}</span>
      </button>
    </div>
  );
}
