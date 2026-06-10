"use client";

import { useEffect, useRef, useState } from "react";

type CoachState = {
  assessment: string;
  next_question: string;
  suggested_response: string;
  risk: string;
  signal_summary?: string;
};

export function InlineAiCoach({ leadId, formId }: { leadId: string; formId: string }) {
  const [coach, setCoach] = useState<CoachState | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChanged = useRef<{ name: string; value: string } | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const requestSuggestion = (event?: Event) => {
      const target = event?.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (target?.name) lastChanged.current = { name: target.name, value: target.value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const data = formDataToRecord(new FormData(form));
        if (lastChanged.current) {
          data._last_changed_name = lastChanged.current.name;
          data._last_changed_value = lastChanged.current.value;
        }
        const hasCallSignal = [
          "call_result",
          "attitude",
          "obstacle",
          "no_help_reason",
          "talk_reason",
          "specialist_contact",
          "next_action",
          "call_comment",
          "next_step"
        ].some((key) => String(data[key] || "").trim());

        if (!hasCallSignal) {
          setCoach(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        try {
          const response = await fetch("/api/ai-next-question", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lead_id: leadId, draft: data })
          });
          if (response.ok) setCoach(await response.json());
        } finally {
          setLoading(false);
        }
      }, 250);
    };

    form.addEventListener("change", requestSuggestion);
    form.addEventListener("input", requestSuggestion);
    requestSuggestion();
    return () => {
      form.removeEventListener("change", requestSuggestion);
      form.removeEventListener("input", requestSuggestion);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [formId, leadId]);

  return (
    <div className="coach-card">
      <div className="coach-head">
        <div>
          <p className="eyebrow">AI vestlus</p>
          <h3>Kõne kõrval</h3>
        </div>
        {loading ? <span className="status">mõtleb</span> : null}
      </div>
      {coach ? (
        <div className="coach-chat">
          {coach.signal_summary ? <div className="coach-chip">{coach.signal_summary}</div> : null}
          <Message label="AI arvamus" text={coach.assessment} />
          <Message label="Küsi järgmiseks" text={coach.next_question} highlight />
          <Message label="Võimalik vastus" text={coach.suggested_response} />
          <Message label="Ettevaatlikult" text={coach.risk} tone="warn" />
        </div>
      ) : (
        <div className="coach-empty">Märgi kõne tulemus, hoiak või takistus. AI annab siia kohe lühikese soovituse.</div>
      )}
    </div>
  );
}

function Message({ label, text, highlight = false, tone }: { label: string; text: string; highlight?: boolean; tone?: "warn" }) {
  return (
    <div className={highlight ? "coach-message highlight" : tone === "warn" ? "coach-message warn" : "coach-message"}>
      <strong>{label}</strong>
      <span>{text}</span>
    </div>
  );
}

function formDataToRecord(formData: FormData) {
  const record: Record<string, string> = {};
  for (const key of Array.from(new Set(Array.from(formData.keys())))) {
    const values = formData.getAll(key).map((value) => String(value).trim()).filter(Boolean);
    record[key] = values.join(", ");
  }
  return record;
}
