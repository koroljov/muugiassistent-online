import Link from "next/link";
import { signOut } from "@/app/actions";
import { MellAgent } from "@/components/MellAgent";
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
    text_size: preferences?.text_size || "compact",
    surface_style: preferences?.surface_style || "flat",
    sidebar_density: preferences?.sidebar_density || "compact",
    card_style: preferences?.card_style || "simple",
    focus_mode: preferences?.focus_mode || "off",
    mell_enabled: preferences?.mell_enabled ?? true,
    mell_position: preferences?.mell_position || "right"
  };

  return (
    <div className={`app-shell theme-${pref.theme} accent-${pref.accent} bg-${pref.background} density-${pref.density} text-${pref.text_size} surface-${pref.surface_style} sidebar-${pref.sidebar_density} card-${pref.card_style} focus-${pref.focus_mode}`}>
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
      {pref.mell_enabled ? <MellAgent active={active} currentLeadId={currentLeadId} role={user?.role} position={pref.mell_position as "right" | "left"} /> : null}
    </div>
  );
}
