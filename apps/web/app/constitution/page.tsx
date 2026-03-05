'use client';

import { useState } from 'react';
import {
  BookOpen, Shield, AlertTriangle, Users, Mail, Bot,
} from 'lucide-react';
import { useAuth } from '../../components/auth-context';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';

type RuleType = 'HARD' | 'SOFT' | 'STRUCTURAL';
type RuleScope = 'Global' | 'Category' | 'Platform';
type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface ConstitutionRule {
  id: string;
  name: string;
  type: RuleType;
  scope: RuleScope;
  description: string;
  riskLevel: RiskLevel;
  enabled: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited';
}

const TYPE_COLORS: Record<RuleType, string> = {
  HARD: 'var(--danger)',
  SOFT: 'var(--warning)',
  STRUCTURAL: 'var(--accent)',
};

const SCOPE_COLORS: Record<RuleScope, string> = {
  Global: 'var(--accent)',
  Category: 'var(--warning)',
  Platform: 'var(--success)',
};

const RISK_COLORS: Record<RiskLevel, string> = {
  HIGH: 'var(--danger)',
  MEDIUM: 'var(--warning)',
  LOW: 'var(--success)',
};

const MOCK_RULES: ConstitutionRule[] = [
  { id: '1', name: 'Price Floor Enforcement', type: 'HARD', scope: 'Global', description: 'Never set price below cost + minimum margin threshold. Applies to all automated pricing decisions.', riskLevel: 'HIGH', enabled: true },
  { id: '2', name: 'Ad Spend Daily Cap', type: 'HARD', scope: 'Platform', description: 'Daily ad spend must not exceed 120% of the configured budget per platform campaign.', riskLevel: 'HIGH', enabled: true },
  { id: '3', name: 'Inventory Reorder Threshold', type: 'SOFT', scope: 'Category', description: 'Trigger reorder when stock drops below 14-day runway. Adjustable per category.', riskLevel: 'MEDIUM', enabled: true },
  { id: '4', name: 'Competitor Price Matching', type: 'SOFT', scope: 'Global', description: 'Allow automated price matching within 5% of competitor price, subject to margin constraints.', riskLevel: 'MEDIUM', enabled: false },
  { id: '5', name: 'Review Response SLA', type: 'STRUCTURAL', scope: 'Platform', description: 'All negative reviews (1-2 stars) must have a response drafted within 4 hours.', riskLevel: 'LOW', enabled: true },
  { id: '6', name: 'Listing Content Approval', type: 'STRUCTURAL', scope: 'Global', description: 'AI-generated listing content must be queued for human approval before publishing.', riskLevel: 'LOW', enabled: true },
  { id: '7', name: 'FBA Shipment Size Limit', type: 'HARD', scope: 'Platform', description: 'Single FBA shipment must not exceed 500 units to avoid storage overflow penalties.', riskLevel: 'MEDIUM', enabled: true },
  { id: '8', name: 'Promotional Discount Cap', type: 'SOFT', scope: 'Category', description: 'Automated promotions cannot exceed 30% discount without tenant admin approval.', riskLevel: 'HIGH', enabled: true },
];

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@company.com', role: 'tenant_admin', status: 'active' },
  { id: '2', name: 'Marcus Johnson', email: 'marcus@company.com', role: 'operator', status: 'active' },
  { id: '3', name: 'Emily Rodriguez', email: 'emily@company.com', role: 'operator', status: 'active' },
  { id: '4', name: 'James Kim', email: 'james@company.com', role: 'viewer', status: 'invited' },
  { id: '5', name: 'Priya Patel', email: 'priya@company.com', role: 'supplier', status: 'active' },
];

export default function ConstitutionPage() {
  const { hasRole } = useAuth();
  const [rules, setRules] = useState(MOCK_RULES);

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  return (
    <RoleGuard allowedRoles={['system_admin', 'tenant_admin']}>
    <main>
      <div className="header">
        <div>
          <h1 className="ios-title">Constitution Management</h1>
          <p className="ios-subtitle">Define the rules that govern AI agent behavior</p>
        </div>
      </div>

      {/* Rules List */}
      <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Shield size={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Constitution Rules</h2>
          <span style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            borderRadius: '999px',
            background: tintedBg('var(--accent)', 10),
            color: 'var(--accent)',
            fontSize: 11,
            fontWeight: 700,
          }}>
            {rules.filter((r) => r.enabled).length} / {rules.length} Active
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.map((rule) => (
            <div
              key={rule.id}
              style={{
                padding: 16,
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--border-color)',
                background: rule.enabled ? 'transparent' : tintedBg('var(--text-tertiary)', 5),
                opacity: rule.enabled ? 1 : 0.7,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
                  {rule.name}
                </h4>

                {/* Type Badge */}
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: tintedBg(TYPE_COLORS[rule.type], 12),
                  color: TYPE_COLORS[rule.type],
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  {rule.type}
                </span>

                {/* Scope Badge */}
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: tintedBg(SCOPE_COLORS[rule.scope], 12),
                  color: SCOPE_COLORS[rule.scope],
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  {rule.scope}
                </span>

                {/* Risk Level */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} style={{ color: RISK_COLORS[rule.riskLevel] }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: RISK_COLORS[rule.riskLevel] }}>
                    {rule.riskLevel}
                  </span>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggleRule(rule.id)}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: '999px',
                    border: 'none',
                    background: rule.enabled ? 'var(--success)' : tintedBg('var(--text-tertiary)', 30),
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: 'var(--panel-bg)',
                    position: 'absolute',
                    top: 3,
                    left: rule.enabled ? 21 : 3,
                    transition: 'left 0.2s ease',
                    boxShadow: 'var(--panel-shadow)',
                  }} />
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {rule.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Team Management */}
      <div className="ios-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Users size={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Team Management</h2>
          <button style={{
            marginLeft: 'auto',
            padding: '8px 18px',
            borderRadius: '999px',
            border: 'none',
            background: 'var(--accent)',
            color: 'var(--panel-bg)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <Mail size={14} />
            Invite Member
          </button>
        </div>

        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Email', 'Role', 'Status'].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_TEAM.map((member) => (
                <tr key={member.id}>
                  <td style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {member.name}
                  </td>
                  <td style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {member.email}
                  </td>
                  <td style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: tintedBg('var(--accent)', 10),
                      color: 'var(--accent)',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {member.role.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: member.status === 'active'
                        ? tintedBg('var(--success)', 12)
                        : tintedBg('var(--warning)', 12),
                      color: member.status === 'active' ? 'var(--success)' : 'var(--warning)',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {member.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
    </RoleGuard>
  );
}
