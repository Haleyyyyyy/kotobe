"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, ShieldCheck } from "lucide-react";
import { useStore } from "./provider";
import { configured, supabase } from "@/lib/supabase";
import { errorText } from "./ui";
export function Auth() {
  const { enterDemo, recovery, finishRecovery } = useStore();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      const response = recovery
        ? await supabase.auth.updateUser({ password })
        : mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : mode === "signup"
            ? await supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: location.origin },
              })
            : await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: location.origin + "/reset-password",
              });
      if (response.error) throw response.error;
      if (recovery) {
        finishRecovery();
        setMessage("密码已更新。");
      } else if (mode === "signup") setMessage("请查收确认邮件，然后登录。");
      else if (mode === "reset")
        setMessage("如果该邮箱已注册，重置链接将发送到邮箱。");
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-mark">言</span>
          <span>
            kotoba<span className="brand-jp">ことば</span>
          </span>
        </Link>
        <div>
          <span className="eyebrow">每天学一点</span>
          <h1>
            让词汇
            <br />
            成为你的语言。
          </h1>
          <p>
            在这里，专注积累日语词汇。
            <br />
            认真学习，记得更牢。
          </p>
          <div className="auth-example">
            <span className="small">今日词汇 · N1</span>
            <strong lang="ja">培う</strong>
            <span lang="ja">つちかう</span>
            <p>
              培养；培育。
              <br />
              <span className="muted">像习惯一样，每天一点点。</span>
            </p>
          </div>
        </div>
        <span className="small">
          <ShieldCheck size={15} /> 你的词汇与学习进度，跨设备同步。
        </span>
      </section>
      <section className="auth-form">
        <div>
          <span className="eyebrow">你的日语学习</span>
          <h2>
            {recovery
              ? "设置新密码"
              : mode === "signup"
                ? "开始积累新词。"
                : mode === "reset"
                  ? "重设密码。"
                  : "欢迎来到 Kotoba。"}
          </h2>
          <p className="muted">
            {recovery
              ? "密码至少 8 位。"
              : mode === "signup"
                ? "创建属于自己的词汇库。"
                : mode === "reset"
                  ? "我们会将重置链接发送到你的邮箱。"
                  : "接着上次的进度继续学习。"}
          </p>
          {configured ? (
            <form onSubmit={submit}>
              {!recovery && (
                <label>
                  邮箱
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
              )}
              {(mode !== "reset" || recovery) && (
                <label>
                  密码
                  <input
                    type="password"
                    autoComplete={
                      mode === "login" && !recovery
                        ? "current-password"
                        : "new-password"
                    }
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              <button className="button primary full" disabled={busy}>
                {busy
                  ? "请稍候…"
                  : recovery
                    ? "更新密码"
                    : mode === "signup"
                      ? "注册账号"
                      : mode === "reset"
                        ? "发送重置链接"
                        : "登录"}
                <ArrowRight size={17} />
              </button>
              {!recovery && (
                <div className="auth-links">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setMode(mode === "signup" ? "login" : "signup");
                      setMessage("");
                    }}
                  >
                    {mode === "signup" ? "已有账号？登录" : "注册账号"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setMode(mode === "reset" ? "login" : "reset");
                      setMessage("");
                    }}
                  >
                    {mode === "reset" ? "返回登录" : "忘记密码？"}
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div className="setup-note">
              <BookOpen size={22} />
              <div>
                <strong>可以先体验学习界面。</strong>
                <p>
                  连接 Supabase 后即可使用云端账号。 现在可以先试用 Kotoba。
                </p>
              </div>
            </div>
          )}
          {message && (
            <p role="status" className="form-message">
              {message}
            </p>
          )}
          {!recovery && (
            <>
              <div className="divider">
                <span>先看看</span>
              </div>
              <button className="button full" onClick={enterDemo}>
                体验演示 <ArrowRight size={17} />
              </button>
              <p className="small muted center">
                演示数据仅供体验，刷新后恢复初始状态。
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
