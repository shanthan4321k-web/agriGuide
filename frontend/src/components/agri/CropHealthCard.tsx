import React, { useState, useRef, useEffect } from 'react';
import type { CropHealth, CropDoctorDiagnosis, Language } from '../../types';
import { translations } from '../../i18n/translations';
import { CropHealthService } from '../../services/crop/cropHealthService';
import { 
  Camera, 
  CheckCircle, 
  AlertTriangle, 
  AlertOctagon, 
  X, 
  Mic, 
  Square, 
  Trash2, 
  Plus, 
  HelpCircle,
  Sparkles
} from 'lucide-react';

interface CropHealthCardProps {
  crops: CropHealth[];
  currentLang: Language;
  onCropUpdate?: (updated: CropHealth) => void;
  style?: React.CSSProperties;
}

export const CropHealthCard: React.FC<CropHealthCardProps> = ({
  crops,
  currentLang,
  style,
}) => {
  const t = translations[currentLang];
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  
  // Multimodal Inputs
  const [selectedImages, setSelectedImages] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [voiceTranscriptText, setVoiceTranscriptText] = useState<string>('');
  const [selectedCropName, setSelectedCropName] = useState<string>('Cotton');

  // Loading & Diagnostics
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [diagnosisResult, setDiagnosisResult] = useState<CropDoctorDiagnosis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Progressive loading message sequence
  const loadingMessages = [
    'Uploading photos...',
    'Understanding your voice...',
    'Checking the crop images with GLM-5.3-Flash...',
    'Preparing your crop assessment...',
  ];

  useEffect(() => {
    let timer: any;
    if (isAnalyzing) {
      setLoadingStage(0);
      timer = setInterval(() => {
        setLoadingStage((prev) => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
      }, 1800);
    }
    return () => clearInterval(timer);
  }, [isAnalyzing]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      selectedImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    };
  }, [selectedImages, recordedAudioUrl]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - selectedImages.length;
    const newFiles = Array.from(files).slice(0, remainingSlots);

    const newItems = newFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedImages(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Voice Recording Handlers
  const startVoiceRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordedAudioBlob(audioBlob);
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.warn('[CropDoctor] Mic access notice:', err);
      alert('Microphone access is needed to record your voice description.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearVoiceRecording = () => {
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setVoiceTranscriptText('');
  };

  const handleRunAnalysis = async () => {
    if (selectedImages.length === 0) {
      setErrorMessage('Please take or upload at least one photo of the affected plant or leaf.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setDiagnosisResult(null);

    const result = await CropHealthService.diagnoseCropMultimodal({
      images: selectedImages.map(item => item.file),
      audioBlob: recordedAudioBlob,
      voiceText: voiceTranscriptText,
      cropName: selectedCropName,
      language: currentLang,
    });

    setIsAnalyzing(false);

    if (result.status === 'success' && result.diagnosis) {
      setDiagnosisResult(result.diagnosis);
    } else {
      setErrorMessage(result.message || 'Crop Doctor analysis is temporarily unavailable.');
    }
  };

  const handleResetModal = () => {
    setSelectedImages([]);
    clearVoiceRecording();
    setDiagnosisResult(null);
    setErrorMessage(null);
    setShowDoctorModal(false);
  };

  const getStatusBadge = (status: CropHealth['status']) => {
    switch (status) {
      case 'healthy':
        return {
          label: t.statusHealthy,
          icon: <CheckCircle size={14} />,
          bg: 'var(--ag-color-primary-light)',
          color: 'var(--ag-color-primary-dark)',
          border: '1px solid #A3D9A5',
        };
      case 'under_watch':
        return {
          label: t.statusUnderWatch,
          icon: <AlertTriangle size={14} />,
          bg: 'var(--ag-color-harvest-light)',
          color: 'var(--ag-color-warning-base)',
          border: '1px solid #FAD48C',
        };
      case 'attention':
      default:
        return {
          label: t.statusAttention,
          icon: <AlertOctagon size={14} />,
          bg: '#FDF0F0',
          color: 'var(--ag-color-danger-base)',
          border: '1px solid #F7B5B3',
        };
    }
  };

  return (
    <section 
      aria-labelledby="crop-health-heading" 
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
          {/* Header & Diagnose CTA */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
          }}>
            <h3 
              id="crop-health-heading"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--ag-color-text-secondary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {t.cropHealthTitle}
            </h3>

            <button
              onClick={() => setShowDoctorModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--ag-color-primary-light)',
                color: 'var(--ag-color-primary-dark)',
                border: '1px solid #A3D9A5',
                padding: '6px 14px',
                borderRadius: 'var(--ag-radius-full)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Camera size={14} color="var(--ag-color-primary-base)" />
              <span>{t.diagnoseCta}</span>
            </button>
          </div>

          {/* Crops List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {crops.map((crop) => {
              const badge = getStatusBadge(crop.status);
              return (
                <div 
                  key={crop.id}
                  style={{
                    backgroundColor: 'var(--ag-color-bg-base)',
                    borderRadius: 'var(--ag-radius-md)',
                    padding: '12px 14px',
                    border: '1px solid var(--ag-border-default)',
                  }}
                >
                  {/* Crop Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}>
                    <div>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ag-color-text-primary)' }}>
                        {crop.cropName}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)', marginLeft: '6px' }}>
                        ({crop.acres} Acres · {crop.variety})
                      </span>
                    </div>

                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: badge.bg,
                      border: badge.border,
                      color: badge.color,
                      padding: '3px 8px',
                      borderRadius: 'var(--ag-radius-full)',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}>
                      {badge.icon}
                      {badge.label}
                    </span>
                  </div>

                  {/* Disease / Condition Note */}
                  {crop.diseaseIdentified && (
                    <p style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--ag-color-danger-base)',
                      marginBottom: '4px',
                    }}>
                      ⚠ {crop.diseaseIdentified}
                    </p>
                  )}

                  {/* Recommended Action */}
                  <p style={{
                    fontSize: '13px',
                    color: 'var(--ag-color-text-primary)',
                    lineHeight: 1.4,
                    marginBottom: '6px',
                  }}>
                    {crop.recommendedAction}
                  </p>

                  <div style={{
                    fontSize: '11px',
                    color: 'var(--ag-color-text-secondary)',
                  }}>
                    {t.lastChecked}: {crop.lastInspectionDate}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CROP DOCTOR MULTIMODAL MODAL EXPERIENCE (Photos + Voice + GLM-5.3-Flash)   */}
      {/* ========================================================================= */}
      {showDoctorModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(25, 53, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }} 
          onClick={() => { if (!isAnalyzing) setShowDoctorModal(false); }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: 'var(--ag-shadow-modal)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--ag-color-primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Camera size={18} color="var(--ag-color-primary-base)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ag-color-text-primary)', margin: 0 }}>
                    Crop Doctor Multimodal Assessment
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)', margin: 0 }}>
                    Photos + Farmer Voice + GLM-5.3-Flash Reasoning
                  </p>
                </div>
              </div>

              {!isAnalyzing && (
                <button 
                  onClick={handleResetModal}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
                >
                  <X size={20} color="var(--ag-color-text-secondary)" />
                </button>
              )}
            </div>

            {/* If Diagnosis Result is Available: Render Comprehensive Farmer-First Results */}
            {diagnosisResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Result Status Banner */}
                {diagnosisResult.status === 'problem_detected' && (
                  <div style={{
                    backgroundColor: '#FEF3F2',
                    border: '1.5px solid #FECDCA',
                    borderRadius: 'var(--ag-radius-md)',
                    padding: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <AlertOctagon size={20} color="var(--ag-color-danger-base)" />
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ag-color-danger-base)', textTransform: 'uppercase' }}>
                        Crop Problem Detected ({diagnosisResult.severity} severity)
                      </span>
                    </div>
                    <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#912018', margin: '0 0 6px 0' }}>
                      {diagnosisResult.diagnosisTitle}
                    </h4>
                    <p style={{ fontSize: '14px', color: '#B42318', margin: 0, lineHeight: 1.4 }}>
                      {diagnosisResult.summary}
                    </p>
                  </div>
                )}

                {diagnosisResult.status === 'no_issue' && (
                  <div style={{
                    backgroundColor: 'var(--ag-color-primary-light)',
                    border: '1.5px solid #A3D9A5',
                    borderRadius: 'var(--ag-radius-md)',
                    padding: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <CheckCircle size={20} color="var(--ag-color-primary-dark)" />
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ag-color-primary-dark)', textTransform: 'uppercase' }}>
                        Crop Looks Healthy
                      </span>
                    </div>
                    <h4 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ag-color-primary-dark)', margin: '0 0 6px 0' }}>
                      {diagnosisResult.diagnosisTitle}
                    </h4>
                    <p style={{ fontSize: '14px', color: '#1B4D21', margin: 0, lineHeight: 1.4 }}>
                      {diagnosisResult.summary}
                    </p>
                  </div>
                )}

                {diagnosisResult.status === 'uncertain' && (
                  <div style={{
                    backgroundColor: 'var(--ag-color-harvest-light)',
                    border: '1.5px solid #FAD48C',
                    borderRadius: 'var(--ag-radius-md)',
                    padding: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <HelpCircle size={20} color="var(--ag-color-warning-base)" />
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ag-color-warning-base)', textTransform: 'uppercase' }}>
                        We Need a Clearer Look
                      </span>
                    </div>
                    <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#7A4D05', margin: '0 0 6px 0' }}>
                      {diagnosisResult.diagnosisTitle}
                    </h4>
                    <p style={{ fontSize: '14px', color: '#935C07', margin: 0, lineHeight: 1.4 }}>
                      {diagnosisResult.summary}
                    </p>
                  </div>
                )}

                {/* Analyzed Photos Gallery */}
                <div>
                  <h5 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Analyzed Photos ({selectedImages.length})
                  </h5>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {selectedImages.map((img, idx) => (
                      <img 
                        key={idx}
                        src={img.previewUrl} 
                        alt={`Analyzed view ${idx + 1}`}
                        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--ag-border-default)' }}
                      />
                    ))}
                  </div>
                </div>

                {/* What We Found (Visual Findings) */}
                {diagnosisResult.visualFindings.length > 0 && (
                  <div style={{ backgroundColor: 'var(--ag-color-bg-base)', padding: '14px', borderRadius: 'var(--ag-radius-md)', border: '1px solid var(--ag-border-default)' }}>
                    <h5 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ag-color-text-primary)', marginBottom: '6px' }}>
                      What We Found (Visual Evidence)
                    </h5>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--ag-color-text-secondary)', lineHeight: 1.5 }}>
                      {diagnosisResult.visualFindings.map((finding, idx) => (
                        <li key={idx}>{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Farmer Reported vs Visual Correlation (Voice/Visual distinction) */}
                {diagnosisResult.farmerReportedSymptoms.length > 0 && (
                  <div style={{ backgroundColor: '#F8F9FA', padding: '12px 14px', borderRadius: 'var(--ag-radius-md)', border: '1px dashed #CBD5E1', fontSize: '12px', color: '#475569' }}>
                    <strong>Farmer-Reported Voice Context:</strong>
                    <p style={{ margin: '4px 0 0 0', fontStyle: 'italic' }}>
                      "{diagnosisResult.farmerReportedSymptoms.join(' ')}"
                    </p>
                  </div>
                )}

                {/* What You Should Do (Recommendations) */}
                {diagnosisResult.recommendation.length > 0 && (
                  <div style={{ backgroundColor: '#F0FDF4', padding: '14px', borderRadius: 'var(--ag-radius-md)', border: '1px solid #BBF7D0' }}>
                    <h5 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ag-color-primary-dark)', marginBottom: '6px' }}>
                      What You Should Do (Practical Steps)
                    </h5>
                    <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#166534', lineHeight: 1.5 }}>
                      {diagnosisResult.recommendation.map((rec, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{rec}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* What To Avoid (Safety Guide) */}
                {diagnosisResult.whatToAvoid.length > 0 && (
                  <div style={{ backgroundColor: '#FFFBEB', padding: '12px 14px', borderRadius: 'var(--ag-radius-md)', border: '1px solid #FDE68A' }}>
                    <h5 style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', marginBottom: '4px' }}>
                      Things to Avoid
                    </h5>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#B45309', lineHeight: 1.4 }}>
                      {diagnosisResult.whatToAvoid.map((avoid, idx) => (
                        <li key={idx}>{avoid}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    onClick={handleResetModal}
                    style={{
                      flex: 1,
                      minHeight: '46px',
                      backgroundColor: 'var(--ag-color-primary-base)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 'var(--ag-radius-md)',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                  <button
                    onClick={() => {
                      setDiagnosisResult(null);
                      setSelectedImages([]);
                      clearVoiceRecording();
                    }}
                    style={{
                      flex: 1,
                      minHeight: '46px',
                      backgroundColor: 'var(--ag-color-surface-base)',
                      color: 'var(--ag-color-text-primary)',
                      border: '1px solid var(--ag-border-default)',
                      borderRadius: 'var(--ag-radius-md)',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Check Another Crop
                  </button>
                </div>
              </div>
            ) : isAnalyzing ? (
              /* Progressive Loading State */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 16px',
                textAlign: 'center',
              }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  border: '4px solid var(--ag-color-primary-light)',
                  borderTopColor: 'var(--ag-color-primary-base)',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '20px',
                }} />
                <h4 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--ag-color-text-primary)', marginBottom: '8px' }}>
                  {loadingMessages[loadingStage]}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--ag-color-text-secondary)', maxWidth: '340px', lineHeight: 1.4 }}>
                  Comparing {selectedImages.length} photo(s) with verified agronomic rules and farmer voice notes...
                </p>
              </div>
            ) : (
              /* Input & Upload Form */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Crop Selector */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Select Crop
                  </label>
                  <select
                    value={selectedCropName}
                    onChange={(e) => setSelectedCropName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--ag-radius-md)',
                      border: '1px solid var(--ag-border-default)',
                      backgroundColor: 'var(--ag-color-surface-base)',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--ag-color-text-primary)',
                    }}
                  >
                    <option value="Cotton">Cotton (పత్తి / कपास)</option>
                    <option value="Maize">Maize (మొక్కజొన్న / मक्का)</option>
                    <option value="Paddy">Paddy (వరి / धान)</option>
                    <option value="Chilli">Chilli (మిరప / मिर्च)</option>
                  </select>
                </div>

                {/* 1. Photo Collection Area */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ag-color-text-primary)' }}>
                      Crop Photos ({selectedImages.length}/5)
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)' }}>
                      Minimum 1, Maximum 5
                    </span>
                  </div>

                  {/* Thumbnail Row */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {selectedImages.map((img, idx) => (
                      <div 
                        key={idx}
                        style={{
                          position: 'relative',
                          width: '84px',
                          height: '84px',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          border: '2px solid var(--ag-color-primary-base)',
                        }}
                      >
                        <img 
                          src={img.previewUrl} 
                          alt={`Uploaded view ${idx + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          onClick={() => handleRemoveImage(idx)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            backgroundColor: 'rgba(0,0,0,0.65)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {/* Add Photo Button */}
                    {selectedImages.length < 5 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          width: '84px',
                          height: '84px',
                          borderRadius: '12px',
                          border: '2px dashed var(--ag-border-default)',
                          backgroundColor: 'var(--ag-color-bg-base)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          color: 'var(--ag-color-primary-base)',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        <Plus size={20} />
                        <span>Add Photo</span>
                      </button>
                    )}
                  </div>

                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleImageSelect}
                  />

                  {/* Compact Guidance */}
                  <div style={{
                    backgroundColor: 'var(--ag-color-bg-base)',
                    padding: '10px 14px',
                    borderRadius: 'var(--ag-radius-md)',
                    border: '1px solid var(--ag-border-default)',
                    fontSize: '12px',
                    color: 'var(--ag-color-text-secondary)',
                    lineHeight: 1.4,
                  }}>
                    <strong style={{ color: 'var(--ag-color-text-primary)' }}>Good photos help AgriGuide understand:</strong>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <span style={{ backgroundColor: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>🌿 Whole plant</span>
                      <span style={{ backgroundColor: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>🔍 Affected area</span>
                      <span style={{ backgroundColor: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>🍃 Close-up of leaf</span>
                      <span style={{ backgroundColor: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>🔄 Back of leaf</span>
                    </div>
                  </div>
                </div>

                {/* 2. Voice Input Section */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ag-color-text-primary)', display: 'block', marginBottom: '6px' }}>
                    Tell AgriGuide what you noticed (Voice Description)
                  </label>

                  <div style={{
                    border: '1px solid var(--ag-border-default)',
                    borderRadius: 'var(--ag-radius-md)',
                    padding: '12px 14px',
                    backgroundColor: 'var(--ag-color-bg-base)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          backgroundColor: isRecording ? 'var(--ag-color-danger-base)' : 'var(--ag-color-primary-base)',
                          color: '#FFFFFF',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isRecording ? <Square size={16} /> : <Mic size={20} />}
                      </button>

                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ag-color-text-primary)' }}>
                          {isRecording ? 'Listening... Tap square to stop' : (recordedAudioBlob ? 'Voice recording ready' : 'Tap mic to speak (Telugu / Hindi / English)')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)' }}>
                          {recordedAudioBlob ? 'Spoken description will be transcribed by Whisper' : 'Describe spots, color changes, or weather noticed'}
                        </div>
                      </div>
                    </div>

                    {recordedAudioBlob && !isRecording && (
                      <button
                        onClick={clearVoiceRecording}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--ag-color-danger-base)',
                          cursor: 'pointer',
                          padding: '6px',
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Error Banner if any */}
                {errorMessage && (
                  <div style={{
                    backgroundColor: '#FEF3F2',
                    border: '1px solid #FECDCA',
                    borderRadius: 'var(--ag-radius-md)',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: '#B42318',
                  }}>
                    {errorMessage}
                  </div>
                )}

                {/* Submit Assessment Button */}
                <button
                  onClick={handleRunAnalysis}
                  disabled={selectedImages.length === 0}
                  style={{
                    width: '100%',
                    minHeight: '52px',
                    backgroundColor: selectedImages.length > 0 ? 'var(--ag-color-primary-base)' : '#94A3B8',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 'var(--ag-radius-md)',
                    fontSize: '15px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: selectedImages.length > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: 'var(--ag-shadow-button)',
                  }}
                >
                  <Sparkles size={18} />
                  <span>Analyze Crop ({selectedImages.length} Photos {recordedAudioBlob ? '+ Voice' : ''})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
