import React from 'react';
import type { WeatherData, Language } from '../../types';
import { translations } from '../../i18n/translations';
import { CacheService } from '../../services/cacheService';
import { Sun, CloudRain, Wind, Droplets, ShieldCheck, AlertCircle, ShieldAlert } from 'lucide-react';

interface WeatherAdvisoryCardProps {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  currentLang: Language;
  onOpen7DayForecast?: () => void;
  style?: React.CSSProperties;
}

export const WeatherAdvisoryCard: React.FC<WeatherAdvisoryCardProps> = ({
  weather,
  loading,
  error,
  currentLang,
  onOpen7DayForecast,
  style,
}) => {
  const t = translations[currentLang];

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
        <span>{t.loadingWeather}</span>
      </div>
    );
  }

  if (error || !weather) {
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
        <span>{t.errorWeather}</span>
      </div>
    );
  }

  const getSprayBadgeConfig = () => {
    switch (weather.sprayCondition) {
      case 'safe':
        return {
          icon: <ShieldCheck size={16} />,
          bg: 'var(--ag-color-primary-light)',
          color: 'var(--ag-color-primary-dark)',
          border: '1px solid #A3D9A5',
        };
      case 'caution':
        return {
          icon: <AlertCircle size={16} />,
          bg: 'var(--ag-color-harvest-light)',
          color: 'var(--ag-color-warning-base)',
          border: '1px solid #FAD48C',
        };
      case 'unsafe':
      default:
        return {
          icon: <ShieldAlert size={16} />,
          bg: '#FDF0F0',
          color: 'var(--ag-color-danger-base)',
          border: '1px solid #F7B5B3',
        };
    }
  };

  const badgeConfig = getSprayBadgeConfig();

  return (
    <section 
      aria-labelledby="weather-advisory-heading" 
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
          {/* Section Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}>
            <h3 
              id="weather-advisory-heading"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--ag-color-text-secondary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {t.weatherTitle}
            </h3>

            <span style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)', fontWeight: 500 }}>
              {weather.location}
            </span>
          </div>

          {/* Live Weather Metrics Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
          }}>
            {/* Main Temperature & Condition */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--ag-radius-full)',
                backgroundColor: 'var(--ag-color-weather-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ag-color-weather-base)',
              }}>
                {weather.isRainExpectedToday ? <CloudRain size={24} /> : <Sun size={24} />}
              </div>

              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ag-color-text-primary)', lineHeight: 1.1 }}>
                  {weather.temperature}°C
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)', fontWeight: 500 }}>
                  {weather.conditionText}
                </div>
              </div>
            </div>

            {/* Quick Metrics (Rain Chance, Wind, Humidity) */}
            <div style={{
              display: 'flex',
              gap: '12px',
              fontSize: '12px',
              color: 'var(--ag-color-text-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <CloudRain size={14} color="var(--ag-color-weather-base)" />
                <span style={{ fontWeight: 600, color: 'var(--ag-color-text-primary)' }}>
                  {weather.rainfallProbability}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Wind size={14} />
                <span>{weather.windSpeedKmH} km/h</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Droplets size={14} />
                <span>{weather.humidity}%</span>
              </div>
            </div>
          </div>

          {/* Farmer Spray Advisory Banner */}
          <div style={{
            backgroundColor: badgeConfig.bg,
            border: badgeConfig.border,
            color: badgeConfig.color,
            padding: '10px 12px',
            borderRadius: 'var(--ag-radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '10px',
          }}>
            {badgeConfig.icon}
            <span>{weather.sprayWindowText}</span>
          </div>

          {/* Actionable Explanation */}
          <p style={{
            fontSize: '13px',
            color: 'var(--ag-color-text-primary)',
            lineHeight: 1.4,
            marginBottom: '12px',
          }}>
            {weather.advisoryText}
          </p>

          {/* View 7-Day Forecast Button */}
          {onOpen7DayForecast && (
            <button
              onClick={onOpen7DayForecast}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: 'var(--ag-color-weather-light)',
                color: 'var(--ag-color-weather-base)',
                border: '1px solid #BAE6FD',
                borderRadius: 'var(--ag-radius-md)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: '38px',
                marginBottom: '4px',
              }}
            >
              <span>{t.view7DayForecast} →</span>
            </button>
          )}
        </div>

        {/* Source & Freshness Metadata */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--ag-color-text-secondary)',
          borderTop: '1px solid var(--ag-border-default)',
          paddingTop: '10px',
          marginTop: '8px',
        }}>
          <span>{t.sourcePrefix} {weather.source}</span>
          <span>
            {weather.isCached 
              ? t.cachedNotice 
              : `${t.updatedPrefix} ${CacheService.formatTimeAgo(new Date(weather.updatedAt).getTime(), currentLang)}`}
          </span>
        </div>
      </div>
    </section>
  );
};
