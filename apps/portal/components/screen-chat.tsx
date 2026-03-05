'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePortalTheme } from '@/lib/themes/portal-theme-context';
import { isLoggedIn } from '@/lib/auth';
import { useChatSSE, type SSEEvent } from '@/lib/use-chat-sse';
import {
  createCase,
  fetchMyCases,
  fetchCase,
  sendMessage,
  uploadMedia,
  escalateCase,
  submitCaseFeedback,
  type CaseMessage,
  type SupportCase,
} from '@/lib/portal-api-client';

interface DisplayMessage {
  id: string;
  role: 'consumer' | 'agent' | 'system';
  content: string;
  contentType: string;
  mediaAnalysis?: Record<string, unknown>;
  streaming?: boolean;
  timestamp: string;
}

interface QuickIssue {
  icon: string;
  label: string;
  issueType: string;
}

const QUICK_ISSUES: QuickIssue[] = [
  { icon: '🔊', label: 'Strange noise', issueType: 'noise' },
  { icon: '🔄', label: 'Warranty replacement', issueType: 'warranty' },
  { icon: '⚠️', label: 'Error code', issueType: 'error_code' },
  { icon: '⚡', label: 'Not turning on', issueType: 'power' },
  { icon: '📦', label: 'Return request', issueType: 'return' },
];

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MediaAnalysisCard({ analysis }: { analysis: Record<string, unknown> }) {
  const severity = analysis.severity as string | undefined;
  const observations = analysis.observations as string[] | undefined;
  const recommendation = analysis.recommendation as string | undefined;
  const damageType = analysis.damageType as string | undefined;
  const issueType = analysis.issueType as string | undefined;

  return (
    <div style={{
      marginTop: 8,
      background: 'color-mix(in srgb, var(--portal-info, #3b82f6) 8%, transparent)',
      border: '1px solid var(--portal-border)',
      borderRadius: 'var(--portal-radius-lg)',
      padding: 12,
    }}>
      <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--portal-info, #3b82f6)', marginBottom: 8 }}>
        AI Media Analysis
      </div>
      {(damageType || issueType) && (
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          {damageType ?? issueType}
          {severity && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: severity === 'critical' || severity === 'high' ? 'color-mix(in srgb, var(--portal-danger, red) 15%, transparent)' : 'color-mix(in srgb, var(--portal-warning, orange) 15%, transparent)', color: severity === 'critical' || severity === 'high' ? 'var(--portal-danger, red)' : 'var(--portal-warning, orange)' }}>{severity}</span>}
        </div>
      )}
      {observations && observations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {observations.map((obs, i) => (
            <span key={i} className="portal-media-tag" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'var(--portal-bg-warm, #f5f5f5)', border: '1px solid var(--portal-border)' }}>{obs}</span>
          ))}
        </div>
      )}
      {recommendation && (
        <div style={{ fontSize: 11, color: 'var(--portal-text-secondary)', marginTop: 8, fontStyle: 'italic' }}>{recommendation}</div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 12px' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--portal-text-tertiary)',
          animation: `typing-dot 1.4s infinite ${i * 0.2}s`,
          opacity: 0.4,
        }} />
      ))}
      <style>{`@keyframes typing-dot { 0%, 60%, 100% { opacity: 0.4; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }`}</style>
    </div>
  );
}

