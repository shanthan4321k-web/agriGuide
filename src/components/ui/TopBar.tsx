import React, { useState } from 'react';
import type { Language, LocationContext } from '../../types';
import { translations } from '../../i18n/translations';
import { AGRICULTURAL_DISTRICTS } from '../../services/location/locationService';
import { MapPin, WifiOff, Check, ChevronDown, User } from 'lucide-react';

interface TopBarProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  location: LocationContext;
  onLocationChange: (loc: LocationContext) => void;
  isOffline: boolean;
  onNavigateHome?: () => void;
  farmerProfile?: { phone?: string; fullName?: string } | null;
  onOpenLogin?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentLang,
  onLanguageChange,
  location,
  onLocationChange,
  isOffline,
  onNavigateHome,
  farmerProfile,
  onOpenLogin,
}) => {
  const t = translations[currentLang];
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  return (
    <header style={{
      backgroundColor: 'var(--ag-color-surface-base)',
      borderBottom: '1px solid var(--ag-border-default)',
      padding: '12px 14px',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
    }}>
      {/* Top Row: Greeting & Language Switcher */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '6px',
        minWidth: 0,
      }}>
        <div 
          onClick={onNavigateHome}
          role={onNavigateHome ? 'button' : undefined}
          style={{ minWidth: 0, flex: 1, cursor: onNavigateHome ? 'pointer' : 'default' }}
        >
          <h1 style={{
            fontSize: '18px',
            fontWeight: 800,
            color: 'var(--ag-color-text-primary)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {farmerProfile?.fullName ? `Namaste, ${farmerProfile.fullName}` : t.greeting}
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'var(--ag-color-text-secondary)',
            fontWeight: 500,
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {farmerProfile?.phone ? `+91 ${farmerProfile.phone}` : t.farmSummary}
          </p>
        </div>

        {/* Language & Profile Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Language Selector Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--ag-color-bg-base)',
            borderRadius: 'var(--ag-radius-full)',
            padding: '2px',
            border: '1px solid var(--ag-border-default)',
            flexShrink: 0,
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
                    padding: '4px 7px',
                    minHeight: '28px',
                    minWidth: '28px',
                    fontSize: '11px',
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

          {/* Profile / Phone identification trigger */}
          <button
            onClick={onOpenLogin}
            aria-label="Farmer profile identification"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--ag-radius-full)',
              backgroundColor: 'var(--ag-color-bg-base)',
              border: '1px solid var(--ag-border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ag-color-primary-base)',
              cursor: onOpenLogin ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            <User size={15} />
          </button>
        </div>
      </div>

      {/* Bottom Row: Location Badge & Offline Indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '6px',
        fontSize: '12px',
        gap: '8px',
        minWidth: 0,
      }}>
        {/* Location Dropdown Trigger */}
        <button
          onClick={() => setShowLocationPicker(!showLocationPicker)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: 'var(--ag-color-primary-dark)',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '2px 0',
            fontSize: '12px',
            minWidth: 0,
            textAlign: 'left',
          }}
        >
          <MapPin size={13} color="var(--ag-color-primary-base)" style={{ flexShrink: 0 }} />
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '180px',
          }}>
            {location.district}, {location.state}
          </span>
          <ChevronDown size={12} style={{ flexShrink: 0 }} />
        </button>

        {/* Offline Badge */}
        {isOffline && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            backgroundColor: 'var(--ag-color-harvest-light)',
            color: 'var(--ag-color-warning-base)',
            padding: '2px 6px',
            borderRadius: 'var(--ag-radius-full)',
            fontWeight: 700,
            fontSize: '11px',
            flexShrink: 0,
          }}>
            <WifiOff size={11} />
            {t.offlineBadge}
          </span>
        )}
      </div>

      {/* District Selector Modal / Dropdown */}
      {showLocationPicker && (
        <div style={{
          marginTop: '10px',
          padding: '12px',
          backgroundColor: 'var(--ag-color-bg-base)',
          borderRadius: 'var(--ag-radius-md)',
          border: '1px solid var(--ag-border-default)',
        }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ag-color-text-secondary)', marginBottom: '8px' }}>
            Select Agricultural District:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
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
                    padding: '8px 10px',
                    fontSize: '12px',
                    textAlign: 'left',
                    borderRadius: 'var(--ag-radius-sm)',
                    border: isSelected ? '1px solid var(--ag-color-primary-base)' : '1px solid var(--ag-border-default)',
                    backgroundColor: isSelected ? 'var(--ag-color-primary-light)' : '#FFFFFF',
                    color: isSelected ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-text-primary)',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{d.district}</span>
                  {isSelected && <Check size={12} color="var(--ag-color-primary-base)" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
