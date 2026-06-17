"use client";

import { useEffect, useState } from "react";

interface HandoffCardProps {
  leadId: string;
  formId: string;
  contactName?: string | null;
  propertyAddress?: string;
  leadScore?: number | null;
}

export function HandoffCard({
  leadId,
  formId,
  contactName,
  propertyAddress,
  leadScore,
}: HandoffCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    function check() {
      if (!form) return;
      const data = new FormData(form);
      const specialistContact = data.get("specialist_contact");
      const callResult = data.get("call_result");
      setVisible(
        specialistContact === "jah" ||
          callResult === "soovib müügispetsialisti kõnet"
      );
    }

    check();
    form.addEventListener("change", check);
    return () => { form.removeEventListener("change", check); };
  }, [formId]);

  if (!visible) return null;

  function handleHandoff() {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const existing = form.querySelector<HTMLInputElement>('input[name="mode"][data-handoff]');
    if (existing) existing.remove();
    const modeInput = document.createElement("input");
    modeInput.type = "hidden";
    modeInput.name = "mode";
    modeInput.value = "handoff";
    modeInput.setAttribute("data-handoff", "1");
    form.appendChild(modeInput);
    const nativeButtons = form.querySelectorAll<HTMLButtonElement>('button[name="mode"]');
    nativeButtons.forEach((btn) => btn.setAttribute("data-name-bak", btn.name));
    nativeButtons.forEach((btn) => btn.removeAttribute("name"));
    form.requestSubmit();
    nativeButtons.forEach((btn) => {
      const bak = btn.getAttribute("data-name-bak");
      if (bak) btn.name = bak;
      btn.removeAttribute("data-name-bak");
    });
  }

  return (
    <div className="handoff-trigger" role="status" aria-live="polite">
      <div className="handoff-trigger-inner">
        <div className="handoff-trigger-text">
          <strong className="handoff-trigger-title">
            Klient on valmis müügispetsialistiga rääkima
          </strong>
          <span className="handoff-trigger-sub">
            {contactName ? `${contactName} · ` : ""}
            {propertyAddress || ""}
            {leadScore != null ? ` · Skoor ${leadScore}` : ""}
          </span>
        </div>
        <button type="button" className="button primary handoff-trigger-btn" onClick={handleHandoff}>
          Anna Mellile üle
        </button>
      </div>
    </div>
  );
}
