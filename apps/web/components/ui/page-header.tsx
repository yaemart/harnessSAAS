import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
    return (
        <div className="header" style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div>
                    <h1 className="ios-title">{title}</h1>
                    {subtitle && <p className="ios-subtitle">{subtitle}</p>}
                </div>
                {actions && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}
