"use client";
import { useNow } from "@/lib/use-now";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  RotateCcw,
  BookOpen,
  ChartNoAxesCombined,
  Settings,
  CalendarDays,
  ArrowUpRight,
  LogOut,
  Flame,
  Cloud,
  CloudOff,
  RefreshCw,
  X,
} from "lucide-react";
import { useStore } from "./provider";
import { Auth } from "./auth";
import { Dashboard, Statistics, Calendar } from "./insights";
import { VocabularyPage } from "./vocabulary";
import { Study, Review } from "./study";
import { SettingsPage } from "./settings";
import { errorText } from "./ui";
const nav = [
  ["首页", "/", LayoutDashboard],
  ["学习", "/study", Layers],
  ["复习", "/review", RotateCcw],
  ["词汇", "/vocabulary", BookOpen],
  ["统计", "/statistics", ChartNoAxesCombined],
  ["日历", "/calendar", CalendarDays],
  ["设置", "/settings", Settings],
] as const;
export function Kotoba() {
  const s = useStore(),
    pathname = usePathname(),
    now = useNow();
  if (s.loading)
    return (
      <div className="loading">
        <span className="brand-mark">言</span>
        <p>正在打开学习空间…</p>
      </div>
    );
  if ((!s.user && !s.demo) || s.recovery) return <Auth />;
  const page = nav.find((n) => n[1] === pathname)?.[0] || "学习";
  const due = s.words.filter(
    (w) =>
      w.progress.next_review_at && Date.parse(w.progress.next_review_at) <= now,
  ).length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">言</span>
          <span>
            kotoba<span className="brand-jp">ことば</span>
          </span>
        </Link>
        <span className="nav-caption">学习空间</span>
        <nav>
          {nav.map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${pathname === href ? "active" : ""}`}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "复习" && due > 0 && (
                <span className="nav-count">{due}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="focus-note">
            <span className="eyebrow">
              <Flame size={14} /> 坚持每天学习
            </span>
            <p>一日一歩。</p>
            <span className="small muted">每天前进一步。</span>
          </div>
          <div className="profile">
            <span className="avatar">
              {s.demo ? "K" : s.user?.email?.[0].toUpperCase()}
            </span>
            <div>
              <strong>
                {s.demo ? "演示用户" : s.user?.email?.split("@")[0]}
              </strong>
              <span className="small muted">个人学习空间</span>
            </div>
            <button
              className="icon-button"
              title="退出登录"
              aria-label="退出登录"
              onClick={() => s.logout().catch((e) => s.notice(errorText(e)))}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="muted">我的空间</span>
            <span className="crumb">/</span>
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="sync-state">
              {!s.online ? (
                <CloudOff size={15} />
              ) : s.pending.length ? (
                <RefreshCw size={15} />
              ) : (
                <Cloud size={15} />
              )}
              <span>
                {s.demo
                  ? "演示模式"
                  : !s.online
                    ? "离线"
                    : s.pending.length
                      ? `待同步 ${s.pending.length} 条`
                      : "云端已连接"}
              </span>
            </span>
            <Link className="level-focus" href="/vocabulary?level=N1">
              专注 N1 <ArrowUpRight size={13} />
            </Link>
          </div>
        </header>
        {s.demo && (
          <div className="demo-banner">
            当前正在体验示例数据。{" "}
            <button onClick={() => void s.logout()}>
              登录以保存进度 <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        <main className="main-content">
          {pathname === "/" ? (
            <Dashboard />
          ) : pathname === "/vocabulary" ? (
            <VocabularyPage />
          ) : pathname === "/review" ? (
            <Review />
          ) : pathname === "/statistics" ? (
            <Statistics />
          ) : pathname === "/calendar" ? (
            <Calendar />
          ) : pathname === "/settings" ? (
            <SettingsPage />
          ) : pathname === "/study" ? (
            <Study />
          ) : (
            <div className="empty">
              <h1>页面不存在</h1>
              <Link href="/">返回首页</Link>
            </div>
          )}
        </main>
      </div>
      <nav className="mobile-nav">
        {nav
          .filter((n) => n[0] !== "日历")
          .map(([label, href, Icon]) => (
            <Link
              key={href}
              className={pathname === href ? "active" : ""}
              href={href}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
      </nav>
      {s.message && (
        <div className="toast" role="status">
          <span>{s.message}</span>
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => s.notice("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
