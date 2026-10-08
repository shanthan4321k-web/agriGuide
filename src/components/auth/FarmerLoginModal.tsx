import React, { useState, useRef } from 'react';
import type { Language, FarmerProfile } from '../../types';
import { translations } from '../../i18n/translations';
import { FarmService } from '../../services/farm/farmService';
import { SpeechService } from '../../utils/speechSynthesis';
import { fetchApi } from '../../services/apiConfig';
import { 
  Phone, 
  Mic, 
  Square, 
  Check, 
  ArrowRight, 
  RefreshCw, 
  UserCheck, 
  X,
  Volume2
} from 'lucide-react';

interface FarmerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  onLoginSuccess?: (profile: FarmerProfile) => void;
  onSuccess?: (profile: FarmerProfile) => void;
  initialPhone?: string;
}

export const FarmerLoginModal: React.FC<FarmerLoginModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  onLoginSuccess,
  onSuccess,
  initialPhone = '',
}) => {
  const t = translations[currentLang];
  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhone);
  const [step, setStep] = useState<'input' | 'confirm' | 'success'>('input');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [confirmedProfile, setConfirmedProfile] = useState<FarmerProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  if (!isOpen) return null;

  const handleStartVoiceInput = async () => {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processVoiceNumber(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('[FarmerLogin] Mic permission error:', err);
      setErrorMsg('Microphone access denied or unavailable.');
    }
  };

  const handleStopVoiceInput = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceNumber = async (blob: Blob) => {
    setIsProcessingVoice(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'phone_input.webm');
      formData.append('language', currentLang);

      const res = await fetchApi<{ text: string }>('/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.data?.text) {
        const transcript = res.data.text;
        // Extract 10 digits from speech
        const digits = transcript.replace(/\D/g, '');
        if (digits.length >= 10) {
          const tenDigits = digits.slice(-10);
          setPhoneNumber(tenDigits);
          setStep('confirm');
          readBackConfirmation(tenDigits);
        } else if (digits.length > 0) {
          setPhoneNumber(digits);
          setErrorMsg(`Heard ${digits.length} digits. Please provide full 10-digit number.`);
        } else {
          setErrorMsg('Could not hear digits clearly. Please try speaking clearly or typing.');
        }
      }
    } catch (err: any) {
      console.warn('[FarmerLogin] Voice transcription notice:', err.message);
      setErrorMsg('Voice transcription temporarily unavailable. Please type your number.');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const readBackConfirmation = (digits: string) => {
    const spacedDigits = digits.split('').join(' ');
    const readText = currentLang === 'te' 
      ? `మీరు నమోదు చేసిన మొబైల్ నంబర్: ${spacedDigits}. ఇది మీ మొబైల్ నంబరేనా?` 
      : currentLang === 'hi' 
      ? `आपने दर्ज किया: ${spacedDigits}. क्या यह आपका मोबाइल नंबर है?` 
      : `You entered: ${spacedDigits}. Is this your mobile number?`;
    SpeechService.speak(readText, currentLang);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneNumber.replace(/\D/g, '');
    if (clean.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }
    const tenDigits = clean.slice(-10);
    setPhoneNumber(tenDigits);
    setStep('confirm');
    readBackConfirmation(tenDigits);
  };

  const handleConfirmAndContinue = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const profile = await FarmService.identifySession(phoneNumber, currentLang);
      if (profile) {
        setConfirmedProfile(profile);
        setStep('success');
        if (profile.phone) {
          localStorage.setItem('agriguide_farmer_phone', profile.phone);
        }
        localStorage.setItem('agriguide_farmer_profile', JSON.stringify(profile));
        
        const successSpeech = currentLang === 'te' 
          ? `మొబైల్ నంబర్ నిర్ధారించబడింది. నమస్కారం!` 
          : currentLang === 'hi' 
          ? `मोबाइल नंबर की पुष्टि हो गई। स्वागत है!` 
          : `Mobile number confirmed. Welcome to AgriGuide!`;
        SpeechService.speak(successSpeech, currentLang);

        setTimeout(() => {
          (onSuccess || onLoginSuccess)?.(profile);
          onClose();
        }, 1200);
      } else {
        setErrorMsg('Failed to confirm session. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(25, 53, 42, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'var(--ag-color-surface-base)',
        borderRadius: 'var(--ag-radius-card)',
        width: '100%',
        maxWidth: '440px',
        boxShadow: 'var(--ag-shadow-elevated)',
        border: '1px solid var(--ag-border-default)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--ag-border-default)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FAFBF7',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--ag-color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ag-color-primary-base)',
            }}>
              <Phone size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--ag-color-text-primary)' }}>
              {t.welcomeToAgriGuide}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ag-color-text-secondary)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {step === 'input' && (
            <div>
              <p style={{ fontSize: '14px', color: 'var(--ag-color-text-secondary)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                {t.enterMobileNumber}
              </p>

              <form onSubmit={handleManualSubmit}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ag-color-text-primary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  {t.enterMobileNumber}
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '2px solid var(--ag-border-default)',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  backgroundColor: '#FFFFFF',
                  marginBottom: '16px',
                }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', marginRight: '8px' }}>
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                    style={{
                      border: 'none',
                      outline: 'none',
                      fontSize: '18px',
                      fontWeight: 700,
                      width: '100%',
                      color: 'var(--ag-color-text-primary)',
                      letterSpacing: '0.05em',
                    }}
                  />
                </div>

                {errorMsg && (
                  <div style={{ color: 'var(--ag-color-danger-base)', fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--ag-color-primary-base)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '12px',
                    borderRadius: 'var(--ag-radius-full)',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    minHeight: '48px',
                    boxShadow: 'var(--ag-shadow-button)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <span>{t.confirm}</span>
                  <ArrowRight size={18} />
                </button>
              </form>

              {/* Voice Alternative */}
              <div style={{
                borderTop: '1px solid var(--ag-border-default)',
                paddingTop: '16px',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase', marginBottom: '10px' }}>
                  {t.sayMobileNumber}
                </p>
                <button
                  type="button"
                  onClick={isRecording ? handleStopVoiceInput : handleStartVoiceInput}
                  disabled={isProcessingVoice}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: isRecording ? '#FDF0F0' : 'var(--ag-color-harvest-light)',
                    color: isRecording ? 'var(--ag-color-danger-base)' : 'var(--ag-color-warning-base)',
                    border: `1px solid ${isRecording ? '#F7B5B3' : '#FAD48C'}`,
                    padding: '10px 20px',
                    borderRadius: 'var(--ag-radius-full)',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    minHeight: '48px',
                  }}
                >
                  {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
                  <span>
                    {isProcessingVoice 
                      ? t.voiceProcessing 
                      : isRecording 
                      ? t.voiceListening 
                      : `🎙 ${t.sayMobileNumber}`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase' }}>
                {t.youEntered}
              </span>
              <div style={{
                fontSize: '28px',
                fontWeight: 900,
                color: 'var(--ag-color-primary-base)',
                margin: '12px 0 6px 0',
                letterSpacing: '0.08em',
              }}>
                +91 {phoneNumber}
              </div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ag-color-text-primary)', margin: '0 0 24px 0' }}>
                {t.isThisYourNumber}
              </p>

              {errorMsg && (
                <div style={{ color: 'var(--ag-color-danger-base)', fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleConfirmAndContinue}
                  disabled={loading}
                  style={{
                    backgroundColor: 'var(--ag-color-primary-base)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '12px',
                    borderRadius: 'var(--ag-radius-full)',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    minHeight: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: 'var(--ag-shadow-button)',
                  }}
                >
                  <Check size={18} />
                  <span>{loading ? 'Confirming...' : t.yesContinue}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('input')}
                  disabled={loading}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--ag-color-text-secondary)',
                    border: '1px solid var(--ag-border-default)',
                    padding: '10px',
                    borderRadius: 'var(--ag-radius-full)',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={15} />
                  <span>{t.changeNumber}</span>
                </button>
              </div>

              <div style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => readBackConfirmation(phoneNumber)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--ag-color-primary-base)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Volume2 size={14} />
                  <span>{t.listen}</span>
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--ag-color-primary-light)',
                color: 'var(--ag-color-primary-base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}>
                <UserCheck size={28} />
              </div>
              <h4 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ag-color-text-primary)', margin: '0 0 6px 0' }}>
                {t.mobileConfirmed || 'Mobile number confirmed'}
              </h4>
              <p style={{ fontSize: '14px', color: 'var(--ag-color-text-secondary)', margin: 0 }}>
                {confirmedProfile?.fullName || 'Farmer'} (+91 {confirmedProfile?.phone})
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
