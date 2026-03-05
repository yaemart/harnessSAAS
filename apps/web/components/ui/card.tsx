import React from 'react';

export function Card({ children, className = '', style = {} }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) {
    return (
        <div className={`ios-card ${className}`} style={{ padding: 24, ...style }}>
            {children}
        </div>
    );
}
