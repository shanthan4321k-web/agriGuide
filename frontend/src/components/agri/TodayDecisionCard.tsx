import React, { useState } from 'react';
import type { TodayDecision, Language } from '../../types';
import { translations } from '../../i18n/translations';
import { SpeechService } from '../../services/voice/speechService';
import { CheckCircle2, Clock, Volume2, Sparkles, Check, ChevronRight } from 'lucide-react';

interface TodayDecisionCardProps {
  decision: TodayDecision;
  currentLang: Language;
  onToggleComplete: () => void;
  style?: React.CSSProperties;
}

export const TodayDecisionCard: React.FC<TodayDecisionCardProps> = ({
  decision,
  currentLang,
  onToggleComplete,
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

    const textToSpeak = `${t.todayActionBadge}: ${decision.actionTitle}. ${t.reasonPrefix} ${decision.reason}. ${t.recommendedBefore} ${decision.deadline}.`;
    SpeechService.speakText(textToSpeak, currentLang);
    setIsSpeaking(true);
    setTimeout(() => setIsSpeaking(false), 8000);
  };

  return (
    <section 
      aria-labelledby="today-decision-heading" 
      style={{
        margin: '0',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {/* Visual Priority Main Card Container */}
      <div style={{
        backgroundColor: 'var(--ag-color-surface-base)',
        borderRadius: 'var(--ag-radius-card)',
        border: decision.isCompleted 
          ? '1.5px solid var(--ag-color-primary-base)' 
          : '1.5px solid #C8DEC9',
        boxShadow: '0 4px 14px rgba(47, 125, 50, 0.08), 0 1px 3px rgba(25, 53, 42, 0.04)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        <div>
          {/* Top Accent Stripe */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '5px',
            backgroundColor: 'var(--ag-color-primary-base)',
          }} />

          {/* Section Header with Category & Urgency */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            marginTop: '2px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--ag-color-primary-light)',
                color: 'var(--ag-color-primary-dark)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '4px 10px',
                borderRadius: 'var(--ag-radius-full)',
                textTransform: 'uppercase',
              }}>
                <Sparkles size={13} color="var(--ag-color-primary-base)" />
                {t.todayActionBadge}
              </span>

              <span style={{
                fontSize: '12px',
                color: 'var(--ag-color-text-secondary)',
                fontWeight: 600,
              }}>
                {decision.cropTarget}
              </span>
            </div>

            {/* Audio Speaker Button (Accessibility First) */}
            <button
              onClick={handleSpeakDecision}
              aria-label="Read today's decision aloud"
              title="Listen to recommendation"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--ag-radius-full)',
                backgroundColor: isSpeaking ? 'var(--ag-color-primary-base)' : 'var(--ag-color-bg-base)',
                color: isSpeaking ? '#FFFFFF' : 'var(--ag-color-primary-base)',
                border: '1px solid var(--ag-border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Volume2 size={18} />
            </button>
          </div>

          {/* Core Decision Title (Large, Clear Typography) */}
          <h2 
            id="today-decision-heading" 
            style={{
              fontSize: '21px',
              fontWeight: 700,
              color: decision.isCompleted ? 'var(--ag-color-text-secondary)' : 'var(--ag-color-text-primary)',
              lineHeight: 1.3,
              marginBottom: '10px',
              textDecoration: decision.isCompleted ? 'line-through' : 'none',
            }}
          >
            {decision.actionTitle}
          </h2>

          {/* Reason / Context Box */}
          <div style={{
            backgroundColor: 'var(--ag-color-bg-base)',
            borderRadius: 'var(--ag-radius-md)',
            padding: '12px 14px',
            marginBottom: '14px',
            border: '1px solid var(--ag-border-default)',
          }}>
            <p style={{
              fontSize: '14px',
              color: 'var(--ag-color-text-primary)',
              lineHeight: 1.5,
            }}>
              <strong style={{ color: 'var(--ag-color-primary-dark)', marginRight: '4px' }}>
                {t.reasonPrefix}
              </strong>
              {decision.reason}
            </p>
          </div>

          {/* Deadline & Weather Trigger Strip */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '18px',
            fontSize: '13px',
          }}>
            {/* Deadline Chip */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--ag-color-danger-base)',
              fontWeight: 600,
              backgroundColor: '#FDF0F0',
              padding: '4px 10px',
              borderRadius: 'var(--ag-radius-sm)',
              border: '1px solid #F7B5B3',
            }}>
              <Clock size={15} />
              <span>{decision.deadline}</span>
            </div>

            {/* Weather Context Tag */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--ag-color-weather-base)',
              fontWeight: 600,
              backgroundColor: 'var(--ag-color-weather-light)',
              padding: '4px 10px',
              borderRadius: 'var(--ag-radius-sm)',
            }}>
              <span>{decision.weatherContext}</span>
            </div>
          </div>
        </div>

        <div>
          {/* Primary Action Buttons (Min 48–56px touch target) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: '10px',
          }}>
            <button
              onClick={onToggleComplete}
              style={{
                minHeight: '48px',
                padding: '12px 16px',
                borderRadius: 'var(--ag-radius-md)',
                backgroundColor: decision.isCompleted 
                  ? 'var(--ag-color-primary-light)' 
                  : 'var(--ag-color-primary-base)',
                color: decision.isCompleted 
                  ? 'var(--ag-color-primary-dark)' 
                  : '#FFFFFF',
                border: decision.isCompleted 
                  ? '1px solid var(--ag-color-primary-base)' 
                  : 'none',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.15s ease',
              }}
            >
              {decision.isCompleted ? (
                <>
                  <Check size={18} />
                  <span>{t.completedStatus}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>{t.markCompleted}</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowAdviceModal(true)}
              style={{
                minHeight: '48px',
                padding: '12px 14px',
                borderRadius: 'var(--ag-radius-md)',
                backgroundColor: 'var(--ag-color-bg-base)',
                color: 'var(--ag-color-text-primary)',
                border: '1px solid var(--ag-border-default)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <span>{t.viewDetails}</span>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Source & Transparency Footer */}
          <div style={{
            marginTop: '14px',
            paddingTop: '10px',
            borderTop: '1px dashed var(--ag-border-default)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: 'var(--ag-color-text-secondary)',
          }}>
            <span>{t.sourcePrefix} {decision.source}</span>
            {decision.confidence && (
              <span>Confidence: {Math.round(decision.confidence * 100)}%</span>
            )}
          </div>
        </div>
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
              padding: '28px 24px 28px 24px',
              boxShadow: 'var(--ag-shadow-modal)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ag-color-text-primary)' }}>
                Field Preparation Steps
              </h3>
              <button 
                onClick={() => setShowAdviceModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--ag-color-text-secondary)',
                  cursor: 'pointer',
                  padding: '6px 12px',
                }}
              >
                Close
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
