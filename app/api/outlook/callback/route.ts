// app/api/outlook/callback/route.ts — Microsoft suunab siia; state kannab user_id (HMAC-allkirjastatud)
import { NextResponse } from "next/server";
import { exchangeCode, saveTokens, graphMe, verifyState } from "@/lib/outlook";

export const dynamic = "force-dynamic";

function appUrl() {
  return (process.env.APP_URL || "https://muugiassistent-online.vercel.app").replace(/\/$/, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  if (url.searchParams.get("error") || !code) return NextResponse.redirect(appUrl() + "/app.html?mail=error");

  const userId = verifyState(state);
  if (!userId) return NextResponse.redirect(appUrl() + "/app.html?mail=state_error");

  try {
    const tok = await exchangeCode(code);
    const me = await graphMe(tok.access_token);
    await saveTokens(userId, tok, me?.email);
    return NextResponse.redirect(appUrl() + "/app.html?mail=connected");
  } catch (e: any) {
    return NextResponse.redirect(appUrl() + "/app.html?mail=fail");
  }
}
