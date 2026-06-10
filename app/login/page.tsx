import { signIn } from "../actions";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main style={{ maxWidth: 420, margin: "8vh auto" }}>
      <form action={signIn} className="panel stack">
        <div>
          <p className="eyebrow">Müügiassistent</p>
          <h1>Login</h1>
        </div>
        <label>E-post <input name="email" type="email" required /></label>
        <label>Parool <input name="password" type="password" required /></label>
        <button className="primary" type="submit">Sisene</button>
      </form>
    </main>
  );
}
