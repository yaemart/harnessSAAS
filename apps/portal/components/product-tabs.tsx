'use client';

import { useState, useMemo, useCallback } from 'react';
import type { FAQ, CommodityMedia } from '@/lib/types';
import { submitFaqFeedback } from '@/lib/portal-api-client';
import { isLoggedIn } from '@/lib/auth';

type TabId = 'faq' | 'manual' | 'recipes' | 'feedback';

const MEDIA_ICONS: Record<string, string> = {
  'quick_start': '📖',
  'user_manual': '📋',
  'troubleshooting': '🔧',
  'cleaning': '🧹',
  'assembly': '🔩',
  'repair': '🛠️',
  'usage': '📖',
  'recipe_demo': '🥘',
  'video': '🎬',
};

function getMediaIcon(type: string): string {
  for (const [key, icon] of Object.entries(MEDIA_ICONS)) {
    if (type.toLowerCase().includes(key)) return icon;
  }
  return '📄';
}

const CATEGORY_LABELS: Record<string, string> = {
  usage: 'Usage',
  warranty: 'Warranty',
  troubleshooting: 'Troubleshooting',
  safety: 'Safety',
};

interface FAQTabProps {
  faqs: FAQ[];
  openFaq: number;
  onToggle: (index: number) => void;
}

export function FAQTab({ faqs, openFaq, onToggle }: FAQTabProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, 'helpful' | 'not_helpful' | 'submitting' | 'error'>>({});
  const [errorRetryHelpful, setErrorRetryHelpful] = useState<Record<string, boolean>>({});

  const handleFaqFeedback = useCallback(async (faqId: string, helpful: boolean) => {
    setFeedbackState((prev) => ({ ...prev, [faqId]: 'submitting' }));
    try {
      await submitFaqFeedback(faqId, helpful);
      setFeedbackState((prev) => ({ ...prev, [faqId]: helpful ? 'helpful' : 'not_helpful' }));
    } catch {
      setFeedbackState((prev) => ({ ...prev, [faqId]: 'error' }));
      setErrorRetryHelpful((prev) => ({ ...prev, [faqId]: helpful }));
    }
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const faq of faqs) {
      if (faq.category) cats.add(faq.category);
    }
    return Array.from(cats).sort();
  }, [faqs]);

  const filtered = useMemo(() => {
    let result = faqs;
    if (activeCategory) {
      result = result.filter((f) => f.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q),
      );
    }
    return result;
  }, [faqs, search, activeCategory]);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <input
          className="portal-form-input"
          type="text"
          placeholder="Search FAQs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: categories.length > 0 ? '12px' : '0' }}
        />
        {categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              className="portal-chip"
              data-active={activeCategory === null}
              onClick={() => setActiveCategory(null)}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className="portal-chip"
                data-active={activeCategory === cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
        )}
      </div>
      {filtered.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--portal-text-tertiary)' }}>
          {search || activeCategory ? 'No matching FAQs found.' : 'No FAQs available for this product yet.'}
        </p>
      )}
      {filtered.map((item, i) => (
        <div
          key={item.id}
          className="portal-faq-item"
          onClick={() => onToggle(i)}
        >
          <div className="portal-faq-question">
            <span style={{ flex: 1 }}>{item.question}</span>
            {item.category && (
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--portal-font-mono)',
                color: 'var(--portal-text-muted)',
                background: 'var(--portal-sand, var(--portal-bg-warm))',
                padding: '2px 8px',
                borderRadius: 'var(--portal-radius-sm)',
                marginRight: '8px',
                flexShrink: 0,
              }}>
                {CATEGORY_LABELS[item.category] ?? item.category}
              </span>
            )}
            <span style={{ transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(180deg)' : 'none', color: 'var(--portal-text-muted)', flexShrink: 0 }}>▾</span>
          </div>
          {openFaq === i && (
            <div className="portal-faq-answer">
              {item.answer}
              <FaqFeedbackBar faqId={item.id} state={feedbackState[item.id]} retryHelpful={errorRetryHelpful[item.id]} onFeedback={handleFaqFeedback} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FaqFeedbackBar({ faqId, state, retryHelpful, onFeedback }: {
  faqId: string;
  state?: 'helpful' | 'not_helpful' | 'submitting' | 'error';
  retryHelpful?: boolean;
  onFeedback: (faqId: string, helpful: boolean) => void;
}) {
  if (!isLoggedIn()) return null;

  if (state === 'helpful') {
    return (
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--portal-accent)', fontFamily: 'var(--portal-font-mono)' }}>
        ✓ Thanks for your feedback!
      </div>
    );
  }
  if (state === 'not_helpful') {
    return (
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--portal-text-muted)', fontFamily: 'var(--portal-font-mono)' }}>
        ✓ We'll work on improving this answer.
      </div>
    );
  }

  const disabled = state === 'submitting';

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--portal-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--portal-text-muted)', fontFamily: 'var(--portal-font-mono)' }}>
        Was this helpful?
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onFeedback(faqId, true); }}
        disabled={disabled}
        style={{
          background: 'none', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-sm)',
          padding: '4px 10px', fontSize: 12, cursor: disabled ? 'wait' : 'pointer',
          color: 'var(--portal-text-secondary)', opacity: disabled ? 0.5 : 1,
        }}
      >
        👍 Yes
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onFeedback(faqId, false); }}
        disabled={disabled}
        style={{
          background: 'none', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-sm)',
          padding: '4px 10px', fontSize: 12, cursor: disabled ? 'wait' : 'pointer',
          color: 'var(--portal-text-secondary)', opacity: disabled ? 0.5 : 1,
        }}
      >
        👎 No
      </button>
      {state === 'error' && (
        <span style={{ fontSize: 11, color: 'var(--portal-danger)' }}>
          Failed —{' '}
          <button
            onClick={(e) => { e.stopPropagation(); onFeedback(faqId, retryHelpful ?? true); }}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--portal-accent)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            retry
          </button>
        </span>
      )}
    </div>
  );
}

