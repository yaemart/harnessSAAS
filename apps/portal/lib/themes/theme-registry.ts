export type ThemeCategory = 'warm' | 'minimal' | 'dark' | 'natural' | 'luxury';
export type ThemeMode = 'light' | 'dark';

export interface ThemeColorSwatch {
  bg: string;
  card: string;
  text: string;
  accent: string;
  success: string;
}

export interface PortalThemeDefinition {
  id: string;
  name: string;
  description: string;
  preview: string;
  category: ThemeCategory;
  mode: ThemeMode;
  swatch: ThemeColorSwatch;
  fonts: {
    heading: string;
    body: string;
    mono: string;
    googleFontsUrl?: string;
  };
  cssClass: string;
  suitedFor: string[];
}

export const portalThemes: Record<string, PortalThemeDefinition> = {
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    description: 'Warm, refined aesthetic with serif headings and earthy tones. Inspired by luxury editorial design.',
    preview: '/themes/editorial-preview.png',
    category: 'warm',
    mode: 'light',
    swatch: { bg: '#faf7f2', card: '#ffffff', text: '#1a1410', accent: '#c4a45a', success: '#7a8c78' },
    fonts: {
      heading: "'Cormorant Garamond', serif",
      body: "'DM Sans', sans-serif",
      mono: "'DM Mono', monospace",
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap',
    },
    cssClass: 'theme-editorial',
    suitedFor: ['home & kitchen', 'lifestyle', 'premium consumer goods'],
  },

  'minimal-mono': {
    id: 'minimal-mono',
    name: 'Minimal Mono',
    description: 'Ultra-clean black & white with generous whitespace. Sans-serif only, zero decoration.',
    preview: '/themes/minimal-mono-preview.png',
    category: 'minimal',
    mode: 'light',
    swatch: { bg: '#ffffff', card: '#ffffff', text: '#111111', accent: '#111111', success: '#22c55e' },
    fonts: {
      heading: "'Inter', -apple-system, sans-serif",
      body: "'Inter', -apple-system, sans-serif",
      mono: "'JetBrains Mono', 'SF Mono', monospace",
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
    },
    cssClass: 'theme-minimal-mono',
    suitedFor: ['consumer electronics', 'tech accessories', 'modern appliances'],
  },

  'tech-neon': {
    id: 'tech-neon',
    name: 'Tech Neon',
    description: 'Dark background with vibrant cyan/electric accents. Monospace-heavy, terminal-inspired.',
    preview: '/themes/tech-neon-preview.png',
    category: 'dark',
    mode: 'dark',
    swatch: { bg: '#0a0e17', card: '#1a2332', text: '#e2e8f0', accent: '#06d6a0', success: '#06d6a0' },
    fonts: {
      heading: "'Space Grotesk', -apple-system, sans-serif",
      body: "'Space Grotesk', -apple-system, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap',
    },
    cssClass: 'theme-tech-neon',
    suitedFor: ['gaming peripherals', 'PC hardware', 'smart home tech', 'audio equipment'],
  },

  'natural-grove': {
    id: 'natural-grove',
    name: 'Natural Grove',
    description: 'Organic greens, warm wood tones, soft rounded shapes. Feels like a walk in the forest.',
    preview: '/themes/natural-grove-preview.png',
    category: 'natural',
    mode: 'light',
    swatch: { bg: '#f7f5f0', card: '#ffffff', text: '#2d3a2e', accent: '#4a7c59', success: '#4a7c59' },
    fonts: {
      heading: "'Fraunces', Georgia, serif",
      body: "'Nunito Sans', -apple-system, sans-serif",
      mono: "'IBM Plex Mono', monospace",
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400&family=Nunito+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
    },
    cssClass: 'theme-natural-grove',
    suitedFor: ['eco-friendly products', 'outdoor gear', 'health & wellness', 'organic food appliances'],
  },

  'luxury-noir': {
    id: 'luxury-noir',
    name: 'Luxury Noir',
    description: 'Deep dark with gold accents, serif typography, and sharp edges. Unmistakably premium.',
    preview: '/themes/luxury-noir-preview.png',
    category: 'luxury',
    mode: 'dark',
    swatch: { bg: '#0c0a08', card: '#1e1a16', text: '#f0ece6', accent: '#c9a84c', success: '#7a9c6a' },
    fonts: {
      heading: "'Playfair Display', Georgia, serif",
      body: "'Lato', -apple-system, sans-serif",
      mono: "'DM Mono', monospace",
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lato:wght@300;400;700&family=DM+Mono:wght@400;500&display=swap',
    },
    cssClass: 'theme-luxury-noir',
    suitedFor: ['luxury watches', 'premium audio', 'designer appliances', 'high-end beauty devices'],
  },
};

export function getTheme(id: string): PortalThemeDefinition {
  return portalThemes[id] ?? portalThemes.editorial;
}

export function getAllThemes(): PortalThemeDefinition[] {
  return Object.values(portalThemes);
}

export function getThemesByCategory(category: ThemeCategory): PortalThemeDefinition[] {
  return Object.values(portalThemes).filter((t) => t.category === category);
}

export function getThemesByMode(mode: ThemeMode): PortalThemeDefinition[] {
  return Object.values(portalThemes).filter((t) => t.mode === mode);
}
