'use client';

import { useState, useMemo, type FormEvent } from 'react';
import { registerWarranty, PortalClientError, type WarrantyRecord } from '@/lib/portal-api-client';

interface WarrantyFormProps {
  commodityId?: string;
  onSuccess: (warranty: WarrantyRecord) => void;
}

const PURCHASE_CHANNELS = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'official', label: 'Official Website' },
  { value: 'retail', label: 'Retail Store' },
  { value: 'other', label: 'Other Online Platform' },
];

export function WarrantyForm({ commodityId, onSuccess }: WarrantyFormProps) {
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseChannel, setPurchaseChannel] = useState('amazon');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!serialNumber.trim() || !purchaseDate || !commodityId) return;

    setError('');
    setLoading(true);
    try {
      const result = await registerWarranty({
        commodityId,
        serialNumber: serialNumber.trim(),
        purchaseDate,
        purchaseChannel,
      });
      onSuccess(result.warranty);
    } catch (err) {
      if (err instanceof PortalClientError) {
        setError(err.message);
      } else {
        setError('Failed to register warranty');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '20px' }}>
        <label className="portal-form-label">Serial Number</label>
        <input
          className="portal-form-input"
          type="text"
          placeholder="e.g. NV-X3-2024-XXXXXX"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          required
          autoFocus
          style={{ fontFamily: 'var(--portal-font-mono)' }}
        />
        <div style={{ fontSize: '11px', color: 'var(--portal-text-tertiary)', marginTop: '6px' }}>
          Found on the bottom of your product or inside the box
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label className="portal-form-label">Purchase Date</label>
        <input
          className="portal-form-input"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          max={today}
          required
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label className="portal-form-label">Where did you buy it?</label>
        <select
          className="portal-form-select"
          value={purchaseChannel}
          onChange={(e) => setPurchaseChannel(e.target.value)}
        >
          {PURCHASE_CHANNELS.map((ch) => (
            <option key={ch.value} value={ch.value}>{ch.label}</option>
          ))}
        </select>
      </div>

      {!commodityId && (
        <div style={{ fontSize: '12px', color: 'var(--portal-warning)', marginBottom: '16px' }}>
          Please navigate from a product page to register warranty for a specific product.
        </div>
      )}

      {error && (
        <div style={{ fontSize: '12px', color: 'var(--portal-danger)', marginBottom: '16px' }}>{error}</div>
      )}

      <button
        type="submit"
        className="portal-btn-primary"
        style={{ width: '100%' }}
        disabled={loading || !serialNumber.trim() || !purchaseDate || !commodityId}
      >
        <span>{loading ? 'Registering...' : 'Activate Warranty'}</span>
        <span>→</span>
      </button>

      <div className="portal-mcp-badge" style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}>
        <div className="portal-agent-dot" />
        Your AI agent can also register on your behalf via MCP
      </div>
    </form>
  );
}
