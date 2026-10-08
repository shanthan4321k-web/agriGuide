import React, { useState } from 'react';
import type { Language } from '../../types';
import { translations } from '../../i18n/translations';
import { SpeechService } from '../../services/voice/speechService';
import { Mic, MicOff, Volume2, X, Sparkles } from 'lucide-react';

interface VoiceActionBarProps {
  currentLang: Language;
  onVoiceIntent?: (intent: string) => void;
  style?: React.CSSProperties;
}

export const VoiceActionBar: React.FC<VoiceActionBarProps> = ({
  currentLang,
  onVoiceIntent,
  style,
}) => {
  const t = translations[currentLang];
  const [isListening, setIsListening] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState<string | null>(null);
  const [voiceResponse, setVoiceResponse] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleVoiceTap = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    setErrorMessage(null);
    setVoiceQuery(null);
    setVoiceResponse(null);
    setIsListening(true);

    const recognitionInstance = SpeechService.startListening(
      currentLang,
      (transcript: string) => {
        setVoiceQuery(transcript);
        processFarmerQuery(transcript);
      },
      (error: string) => {
        setIsListening(false);
        setErrorMessage(error);
      },
      () => {
        setIsListening(false);
      }
    );

    if (!recognitionInstance) {
      setIsListening(false);
    }
  };

  const processFarmerQuery = (query: string) => {
    const q = query.toLowerCase();
    let reply = '';

    if (q.includes('spray') || q.includes('మందు') || q.includes('छिड़काव') || q.includes('rain') || q.includes('వర్షం') || q.includes('बारिश')) {
      reply = currentLang === 'te' 
        ? 'ఈ రోజు వర్ష సూచన లేదు. మధ్యాహ్నం 2 గంటల లోపు పత్తి పై వేప నూనె పిచికారీ చేయడం సురక్షితం.'
        : currentLang === 'hi'
        ? 'आज बारिश की संभावना बहुत कम है। दोपहर 2 बजे से पहले कपास पर नीम तेल का छिड़काव सुरक्षित है।'
        : 'Zero rain expected today. It is safe to spray Neem oil on Cotton before 2:00 PM.';
    } else if (q.includes('price') || q.includes('ధర') || q.includes('भाव') || q.includes('mandi') || q.includes('cotton') || q.includes('పత్తి') || q.includes('कपास')) {
      reply = currentLang === 'te' 
        ? 'వరంగల్ మార్కెట్‌లో పత్తి క్వింటాల్ ధర 7,120 రూపాయలు ఉంది. ఇది గత వారం కంటే 3.8 శాతం పెరిగింది.'
        : currentLang === 'hi'
        ? 'वारंगल मंडी में कपास का भाव ₹7,120 प्रति क्विंटल है। भाव में 3.8% की बढ़ोतरी हुई है।'
        : 'Cotton modal price at Warangal Mandi is ₹7,120 per quintal, up +3.8% today.';
    } else {
      reply = currentLang === 'te'
        ? 'మీ ప్రశ్న నమోదయింది. ఈ రోజు ప్రధాన పని: పత్తి పంటను తనిఖీ చేసి వేప నూనె పిచికారీ చేయండి.'
        : currentLang === 'hi'
        ? 'आपकी आवाज दर्ज हुई। आज का मुख्य कार्य: कपास पर कीट जांच और नीम तेल का छिड़काव करें।'
        : 'Understood. Today’s top action is spraying Neem Oil on Cotton before 2:00 PM.';
    }

    setVoiceResponse(reply);
    SpeechService.speakText(reply, currentLang);
    if (onVoiceIntent) onVoiceIntent(query);
  };

  const handleClose = () => {
    SpeechService.stopSpeaking();
    setIsListening(false);
    setVoiceQuery(null);
    setVoiceResponse(null);
    setErrorMessage(null);
  };

  return (
    <section 
      aria-label="Voice Agricultural Assistant" 
      style={{
        margin: '0',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {/* Prominent Voice Bar Card */}
      <div style={{
        backgroundColor: 'var(--ag-color-surface-base)',
        borderRadius: 'var(--ag-radius-card)',
        border: isListening ? '2px solid var(--ag-color-primary-base)' : '1px solid var(--ag-border-default)',
        padding: '14px 16px',
        boxShadow: 'var(--ag-shadow-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        position: 'relative',
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
      }}>
        {/* Left Side: Voice Icon / State & Prompt */}
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '4px',
          }}>
            <Sparkles size={14} color="var(--ag-color-primary-base)" style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--ag-color-primary-dark)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {isListening ? t.voiceListening : t.voiceTitle}
            </span>
          </div>

          <p style={{
            fontSize: '13px',
            fontWeight: 600,
            color: isListening ? 'var(--ag-color-primary-base)' : 'var(--ag-color-text-primary)',
            lineHeight: 1.35,
            wordBreak: 'break-word',
          }}>
            {isListening ? t.voiceListening : t.voicePrompt}
          </p>
        </div>

        {/* Large Prominent 50-56px Microphone Touch Target */}
        <button
          onClick={handleVoiceTap}
          aria-label={isListening ? 'Stop listening' : 'Start speaking your farm query'}
          style={{
            width: '50px',
            height: '50px',
            minWidth: '50px',
            minHeight: '50px',
            borderRadius: 'var(--ag-radius-full)',
            backgroundColor: isListening ? 'var(--ag-color-danger-base)' : 'var(--ag-color-primary-base)',
            color: '#FFFFFF',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: isListening 
              ? '0 0 0 4px rgba(217, 74, 69, 0.25)' 
              : '0 4px 12px rgba(47, 125, 50, 0.3)',
            transition: 'all 0.2s ease',
          }}
        >
          {isListening ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
      </div>

      {/* Spoken Query & Audio Response Card */}
      {(voiceQuery || voiceResponse || errorMessage) && (
        <div style={{
          marginTop: '10px',
          backgroundColor: 'var(--ag-color-surface-base)',
          borderRadius: 'var(--ag-radius-md)',
          padding: '14px 16px',
          border: '1px solid var(--ag-border-default)',
          boxShadow: 'var(--ag-shadow-card)',
          position: 'relative',
        }}>
          <button
            onClick={handleClose}
            aria-label="Dismiss voice feedback"
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'none',
              border: 'none',
              color: 'var(--ag-color-text-secondary)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={16} />
          </button>

          {voiceQuery && (
            <p style={{
              fontSize: '13px',
              color: 'var(--ag-color-text-secondary)',
              marginBottom: '6px',
            }}>
              <em>"{voiceQuery}"</em>
            </p>
          )}

          {voiceResponse && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              backgroundColor: 'var(--ag-color-primary-light)',
              padding: '10px 12px',
              borderRadius: 'var(--ag-radius-sm)',
              marginTop: '4px',
            }}>
              <Volume2 size={18} color="var(--ag-color-primary-base)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <p style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--ag-color-primary-dark)',
                lineHeight: 1.4,
              }}>
                {voiceResponse}
              </p>
            </div>
          )}

          {errorMessage && (
            <p style={{
              fontSize: '13px',
              color: 'var(--ag-color-danger-base)',
              fontWeight: 500,
            }}>
              {errorMessage}
            </p>
          )}
        </div>
      )}
    </section>
  );
};
