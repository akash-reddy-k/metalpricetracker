import React from 'react';
import { INVESTMENT_TIPS } from '../data/content';
import { Lightbulb } from 'lucide-react';

const METAL_TAG: Record<string, { label: string; color: string }> = {
  general: { label: 'Basics', color: '#8b5cf6' },
  gold: { label: 'Gold', color: '#EAB308' },
  silver: { label: 'Silver', color: '#9CA3AF' },
  platinum: { label: 'Platinum', color: '#38BDF8' },
  palladium: { label: 'Palladium', color: '#A78BFA' },
};

export const TipsSection: React.FC = () => {
  return (
    <div id="investment-tips" className="tips-panel card-panel">
      <div className="panel-title">
        <Lightbulb size={20} className="glow-purple-text" />
        <h2>How Precious-Metal Investing Works</h2>
      </div>
      <p className="panel-subtitle">
        Quick primers on pricing, purity, and strategy before you buy.
      </p>

      <div className="tips-grid">
        {INVESTMENT_TIPS.map((tip, idx) => {
          const tag = METAL_TAG[tip.metal] ?? METAL_TAG.general;
          return (
            <div key={idx} className="tip-card">
              <span
                className="tip-tag"
                style={{ color: tag.color, borderColor: `${tag.color}40`, background: `${tag.color}12` }}
              >
                {tag.label}
              </span>
              <h3>{tip.title}</h3>
              <p>{tip.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
