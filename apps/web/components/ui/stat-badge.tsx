import React from 'react';

interface StatBadgeProps {
    label: string;
    value: React.ReactNode;
    trend?: React.ReactNode;
    trendColor?: string;
    style?: React.CSSProperties;
}

export function StatBadge({ label, value, trend, trendColor = 'var(--success)', style = {} }: StatBadgeProps) {
    return (
        <div style={{
            padding: 16,
            background: 'var(--panel-bg)',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--panel-border)',
            boxShadow: 'var(--panel-shadow)',
            ...style
        }}>
            <div className="small" style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            {trend && <div className="small" style={{ color: trendColor, marginTop: 4 }}>{trend}</div>}
        </div>
    );
}
