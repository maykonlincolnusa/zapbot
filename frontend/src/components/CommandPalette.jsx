import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

function scoreAction(action, query) {
  const haystack = `${action.label} ${action.group} ${action.keywords || ''}`.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return action.recent ? 2 : 1;
  if (haystack.includes(needle)) return 100 - haystack.indexOf(needle);

  let score = 0;
  let cursor = 0;
  for (const char of needle) {
    const index = haystack.indexOf(char, cursor);
    if (index === -1) return 0;
    score += 4;
    cursor = index + 1;
  }
  return score;
}

export default function CommandPalette({ actions, open, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const matches = useMemo(() => {
    return actions
      .map((action) => ({ action, score: scoreAction(action, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 9)
      .map((item) => item.action);
  }, [actions, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key === 'Enter' && matches[activeIndex]) {
        event.preventDefault();
        matches[activeIndex].run();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, matches, onClose, open]);

  if (!open) return null;

  return (
    <div className="command-overlay" role="presentation" onMouseDown={onClose}>
      <section className="command-panel" role="dialog" aria-label="Paleta de comandos" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-search">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Buscar ações, telas, contatos..."
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="command-results">
          {matches.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                className={index === activeIndex ? 'active' : ''}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  action.run();
                  onClose();
                }}
              >
                {Icon && <Icon size={17} />}
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.group}</small>
                </span>
                {index === activeIndex && <CornerDownLeft size={15} />}
              </button>
            );
          })}
          {!matches.length && <p className="command-empty">Nenhuma ação encontrada.</p>}
        </div>
      </section>
    </div>
  );
}