export function ScreenChat() {
  const { brandName } = usePortalTheme();
  const [authenticated, setAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caseList, setCaseList] = useState<SupportCase[]>([]);
  const [showCaseList, setShowCaseList] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackPending, setFeedbackPending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingContentRef = useRef('');
  const streamThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStreamUpdate = useRef(false);

  const commodityId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('commodity');
  }, []);

  useEffect(() => {
    setAuthenticated(isLoggedIn());
    setHydrated(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'typing':
        setTyping(true);
        break;

      case 'message': {
        const { delta, role, contentType, mediaAnalysisId, analysisResult } = event.data as {
          delta?: string;
          role?: string;
          contentType?: string;
          mediaAnalysisId?: string;
          analysisResult?: Record<string, unknown>;
        };

        if (contentType === 'media_ref' && analysisResult) {
          setMessages((prev) => [
            ...prev,
            {
              id: mediaAnalysisId ?? Date.now().toString(),
              role: 'agent',
              content: 'Media analysis complete:',
              contentType: 'media_ref',
              mediaAnalysis: analysisResult,
              timestamp: new Date().toISOString(),
            },
          ]);
          setTyping(false);
          return;
        }

        if (delta && role === 'agent') {
          streamingContentRef.current += delta;
          pendingStreamUpdate.current = true;

          if (!streamThrottleRef.current) {
            const flush = () => {
              if (!pendingStreamUpdate.current) {
                streamThrottleRef.current = null;
                return;
              }
              pendingStreamUpdate.current = false;
              const currentContent = streamingContentRef.current;

              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.streaming && last.role === 'agent') {
                  return [...prev.slice(0, -1), { ...last, content: currentContent }];
                }
                return [
                  ...prev,
                  {
                    id: `stream-${Date.now()}`,
                    role: 'agent',
                    content: currentContent,
                    contentType: 'text',
                    streaming: true,
                    timestamp: new Date().toISOString(),
                  },
                ];
              });
              setTyping(false);

              streamThrottleRef.current = setTimeout(flush, 50);
            };
            flush();
          }
        }
        break;
      }

      case 'done': {
        const { messageId, escalated: isEscalated } = event.data as { messageId?: string; escalated?: boolean };
        streamingContentRef.current = '';

        setMessages((prev) =>
          prev.map((m) =>
            m.streaming ? { ...m, streaming: false, id: messageId ?? m.id } : m,
          ),
        );
        setTyping(false);
        if (isEscalated) setEscalated(true);
        break;
      }

      case 'escalation': {
        setEscalated(true);
        setTyping(false);
        const { reason } = event.data as { reason?: string };
        setMessages((prev) => [
          ...prev,
          {
            id: `esc-${Date.now()}`,
            role: 'system',
            content: reason === 'agent_error'
              ? 'An error occurred. Connecting you with a human agent...'
              : 'This conversation has been escalated to a human support agent.',
            contentType: 'text',
            timestamp: new Date().toISOString(),
          },
        ]);
        break;
      }
    }
  }, []);

  const { connected } = useChatSSE({
    caseId: activeCaseId,
    onEvent: handleSSEEvent,
  });

  async function startNewCase(description: string, issueType?: string) {
    if (!commodityId || !authenticated) return;
    setSending(true);
    try {
      const result = await createCase({
        commodityId,
        description,
        issueType,
      });
      setActiveCaseId(result.case.id);
      setMessages([{
        id: Date.now().toString(),
        role: 'consumer',
        content: description,
        contentType: 'text',
        timestamp: new Date().toISOString(),
      }]);
      setEscalated(false);
    } catch (err) {
      console.error('Failed to create case:', err);
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || sending) return;

    const text = input.trim();
    setInput('');

    if (text.toLowerCase() === '/help') {
      setMessages((prev) => [
        ...prev,
        {
          id: `help-${Date.now()}`,
          role: 'system',
          content: [
            '🤖 **I can help you with:**',
            '• Answer product questions from our knowledge base',
            '• Check your warranty status and coverage',
            '• Analyze product photos/videos for damage assessment',
            '• Help with returns, repairs, and replacements',
            '• Provide step-by-step troubleshooting',
            '• Escalate to a human agent when needed',
            '',
            'Just describe your issue or type a question!',
          ].join('\n'),
          contentType: 'text',
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    if (!activeCaseId) {
      await startNewCase(text);
      return;
    }

    setSending(true);
    try {
      const result = await sendMessage(activeCaseId, text);
      setMessages((prev) => [
        ...prev,
        {
          id: result.message.id,
          role: 'consumer',
          content: text,
          contentType: 'text',
          timestamp: result.message.createdAt,
        },
      ]);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }

  async function handleQuickIssue(qi: QuickIssue) {
    const description = `I need help with: ${qi.label}`;
    await startNewCase(description, qi.issueType);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeCaseId) return;

    if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
      alert('Unsupported file type. Please upload JPEG, PNG, WebP images or MP4/WebM videos.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    setUploading(true);
    try {
      setMessages((prev) => [
        ...prev,
        {
          id: `upload-${Date.now()}`,
          role: 'consumer',
          content: `📎 Uploaded ${file.type.startsWith('video/') ? 'video' : 'image'}: ${file.name}`,
          contentType: file.type.startsWith('video/') ? 'video' : 'image',
          timestamp: new Date().toISOString(),
        },
      ]);
      await uploadMedia(activeCaseId, file);
    } catch (err) {
      console.error('Failed to upload media:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleEscalate() {
    if (!activeCaseId) return;
    try {
      await escalateCase(activeCaseId);
      setEscalated(true);
    } catch (err) {
      console.error('Failed to escalate:', err);
    }
  }

  async function handleCaseFeedback(resolved: boolean) {
    if (!activeCaseId || feedbackSubmitted || feedbackPending) return;
    setFeedbackPending(true);
    try {
      await submitCaseFeedback(activeCaseId, resolved);
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setFeedbackPending(false);
    }
  }

  async function loadExistingCase(caseId: string) {
    try {
      const result = await fetchCase(caseId);
      setActiveCaseId(result.case.id);
      setEscalated(result.case.status === 'human_escalated');
      setMessages(
        (result.case.messages ?? []).map((m: CaseMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          contentType: m.contentType,
          mediaAnalysis: m.contentType === 'media_ref' && m.metadata ? (m.metadata as Record<string, unknown>).analysisResult as Record<string, unknown> : undefined,
          timestamp: m.createdAt,
        })),
      );
      setShowCaseList(false);
    } catch (err) {
      console.error('Failed to load case:', err);
    }
  }

  async function loadCaseList() {
    try {
      const result = await fetchMyCases();
      setCaseList(result.cases);
      setShowCaseList(true);
    } catch (err) {
      console.error('Failed to load cases:', err);
    }
  }

  if (!hydrated) return null;

  if (!authenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>💬</div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Please sign in to access support chat</div>
        <a href="/warranty" style={{ color: 'var(--portal-accent)', fontSize: 13 }}>Sign in via Warranty Registration →</a>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_MEDIA_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      <div className="portal-chat-layout">
        {/* Sidebar */}
        <div className="portal-chat-sidebar">
          <div className="portal-agent-status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className="portal-agent-dot" style={{ background: connected ? 'var(--portal-success, #22c55e)' : 'var(--portal-text-tertiary)' }} />
              <div style={{ fontSize: 12, letterSpacing: 1 }}>{brandName} AI · {connected ? 'Connected' : 'Offline'}</div>
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.6 }}>
              Agent-native support. I handle most issues instantly. Complex cases are escalated to a specialist with full context.
            </div>
          </div>

          {!activeCaseId && (
            <div>
              <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: 9, letterSpacing: 2, color: 'var(--portal-text-tertiary)', textTransform: 'uppercase' as const, marginBottom: 10 }}>Quick Issues</div>
              {QUICK_ISSUES.map((qi) => (
                <button
                  key={qi.label}
                  onClick={() => handleQuickIssue(qi)}
                  disabled={sending || !commodityId}
                  style={{
                    display: 'block', width: '100%', background: 'transparent',
                    border: '1px solid var(--portal-border)', padding: '10px 14px',
                    marginBottom: 6, textAlign: 'left', fontFamily: 'var(--portal-font-body)',
                    fontSize: 12, color: 'var(--portal-text-secondary)', cursor: 'pointer',
                    borderRadius: 'var(--portal-radius-md)', transition: 'all 0.2s',
                    opacity: sending || !commodityId ? 0.5 : 1,
                  }}
                >
                  {qi.icon} {qi.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={loadCaseList}
            style={{
              marginTop: 16, width: '100%', padding: '10px 14px',
              background: 'var(--portal-bg-card, var(--portal-bg))', border: '1px solid var(--portal-border)',
              borderRadius: 'var(--portal-radius-md)', cursor: 'pointer',
              fontSize: 12, color: 'var(--portal-text-secondary)', fontFamily: 'var(--portal-font-body)',
            }}
          >
            📋 My Support Cases
          </button>

          {showCaseList && caseList.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {caseList.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadExistingCase(c.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', marginBottom: 4, fontSize: 11,
                    background: c.id === activeCaseId ? 'color-mix(in srgb, var(--portal-accent, #007aff) 10%, transparent)' : 'transparent',
                    border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-sm)',
                    cursor: 'pointer', fontFamily: 'var(--portal-font-body)',
                    color: 'var(--portal-text-secondary)',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 11 }}>{c.issueType ?? 'Support Case'}</div>
                  <div style={{ fontSize: 10, color: 'var(--portal-text-tertiary)', marginTop: 2 }}>
                    {c.status} · {c._count?.messages ?? 0} msgs
                  </div>
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <div className="portal-mcp-badge">
              <div className="portal-agent-dot" />
              Agent API · MCP Available
            </div>
            <div style={{ fontSize: 10, color: 'var(--portal-text-muted)', marginTop: 8, lineHeight: 1.6, fontFamily: 'var(--portal-font-mono)' }}>
              Connect your AI assistant to handle support on your behalf
            </div>
          </div>
        </div>

        {/* Chat Main */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--portal-border)', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--portal-bg)' }}>
            <div style={{ fontSize: 24 }}>💬</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                Support Chat{activeCaseId ? '' : ' — New Conversation'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--portal-text-tertiary)', fontFamily: 'var(--portal-font-mono)' }}>
                {escalated ? 'Escalated to human agent' : 'AI Agent · Avg response <5 sec · Human escalation available'}
              </div>
            </div>
            {activeCaseId && !escalated && (
              <button
                onClick={handleEscalate}
                style={{
                  marginLeft: 'auto', fontSize: 10, letterSpacing: 1,
                  textTransform: 'uppercase' as const, color: 'var(--portal-text-tertiary)',
                  cursor: 'pointer', background: 'transparent',
                  border: '1px solid var(--portal-stone, var(--portal-border))',
                  padding: '6px 14px', borderRadius: 'var(--portal-radius-sm)',
                  fontFamily: 'var(--portal-font-body)',
                }}
              >
                Request Human
              </button>
            )}
            {escalated && (
              <div style={{
                marginLeft: 'auto', fontSize: 10, letterSpacing: 1,
                textTransform: 'uppercase' as const, padding: '6px 14px',
                borderRadius: 'var(--portal-radius-sm)',
                background: 'color-mix(in srgb, var(--portal-warning, orange) 15%, transparent)',
                color: 'var(--portal-warning, orange)', fontWeight: 600,
              }}>
                Human Agent Assigned
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.length === 0 && !activeCaseId && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--portal-text-tertiary)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>How can I help you today?</div>
                <div style={{ fontSize: 12 }}>
                  {commodityId
                    ? 'Type a message or select a quick issue from the sidebar.'
                    : 'Please navigate from a product page to start a support chat.'}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex', gap: 12, maxWidth: '80%',
                  alignSelf: msg.role === 'consumer' ? 'flex-end' : 'flex-start',
                  flexDirection: msg.role === 'consumer' ? 'row-reverse' : 'row',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                  background: msg.role === 'consumer' ? 'var(--portal-sand, #e5e5e5)' : msg.role === 'agent' ? 'var(--portal-text-primary)' : 'var(--portal-warning, orange)',
                }}>
                  {msg.role === 'consumer' ? '👤' : msg.role === 'agent' ? '🤖' : '⚡'}
                </div>
                <div>
                  <div
                    className={msg.role === 'consumer' ? 'portal-msg-bubble portal-msg-bubble--user' : 'portal-msg-bubble'}
                    style={{ whiteSpace: 'pre-line' }}
                  >
                    {msg.content}
                    {msg.streaming && <span style={{ opacity: 0.5 }}>▊</span>}
                    {msg.mediaAnalysis && <MediaAnalysisCard analysis={msg.mediaAnalysis} />}
                  </div>
                  <div className="portal-msg-meta" style={{ textAlign: msg.role === 'consumer' ? 'right' : 'left' }}>
                    {msg.role === 'consumer' ? 'You' : msg.role === 'agent' ? 'Agent' : 'System'} · {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {typing && (
              <div style={{ display: 'flex', gap: 12, alignSelf: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'var(--portal-text-primary)' }}>🤖</div>
                <div className="portal-msg-bubble">
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Case Feedback Prompt */}
          {activeCaseId && messages.length >= 2 && !typing && !feedbackSubmitted && (
            <div style={{
              padding: '12px 32px', borderTop: '1px solid var(--portal-border)',
              background: 'var(--portal-bg-warm, #fafafa)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 12, color: 'var(--portal-text-secondary)', fontFamily: 'var(--portal-font-body)' }}>
                Was your issue resolved?
              </span>
              <button
                onClick={() => handleCaseFeedback(true)}
                disabled={feedbackPending}
                style={{
                  padding: '6px 16px', fontSize: 13, border: '1px solid var(--portal-border)',
                  borderRadius: 3, cursor: feedbackPending ? 'not-allowed' : 'pointer',
                  background: 'var(--portal-bg)', fontFamily: 'var(--portal-font-body)',
                }}
              >
                👍 Yes
              </button>
              <button
                onClick={() => handleCaseFeedback(false)}
                disabled={feedbackPending}
                style={{
                  padding: '6px 16px', fontSize: 13, border: '1px solid var(--portal-border)',
                  borderRadius: 3, cursor: feedbackPending ? 'not-allowed' : 'pointer',
                  background: 'var(--portal-bg)', fontFamily: 'var(--portal-font-body)',
                }}
              >
                👎 No
              </button>
            </div>
          )}
          {feedbackSubmitted && (
            <div style={{
              padding: '10px 32px', borderTop: '1px solid var(--portal-border)',
              background: 'var(--portal-bg-warm, #fafafa)', textAlign: 'center',
              fontSize: 12, color: 'var(--portal-text-secondary)', fontFamily: 'var(--portal-font-body)',
            }}>
              Thank you for your feedback!
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '20px 32px', borderTop: '1px solid var(--portal-border)', background: 'var(--portal-bg)' }}>
            {activeCaseId && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    background: 'var(--portal-bg-warm, #f5f5f5)', border: '1px solid var(--portal-border)',
                    padding: '6px 14px', fontSize: 11, color: 'var(--portal-text-tertiary)',
                    cursor: uploading ? 'not-allowed' : 'pointer', borderRadius: 3,
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'var(--portal-font-body)', opacity: uploading ? 0.5 : 1,
                  }}
                >
                  {uploading ? '⏳ Uploading...' : '📷 Photo/Video'}
                </button>
              </div>
            )}
            <div className="portal-chat-input" style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={activeCaseId ? 'Type your message...' : commodityId ? 'Describe your issue to start a support chat...' : 'Navigate from a product page to start'}
                rows={1}
                disabled={!commodityId && !activeCaseId}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim() || (!commodityId && !activeCaseId)}
                style={{
                  background: 'var(--portal-text-primary)', color: 'var(--portal-bg)',
                  border: 'none', width: 48, height: 48,
                  borderRadius: 'var(--portal-radius-md)', cursor: 'pointer',
                  fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: sending || !input.trim() ? 0.5 : 1,
                }}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
