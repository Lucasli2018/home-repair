// config.js — 全局配置常量
(function (global) {
  "use strict";

  const CONFIG = {
    // 后端 API base（前端直接挂 /api）
    apiBase: "/api",

    // localStorage 主 key（存手机号/token 等）
    storageKey: "home-repair-v1",

    // 图片 base（与后端 /api/image/:key 对接）
    imageBase: "/api/image/",

    // 分类常量（与后端 categories.js 对齐）
    categories: [
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
    ],

    // 订单状态映射
    orderStatus: {
      pending: { name: "待确认", badge: "badge--warn" },
      confirmed: { name: "已确认", badge: "badge--info" },
      done: { name: "已完成", badge: "badge--ok" },
      cancelled: { name: "已取消", badge: "badge" },
      rejected: { name: "已拒绝", badge: "badge--danger" },
    },

    // 客服时间
    serviceHours: "8:00 - 22:00",

    // 站点名
    appName: "家修管家",
    appSlogan: "省心 · 专业 · 上门服务",

    // 平台管理后台路径
    adminPath: "/admin.html",

    // 默认头像（用首字母占位）
    defaultAvatarColors: ["#ea580c", "#dc2626", "#0891b2", "#7c3aed", "#475569"],

    // 预约时段默认提前分钟数（防止选过期时段）
    minLeadMinutes: 60,

    // 默认一次列表数量
    pageSize: 20,

    // 默认城市（暂未启用多城市，仅显示）
    defaultCity: "北京",
  };

  global.CONFIG = CONFIG;
})(window);
