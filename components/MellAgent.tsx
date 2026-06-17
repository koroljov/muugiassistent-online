"use client";

import { useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
};

export function MellAgent({
  active,
  currentLeadId,
  role,
  position
}: {
  active: string;
  currentLeadId?: string;
  role?: string | null;
  position?: "right" | "left";
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hint = hintFor(active);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    const next: Message[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/mell-ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: q,
          lead_id: currentLeadId,
          active,
          history: next.slice(-6)
        })
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer || "Ei saanud vastust." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Ühenduse viga. Proovi uuesti." }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <aside className={`mell-agent mell-${position || "right"} ${open ? "open" : ""}`}>
      {open ? (
        <div className="mell-card" role="dialog" aria-label="Mell">
          <div className="mell-head">
            <div>
              <span>Mell</span>
              <strong>{hint.title}</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Sulge Mell">×</button>
          </div>

          <div className="mell-chat">
            {messages.length === 0 ? (
              <p className="mell-hint">{hint.text}</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "mell-msg mell-msg-user" : "mell-msg mell-msg-assistant"}>
                  {m.text}
                </div>
              ))
            )}
            {loading && <div className="mell-msg mell-msg-assistant mell-typing">...</div>}
            <div ref={bottomRef} />
          </div>

          {messages.length === 0 && hint.actions.length > 0 && (
            <div className="mell-actions">
              {hint.actions.map((a) => (
                <a key={a.href + a.label} className={a.primary ? "button primary" : "button"} href={a.href}>{a.label}</a>
              ))}
            </div>
          )}

          <div className="mell-input-row">
            <input
              ref={inputRef}
              className="mell-input"
              type="text"
              placeholder="Küsi midagi..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              autoFocus
            />
            <button
              type="button"
              className="mell-send"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Saada"
            >
              ↑
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="mell-toggle"
        onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 80); }}
        aria-label="Ava Mell"
      >
        Mell
      </button>
    </aside>
  );
}

function hintFor(active: string) {
  if (active === "call") return {
    title: "Kõne kõrval",
    text: "Kirjuta, mis juhtus kõnes — annan kohe nõu.",
    actions: []
  };
  if (active === "leads") return {
    title: "Kontaktide töö",
    text: "Küsi, kuidas kontakti kvalifitseerida või järjestada.",
    actions: [
      { label: "Lisa kontakt", href: "/?view=leads&new=1", primary: true },
      { label: "Kõrge prioriteet", href: "/?view=leads&minScore=60", primary: false }
    ]
  };
  if (active === "calendar") return {
    title: "Järeltegevused",
    text: "Küsi, kuidas järeltegevust planeerida.",
    actions: []
  };
  return {
    title: "Tänane fookus",
    text: "Küsi mida tahad — kõne olukord, klient, vastuväide.",
    actions: [
      { label: "Lisa kontakt", href: "/?view=leads&new=1", primary: true },
      { label: "Kalender", href: "/calendar", primary: false }
    ]
  };
}
