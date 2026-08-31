import React from 'react';
import type { MetalType, WeightUnit } from '../types/metals';
import { Award, Gem, ShoppingBag } from 'lucide-react';

interface ShowcaseItem {
  id: string;
  name: string;
  metal: MetalType;
  purityIndex: number; // Index in purity options
  weight: number;
  weightUnit: WeightUnit;
  productType: 'bullion' | 'jewellery';
  description: string;
  image: string;
}

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  // Investment Bullion Items
  {
    id: 'gold-bar-1oz',
    name: '1 oz Gold Kangaroo Mint Bar',
    metal: 'gold',
    purityIndex: 0, // 24K
    weight: 1,
    weightUnit: 'oz',
    productType: 'bullion',
    description: 'Highly liquid investment grade Australian bullion bar with certicard.',
    image:
      'https://images.unsplash.com/photo-1610374792793-f016b77ca0d6?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'silver-bar-1kg',
    name: '1 Kilo Silver Cast Bar (99.9%)',
    metal: 'silver',
    purityIndex: 0, // Fine
    weight: 1,
    weightUnit: 'kg',
    productType: 'bullion',
    description: 'Bulk investment-grade cast bar, ideal for stackers and raw metal storage.',
    image:
      'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'gold-tola-10g',
    name: '1 Tola Gold Minted Bar (10g)',
    metal: 'gold',
    purityIndex: 0, // 24K
    weight: 1,
    weightUnit: 'tola',
    productType: 'bullion',
    description: 'Traditional metric gold bar, standard across South Asia and Middle East.',
    image:
      'https://images.unsplash.com/photo-1589758438368-0ad531db3366?auto=format&fit=crop&w=400&q=80',
  },
  // Jewellery Items
  {
    id: 'gold-necklace-22k',
    name: '22K Gold Handcrafted Bangle Band',
    metal: 'gold',
    purityIndex: 1, // 22K (91.6% crown gold)
    weight: 25,
    weightUnit: 'g',
    productType: 'jewellery',
    description: 'Elegant, traditional wedding jewelry with high metal purity.',
    image:
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'silver-bracelet-sterling',
    name: 'Sterling Silver Classic Curb Bracelet',
    metal: 'silver',
    purityIndex: 2, // Sterling 92.5%
    weight: 50,
    weightUnit: 'g',
    productType: 'jewellery',
    description: 'Highly polished premium 925 sterling silver everyday bracelet.',
    image:
      'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'gold-ring-18k',
    name: '18K Yellow Gold Diamond Eternity Band',
    metal: 'gold',
    purityIndex: 2, // 18K
    weight: 8,
    weightUnit: 'g',
    productType: 'jewellery',
    description: 'Modern luxury wedding band with high durability for daily wear.',
    image:
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=400&q=80',
  },
];

interface ShowcaseProps {
  onSelectItem: (item: {
    metal: MetalType;
    weight: number;
    weightUnit: WeightUnit;
    productType: 'bullion' | 'jewellery';
    purityIndex: number;
  }) => void;
}

export const Showcase: React.FC<ShowcaseProps> = ({ onSelectItem }) => {
  return (
    <div className="showcase-section" style={{ marginTop: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <ShoppingBag size={22} className="glow-purple-text" />
        <h2>Precious Products Catalog</h2>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Explore standard bullion items and jewelry styles. Click <strong>"Calculate Cost"</strong>{' '}
        to load an item directly into the calculator.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {/* Bullion Investment Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Award size={18} style={{ color: 'var(--gold)' }} />
            <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>
              Investment Bullion (Bars & Coins)
            </h3>
          </div>
          <div
            className="grid-showcase"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
            }}
          >
            {SHOWCASE_ITEMS.filter((i) => i.productType === 'bullion').map((item) => (
              <ShowcaseCard key={item.id} item={item} onSelect={onSelectItem} />
            ))}
          </div>
        </div>

        {/* Jewelry Retail Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Gem size={18} style={{ color: 'var(--platinum)' }} />
            <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>
              Retail Jewelry (Ornaments)
            </h3>
          </div>
          <div
            className="grid-showcase"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
            }}
          >
            {SHOWCASE_ITEMS.filter((i) => i.productType === 'jewellery').map((item) => (
              <ShowcaseCard key={item.id} item={item} onSelect={onSelectItem} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ShowcaseCard: React.FC<{ item: ShowcaseItem; onSelect: ShowcaseProps['onSelectItem'] }> = ({
  item,
  onSelect,
}) => {
  return (
    <div className="metal-card showcase-card-container">
      <img
        src={item.image}
        alt={item.name}
        style={{
          width: '80px',
          height: '80px',
          objectFit: 'cover',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      />
      <div
        style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}
      >
        <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0 }}>{item.name}</h4>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {item.weight} {item.weightUnit} • {item.metal.toUpperCase()}
        </span>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            margin: '4px 0 8px 0',
            lineHeight: '1.4',
          }}
        >
          {item.description}
        </p>
        <button
          onClick={() =>
            onSelect({
              metal: item.metal,
              weight: item.weight,
              weightUnit: item.weightUnit,
              productType: item.productType,
              purityIndex: item.purityIndex,
            })
          }
          style={{
            alignSelf: 'flex-start',
            fontSize: '11px',
            fontWeight: '600',
            background: 'var(--accent-bg)',
            border: '1px solid rgba(170, 59, 255, 0.2)',
            color: 'var(--accent)',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          className="prov-btn"
        >
          Calculate Cost
        </button>
      </div>
    </div>
  );
};
