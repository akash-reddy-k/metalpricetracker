import React, { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';

interface AdSlotProps {
  id: string;
  type: 'banner' | 'sidebar';
  title?: string;
  link?: string;
  description?: string;
  sponsor?: string;
}

export const AdSlot: React.FC<AdSlotProps> = ({
  id,
  type,
  title = 'Direct Gold Custody Vaults',
  link = 'https://www.google.com',
  description = 'Secure physical gold bar storage in zero-tax zones with free shipping.',
  sponsor = 'BullionVault Inc.',
}) => {
  const [closed, setClosed] = useState(false);

  if (closed) return null;

  if (type === 'banner') {
    return (
      <div id={id} className="metal-card ad-banner-container">
        <div className="ad-banner-content">
          <div
            style={{
              fontSize: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--gold)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Sponsor
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h4 style={{ fontSize: '14px', margin: 0, color: '#fff', fontWeight: '600' }}>
              {title}
            </h4>
            <p style={{ fontSize: '12px', margin: 0, color: 'var(--text-secondary)' }}>
              {description} • <span style={{ color: 'var(--text-muted)' }}>{sponsor}</span>
            </p>
          </div>
        </div>

        <div className="ad-banner-actions">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: '600',
              color: 'var(--gold)',
              textDecoration: 'none',
              background: 'rgba(245, 158, 11, 0.08)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(245, 158, 11, 0.2)',
            }}
          >
            Visit Site <ExternalLink size={12} />
          </a>
          <button
            onClick={() => setClosed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
            title="Dismiss ad"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Sidebar layout
  return (
    <div
      id={id}
      className="metal-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        border: '2px solid var(--border-color)',
        background: 'var(--bg-card)',
        borderRadius: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '9px',
            color: 'var(--text-muted)',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          Sponsored Link
        </span>
        <button
          onClick={() => setClosed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <X size={12} />
        </button>
      </div>

      <div>
        <h4
          style={{
            fontSize: '13px',
            margin: '0 0 4px 0',
            color: 'var(--text-primary)',
            fontWeight: '600',
          }}
        >
          {title}
        </h4>
        <p
          style={{ fontSize: '11px', margin: 0, color: 'var(--text-secondary)', lineHeight: '1.4' }}
        >
          {description}
        </p>
      </div>

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '11px',
          fontWeight: '600',
          color: '#fff',
          textDecoration: 'none',
          background: 'var(--accent)',
          padding: '8px',
          borderRadius: '6px',
          textAlign: 'center',
        }}
      >
        Learn More <ExternalLink size={12} />
      </a>
    </div>
  );
};
