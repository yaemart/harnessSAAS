# Markets Compliance Seed — Claude Code 任务指引

## 任务目标
为跨境电商 AI 原生 SaaS 系统生成并插入 `markets` 表的合规预置数据。
数据来源：各国官方税务局公开数据（截至 2025-2026 年最新版本）。

## 执行顺序（严格按此顺序）

### Step 1: 运行 migration（建表）
```bash
python -m alembic upgrade head
# 或直接执行：
psql $DATABASE_ADMIN_URL -f migrations/create_markets.sql
```

### Step 2: 插入预置数据
```bash
python seed/seed_markets.py
```

### Step 3: 验证数据
```bash
python seed/verify_markets.py
```

### Step 4: 运行 Harness 测试
```bash
pytest tests/test_markets_compliance.py -v
```

## 文件结构
```
markets_seed/
├── CLAUDE.md                    ← 你现在读的文件（Claude Code 任务指引）
├── migrations/
│   └── create_markets.sql       ← 建表 DDL（含 RLS）
├── seed/
│   ├── seed_markets.py          ← 幂等 seed script
│   ├── verify_markets.py        ← 数据验证
│   └── market_data.json         ← 税率原始数据（可独立更新）
├── tests/
│   └── test_markets_compliance.py  ← Harness 测试
└── opa/
    └── markets_policy.rego      ← OPA 税务策略（基于此表数据）
```

## 重要约束
- DATABASE_ADMIN_URL 连接超级用户（绕过 RLS 插入 seed）
- DATABASE_URL 连接 app_user（RLS 生效，业务代码用此）
- 所有 seed 数据使用固定 UUID，确保幂等
- 税率数据变更时只更新 market_data.json，重新运行 seed_markets.py 即可

## 数据来源说明（公开官方数据）
| 市场 | 税率类型 | 官方来源 | 最后验证 |
|------|---------|---------|---------|
| US | Sales Tax (州级，无联邦) | IRS + 各州税务局 | 2025-08 |
| UK | VAT 20% | HMRC gov.uk | 2025-01 |
| DE | VAT 19% | Bundeszentralamt für Steuern | 2025-01 |
| JP | Consumption Tax 10% | Japan Customs / NTA | 2025-10 |
| AU | GST 10% | ATO gov.au | 2025-01 |
| CA | GST 5% (+ 省级 HST/PST) | CRA canada.ca | 2025-04 |
