# Portal Theme Creation Guide

## Architecture

每个门户主题由三部分组成：

1. **CSS 文件** (`lib/themes/{theme-id}.css`) — 定义所有 `--portal-*` CSS 变量和组件样式
2. **注册条目** (`lib/themes/theme-registry.ts`) — 在 `portalThemes` 对象中添加主题元数据
3. **CSS 导入** (`app/layout.tsx`) — 在 layout 中导入 CSS 文件

## CSS 变量契约

所有主题 **必须** 定义以下 CSS 变量（在 `.theme-{id}` 选择器下）：

### 核心色板
| 变量 | 用途 |
|------|------|
| `--portal-bg` | 页面背景 |
| `--portal-bg-warm` | 次级背景（侧边栏、卡片底色） |
| `--portal-bg-card` | 卡片/面板背景 |
| `--portal-sand` | 装饰色（进度条底色等） |
| `--portal-stone` | 辅助边框色 |

### 文字
| 变量 | 用途 |
|------|------|
| `--portal-text-primary` | 主文字 |
| `--portal-text-secondary` | 次级文字 |
| `--portal-text-tertiary` | 辅助文字/标签 |
| `--portal-text-muted` | 最弱文字/占位符 |

### 强调色
| 变量 | 用途 |
|------|------|
| `--portal-accent` | 品牌强调色 |
| `--portal-accent-light` | 强调色浅版 |
| `--portal-accent-rgb` | 强调色 RGB 值（用于 rgba） |

### 语义色
| 变量 | 用途 |
|------|------|
| `--portal-success` | 成功/激活 |
| `--portal-danger` | 错误/危险 |
| `--portal-info` | 信息/分析 |
| `--portal-warning` | 警告 |

### 边框与阴影
| 变量 | 用途 |
|------|------|
| `--portal-border` | 标准边框 |
| `--portal-border-subtle` | 微弱边框 |
| `--portal-shadow-sm` | 小阴影 |
| `--portal-shadow-md` | 中阴影 |
| `--portal-shadow-lg` | 大阴影 |

### 圆角
| 变量 | 用途 |
|------|------|
| `--portal-radius-sm` | 小元素（badge） |
| `--portal-radius-md` | 输入框、按钮 |
| `--portal-radius-lg` | 卡片 |
| `--portal-radius-xl` | 浮动卡片 |
| `--portal-radius-pill` | 药丸形 |

### 毛玻璃
| 变量 | 用途 |
|------|------|
| `--portal-glass-bg` | 导航栏半透明背景 |
| `--portal-glass-blur` | 模糊值 |

### 字体
| 变量 | 用途 |
|------|------|
| `--portal-font-heading` | 标题字体 |
| `--portal-font-body` | 正文字体 |
| `--portal-font-mono` | 等宽字体 |

### 间距
| 变量 | 用途 |
|------|------|
| `--portal-space-xs` ~ `--portal-space-4xl` | 间距阶梯 |

### 布局
| 变量 | 用途 |
|------|------|
| `--portal-nav-height` | 导航栏高度 |
| `--portal-sidebar-width` | 产品详情侧边栏宽度 |
| `--portal-chat-sidebar-width` | Chat 侧边栏宽度 |
| `--portal-content-max-width` | 内容最大宽度 |

## 组件 CSS 类名

所有组件使用 `portal-` 前缀的 CSS 类名。主题通过 `.theme-{id} .portal-*` 选择器覆盖样式。

关键组件类名：
- `.portal-nav` — 导航栏
- `.portal-btn-primary` / `.portal-btn-secondary` — 按钮
- `.portal-hero` — 首页英雄区
- `.portal-product-grid` / `.portal-product-tile` — 产品网格
- `.portal-detail-layout` / `.portal-sidebar` — 产品详情布局
- `.portal-warranty-card` / `.portal-warranty-track` — 质保卡片
- `.portal-tabs` / `.portal-tab` — 标签页
- `.portal-faq-*` — FAQ 组件
- `.portal-chat-layout` / `.portal-msg-bubble` — Chat 组件
- `.portal-form-*` — 表单元素
- `.portal-chip` — 选择标签
- `.portal-mcp-badge` — MCP 标识

## 新增主题步骤

1. 复制 `lib/themes/editorial.css` 为 `lib/themes/{new-theme-id}.css`
2. 将所有 `.theme-editorial` 替换为 `.theme-{new-theme-id}`
3. 修改 CSS 变量值以匹配新主题的视觉风格
4. 在 `lib/themes/theme-registry.ts` 的 `portalThemes` 中添加条目
5. 在 `app/layout.tsx` 中导入新 CSS 文件
6. 测试所有四个屏幕（首页、商品详情、Chat、质保注册）

## 已有主题

| ID | 名称 | 模式 | 分类 | 适用品类 |
|----|------|------|------|----------|
| `editorial` | Editorial | Light | warm | 家居厨房、生活方式、高端消费品 |
| `minimal-mono` | Minimal Mono | Light | minimal | 消费电子、科技配件、现代家电 |
| `tech-neon` | Tech Neon | Dark | dark | 游戏外设、PC硬件、智能家居、音频设备 |
| `natural-grove` | Natural Grove | Light | natural | 环保产品、户外装备、健康养生、有机食品电器 |
| `luxury-noir` | Luxury Noir | Dark | luxury | 奢侈手表、高端音频、设计师家电、美容仪器 |

## 后续可创建的主题方向

- **Playful** — 圆角、渐变、鲜艳配色，适合儿童/年轻消费电子
- **Corporate** — 蓝灰色调、专业感，适合 B2B 品牌
- **Retro** — 复古色调、像素风点缀，适合怀旧/潮流品牌
- **Ocean** — 蓝色系、流动感，适合户外/运动品牌
