'use client';

import React from 'react';
import { Shield, Eye, Compass, Zap, AlertTriangle, RefreshCcw, CheckCircle } from 'lucide-react';
import type { ReasoningLog, ConstitutionResult, GovernanceData } from '../lib/api';

interface Props {
    reasoningLog?: ReasoningLog;
    constitution?: ConstitutionResult;
    governance?: GovernanceData;
    compact?: boolean;
}

export function SovereignGovernanceInsight({ reasoningLog, constitution, governance, compact }: Props) {
    const govReasoning = governance?.reasoningLog;
    const govConstitution = governance?.constitution;
    const hasAnyData = reasoningLog || constitution || govReasoning || govConstitution;

    if (!hasAnyData) {
        return (
            <div className="ios-placeholder" style={{ padding: 12, fontSize: 13 }}>
                No sovereign governance data available for this intent.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* OODA Reasoning Section */}
            {reasoningLog && (
                <section style={{ border: '1px solid var(--sidebar-border)', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--sidebar-bg)', padding: '8px 12px', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Compass size={14} color="var(--accent)" />
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OODA Reasoning Log</span>
                    </div>

                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <Eye size={12} color="var(--accent)" />
                                </div>
                                <div style={{ width: 1, flex: 1, background: 'var(--sidebar-border)' }}></div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="small" style={{ fontWeight: 700, marginBottom: 2 }}>OBSERVE</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {JSON.stringify(reasoningLog.observe.snapshot)}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <Compass size={12} color="var(--accent)" />
                                </div>
                                <div style={{ width: 1, flex: 1, background: 'var(--sidebar-border)' }}></div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="small" style={{ fontWeight: 700, marginBottom: 2 }}>ORIENT</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {reasoningLog.orient.analysis}
                                    {reasoningLog.orient.matchedRules.length > 0 && (
                                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {reasoningLog.orient.matchedRules.map(rule => (
                                                <span key={rule} style={{ padding: '2px 6px', background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)', borderRadius: 'var(--border-radius-sm)', fontSize: 10 }}>{rule}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <Zap size={12} color="var(--accent)" />
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="small" style={{ fontWeight: 700, marginBottom: 2 }}>DECIDE</div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    {reasoningLog.decide.rationale}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Constitution Section */}
            {constitution && (
                <section style={{
                    border: '1px solid',
                    borderColor: constitution.pass
                        ? 'color-mix(in srgb, var(--success) 20%, transparent)'
                        : 'color-mix(in srgb, var(--danger) 20%, transparent)',
                    borderRadius: 'var(--border-radius-lg)',
                    overflow: 'hidden',
                    background: constitution.pass
                        ? 'color-mix(in srgb, var(--success) 2%, transparent)'
                        : 'color-mix(in srgb, var(--danger) 2%, transparent)',
                }}>
                    <div style={{
                        background: constitution.pass
                            ? 'color-mix(in srgb, var(--success) 5%, transparent)'
                            : 'color-mix(in srgb, var(--danger) 5%, transparent)',
                        padding: '8px 12px',
                        borderBottom: '1px solid',
                        borderColor: constitution.pass
                            ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                            : 'color-mix(in srgb, var(--danger) 10%, transparent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Shield size={14} color={constitution.pass ? 'var(--success)' : 'var(--danger)'} />
                            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sovereign Constitution Proxy</span>
                        </div>
                        <span style={{ fontSize: 10, opacity: 0.6 }}>{constitution.version}</span>
                    </div>

                    <div style={{ padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            {constitution.pass ? (
                                <CheckCircle size={16} color="var(--success)" />
                            ) : (
                                <AlertTriangle size={16} color="var(--danger)" />
                            )}
                            <span style={{ fontSize: 14, fontWeight: 700 }}>
                                {constitution.pass ? 'Constitution Pass' : 'Constitution Rejected'}
                            </span>
                        </div>

                        {constitution.hardViolations.length > 0 && (
                            <ul style={{ margin: '8px 0 0 20px', padding: 0, fontSize: 12, color: 'var(--danger)' }}>
                                {constitution.hardViolations.map((v, i) => (
                                    <li key={i}>{v}</li>
                                ))}
                            </ul>
                        )}

                        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                            Constitution Risk Score: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{constitution.ruleRiskScore}</span>
                        </div>
                    </div>
                </section>
            )}

            {/* Governance Execution Status */}
            {governance && (governance.executionStatus || governance.receipt) && (
                <section style={{
                    border: '1px solid var(--panel-border)',
                    borderRadius: 'var(--border-radius-lg)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        background: 'var(--sidebar-bg)',
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--sidebar-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <RefreshCcw size={14} color="var(--accent)" />
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Execution Receipt
                        </span>
                    </div>
                    <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        {governance.executionStatus && (
                            <div>
                                <div className="small" style={{ fontWeight: 700, marginBottom: 2 }}>Status</div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{governance.executionStatus}</div>
                            </div>
                        )}
                        {governance.riskLevel && (
                            <div>
                                <div className="small" style={{ fontWeight: 700, marginBottom: 2 }}>Risk Level</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: governance.riskLevel === 'CRITICAL' || governance.riskLevel === 'HIGH' ? 'var(--danger)' : 'var(--text-primary)' }}>
                                    {governance.riskLevel}
                                </div>
                            </div>
                        )}
                        {governance.targetKey && (
                            <div>
                                <div className="small" style={{ fontWeight: 700, marginBottom: 2 }}>Target</div>
                                <div style={{ fontSize: 13 }}>{governance.targetKey}</div>
                            </div>
                        )}
                        {governance.receipt && (
                            <>
                                <div>
                                    <div className="small" style={{ fontWeight: 700, marginBottom: 2 }}>Platform</div>
                                    <div style={{ fontSize: 13 }}>{governance.receipt.platform}</div>
                                </div>
                                <div>
                                    <div className="small" style={{ fontWeight: 700, marginBottom: 2 }}>Receipt Status</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: governance.receipt.status === 'SUCCESS' ? 'var(--success)' : 'var(--danger)' }}>
                                        {governance.receipt.status}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            )}

            {/* Governance OODA from API (when no local reasoningLog) */}
            {!reasoningLog && govReasoning && (
                <section style={{ border: '1px solid var(--sidebar-border)', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--sidebar-bg)', padding: '8px 12px', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Compass size={14} color="var(--accent)" />
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OODA Reasoning (from execution log)</span>
                    </div>
                    <div style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                        {govReasoning.summary && <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-primary)' }}>{govReasoning.summary}</div>}
                        {govReasoning.observe && (
                            <div style={{ marginBottom: 8 }}>
                                <span className="small" style={{ fontWeight: 700 }}>Observe: </span>
                                {JSON.stringify(govReasoning.observe)}
                            </div>
                        )}
                        {govReasoning.orient && (
                            <div style={{ marginBottom: 8 }}>
                                <span className="small" style={{ fontWeight: 700 }}>Orient: </span>
                                {JSON.stringify(govReasoning.orient)}
                            </div>
                        )}
                        {govReasoning.decide && (
                            <div>
                                <span className="small" style={{ fontWeight: 700 }}>Decide: </span>
                                {JSON.stringify(govReasoning.decide)}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Constitution version from governance (when no local constitution) */}
            {!constitution && govConstitution && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: 'color-mix(in srgb, var(--success) 5%, transparent)',
                    borderRadius: 'var(--border-radius-lg)',
                    border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)',
                }}>
                    <Shield size={14} color="var(--success)" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>Constitution Applied</div>
                        <div className="small" style={{ opacity: 0.8 }}>Version: {govConstitution.version}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
