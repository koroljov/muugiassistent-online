import Link from "next/link";
import { signOut } from "@/app/actions";
import type { UserPreference } from "@/lib/types";

export function Shell({
  children,
  active,
  currentLeadId,
  user,
  preferences
}: {
  children: React.ReactNode;
  active: "dashboard" | "leads" | "call" | "calendar" | "stats" | "import" | "settings";
  currentLeadId?: string;
  user?: { name?: string | null; role?: string | null };
  preferences?: Partial<UserPreference> | null;
}) {
  const tabs = [
    ["dashboard", "/", "Töölaud"],
    ["leads", "/?view=leads", "Kontaktid"],
    ["call", currentLeadId ? `/?view=call&lead=${currentLeadId}` : "/?view=call", "Kõne"],
    ["calendar", "/calendar", "Kalender"],
    ["stats", "/?view=stats", "Statistika"],
    ["import", "/import", "Import"],
    ["settings", "/?view=settings", "Seaded"]
  ] as const;

  const pref = {
    theme: preferences?.theme || "light",
    accent: preferences?.accent || "green",
    background: preferences?.background || "plain",
    density: preferences?.density || "compact",
    text_size: preferences?.text_size || "compact"
  };

  return (
    <div className={`app-shell theme-${pref.theme} accent-${pref.accent} bg-${pref.background} density-${pref.density} text-${pref.text_size}`}>
      <header className="topbar">
        <div>
          <h1>Müügiassistent</h1>
        </div>
        {user ? (
          <div className="user-menu">
            <span><strong>{user.name || "Kasutaja"}</strong><br />{user.role === "admin" ? "Müügijuht" : "Müügiassistent"}</span>
            <form action={signOut}><button type="submit">Välju</button></form>
          </div>
        ) : (
          <Link className="button" href="/login">Login</Link>
        )}
      </header>
      <nav className="tabs">
        {tabs.map(([key, href, label]) => (
          <Link key={key} href={href} className={active === key ? "active" : ""}>{label}</Link>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
