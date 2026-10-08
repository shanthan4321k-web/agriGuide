import React, { useState } from 'react';
import type { Language, LocationContext, DesktopNavTab } from '../../types';
import { translations } from '../../i18n/translations';
import { AGRICULTURAL_DISTRICTS } from '../../services/location/locationService';
import { 
  Sprout, 
  MapPin, 
  WifiOff, 
  User, 
  ChevronDown, 
  Check, 
  Home, 
  CloudSun, 
  Stethoscope, 
  Store, 
  Landmark, 
  Bell 
} from 'lucide-react';

export type { DesktopNavTab };

interface DesktopHeaderProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  location: LocationContext;
  onLocationChange: (loc: LocationContext) => void;
  isOffline: boolean;
  activeTab: DesktopNavTab;
  onTabChange: (tab: DesktopNavTab) => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  currentLang,
  onLanguageChange,
  location,
  onLocationChange,
  isOffline,
  activeTab,
  onTabChange,
}) => {
  const t = translations[currentLang];
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const navLinks: { id: DesktopNavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: t.navHome, icon: <Home size={15} /> },
    { id: 'weather', label: t.navWeather, icon: <CloudSun size={15} /> },
    { id: 'doctor', label: t.navCropDoctor, icon: <Stethoscope size={15} /> },
    { id: 'mandi', label: t.navMandi, icon: <Store size={15} /> },
    { id: 'money', label: t.navMoney, icon: <Landmark size={15} /> },
    { id: 'alerts', label: t.navAlerts, icon: <Bell size={15} /> },
  ];

  return (
    <header style={{
      backgroundColor: 'var(--ag-color-surface-base)',
      borderBottom: '1px solid var(--ag-border-default)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 1px 4px rgba(25, 53, 42, 0.04)',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '0 16px',
        minHeight: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        boxSizing: 'border-box',
      }}>
        {/* Left: Brand Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--ag-radius-md)',
              backgroundColor: 'var(--ag-color-primary-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 2px 6px rgba(47, 125, 50, 0.25)',
              flexShrink: 0,
            }}>
              <Sprout size={20} />
            </div>

            <div>
              <span style={{
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--ag-color-text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                display: 'block',
              }}>
                {t.brandName}
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--ag-color-primary-base)',
                letterSpacing: '0.02em',
              }}>
                {t.brandTagline}
              </span>
            </div>
          </div>
        </div>

        {/* Center Navigation Links (Scrollable if narrow, clean buttons) */}
        <nav 
          aria-label="Desktop Primary Navigation" 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            overflowX: 'auto',
            maxWidth: '100%',
            padding: '4px 0',
          }}
        >
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onTabChange(link.id)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  minHeight: '36px',
                  borderRadius: 'var(--ag-radius-full)',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--ag-color-primary-light)' : 'transparent',
                  color: isActive ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ color: isActive ? 'var(--ag-color-primary-base)' : 'inherit' }}>
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Side: Location, Language, Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Offline Pill */}
          {isOffline && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: 'var(--ag-color-harvest-light)',
              color: 'var(--ag-color-warning-base)',
              padding: '3px 8px',
              borderRadius: 'var(--ag-radius-full)',
              fontWeight: 700,
              fontSize: '11px',
            }}>
              <WifiOff size={12} />
              {t.offlineBadge}
            </span>
          )}

          {/* Location Selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowLocationPicker(!showLocationPicker)}
              aria-label="Change farm district"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--ag-color-bg-base)',
                border: '1px solid var(--ag-border-default)',
                padding: '6px 10px',
                borderRadius: 'var(--ag-radius-md)',
                color: 'var(--ag-color-text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                maxWidth: '160px',
              }}
            >
              <MapPin size={13} color="var(--ag-color-primary-base)" style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {location.district}
              </span>
              <ChevronDown size={12} color="var(--ag-color-text-secondary)" style={{ flexShrink: 0 }} />
            </button>

            {showLocationPicker && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                width: '240px',
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--ag-radius-md)',
                boxShadow: 'var(--ag-shadow-elevated)',
                border: '1px solid var(--ag-border-default)',
                padding: '8px',
                zIndex: 60,
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', marginBottom: '6px', padding: '0 4px' }}>
                  Select District:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '200px', overflowY: 'auto' }}>
                  {AGRICULTURAL_DISTRICTS.map((d) => {
                    const isSelected = d.district === location.district;
                    return (
                      <button
                        key={d.district}
                        onClick={() => {
                          onLocationChange(d);
                          setShowLocationPicker(false);
                        }}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 8px',
                          borderRadius: 'var(--ag-radius-sm)',
                          border: 'none',
                          backgroundColor: isSelected ? 'var(--ag-color-primary-light)' : 'transparent',
                          color: isSelected ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-text-primary)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <span>{d.district}, {d.state}</span>
                        {isSelected && <Check size={13} color="var(--ag-color-primary-base)" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Multilingual Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--ag-color-bg-base)',
            borderRadius: 'var(--ag-radius-full)',
            padding: '2px',
            border: '1px solid var(--ag-border-default)',
          }}>
            {(['en', 'te', 'hi'] as Language[]).map((lang) => {
              const isActive = currentLang === lang;
              const labels = { en: 'EN', te: 'తె', hi: 'हि' };
              return (
                <button
                  key={lang}
                  onClick={() => onLanguageChange(lang)}
                  aria-label={`Switch language to ${lang}`}
                  style={{
                    padding: '4px 8px',
                    minHeight: '28px',
                    minWidth: '30px',
                    fontSize: '12px',
                    fontWeight: isActive ? 700 : 500,
                    backgroundColor: isActive ? 'var(--ag-color-primary-base)' : 'transparent',
                    color: isActive ? '#FFFFFF' : 'var(--ag-color-text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--ag-radius-full)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {labels[lang]}
                </button>
              );
            })}
          </div>

          {/* Farmer Profile Avatar Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            backgroundColor: 'var(--ag-color-bg-base)',
            borderRadius: 'var(--ag-radius-full)',
            border: '1px solid var(--ag-border-default)',
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: 'var(--ag-radius-full)',
              backgroundColor: 'var(--ag-color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ag-color-primary-base)',
            }}>
              <User size={14} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ag-color-text-primary)', whiteSpace: 'nowrap' }}>
              {t.farmerProfile}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
