"use client";
import { themeLabel } from "@/lib/locale";
import { useEffect, useState, type FormEvent } from "react";
import {
  Download,
  Save,
  RefreshCw,
  Cloud,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useStore } from "./provider";
import { LEVELS, type Settings } from "@/lib/types";
import { csv, download } from "@/lib/import-export";
import { errorText, SectionTitle } from "./ui";
export function SettingsPage() {
  const s = useStore(),
    [form, setForm] = useState<Settings>(s.settings),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [exportType, setExportType] = useState("all"),
    [format, setFormat] = useState("json");
  const [dirty, setDirty] = useState(false);
  const updateForm = (next: Settings) => {
    setDirty(true);
    setForm(next);
  };
  useEffect(() => {
    if (!dirty) setForm(s.settings);
  }, [s.settings, dirty]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      new Intl.DateTimeFormat("zh-CN", { timeZone: form.timezone }).format();
      await s.saveSettings(form);
      setDirty(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    setBusy(true);
    try {
      const vocabulary = s.words.map(({ progress, ...word }) => {
          void progress;
          return word;
        }),
        progress = s.words.map((w) => w.progress),
        history = await s.history();
      const data: Record<string, unknown[]> = {
        vocabulary,
        progress,
        history,
        settings: [s.settings],
        daily_statistics: s.days,
      };
      const selected =
        exportType === "all" ? data : { [exportType]: data[exportType] };
      if (format === "json")
        download(
          `kotoba-${exportType}-${new Date().toISOString().slice(0, 10)}.json`,
          JSON.stringify(
            { exported_at: new Date().toISOString(), ...selected },
            null,
            2,
          ),
        );
      else
        for (const [name, rows] of Object.entries(selected))
          download(
            `kotoba-${name}.csv`,
            csv(rows as Record<string, unknown>[]),
            "text/csv;charset=utf-8",
          );
      s.notice("导出文件已下载。");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">按照自己的节奏</span>
          <h1>按自己的节奏学习。</h1>
          <p>设定适合自己的每日目标。</p>
        </div>
      </div>
      <div className="settings-layout">
        <form onSubmit={save}>
          <section className="panel">
            <SectionTitle title="每日目标" />
            <div className="form-grid">
              <label>
                每日新词数量
                <input
                  type="number"
                  min={0}
                  max={500}
                  required
                  value={form.daily_new_words}
                  onChange={(e) =>
                    updateForm({
                      ...form,
                      daily_new_words: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                每日最多复习数量
                <input
                  type="number"
                  min={0}
                  max={2000}
                  required
                  value={form.daily_review_limit}
                  onChange={(e) =>
                    updateForm({
                      ...form,
                      daily_review_limit: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <p className="small muted">学习时先复习到期词汇，再学习新词。</p>
            <label>
              学习时区
              <input
                required
                value={form.timezone}
                onChange={(e) =>
                  updateForm({ ...form, timezone: e.target.value })
                }
                list="timezones"
              />
              <datalist id="timezones">
                {[
                  "Asia/Shanghai",
                  "Asia/Tokyo",
                  "Asia/Hong_Kong",
                  "America/New_York",
                  "America/Los_Angeles",
                  "Europe/London",
                  "UTC",
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </datalist>
            </label>
            <p className="small muted">
              时区决定每日目标和日历日期。 已有学习日期保持不变。
            </p>
            <fieldset className="levels-field">
              <legend>学习等级</legend>
              <div className="level-checks">
                {LEVELS.map((l) => (
                  <label
                    key={l}
                    className={form.jlpt_levels.includes(l) ? "checked" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={form.jlpt_levels.includes(l)}
                      onChange={(e) =>
                        updateForm({
                          ...form,
                          jlpt_levels: e.target.checked
                            ? [...form.jlpt_levels, l]
                            : form.jlpt_levels.filter((x) => x !== l),
                        })
                      }
                    />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
          <section className="panel">
            <SectionTitle title="卡片显示" />
            <label>
              释义语言
              <select
                value={form.preferred_language}
                onChange={(e) =>
                  updateForm({
                    ...form,
                    preferred_language: e.target
                      .value as Settings["preferred_language"],
                  })
                }
              >
                <option value="zh">简体中文</option>
                <option value="zh-CN">英语</option>
              </select>
            </label>
            <label className="toggle-row">
              <span>
                <strong>显示罗马字</strong>
                <small>在卡片背面显示罗马字读音</small>
              </span>
              <input
                role="switch"
                type="checkbox"
                checked={form.show_romaji}
                onChange={(e) =>
                  updateForm({ ...form, show_romaji: e.target.checked })
                }
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>显示例句翻译</strong>
                <small>用熟悉的语言理解例句</small>
              </span>
              <input
                role="switch"
                type="checkbox"
                checked={form.show_translation}
                onChange={(e) =>
                  updateForm({ ...form, show_translation: e.target.checked })
                }
              />
            </label>
          </section>
          <section className="panel">
            <SectionTitle title="外观" />
            <div className="theme-options">
              {(
                [
                  ["light", Sun],
                  ["dark", Moon],
                  ["system", Monitor],
                ] as const
              ).map(([theme, Icon]) => (
                <label
                  key={theme}
                  className={form.theme === theme ? "selected" : ""}
                >
                  <Icon size={24} />
                  <span>{themeLabel[theme]}</span>
                  <input
                    type="radio"
                    name="theme"
                    checked={form.theme === theme}
                    onChange={() => updateForm({ ...form, theme })}
                  />
                </label>
              ))}
            </div>
          </section>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            <Save size={17} />
            {busy ? "保存中…" : "保存设置"}
          </button>
        </form>
        <div>
          <section className="panel">
            <SectionTitle title="我的账号" />
            <p className="account-email">
              {s.demo ? "演示用户" : s.user?.email}
            </p>
            <div className="sync-box">
              <Cloud size={20} />
              <div>
                <strong>
                  {s.demo
                    ? "正在体验演示模式"
                    : s.online
                      ? "已连接云端"
                      : "当前离线"}
                </strong>
                <p className="small muted">
                  {s.demo
                    ? "演示数据刷新后会重置。"
                    : "词汇和学习进度会在登录设备间同步。"}
                </p>
              </div>
            </div>
            <button className="button full" onClick={() => void s.sync()}>
              <RefreshCw size={15} />
              立即同步
            </button>
          </section>
          <section className="panel">
            <SectionTitle title="导出我的数据" />
            <p className="muted small">
              可导出词汇、学习进度和复习记录， 随时保存自己的数据。
            </p>
            <label>
              导出内容
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
              >
                <option value="all">全部数据</option>
                <option value="vocabulary">词汇</option>
                <option value="progress">学习进度</option>
                <option value="history">复习记录</option>
              </select>
            </label>
            <label>
              文件格式
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV（每张表一个文件）</option>
              </select>
            </label>
            <button
              disabled={busy}
              className="button full"
              onClick={() => void exportData()}
            >
              <Download size={17} />
              下载数据
            </button>
          </section>
          {s.pending.length > 0 && (
            <section className="panel">
              <SectionTitle title="待同步的复习" />
              <p className="small muted">
                答案会保存在此设备，直到云端确认。 冲突的答案需要你处理。
              </p>
              {s.pending.map((a) => (
                <div className="pending-item" key={a.id}>
                  <strong>
                    {s.words.find((w) => w.id === a.wordId)?.word || "词汇"}
                  </strong>
                  <p className="small">
                    {a.error
                      ? "该词汇已在其他设备修改，云端保留了最新进度。"
                      : "等待同步…"}
                  </p>
                  {a.error && (
                    <button
                      className="text-button"
                      onClick={() => {
                        if (
                          confirm("放弃这条待同步答案，并保留云端的最新进度？")
                        )
                          void s.discard(a.id);
                      }}
                    >
                      放弃冲突答案
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
