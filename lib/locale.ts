import type { Status, Rating } from "./types";
export const statusLabel: Record<Status, string> = {
  new: "新词",
  learning: "学习中",
  review: "待复习",
  mastered: "已掌握",
};
export const ratingLabel: Record<Rating, string> = {
  1: "重来",
  2: "较难",
  3: "记得",
  4: "轻松",
};
export const partOfSpeechLabel: Record<string, string> = {
  Noun: "名词",
  Verb: "动词",
  Adjective: "形容词",
  Adverb: "副词",
  Expression: "表达",
  Particle: "助词",
};
export const themeLabel: Record<string, string> = {
  light: "浅色",
  dark: "深色",
  system: "跟随系统",
};
