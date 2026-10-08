import React from 'react';
import type { WeatherData, MarketPrice, CropHealth, Language } from '../../types';
import { translations } from '../../i18n/translations';
import { CloudSun, Store, Stethoscope, ChevronRight, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TodayAtAGlanceProps {
  weather: WeatherData | null;
  weatherLoading: boolean;
  markets: MarketPrice[];
  marketsLoading: boolean;
  crops: CropHealth[];
  currentLang: Language;
  onNavigateWeather: () => void;
  onNavigateMandi: () => void;
  onNavigateDoctor: () => void;
  style?: React.CSSProperties;
}

export const TodayAtAGlance: React.FC<TodayAtAGlanceProps> = ({
  weather,
  weatherLoading,
  markets,
  marketsLoading,
  crops,
  currentLang,
  onNavigateWeather,
  onNavigateMandi,
  onNavigateDoctor,
  style,
}) => {
  const t = translations[currentLang];
  const primaryMarket = markets.length > 0 ? markets[0] : null;
  const underWatchCrop = crops.find(c => c.status === 'under_watch' || c.status === 'attention');
  const hasCropIssue = Boolean(underWatchCrop);

  return (
    <section aria-labelledby="glance-heading" style={{ width: '100%', minWidth: 0, ...style }}>
      {/* Section Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
      }}>
        <h2 
          id="glance-heading"
          style={{
            fontSize: '12px',
            fontWeight: 800,
            color: 'var(--ag-color-text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {t.todayAtAGlance}
        </h2>
      </div>

      {/* Unified Information Strip Container */}
      <div style={{
        backgroundColor: 'var(--ag-color-surface-base)',
        borderRadius: 'var(--ag-radius-card)',
        border: '1px solid var(--ag-border-default)',
        boxShadow: 'var(--ag-shadow-card)',
        padding: '6px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '6px',
      }}>
        {/* 1. Weather Item */}
        <div style={{
          padding: '14px 16px',
          borderRadius: 'var(--ag-radius-md)',
          backgroundColor: 'var(--ag-color-bg-base)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--ag-color-weather-base)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                <CloudSun size={14} />
                {t.navWeather}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--ag-color-text-secondary)' }}>
                {weather?.source || 'Open-Meteo & IMD'}
              </span>
            </div>

            {weatherLoading ? (
              <div style={{ fontSize: '13px', color: 'var(--ag-color-text-secondary)', padding: '4px 0' }}>
                {t.loadingWeather}
              </div>
            ) : weather ? (
              <>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--ag-color-text-primary)',
                  letterSpacing: '-0.01em',
                  marginBottom: '2px',
                }}>
                  {weather.temperature}°C · {weather.rainfallProbability}% {t.rainChance}
                </div>
                <p style={{
                  fontSize: '12px',
                  color: 'var(--ag-color-text-secondary)',
                  lineHeight: 1.35,
                  marginBottom: '10px',
                }}>
                  {weather.rainfallProbability < 30 ? t.weatherSafeSummary : t.weatherRainSummary}
                </p>
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)', padding: '4px 0' }}>
                {t.errorWeather}
              </div>
            )}
          </div>

          <button
            onClick={onNavigateWeather}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '6px 10px',
              backgroundColor: '#FFFFFF',
              color: 'var(--ag-color-weather-base)',
              border: '1px solid #D1E5F7',
              borderRadius: 'var(--ag-radius-sm)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <span>{t.viewWeatherForecast}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 2. Cotton Market Item */}
        <div style={{
          padding: '14px 16px',
          borderRadius: 'var(--ag-radius-md)',
          backgroundColor: 'var(--ag-color-bg-base)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--ag-color-primary-base)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                <Store size={14} />
                {t.marketGlancePrefix} {t.navMandi}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--ag-color-text-secondary)' }}>
                {primaryMarket?.source || 'Agmarknet'}
              </span>
            </div>

            {marketsLoading ? (
              <div style={{ fontSize: '13px', color: 'var(--ag-color-text-secondary)', padding: '4px 0' }}>
                {t.loadingMandi}
              </div>
            ) : primaryMarket ? (
              <>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--ag-color-text-primary)',
                  letterSpacing: '-0.01em',
                  marginBottom: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span>₹{primaryMarket.modalPrice.toLocaleString('en-IN')}/q</span>
                  {primaryMarket.trendPercentage !== 0 && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: primaryMarket.trendDirection === 'up' ? 'var(--ag-color-success-base)' : 'var(--ag-color-danger-base)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}>
                      <TrendingUp size={13} />
                      {primaryMarket.trendPercentage > 0 ? `+${primaryMarket.trendPercentage}%` : `${primaryMarket.trendPercentage}%`}
                    </span>
                  )}
                </div>
                <p style={{
                  fontSize: '12px',
                  color: 'var(--ag-color-text-secondary)',
                  lineHeight: 1.35,
                  marginBottom: '10px',
                }}>
                  {primaryMarket.marketName} · {primaryMarket.actionRecommendation === 'SELL' ? t.recommendationSell : t.recommendationHold}
                </p>
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)', padding: '4px 0 10px 0' }}>
                {t.errorMandi}
              </div>
            )}
          </div>

          <button
            onClick={onNavigateMandi}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '6px 10px',
              backgroundColor: '#FFFFFF',
              color: 'var(--ag-color-primary-dark)',
              border: '1px solid #C4DCC6',
              borderRadius: 'var(--ag-radius-sm)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <span>{t.viewMandiRates}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 3. Crop Health Item */}
        <div style={{
          padding: '14px 16px',
          borderRadius: 'var(--ag-radius-md)',
          backgroundColor: 'var(--ag-color-bg-base)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 800,
                color: hasCropIssue ? 'var(--ag-color-warning-base)' : 'var(--ag-color-primary-base)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                <Stethoscope size={14} />
                {t.cropHealthTitle}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--ag-color-text-secondary)' }}>
                {crops.length} Plots Tracked
              </span>
            </div>

            <div style={{
              fontSize: '18px',
              fontWeight: 800,
              color: 'var(--ag-color-text-primary)',
              letterSpacing: '-0.01em',
              marginBottom: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              {hasCropIssue ? (
                <>
                  <AlertTriangle size={16} color="var(--ag-color-warning-base)" />
                  <span>{t.statusUnderWatch}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} color="var(--ag-color-success-base)" />
                  <span>{t.statusHealthy}</span>
                </>
              )}
            </div>
            <p style={{
              fontSize: '12px',
              color: 'var(--ag-color-text-secondary)',
              lineHeight: 1.35,
              marginBottom: '10px',
            }}>
              {hasCropIssue ? `${underWatchCrop?.cropName}: ${t.cropStatusWatchSummary}` : t.cropStatusHealthySummary}
            </p>
          </div>

          <button
            onClick={onNavigateDoctor}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '6px 10px',
              backgroundColor: '#FFFFFF',
              color: hasCropIssue ? '#A06B00' : 'var(--ag-color-primary-dark)',
              border: hasCropIssue ? '1px solid #F5D98B' : '1px solid #C4DCC6',
              borderRadius: 'var(--ag-radius-sm)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <span>{t.viewCropDoctor}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
};
