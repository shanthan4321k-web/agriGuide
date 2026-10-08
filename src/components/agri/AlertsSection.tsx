import React from 'react';
import type { AlertNotification, Language } from '../../types';
import { translations } from '../../i18n/translations';
import { AlertTriangle, Info, BellRing } from 'lucide-react';

interface AlertsSectionProps {
  alerts: AlertNotification[];
  currentLang: Language;
  style?: React.CSSProperties;
}

export const AlertsSection: React.FC<AlertsSectionProps> = ({
  alerts,
  currentLang,
  style,
}) => {
  const t = translations[currentLang];

  if (alerts.length === 0) return null;

  return (
    <section 
      aria-labelledby="alerts-heading" 
      style={{
        margin: '0',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
      }}>
        <BellRing size={14} color="var(--ag-color-warning-base)" />
        <h3
          id="alerts-heading"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--ag-color-text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {t.alertsTitle}
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {alerts.map((alert) => {
          const isDanger = alert.severity === 'danger';
          return (
            <div
              key={alert.id}
              style={{
                backgroundColor: isDanger ? '#FDF0F0' : 'var(--ag-color-harvest-light)',
                border: isDanger ? '1px solid #F7B5B3' : '1px solid #FAD48C',
                borderRadius: 'var(--ag-radius-md)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                height: '100%',
              }}
            >
              <div style={{
                color: isDanger ? 'var(--ag-color-danger-base)' : 'var(--ag-color-warning-base)',
                marginTop: '1px',
                flexShrink: 0,
              }}>
                {isDanger ? <AlertTriangle size={18} /> : <Info size={18} />}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: isDanger ? 'var(--ag-color-danger-base)' : 'var(--ag-color-text-primary)',
                  marginBottom: '2px',
                }}>
                  {alert.title}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--ag-color-text-primary)',
                  lineHeight: 1.4,
                }}>
                  {alert.description}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--ag-color-text-secondary)',
                  marginTop: '4px',
                }}>
                  {t.sourcePrefix} {alert.source} • {alert.issuedAt}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
