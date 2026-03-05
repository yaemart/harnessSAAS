'use client';

import { useState } from 'react';
import Link from 'next/link';

// === 模拟数据 ===
const MODEL_VERSIONS = [
    { version: 'v2.4.1 (Stable)', status: 'ACTIVE', generation: 41, timeAlive: '14 days' },
    { version: 'v2.4.2 (Challenger)', status: 'TRAINING', generation: 42, timeAlive: '2 days' },
    { version: 'v2.3.9 (Fallback)', status: 'ARCHIVED', generation: 39, timeAlive: '30 days' },
];

const METRICS = {
    learningRate: 0.0015,
    explorationEpsilon: 0.12,
    avgRewardLast100: 4.8,
    capitalEfficiencyAvg: 2.3, // ROAS equivalent
    decisionsPerMinute: 345,
};

const MUTATION_LOGS = [
    { id: 'MUT-001', time: '10 mins ago', type: 'HYPERPARAM_UPDATE', detail: 'Increased exploration epsilon from 0.10 to 0.12 due to stagnating local optimum.', impact: 'PENDING' },
    { id: 'MUT-002', time: '1 hour ago', type: 'WEIGHT_PENALTY', detail: 'Applied -5.0 penalty for breaching ACoS constraint on Campaign X.', impact: 'NEGATIVE' },
    { id: 'MUT-003', time: '3 hours ago', type: 'REWARD_SIGNAL', detail: 'Received +10.0 reward for discovering new profitable long-tail keyword segment.', impact: 'POSITIVE' },
    { id: 'MUT-004', time: '12 hours ago', type: 'MODEL_CHECKPOINT', detail: 'Saved generation 41 checkpoint after hitting stable efficiency ratio.', impact: 'NEUTRAL' },
];

import { useTenant } from './tenant-context';
import { Card, PageHeader, StatBadge, Badge } from './ui';

export function EvolutionDashboard() {
    const { currentTenant } = useTenant();
    const [learningRate, setLearningRate] = useState(METRICS.learningRate);
    const [epsilon, setEpsilon] = useState(METRICS.explorationEpsilon);

    return (
        <main>
            <PageHeader
                title="RL Capital Brain View"
                subtitle={`Evolution Engine Metrics & Generation Control · ${currentTenant?.name}`}
                actions={
                    <>
                        <Link href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13 }}>Home</Link>
                        <Link href="/governance" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13 }}>← Governance</Link>
                    </>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, marginBottom: 24 }}>

                {/* Left Column: Metrics & Logs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <Card>
                        <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
                            Key Evolution Metrics
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                            <StatBadge
                                label="Avg Reward (Last 100)"
                                value={METRICS.avgRewardLast100}
                                trend="↑ 0.3 since yesterday"
                            />
                            <StatBadge
                                label="Capital Efficiency (ROAS)"
                                value={`${METRICS.capitalEfficiencyAvg}x`}
                                trend="↑ 12% vs Baseline"
                            />
                            <StatBadge
                                label="Decisions / Minute"
                                value={METRICS.decisionsPerMinute}
                            />
                        </div>

                        <div style={{ marginTop: 24, height: 200, background: 'var(--panel-bg)', border: '1px dashed var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="small" style={{ color: 'var(--text-secondary)' }}>[ Reward Trajectory Chart Placeholder ]</span>
                        </div>
                    </Card>

                    <Card>
                        <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
                            Mutation & Penalty Logs
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {MUTATION_LOGS.map(log => (
                                <div key={log.id} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ width: 100, flexShrink: 0 }}>
                                        <div className="small" style={{ color: 'var(--text-secondary)' }}>{log.time}</div>
                                        <div className="small" style={{ fontWeight: 600, marginTop: 4 }}>{log.type}</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p className="small" style={{ margin: 0 }}>{log.detail}</p>
                                    </div>
                                    <div style={{ width: 80, textAlign: 'right' }}>
                                        <Badge variant={log.impact === 'NEGATIVE' ? 'danger' : log.impact === 'POSITIVE' ? 'success' : 'default'}>
                                            {log.impact}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right Column: Controls & Active Models */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                    <Card style={{ padding: 20 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>Evolution Controls</h3>

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <label className="small" style={{ fontWeight: 600 }}>Learning Rate (α)</label>
                                <span className="small" style={{ fontFamily: 'monospace' }}>{learningRate.toFixed(4)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.0001"
                                max="0.01"
                                step="0.0001"
                                value={learningRate}
                                onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <label className="small" style={{ fontWeight: 600 }}>Exploration Rate (ε)</label>
                                <span className="small" style={{ fontFamily: 'monospace' }}>{epsilon.toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.01"
                                max="0.5"
                                step="0.01"
                                value={epsilon}
                                onChange={(e) => setEpsilon(parseFloat(e.target.value))}
                                style={{ width: '100%' }}
                            />
                            <p className="small" style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.4 }}>
                                Higher epsilon increases random exploration. Lower epsilon favors exploiting known profitable strategies.
                            </p>
                        </div>

                        <button type="button" className="approve" style={{ width: '100%' }} title="Apply the updated reward parameters to the RLHF engine">Apply Parameters</button>
                        <button type="button" className="reject" style={{ width: '100%', marginTop: 8 }} title="Manually apply a -10 penalty to the selected AI model's score">Force Manual Penalty (-10)</button>
                    </Card>

                    <Card>
                        <h3 style={{ margin: '0 0 16px 0' }}>Active Generations</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {MODEL_VERSIONS.map(model => (
                                <div key={model.version} style={{
                                    padding: 12,
                                    border: '1px solid',
                                    borderColor: model.status === 'ACTIVE' ? '#a7f3d0' : 'var(--border)',
                                    borderRadius: 8,
                                    background: model.status === 'ACTIVE' ? '#f0fdf4' : '#ffffff'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{model.version}</span>
                                        <Badge variant={model.status === 'ACTIVE' ? 'success' : model.status === 'TRAINING' ? 'warning' : 'default'} style={{ fontSize: 10 }}>
                                            {model.status}
                                        </Badge>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span className="small" style={{ color: 'var(--text-secondary)' }}>Gen {model.generation}</span>
                                        <span className="small" style={{ color: 'var(--text-secondary)' }}>Alive: {model.timeAlive}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                </div>
            </div>
        </main>
    );
}
