// app/api/ai/route.ts — üldine AI-vahendaja crm.html jaoks.
// Hoiab Anthropic võtit serveris (process.env.ANTHROPIC_API_KEY), brauser seda ei näe.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY puudub serveris" }, { status: 500 });

  const body = await request.json();
  const { system, messages, model, max_tokens } = body as {
    system?: string;
    messages: Anthropic.MessageParam[];
    model?: string;
    max_tokens?: number;
  };
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages puudub" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: model || "claude-haiku-4-5-20251001",
      max_tokens: max_tokens || 700,
      system: system,
      messages,
    });
    const text = response.content[0] && response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "AI viga" }, { status: 500 });
  }
}
