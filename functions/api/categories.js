// GET /api/categories — 分类目录
// 返回 4 大类 + 子分类

import { json } from "../_shared/helpers.js";

const CATEGORIES = [
  { key: "repair", name: "维修", icon: "wrench", color: "#dc2626",
    subs: [
      { key: "water", name: "水电" },
      { key: "appliance", name: "家电" },
      { key: "pipe", name: "管道" },
    ] },
  { key: "cleaning", name: "保洁", icon: "sparkles", color: "#0891b2",
    subs: [
      { key: "daily", name: "日常" },
      { key: "deep", name: "深度" },
      { key: "rough", name: "开荒" },
    ] },
  { key: "install", name: "安装", icon: "screwdriver", color: "#7c3aed",
    subs: [
      { key: "furniture", name: "家具" },
      { key: "appliance", name: "家电" },
    ] },
  { key: "other", name: "其他", icon: "more", color: "#475569",
    subs: [] },
];

export async function onRequestGet() {
  return json({ categories: CATEGORIES });
}
