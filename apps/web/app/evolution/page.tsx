'use client';

import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Target, Shield, Zap, Eye } from 'lucide-react';
import { useAuth } from '../../components/auth-context';
import { tokens, tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type PatternGrade = 'SHADOW' | 'SUGGEST' | 'AUTO_LOW' | 'AUTO_FULL';

interface QualityTrendPoint {
  date: string;
  avgScore: number;
  count: number;
}

interface EvolutionStats {
  totalPatterns: number;
  activePatterns: number;
  byGrade: Record<string, number>;
  avgConfidence: number;
  totalApplications: number;
  successRate: number;
  recentExperiences: number;
  avgQualityScore: number;
  qualityTrend: QualityTrendPoint[];
}

const GRADE_CONFIG: Record<PatternGrade, { label: string; color: string; description: string }> = {
  SHADOW: { label: 'Shadow', color: tokens.color.textSecondary, description: 'Log only, no impact' },
  SUGGEST: { label: 'Suggest', color: tokens.color.warning, description: 'Needs human confirmation' },
  AUTO_LOW: { label: 'Auto Low', color: tokens.color.accent, description: 'Low-risk auto-apply' },
  AUTO_FULL: { label: 'Auto Full', color: tokens.color.success, description: 'Full auto-apply' },
};

const EMPTY_STATS: EvolutionStats = {
  totalPatterns: 0,
  activePatterns: 0,
  byGrade: {},
  avgConfidence: 0,
  totalApplications: 0,
  successRate: 0,
  recentExperiences: 0,
  avgQualityScore: 0,
  qualityTrend: [],
};

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="ios-card" style={{
      padding: tokens.spacing.cardPadding,
      flex: 1,
      minWidth: 160,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: tokens.radius.sm,
          background: tintedBg(tokens.color.accent, 10),
          color: tokens.color.accent,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: tokens.font.size.stat, fontWeight: tokens.font.weight.bold, color: tokens.color.textPrimary }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: tokens.font.size.xs, color: tokens.color.textTertiary, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function GradeBar({ byGrade, total }: { byGrade: Record<string, number>; total: number }) {
  const grades: PatternGrade[] = ['AUTO_FULL', 'AUTO_LOW', 'SUGGEST', 'SHADOW'];
  if (total === 0) return null;

  return (
    <div>
      <div style={{
        display: 'flex',
        height: 8,
        borderRadius: tokens.radius.pill,
        overflow: 'hidden',
        background: tintedBg(tokens.color.textTertiary, 8),
      }}>
        {grades.map((grade) => {
          const count = byGrade[grade] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={grade}
              style={{
                width: `${pct}%`,
                background: GRADE_CONFIG[grade].color,
                transition: 'width 0.3s ease',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        {grades.map((grade) => {
          const count = byGrade[grade] ?? 0;
          const cfg = GRADE_CONFIG[grade];
          return (
            <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: cfg.color,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.textSecondary }}>
                {cfg.label}: {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QualityTrendChart({ data }: { data: QualityTrendPoint[] }) {
  if (data.length === 0) return null;

  const maxScore = Math.max(...data.map((d) => d.avgScore), 1);
  const chartHeight = 120;

  return (
    <div style={{ position: 'relative', height: chartHeight, marginTop: 12 }}>
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${data.length * 40} ${chartHeight}`} preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          points={data
            .map((d, i) => `${i * 40 + 20},${chartHeight - (d.avgScore / maxScore) * (chartHeight - 20)}`)
            .join(' ')}
        />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={i * 40 + 20}
            cy={chartHeight - (d.avgScore / maxScore) * (chartHeight - 20)}
            r="3"
            fill="var(--accent)"
          />
        ))}
      </svg>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 4,
      }}>
        <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.textTertiary }}>
          {data[0]?.date.slice(5)}
        </span>
        <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.textTertiary }}>
          {data[data.length - 1]?.date.slice(5)}
        </span>
      </div>
    </div>
  );
}

export default function EvolutionPage() {
  const { hasRole, authHeaders } = useAuth();
  const [stats, setStats] = useState<EvolutionStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/evolution/stats`, { headers: authHeaders })
      .then((r) => r.ok ? r.json() : EMPTY_STATS)
      .then((data) => setStats(data))
      .catch(() => setStats(EMPTY_STATS))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  return (
    <RoleGuard allowedRoles={['system_admin', 'tenant_admin']}>
    <main>
      <div className="header">
        <div>
          <h1 className="ios-title">Evolution Dashboard</h1>
          <p className="ios-subtitle">Agent learning curve &amp; pattern intelligence</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: tokens.spacing.sectionGap }}>
        <StatCard
          icon={<Target size={16} />}
          label="Active Patterns"
          value={stats.activePatterns}
          sub={`${stats.totalPatterns} total`}
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Avg Quality"
          value={stats.avgQualityScore.toFixed(2)}
          sub={`${stats.recentExperiences} experiences (30d)`}
        />
        <StatCard
          icon={<Zap size={16} />}
          label="Pattern Success"
          value={`${(stats.successRate * 100).toFixed(0)}%`}
          sub={`${stats.totalApplications} applications`}
        />
        <StatCard
          icon={<Shield size={16} />}
          label="Avg Confidence"
          value={stats.avgConfidence.toFixed(2)}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: tokens.spacing.sectionGap }}>
        <div className="ios-card" style={{ padding: tokens.spacing.cardPadding, flex: 2, minWidth: 300 }}>
          <h3 style={{
            fontSize: tokens.font.size.base,
            fontWeight: tokens.font.weight.semibold,
            color: tokens.color.textPrimary,
            marginBottom: 12,
          }}>
            Quality Score Trend
          </h3>
          <QualityTrendChart data={stats.qualityTrend} />
        </div>

        <div className="ios-card" style={{ padding: tokens.spacing.cardPadding, flex: 1, minWidth: 240 }}>
          <h3 style={{
            fontSize: tokens.font.size.base,
            fontWeight: tokens.font.weight.semibold,
            color: tokens.color.textPrimary,
            marginBottom: 12,
          }}>
            Pattern Grade Distribution
          </h3>
          <GradeBar byGrade={stats.byGrade} total={stats.activePatterns} />

          <div style={{ marginTop: 20 }}>
            {(['AUTO_FULL', 'AUTO_LOW', 'SUGGEST', 'SHADOW'] as PatternGrade[]).map((grade) => {
              const cfg = GRADE_CONFIG[grade];
              return (
                <div key={grade} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: `1px solid ${tokens.color.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: cfg.color,
                    }} />
                    <span style={{ fontSize: tokens.font.size.sm, color: tokens.color.textPrimary }}>
                      {cfg.label}
                    </span>
                  </div>
                  <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.textTertiary }}>
                    {cfg.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ios-card" style={{ padding: tokens.spacing.cardPadding }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Eye size={18} style={{ color: tokens.color.accent }} />
          <h3 style={{
            fontSize: tokens.font.size.base,
            fontWeight: tokens.font.weight.semibold,
            color: tokens.color.textPrimary,
          }}>
            Session Evaluation Dimensions
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { name: 'Goal Achievement', weight: '30%', desc: 'Execution success + business improvement' },
            { name: 'Execution Efficiency', weight: '15%', desc: 'Step count & latency' },
            { name: 'Tool Usage', weight: '15%', desc: 'Observation data sufficiency' },
            { name: 'Self Correction', weight: '10%', desc: 'Retry recovery capability' },
            { name: 'Risk Compliance', weight: '15%', desc: 'Constitution pass rate' },
            { name: 'Business Impact', weight: '15%', desc: 'Sales & profit delta' },
          ].map((dim) => (
            <div
              key={dim.name}
              style={{
                padding: 14,
                borderRadius: tokens.radius.sm,
                background: tintedBg(tokens.color.accent, 5),
                border: `1px solid ${tokens.color.border}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>
                  {dim.name}
                </span>
                <span style={{
                  fontSize: tokens.font.size.xs,
                  fontWeight: tokens.font.weight.bold,
                  color: tokens.color.accent,
                  padding: '1px 6px',
                  borderRadius: tokens.radius.pill,
                  background: tintedBg(tokens.color.accent, 12),
                }}>
                  {dim.weight}
                </span>
              </div>
              <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.textTertiary }}>
                {dim.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
    </RoleGuard>
  );
}
