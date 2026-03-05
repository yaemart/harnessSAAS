'use client';

import { getAllThemes, type PortalThemeDefinition } from '@/lib/themes/theme-registry';

interface ThemeSelectorProps {
  currentThemeId: string;
  onSelect: (themeId: string) => void;
}

export function ThemeSelector({ currentThemeId, onSelect }: ThemeSelectorProps) {
  const themes = getAllThemes();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
      {themes.map((theme) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          isActive={theme.id === currentThemeId}
          onSelect={() => onSelect(theme.id)}
        />
      ))}
    </div>
  );
}

function ColorDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: color,
        border: '1px solid rgba(128,128,128,0.2)',
      }} />
      <span style={{ fontSize: '9px', color: '#999', fontFamily: 'monospace' }}>{label}</span>
    </div>
  );
}

function ThemeCard({
  theme,
  isActive,
  onSelect,
}: {
  theme: PortalThemeDefinition;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        border: isActive ? `2px solid ${theme.swatch.accent}` : '1px solid #e0e0e0',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: '#fff',
      }}
    >
      {/* Color preview bar */}
      <div style={{
        height: '48px',
        background: theme.swatch.bg,
        borderBottom: '1px solid rgba(128,128,128,0.1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '8px',
      }}>
        <span style={{
          fontFamily: theme.fonts.heading.split(',')[0],
          fontSize: '16px',
          fontWeight: 600,
          color: theme.swatch.text,
          letterSpacing: '2px',
        }}>
          Aa
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: theme.swatch.accent }} />
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: theme.swatch.success }} />
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: theme.swatch.text, opacity: 0.3 }} />
      </div>

      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>{theme.name}</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{
              fontSize: '9px',
              letterSpacing: '1px',
              padding: '2px 8px',
              borderRadius: '10px',
              background: theme.mode === 'dark' ? '#1a1a1a' : '#f0f0f0',
              color: theme.mode === 'dark' ? '#ccc' : '#666',
              textTransform: 'uppercase',
            }}>
              {theme.mode}
            </span>
            {isActive && (
              <span style={{
                fontSize: '9px',
                letterSpacing: '1px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: theme.swatch.accent,
                color: '#fff',
                textTransform: 'uppercase',
              }}>
                Active
              </span>
            )}
          </div>
        </div>

        <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.6, marginBottom: '12px' }}>
          {theme.description}
        </div>

        {/* Swatch row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <ColorDot color={theme.swatch.bg} label="bg" />
          <ColorDot color={theme.swatch.card} label="card" />
          <ColorDot color={theme.swatch.text} label="text" />
          <ColorDot color={theme.swatch.accent} label="accent" />
          <ColorDot color={theme.swatch.success} label="ok" />
        </div>

        {/* Font info */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span style={{ fontSize: '10px', color: '#999', fontFamily: 'monospace' }}>
            {theme.fonts.heading.split(',')[0].replace(/'/g, '')}
          </span>
          <span style={{ fontSize: '10px', color: '#ddd' }}>·</span>
          <span style={{ fontSize: '10px', color: '#999', fontFamily: 'monospace' }}>
            {theme.fonts.body.split(',')[0].replace(/'/g, '')}
          </span>
        </div>

        {/* Suited for */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {theme.suitedFor.map((tag) => (
            <span key={tag} style={{
              fontSize: '9px',
              padding: '2px 6px',
              borderRadius: '3px',
              background: '#f5f5f5',
              color: '#888',
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
