import React, { useState } from 'react';
import type { MarketPrice, Language } from '../../types';
import { translations } from '../../i18n/translations';
import { TrendingUp, TrendingDown, Minus, Store, AlertCircle } from 'lucide-react';

interface MandiPriceCardProps {
  markets: MarketPrice[];
  loading: boolean;
  error: string | null;
  currentLang: Language;
  style?: React.CSSProperties;
}

export const MandiPriceCard: React.FC<MandiPriceCardProps> = ({
  markets,
  loading,
  error,
  currentLang,
  style,
}) => {
  const t = translations[currentLang];
  const [selectedCommodity, setSelectedCommodity] = useState<string>(
    markets.length > 0 ? markets[0].commodity : 'Cotton'
  );

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: 'var(--ag-color-surface-base)',
        borderRadius: 'var(--ag-radius-card)',
        border: '1px solid var(--ag-border-default)',
        color: 'var(--ag-color-text-secondary)',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '100%',
        ...style,
      }}>
        <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--ag-color-primary-base)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <span>{t.loadingMandi}</span>
      </div>
    );
  }

  if (error || markets.length === 0) {
    return (
      <div style={{
        padding: '16px 18px',
        backgroundColor: '#FDF0F0',
        borderRadius: 'var(--ag-radius-card)',
        border: '1px solid #F7B5B3',
        color: 'var(--ag-color-danger-base)',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '100%',
        ...style,
      }}>
        <AlertCircle size={16} />
        <span>{t.errorMandi}</span>
      </div>
    );
  }

  const activeMarket = markets.find(m => m.commodity === selectedCommodity) || markets[0];

  const getActionBadge = (rec: MarketPrice['actionRecommendation']) => {
    switch (rec) {
      case 'SELL':
        return {
          label: t.recommendationSell,
          bg: 'var(--ag-color-primary-light)',
          color: 'var(--ag-color-primary-dark)',
          border: '1px solid #A3D9A5',
        };
      case 'HOLD':
        return {
          label: t.recommendationHold,
          bg: 'var(--ag-color-harvest-light)',
          color: 'var(--ag-color-warning-base)',
          border: '1px solid #FAD48C',
        };
      case 'WAIT':
      default:
        return {
          label: t.recommendationWait,
          bg: 'var(--ag-color-weather-light)',
          color: 'var(--ag-color-weather-base)',
          border: '1px solid #BCE0F7',
        };
    }
  };

  const actionBadge = getActionBadge(activeMarket.actionRecommendation);

  return (
    <section 
      aria-labelledby="mandi-snapshot-heading" 
      style={{
        margin: '0',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div style={{
        backgroundColor: 'var(--ag-color-surface-base)',
        borderRadius: 'var(--ag-radius-card)',
        border: '1px solid var(--ag-border-default)',
        padding: '20px',
        boxShadow: 'var(--ag-shadow-card)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        <div>
          {/* Header & Commodity Selector Pills */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}>
            <h3 
              id="mandi-snapshot-heading"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--ag-color-text-secondary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {t.mandiTitle}
            </h3>

            <div style={{ display: 'flex', gap: '6px' }}>
              {markets.map((m) => {
                const isSelected = m.commodity === activeMarket.commodity;
                return (
                  <button
                    key={m.commodity}
                    onClick={() => setSelectedCommodity(m.commodity)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: 'var(--ag-radius-full)',
                      border: isSelected ? '1px solid var(--ag-color-primary-base)' : '1px solid var(--ag-border-default)',
                      backgroundColor: isSelected ? 'var(--ag-color-primary-light)' : 'transparent',
                      color: isSelected ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {m.commodity}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mandi Name & Variety */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--ag-color-text-secondary)',
            fontSize: '12px',
            marginBottom: '10px',
          }}>
            <Store size={14} color="var(--ag-color-primary-base)" />
            <span>{activeMarket.marketName}</span>
            <span>•</span>
            <span>{activeMarket.variety}</span>
          </div>

          {/* Price Metric & Action Recommendation Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '14px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--ag-border-default)',
          }}>
            {/* Main Price */}
            <div>
              <div style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)', fontWeight: 600 }}>
                {t.modalPrice}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--ag-color-text-primary)' }}>
                  ₹{activeMarket.modalPrice.toLocaleString('en-IN')}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)' }}>
                  /{t.perQuintal}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)', marginTop: '2px' }}>
                Range: ₹{activeMarket.minPrice.toLocaleString('en-IN')} – ₹{activeMarket.maxPrice.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Trend & Action Badge */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: activeMarket.trendDirection === 'up' ? 'var(--ag-color-success-base)' : 'var(--ag-color-danger-base)',
                fontWeight: 700,
                fontSize: '13px',
                marginBottom: '6px',
              }}>
                {activeMarket.trendDirection === 'up' && <TrendingUp size={16} />}
                {activeMarket.trendDirection === 'down' && <TrendingDown size={16} />}
                {activeMarket.trendDirection === 'steady' && <Minus size={16} />}
                <span>
                  {activeMarket.trendPercentage > 0 ? '+' : ''}{activeMarket.trendPercentage}% ({activeMarket.trendDirection === 'up' ? t.trendUp : activeMarket.trendDirection === 'down' ? t.trendDown : t.trendSteady})
                </span>
              </div>

              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '5px 12px',
                  borderRadius: 'var(--ag-radius-sm)',
                  backgroundColor: actionBadge.bg,
                  color: actionBadge.color,
                  border: actionBadge.border,
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                }}>
                  {actionBadge.label}
                </span>
              </div>
            </div>
          </div>

          {/* Explainable Decision Note */}
          <p style={{
            fontSize: '13px',
            color: 'var(--ag-color-text-primary)',
            lineHeight: 1.4,
            marginBottom: '10px',
          }}>
            <strong>Advice:</strong> {activeMarket.actionReason}
          </p>
        </div>

        {/* Source & Freshness Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--ag-color-text-secondary)',
          borderTop: '1px solid var(--ag-border-default)',
          paddingTop: '8px',
          marginTop: '6px',
        }}>
          <span>{t.sourcePrefix} {activeMarket.source}</span>
          <span>{activeMarket.date}</span>
        </div>
      </div>
    </section>
  );
};
