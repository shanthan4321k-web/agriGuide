import React from 'react';
import type { Language } from '../../types';
import { translations } from '../../i18n/translations';
import { Calculator, Landmark, FileText, ChevronRight } from 'lucide-react';

interface QuickActionsProps {
  currentLang: Language;
  style?: React.CSSProperties;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ currentLang, style }) => {
  const t = translations[currentLang];

  const actions = [
    {
      id: 'fertilizer',
      title: t.quickFertilizer,
      subtitle: 'NPK Dosage per Acre',
      icon: <Calculator size={18} color="var(--ag-color-primary-base)" />,
    },
    {
      id: 'schemes',
      title: t.quickGovtSchemes,
      subtitle: 'PM-Kisan & Subsidies',
      icon: <Landmark size={18} color="var(--ag-color-warning-base)" />,
    },
    {
      id: 'soil',
      title: t.quickSoilTest,
      subtitle: 'Nitrogen & pH Summary',
      icon: <FileText size={18} color="var(--ag-color-weather-base)" />,
    },
  ];

  return (
    <section 
      aria-label="Secondary Farm Tools" 
      style={{
        margin: '0',
        ...style,
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '12px',
      }}>
        {actions.map((act) => (
          <div
            key={act.id}
            style={{
              backgroundColor: 'var(--ag-color-surface-base)',
              borderRadius: 'var(--ag-radius-md)',
              border: '1px solid var(--ag-border-default)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              minHeight: '48px',
              boxShadow: 'var(--ag-shadow-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--ag-radius-full)',
                backgroundColor: 'var(--ag-color-bg-base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {act.icon}
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ag-color-text-primary)' }}>
                  {act.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)', marginTop: '2px' }}>
                  {act.subtitle}
                </div>
              </div>
            </div>

            <ChevronRight size={16} color="var(--ag-color-text-secondary)" />
          </div>
        ))}
      </div>
    </section>
  );
};
