import { Resend } from "resend";

export type EmailResult =
  | { sent: true; id?: string }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped?: false; error: string };

export async function sendSystemEmail({
  to,
  subject,
  text
}: {
  to?: string | null;
  subject: string;
  text: string;
}): Promise<EmailResult> {
  if (!to) return { sent: false, skipped: true, reason: "Saaja e-post puudub." };
  if (!process.env.RESEND_API_KEY) return { sent: false, skipped: true, reason: "RESEND_API_KEY puudub." };

  const from = process.env.RESEND_FROM || "Müügiassistent <onboarding@resend.dev>";
  try {
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from, to, subject, text });
    if (result.error) return { sent: false, error: result.error.message };
    return { sent: true, id: result.data?.id };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "E-kirja saatmine ebaõnnestus." };
  }
}

export function appUrl(path = "/") {
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
