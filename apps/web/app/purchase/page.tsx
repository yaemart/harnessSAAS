'use client';

import { useState } from 'react';
import {
  Truck, Package, Calendar, Upload, MessageSquare, FileText, Clock,
} from 'lucide-react';
import { useAuth } from '../../components/auth-context';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';

type POStatus = 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  productName: string;
  productSpec: string;
  quantity: number;
  status: POStatus;
  expectedDate: string;
  qualityReqs: string;
}

const STATUS_COLORS: Record<POStatus, string> = {
  Pending: 'var(--warning)',
  Confirmed: 'var(--accent)',
  Shipped: 'var(--success)',
  Delivered: 'var(--success)',
};

const MOCK_ORDERS: PurchaseOrder[] = [
  { id: '1', poNumber: 'PO-2026-0041', productName: 'Wireless Noise-Cancelling Headphones', productSpec: 'BT 5.3, ANC, 40h battery, USB-C', quantity: 2000, status: 'Shipped', expectedDate: '2026-03-08', qualityReqs: 'CE/FCC certified' },
  { id: '2', poNumber: 'PO-2026-0042', productName: 'Premium Yoga Mat Set', productSpec: 'TPE 6mm, non-slip, carry strap', quantity: 1500, status: 'Confirmed', expectedDate: '2026-03-15', qualityReqs: 'SGS tested' },
  { id: '3', poNumber: 'PO-2026-0043', productName: 'Smart LED Desk Lamp', productSpec: '5 color temps, USB port, touch control', quantity: 3000, status: 'Pending', expectedDate: '2026-03-22', qualityReqs: 'CE/UL certified' },
  { id: '4', poNumber: 'PO-2026-0044', productName: 'Organic Face Serum 30ml', productSpec: 'Vitamin C 15%, hyaluronic acid', quantity: 5000, status: 'Delivered', expectedDate: '2026-02-28', qualityReqs: 'FDA registered' },
  { id: '5', poNumber: 'PO-2026-0045', productName: 'Stainless Steel Water Bottle', productSpec: '750ml, vacuum insulated, BPA-free', quantity: 2500, status: 'Pending', expectedDate: '2026-03-30', qualityReqs: 'FDA/LFGB' },
];

const STATUS_FILTERS: (POStatus | 'All')[] = ['All', 'Pending', 'Confirmed', 'Shipped', 'Delivered'];

export default function PurchasePage() {
  const { hasRole } = useAuth();
  const [statusFilter, setStatusFilter] = useState<POStatus | 'All'>('All');
  const isSupplier = hasRole('supplier');

  const filtered = statusFilter === 'All'
    ? MOCK_ORDERS
    : MOCK_ORDERS.filter((o) => o.status === statusFilter);

  return (
    <RoleGuard allowedRoles={['tenant_admin', 'supplier']}>
    <main>
      <IronLawBanner />
      <div className="header">
        <div>
          <h1 className="ios-title">{isSupplier ? 'Supplier Portal' : 'Purchase Orders'}</h1>
          <p className="ios-subtitle">
            {isSupplier
              ? 'View requirements, submit quotes, and track orders · Layer 1 Foundation'
              : 'Track supplier purchase orders and delivery status'}
          </p>
        </div>
      </div>

      {/* Status Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: tintedBg('var(--panel-bg-secondary)', 50), padding: 4, borderRadius: '999px', width: 'fit-content' }}>
        {STATUS_FILTERS.map((status) => {
          const active = statusFilter === status;
          const color = status === 'All' ? 'var(--accent)' : STATUS_COLORS[status];
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '8px 18px', borderRadius: '999px', border: 'none',
                background: active ? tintedBg(color, 18) : 'transparent',
                color: active ? color : 'var(--text-secondary)',
                fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >{status}</button>
          );
        })}
      </div>

      {/* Order Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
        {filtered.map((order) => {
          const statusColor = STATUS_COLORS[order.status];
          return (
            <div key={order.id} className="ios-card" style={{ padding: 20 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.02em' }}>{order.poNumber}</span>
                <span style={{
                  padding: '3px 10px', borderRadius: '999px',
                  background: tintedBg(statusColor, 15), color: statusColor,
                  fontSize: 10, fontWeight: 700,
                }}>{order.status}</span>
              </div>

              {/* Product Name */}
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>{order.productName}</h3>

              {/* Spec & Quality */}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                <div>Spec: {order.productSpec}</div>
                <div>Quality: {order.qualityReqs}</div>
              </div>

              {/* Details */}
              <div style={{
                display: 'flex', gap: 16, padding: 12,
                background: tintedBg('var(--panel-bg-secondary)', 50),
                borderRadius: 'var(--border-radius-md)',
                marginBottom: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Package size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Qty</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{order.quantity.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expected</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{order.expectedDate}</div>
                  </div>
                </div>
              </div>

              {/* Supplier actions (only for supplier role) */}
              {isSupplier && order.status === 'Pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{
                    flex: 1, padding: '8px 12px', borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--success)', color: '#fff', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    minHeight: 44,
                  }}>
                    <FileText size={14} /> Submit Quote
                  </button>
                  <button style={{
                    padding: '8px 12px', borderRadius: 'var(--border-radius-sm)',
                    background: tintedBg('var(--accent)', 15), color: 'var(--accent)', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                    minHeight: 44,
                  }}>
                    <MessageSquare size={14} /> Message
                  </button>
                </div>
              )}

              {isSupplier && (order.status === 'Confirmed' || order.status === 'Shipped') && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{
                    flex: 1, padding: '8px 12px', borderRadius: 'var(--border-radius-sm)',
                    background: tintedBg('var(--accent)', 15), color: 'var(--accent)', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    minHeight: 44,
                  }}>
                    <Clock size={14} /> Update Progress
                  </button>
                  <button style={{
                    padding: '8px 12px', borderRadius: 'var(--border-radius-sm)',
                    background: tintedBg('var(--warning)', 15), color: 'var(--warning)', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                    minHeight: 44,
                  }}>
                    <Upload size={14} /> Upload QC
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="ios-card" style={{ padding: 48, textAlign: 'center' }}>
          <Truck size={40} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No purchase orders match this filter.</p>
        </div>
      )}
    </main>
    </RoleGuard>
  );
}
