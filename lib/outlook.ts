// lib/outlook.ts
// Microsoft Graph (Outlook) e-posti integratsioon. OAuth2 + token-värskendus + kirjade päring.
// Tokenid hoitakse email_accounts tabelis (RLS: ainult service_role). Klient ei näe kunagi tokeneid.
import { getSupabaseAdmin } from "./supabase-server";
import crypto from "crypto";

const AUTH_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0";

// --- Kasutaja tuvastus Bearer tokenist (sama muster mis /api/admin/invite) ---
export async function userIdFromBearer(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

// --- Allkirjastatud state: kannab user_id turvaliselt läbi OAuth-redirecti (küpsist pole) ---
function stateSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "mell-fallback-secret";
}
export function signState(userId: string): string {
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${userId}.${nonce}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", stateSecret()).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}
export function verifyState(state: string): string | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parts = raw.split(".");
    if (parts.length !== 4) return null;
    const [userId, nonce, ts, sig] = parts;
    const expect = crypto.createHmac("sha256", stateSecret()).update(`${userId}.${nonce}.${ts}`).digest("hex").slice(0, 32);
    if (expect !== sig) return null;
    if (Date.now() - Number(ts) > 15 * 60 * 1000) return null; // 15 min aegumine
    return userId;
  } catch {
    return null;
  }
}
const GRAPH = "https://graph.microsoft.com/v1.0";
export const OUTLOOK_SCOPES = "offline_access openid email User.Read Mail.ReadWrite Mail.Send";

function appUrl(): string {
  return (process.env.APP_URL || "https://muugiassistent-online.vercel.app").replace(/\/$/, "");
}
export function redirectUri(): string {
  return appUrl() + "/api/outlook/callback";
}
export function outlookConfigured(): boolean {
  return Boolean(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    prompt: "select_account",
    scope: OUTLOOK_SCOPES,
    state,
  });
  return `${AUTH_BASE}/authorize?${p.toString()}`;
}

async function tokenRequest(body: Record<string, string>) {
  const r = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID || "",
      client_secret: process.env.MS_CLIENT_SECRET || "",
      redirect_uri: redirectUri(),
      ...body,
    }).toString(),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || "token_error");
  return j as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function exchangeCode(code: string) {
  return tokenRequest({ grant_type: "authorization_code", code, scope: OUTLOOK_SCOPES });
}

export async function saveTokens(userId: string, tok: { access_token: string; refresh_token?: string; expires_in: number }, email?: string) {
  const admin = getSupabaseAdmin();
  const expires_at = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
  const patch: any = { user_id: userId, provider: "outlook", access_token: tok.access_token, expires_at, updated_at: new Date().toISOString() };
  if (tok.refresh_token) patch.refresh_token = tok.refresh_token;
  if (email) patch.email = email;
  await admin.from("email_accounts").upsert(patch, { onConflict: "user_id" });
}

// Tagastab kehtiva access tokeni; värskendab kui vaja. null kui pole ühendatud.
export async function getValidToken(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("email_accounts").select("access_token,refresh_token,expires_at").eq("user_id", userId).maybeSingle();
  if (!data || !data.access_token) return null;
  const exp = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (exp > Date.now() + 30000) return data.access_token;
  if (!data.refresh_token) return null;
  try {
    const tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: data.refresh_token, scope: OUTLOOK_SCOPES });
    await saveTokens(userId, tok);
    return tok.access_token;
  } catch (e) {
    return null;
  }
}

export async function sendMail(token: string, msg: { to: string; subject: string; text: string; attachments?: { name: string; contentType: string; contentBytes: string }[] }) {
  const message: any = {
    subject: msg.subject,
    body: { contentType: "Text", content: msg.text || "" },
    toRecipients: [{ emailAddress: { address: msg.to } }],
  };
  if (msg.attachments && msg.attachments.length) {
    message.attachments = msg.attachments.map((a) => ({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.name, contentType: a.contentType, contentBytes: a.contentBytes }));
  }
  const r = await fetch(`${GRAPH}/me/sendMail`, {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ message, saveToSentItems: true }),
    signal: AbortSignal.timeout(20000),
  });
  if (r.status !== 202) {
    let detail = "";
    try { const j: any = await r.json(); detail = j?.error?.message || ""; } catch {}
    throw new Error("Graph sendMail " + r.status + (detail ? ": " + detail : ""));
  }
}

export async function graphMe(token: string): Promise<{ email: string; name: string } | null> {
  const r = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName,displayName`, { headers: { authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const j = await r.json();
  return { email: j.mail || j.userPrincipalName || "", name: j.displayName || "" };
}

export type MailMsg = { id: string; subject: string; from: string; fromName: string; received: string; preview: string; unread: boolean; webLink: string };

export async function fetchMessages(token: string, top = 25): Promise<MailMsg[]> {
  const url = `${GRAPH}/me/messages?$top=${top}&$select=subject,from,receivedDateTime,bodyPreview,isRead,webLink&$orderby=receivedDateTime desc`;
  const r = await fetch(url, { headers: { authorization: "Bearer " + token } });
  if (!r.ok) throw new Error("graph_messages_" + r.status);
  const j = await r.json();
  return (j.value || []).map((m: any) => ({
    id: m.id,
    subject: m.subject || "(pealkirjata)",
    from: (m.from && m.from.emailAddress && m.from.emailAddress.address) || "",
    fromName: (m.from && m.from.emailAddress && m.from.emailAddress.name) || "",
    received: m.receivedDateTime || "",
    preview: m.bodyPreview || "",
    unread: m.isRead === false,
    webLink: m.webLink || "",
  }));
}

export async function deleteMessage(token: string, id: string): Promise<void> {
  const r = await fetch(GRAPH + "/me/messages/" + encodeURIComponent(id), {
    method: "DELETE",
    headers: { authorization: "Bearer " + token },
    signal: AbortSignal.timeout(15000),
  });
  if (r.status !== 204 && r.status !== 200) {
    let detail = "";
    try { const j: any = await r.json(); detail = j?.error?.message || ""; } catch {}
    throw new Error("Graph delete " + r.status + (detail ? ": " + detail : ""));
  }
}

// redeploy: MS_CLIENT env aktiveerimine
// env fix redeploy 2
// env fix redeploy 3
