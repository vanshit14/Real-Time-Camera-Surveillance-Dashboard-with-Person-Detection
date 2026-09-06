import { FormEvent, useState } from "react";
import { Camera, Lock, User } from "lucide-react";
import { login, signup, type Session } from "../lib/api";

export function AuthView({ onSession }: { onSession: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const session = mode === "login" ? await login(username, password) : await signup(username, password);
      onSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark">
          <Camera size={28} />
        </div>
        <h1>Surveillance Dashboard</h1>
        <p>Sign in to manage cameras, start streams, and watch realtime person alerts.</p>
        <form onSubmit={submit} className="auth-form">
          <label>
            Username
            <span className="input-with-icon">
              <User size={18} />
              <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} required />
            </span>
          </label>
          <label>
            Password
            <span className="input-with-icon">
              <Lock size={18} />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
            </span>
          </label>
          {error ? <div className="error-text">{error}</div> : null}
          <button type="submit" className="primary-button">{mode === "login" ? "Login" : "Create account"}</button>
        </form>
        <button className="text-button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Login"}
        </button>
      </section>
    </main>
  );
}