function extractVideoId(url: string): { platform: 'youtube' | 'vimeo'; id: string } | null {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { platform: 'youtube', id: ytMatch[1] };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { platform: 'vimeo', id: vimeoMatch[1] };
  return null;
}

function isVideoUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

function VideoEmbed({ url, title }: { url: string; title: string }) {
  const video = extractVideoId(url);
  if (!video) return null;
  const src = video.platform === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${video.id}?rel=0`
    : `https://player.vimeo.com/video/${video.id}`;
  return (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 'var(--portal-radius-md)', marginBottom: '16px' }}>
      <iframe
        src={src}
        title={title}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

interface ManualTabProps {
  manuals: CommodityMedia[];
  language: string;
}

export function ManualTab({ manuals, language }: ManualTabProps) {
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  const pdfs = manuals.filter((m) => !isVideoUrl(m.url));
  const videos = manuals.filter((m) => isVideoUrl(m.url));

  return (
    <div>
      {manuals.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--portal-text-tertiary)' }}>No manuals or guides available yet.</p>
      )}

      {videos.length > 0 && (
        <div style={{ marginBottom: pdfs.length > 0 ? '28px' : '0' }}>
          <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--portal-text-tertiary)', marginBottom: '12px' }}>
            Video Guides
          </div>
          {videos.map((m) => (
            <div key={m.id} style={{ marginBottom: '16px' }}>
              {expandedVideo === m.id ? (
                <>
                  <VideoEmbed url={m.url} title={m.title ?? m.type} />
                  <button
                    onClick={() => setExpandedVideo(null)}
                    style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--portal-accent)', fontFamily: 'var(--portal-font-mono)', cursor: 'pointer', padding: 0 }}
                  >
                    Collapse ▴
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setExpandedVideo(m.id)}
                  className="portal-manual-section"
                  style={{ cursor: 'pointer', width: '100%', textAlign: 'left', background: 'none', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-md)', padding: '16px' }}
                >
                  <div style={{ fontSize: '32px', flexShrink: 0 }}>🎬</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>{m.title ?? m.type}</div>
                    <div style={{ fontSize: '12px', color: 'var(--portal-text-tertiary)' }}>
                      {m.aiSummary ?? `${m.type} · ${m.duration ? `${Math.ceil(m.duration / 60)} min` : m.language ?? language}`}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--portal-accent)', fontFamily: 'var(--portal-font-mono)', flexShrink: 0 }}>▶ Play</div>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pdfs.length > 0 && (
        <div>
          {videos.length > 0 && (
            <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--portal-text-tertiary)', marginBottom: '12px' }}>
              Documents & Guides
            </div>
          )}
          {pdfs.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="portal-manual-section"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ fontSize: '32px', flexShrink: 0 }}>{getMediaIcon(m.type)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>{m.title ?? m.type}</div>
                <div style={{ fontSize: '12px', color: 'var(--portal-text-tertiary)' }}>
                  {m.aiSummary ?? `${m.type} · ${m.language ?? language}`}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--portal-accent)', fontFamily: 'var(--portal-font-mono)' }}>View ↗</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface RecipesTabProps {
  recipes: CommodityMedia[];
  productName: string;
  categoryCode?: string | null;
}

function getRecipeLabel(categoryCode?: string | null): { title: string; description: string } {
  const code = (categoryCode ?? '').toLowerCase();
  if (code.includes('kitchen') || code.includes('cook') || code.includes('chef') || code.includes('appliance')) {
    return {
      title: 'Recipes',
      description: 'Explore recipes optimised for your {name}. Cooking times are automatically calibrated for your model.',
    };
  }
  return {
    title: 'Tutorials & Demos',
    description: 'Step-by-step guides and demonstrations for getting the most out of your {name}.',
  };
}

export function RecipesTab({ recipes, productName, categoryCode }: RecipesTabProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const labels = getRecipeLabel(categoryCode);

  return (
    <div>
      <p style={{ fontSize: '13px', color: 'var(--portal-text-tertiary)', marginBottom: '24px', lineHeight: 1.8 }}>
        {labels.description.replace('{name}', productName)}
      </p>

      {playingId && (() => {
        const media = recipes.find((r) => r.id === playingId);
        if (!media) return null;
        return (
          <div style={{ marginBottom: '24px' }}>
            <VideoEmbed url={media.url} title={media.title ?? media.type} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{media.title ?? media.type}</span>
              <button
                onClick={() => setPlayingId(null)}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--portal-accent)', fontFamily: 'var(--portal-font-mono)', cursor: 'pointer' }}
              >
                Close ✕
              </button>
            </div>
          </div>
        );
      })()}

      <div className="portal-recipe-grid">
        {recipes.map((r) => {
          const hasVideo = isVideoUrl(r.url);
          const Wrapper = hasVideo ? 'button' : 'a';
          const wrapperProps = hasVideo
            ? { onClick: () => setPlayingId(r.id), type: 'button' as const }
            : { href: r.url, target: '_blank', rel: 'noopener noreferrer' };

          return (
            <Wrapper
              key={r.id}
              {...wrapperProps as Record<string, unknown>}
              className="portal-recipe-card"
              style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', background: 'none', border: '1px solid var(--portal-border)', textAlign: 'left', width: '100%' }}
            >
              <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', background: 'var(--portal-sand, var(--portal-bg-warm))', position: 'relative' }}>
                {hasVideo ? '▶' : '🥘'}
                {r.duration && (
                  <span style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    fontSize: '10px',
                    fontFamily: 'var(--portal-font-mono)',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: 'var(--portal-radius-sm)',
                  }}>
                    {Math.ceil(r.duration / 60)} min
                  </span>
                )}
              </div>
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{r.title ?? r.type}</div>
                <div style={{ fontSize: '11px', color: 'var(--portal-text-tertiary)', fontFamily: 'var(--portal-font-mono)' }}>
                  {r.aiSummary ?? (hasVideo ? 'Watch video' : 'View')}
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}

interface FeedbackTabProps {
  activeFeedbackType: number;
  onFeedbackTypeChange: (index: number) => void;
}

const FEEDBACK_TYPES = ['Bug Report', 'Feature Request', 'Design Feedback', 'New Product Idea', 'Safety Concern'];

export function FeedbackTab({ activeFeedbackType, onFeedbackTypeChange }: FeedbackTabProps) {
  return (
    <div>
      <p style={{ fontSize: '13px', color: 'var(--portal-text-tertiary)', lineHeight: 1.8, marginBottom: '28px' }}>
        Your ideas directly influence our next product generation. Every submission is reviewed by our product team.
      </p>
      <div style={{ maxWidth: '560px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label className="portal-form-label">Feedback Type</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {FEEDBACK_TYPES.map((type, i) => (
              <button
                key={type}
                className="portal-chip"
                data-active={activeFeedbackType === i}
                onClick={() => onFeedbackTypeChange(i)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label className="portal-form-label">Title</label>
          <input className="portal-form-input" type="text" placeholder="Summarise your idea or issue" />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label className="portal-form-label">Details</label>
          <textarea className="portal-form-textarea" placeholder="Tell us more — the more specific, the better..." style={{ height: '100px', resize: 'vertical' }} />
        </div>
        <button className="portal-btn-primary" style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }} disabled>
          <span>Submit Feedback (Coming Soon)</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}

export type { TabId };
