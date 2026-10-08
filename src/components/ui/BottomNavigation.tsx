import React from 'react';
import type { Language, NavTab } from '../../types';
import { translations } from '../../i18n/translations';
import { Stethoscope, Sprout, Store, Landmark } from 'lucide-react';

export type { NavTab };

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentLang: Language;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  currentLang,
}) => {
  const t = translations[currentLang];

  const tabs: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'doctor', label: t.navCropDoctor, icon: <Stethoscope size={20} /> },
    { id: 'farm', label: t.navMyFarm, icon: <Sprout size={20} /> },
    { id: 'mandi', label: t.navMandi, icon: <Store size={20} /> },
    { id: 'money', label: t.navMoney, icon: <Landmark size={20} /> },
  ];

  return (
    <nav
      aria-label="Main Navigation"
      style={{
        position: 'sticky',
        bottom: 0,
        backgroundColor: 'var(--ag-color-surface-base)',
        borderTop: '1px solid var(--ag-border-default)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        padding: '6px 0 8px 0',
        zIndex: 50,
        boxShadow: '0 -2px 10px rgba(25, 53, 42, 0.04)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '52px',
              padding: '4px 0',
              color: isActive ? 'var(--ag-color-primary-base)' : 'var(--ag-color-text-secondary)',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '28px',
              borderRadius: 'var(--ag-radius-full)',
              backgroundColor: isActive ? 'var(--ag-color-primary-light)' : 'transparent',
              transition: 'background-color 0.15s ease',
            }}>
              {tab.icon}
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: isActive ? 700 : 500,
              marginTop: '2px',
              lineHeight: 1.2,
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
