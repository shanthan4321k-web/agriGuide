import React from 'react';
import type { AlertNotification, Language } from '../../types';
import { translations } from '../../i18n/translations';
import { AlertTriangle, ChevronRight } from 'lucide-react';

interface ImportantAlertBannerProps {
  alerts: AlertNotification[];
  currentLang: Language;
  onViewAlert?: (alert: AlertNotification) => void;
  style?: React.CSSProperties;
}

export const ImportantAlertBanner: React.FC<ImportantAlertBannerProps> = ({
  alerts,
  currentLang,
  onViewAlert,
  style,
}) => {
  const t = translations[currentLang];
  
  // Only display if there is an actual high priority / warning alert
  const primaryAlert = alerts.find(a => a.severity === 'warning' || a.severity === 'danger') || alerts[0];

  if (!primaryAlert) {
    return null; // Return null if no important alert exists (No fake cards)
  }

  return (
    <div
      role="alert"
      style={{
        backgroundColor: '#FFF8E7',
        border: '1.5px solid #F2B84B',
        borderRadius: 'var(--ag-radius-card)',
        padding: '14px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: 'var(--ag-shadow-card)',
        width: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: '1 1 200px', minWidth: 0 }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--ag-radius-full)',
          backgroundColor: '#FDE4A8',
          color: '#8C5800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '2px',
        }}>
          <AlertTriangle size={16} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#8C5800',
            marginBottom: '2px',
          }}>
            ⚠ {t.importantTodayBadge}
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--ag-color-text-primary)',
            lineHeight: 1.3,
            marginBottom: '2px',
            wordBreak: 'break-word',
          }}>
            {primaryAlert.title}
          </div>
          <p style={{
            fontSize: '12px',
            color: 'var(--ag-color-text-secondary)',
            lineHeight: 1.35,
            wordBreak: 'break-word',
          }}>
            {primaryAlert.description}
          </p>
        </div>
      </div>

      <button
        onClick={() => onViewAlert && onViewAlert(primaryAlert)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          borderRadius: 'var(--ag-radius-sm)',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E0AB3B',
          color: '#8C5800',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <span>{t.viewAlertAction}</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
};
