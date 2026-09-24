import Papa from "papaparse";
import { LEVELS, type VocabularyInput } from "./types";
export const FIELDS = [
  "word",
  "kana",
  "romaji",
  "meaning_zh",
  "meaning_en",
  "jlpt_level",
  "part_of_speech",
  "example_sentence",
  "example_kana",
  "example_translation",
  "notes",
  "tags",
] as const;
export function parseVocabulary(
  text: string,
  filename: string,
): VocabularyInput[] {
  if (text.length > 5_000_000) throw new Error("文件超过 5 MB，请拆分后导入。");
  let raw: unknown;
  if (filename.toLowerCase().endsWith(".json")) {
    raw = JSON.parse(text);
    if (
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      "vocabulary" in raw
    )
      raw = (raw as { vocabulary: unknown }).vocabulary;
  } else {
    const result = Papa.parse(text.replace(/^\uFEFF/, ""), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    if (result.errors.length)
      throw new Error(`CSV: ${result.errors[0].message}`);
    raw = result.data;
  }
  if (!Array.isArray(raw) || !raw.length || raw.length > 5000)
    throw new Error("请选择包含 1～5,000 行词汇的文件。");
  return raw.map((item, index) => {
    if (!item || typeof item !== "object")
      throw new Error(`Row ${index + 1}: 内容必须是对象。`);
    const row = Object.fromEntries(
      FIELDS.filter((k) => k !== "tags").map((k) => [
        k,
        String(item[k] ?? "").trim(),
      ]),
    ) as Omit<VocabularyInput, "tags">;
    if (!row.word || row.word.length > 200 || row.kana.length > 200)
      throw new Error(
        `Row ${index + 1}: 词汇不能为空，词汇和假名最多 200 个字符。`,
      );
    row.jlpt_level = row.jlpt_level || "N1";
    if (!LEVELS.includes(row.jlpt_level))
      throw new Error(`Row ${index + 1}: JLPT 等级无效。`);
    if (!row.meaning_zh && !row.meaning_en)
      throw new Error(`Row ${index + 1}: 请填写中文或英文释义。`);
    return {
      ...row,
      tags: Array.isArray(item.tags)
        ? item.tags.map(String)
        : String(item.tags || "")
            .split(/[;|]/)
            .map((x) => x.trim())
            .filter(Boolean),
    };
  });
}
export function csv(data: Record<string, unknown>[]) {
  return Papa.unparse(
    data.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(";") : v,
        ]),
      ),
    ),
    { escapeFormulae: true },
  );
}
export function download(
  name: string,
  data: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
