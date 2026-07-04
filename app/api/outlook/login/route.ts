// app/api/outlook/login/route.ts — tagasta Microsofti nõusoleku-URL (klient fetch'ib Beareriga, siis suunab)
import { NextResponse } from "next/server";
import { authorizeUrl, outlookConfigured, userIdFromBearer, signState } from "@/lib/outlook";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!outlookConfigured()) {
    return NextResponse.json({ error: "Outlook pole seadistatud (MS_CLIENT_ID/SECRET puudub Vercelis)." }, { status: 500 });
  }
  const userId = await userIdFromBearer(request);
  if (!userId) return NextResponse.json({ error: "Pole sisse logitud." }, { status: 401 });
  const url = authorizeUrl(signState(userId));
  return NextResponse.json({ url });
}
