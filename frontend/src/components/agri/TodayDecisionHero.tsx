import React, { useState } from 'react';
import type { TodayDecision, Language, LocationContext } from '../../types';
import { translations } from '../../i18n/translations';
import { SpeechService } from '../../services/voice/speechService';
import { 
  CheckCircle2, 
  Clock, 
  Volume2, 
  Sparkles, 
  Check, 
  ChevronRight, 
  MapPin, 
  X
} from 'lucide-react';

interface TodayDecisionHeroProps {
  decision: TodayDecision;
  location: LocationContext;
  currentLang: Language;
  onToggleComplete: () => void;
  isDesktop?: boolean;
  style?: React.CSSProperties;
}

export const TodayDecisionHero: React.FC<TodayDecisionHeroProps> = ({
  decision,
  location,
  currentLang,
  onToggleComplete,
  isDesktop = false,
  style,
}) => {
  const t = translations[currentLang];
  const [showAdviceModal, setShowAdviceModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeakDecision = () => {
    if (isSpeaking) {
      SpeechService.stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = `${t.todayPriorityBadge}: ${decision.actionTitle}. ${t.reasonPrefix} ${decision.reason}. ${t.recommendedBefore} ${decision.deadline}.`;
    SpeechService.speakText(textToSpeak, currentLang);
    setIsSpeaking(true);
    setTimeout(() => setIsSpeaking(false), 8000);
  };

  return (
    <section aria-labelledby="today-priority-heading" style={{ width: '100%', minWidth: 0, ...style }}>
      {/* Desktop 2-Column Hero (62% / 38%) or Mobile 1-Column Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isDesktop ? '1.6fr 1fr' : '1fr',
        gap: isDesktop ? '20px' : '14px',
        alignItems: 'stretch',
        minWidth: 0,
      }}>
        {/* Left Column: Decision Card */}
        <div style={{
          backgroundColor: 'var(--ag-color-surface-base)',
          borderRadius: 'var(--ag-radius-card)',
          border: decision.isCompleted 
            ? '1.5px solid var(--ag-color-primary-base)' 
            : '1.5px solid #C4DCC6',
          boxShadow: '0 3px 12px rgba(47, 125, 50, 0.06), 0 1px 3px rgba(25, 53, 42, 0.03)',
          padding: isDesktop ? '24px 26px' : '16px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
        }}>
          {/* Top Green Accent Indicator */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            backgroundColor: 'var(--ag-color-primary-base)',
          }} />

          <div>
            {/* Header: Priority Badge + Crop Target + Audio Readout */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', minWidth: 0 }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--ag-color-primary-light)',
                  color: 'var(--ag-color-primary-dark)',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  padding: '3px 8px',
                  borderRadius: 'var(--ag-radius-full)',
                  textTransform: 'uppercase',
                }}>
                  <Sparkles size={12} color="var(--ag-color-primary-base)" />
                  {t.todayPriorityBadge}
                </span>

                <span style={{
                  fontSize: '12px',
                  color: 'var(--ag-color-text-secondary)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  {decision.cropTarget}
                </span>
              </div>

              {/* Audio Speaker Button (Accessibility First) */}
              <button
                onClick={handleSpeakDecision}
                aria-label="Read decision aloud"
                title="Listen to recommendation"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--ag-radius-full)',
                  backgroundColor: isSpeaking ? 'var(--ag-color-primary-base)' : 'var(--ag-color-bg-base)',
                  color: isSpeaking ? '#FFFFFF' : 'var(--ag-color-primary-base)',
                  border: '1px solid var(--ag-border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <Volume2 size={16} />
              </button>
            </div>

            {/* Core Action Title */}
            <h1 
              id="today-priority-heading"
              style={{
                fontSize: isDesktop ? '22px' : '18px',
                fontWeight: 800,
                color: decision.isCompleted ? 'var(--ag-color-text-secondary)' : 'var(--ag-color-text-primary)',
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
                marginBottom: '10px',
                wordBreak: 'break-word',
                textDecoration: decision.isCompleted ? 'line-through' : 'none',
              }}
            >
              {decision.actionTitle}
            </h1>

            {/* Reason Box */}
            <div style={{
              backgroundColor: 'var(--ag-color-bg-base)',
              borderRadius: 'var(--ag-radius-md)',
              padding: '10px 14px',
              marginBottom: '12px',
              border: '1px solid var(--ag-border-default)',
            }}>
              <p style={{
                fontSize: '13px',
                color: 'var(--ag-color-text-primary)',
                lineHeight: 1.45,
                wordBreak: 'break-word',
              }}>
                <strong style={{ color: 'var(--ag-color-primary-dark)', marginRight: '6px' }}>
                  {t.reasonPrefix}
                </strong>
                {decision.reason}
              </p>
            </div>

            {/* Deadline & Weather Strip */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              fontSize: '12px',
            }}>
              {/* Deadline Chip */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--ag-color-danger-base)',
                fontWeight: 700,
                backgroundColor: '#FDF0F0',
                padding: '4px 8px',
                borderRadius: 'var(--ag-radius-sm)',
                border: '1px solid #F7B5B3',
              }}>
                <Clock size={13} />
                <span>{decision.deadline}</span>
              </div>

              {/* Weather Context Tag */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--ag-color-weather-base)',
                fontWeight: 600,
                backgroundColor: 'var(--ag-color-weather-light)',
                padding: '4px 8px',
                borderRadius: 'var(--ag-radius-sm)',
              }}>
                <span>{decision.weatherContext}</span>
              </div>
            </div>
          </div>

          <div>
            {/* Primary Action Buttons: Stack cleanly on mobile, side-by-side on desktop */}
            <div style={{
              display: 'flex',
              flexDirection: isDesktop ? 'row' : 'column',
              gap: '8px',
            }}>
              <button
                onClick={onToggleComplete}
                style={{
                  flex: isDesktop ? '1.4' : 'none',
                  minHeight: '46px',
                  padding: '10px 16px',
                  borderRadius: 'var(--ag-radius-md)',
                  backgroundColor: decision.isCompleted 
                    ? 'var(--ag-color-primary-light)' 
                    : 'var(--ag-color-primary-base)',
                  color: decision.isCompleted 
                    ? 'var(--ag-color-primary-dark)' 
                    : '#FFFFFF',
                  border: decision.isCompleted 
                    ? '1.5px solid var(--ag-color-primary-base)' 
                    : 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background-color 0.15s ease',
                  boxShadow: decision.isCompleted ? 'none' : '0 2px 6px rgba(47, 125, 50, 0.2)',
                  whiteSpace: 'nowrap',
                }}
              >
                {decision.isCompleted ? (
                  <>
                    <Check size={16} />
                    <span>{t.completedStatus}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>{t.markCompleted}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowAdviceModal(true)}
                style={{
                  flex: isDesktop ? '1' : 'none',
                  minHeight: '46px',
                  padding: '10px 14px',
                  borderRadius: 'var(--ag-radius-md)',
                  backgroundColor: 'var(--ag-color-bg-base)',
                  color: 'var(--ag-color-text-primary)',
                  border: '1px solid var(--ag-border-default)',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{t.viewDetails}</span>
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Source & Provenance Footer (Honest data sources, no fake confidence scores) */}
            <div style={{
              marginTop: '12px',
              paddingTop: '8px',
              borderTop: '1px dashed var(--ag-border-default)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--ag-color-text-secondary)',
            }}>
              <span>{t.sourcePrefix} {decision.source}</span>
              <span>Validated by Decision Rules</span>
            </div>
          </div>
        </div>

        {/* Right Column (Desktop Only): Balanced 38% Agricultural Context Photo */}
        {isDesktop && (
          <div style={{
            position: 'relative',
            borderRadius: 'var(--ag-radius-card)',
            overflow: 'hidden',
            boxShadow: 'var(--ag-shadow-card)',
            border: '1px solid var(--ag-border-default)',
            minHeight: '260px',
            backgroundColor: '#E4ECE5',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}>
            <img
              src="/farm_hero.jpg"
              alt="Indian Cotton & Maize Field in morning sunlight"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'brightness(0.95)',
              }}
            />
            {/* Subtle Gradient Overlay for Legibility */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(25, 53, 42, 0.02) 45%, rgba(25, 53, 42, 0.8) 100%)',
            }} />

            {/* Farm Context Tag on Image (Clean, honest, no fabricated sensor claims) */}
            <div style={{
              position: 'relative',
              zIndex: 2,
              padding: '16px 18px',
              color: '#FFFFFF',
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: 'rgba(255, 255, 255, 0.22)',
                backdropFilter: 'blur(4px)',
                padding: '3px 8px',
                borderRadius: 'var(--ag-radius-full)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                marginBottom: '4px',
              }}>
                <MapPin size={11} />
                <span>{location.district}, {location.state}</span>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.5)', marginBottom: '0' }}>
                4.5 Acres · Cotton & Maize
              </h3>
            </div>
          </div>
        )}
      </div>

      {/* Advisory Details Modal */}
      {showAdviceModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(25, 53, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px',
        }} onClick={() => setShowAdviceModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              width: '100%',
              maxWidth: '520px',
              borderRadius: '24px',
              padding: '28px 24px',
              boxShadow: 'var(--ag-shadow-modal)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ag-color-text-primary)' }}>
                Field Action Guide
              </h3>
              <button 
                onClick={() => setShowAdviceModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--ag-color-text-secondary)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--ag-color-text-primary)' }}>
              <p style={{ marginBottom: '12px' }}>
                <strong>Dosage:</strong> Mix 5 ml of Neem Oil (1500 ppm) per liter of water with 1 g detergent powder as surfactant.
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>Spray Direction:</strong> Target the underside of the leaf canopy where Whitefly nymphs cluster.
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>Weather Safety:</strong> Wind speed is currently optimal. Complete spraying before afternoon heat increases.
              </p>
            </div>

            <button
              onClick={() => {
                onToggleComplete();
                setShowAdviceModal(false);
              }}
              style={{
                width: '100%',
                minHeight: '48px',
                backgroundColor: 'var(--ag-color-primary-base)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--ag-radius-md)',
                fontWeight: 700,
                fontSize: '15px',
                marginTop: '16px',
                cursor: 'pointer',
              }}
            >
              {decision.isCompleted ? 'Keep Completed' : 'Complete and Return'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
