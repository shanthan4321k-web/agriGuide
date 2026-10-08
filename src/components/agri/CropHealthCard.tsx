import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CropHealth, CropDoctorDiagnosis, Language } from '../../types';
import { translations } from '../../i18n/translations';
import { CropHealthService, type CropDiagnosisHistoryItem } from '../../services/crop/cropHealthService';
import { 
  Camera, 
  CheckCircle, 
  AlertTriangle, 
  AlertOctagon, 
  X, 
  Mic, 
  Square, 
  Plus, 
  HelpCircle, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Play, 
  RotateCcw, 
  Maximize2,
  History,
  ChevronRight,
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface CropHealthCardProps {
  crops: CropHealth[];
  currentLang: Language;
  onCropUpdate?: (updated: CropHealth) => void;
  style?: React.CSSProperties;
}

interface MismatchErrorData {
  notice: string;
  selectedCrop: string;
  visualCrop: string;
  voiceCrop?: string | null;
}

export const CropHealthCard: React.FC<CropHealthCardProps> = ({
  crops,
  currentLang,
  style,
}) => {
  const t = translations[currentLang];
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'assess' | 'history'>('assess');
  
  // History list from Supabase
  const [historyList, setHistoryList] = useState<CropDiagnosisHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isHistoricalView, setIsHistoricalView] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'failed' | null>('saved');
  const [showFullTranscript, setShowFullTranscript] = useState<boolean>(false);
  
  // Multimodal Inputs
  const [selectedImages, setSelectedImages] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [analyzedImagesList, setAnalyzedImagesList] = useState<Array<{ previewUrl: string; name: string }>>([]);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; index: number } | null>(null);

  // Voice Recording & Live Speech Recognition
  const [isRecording, setIsRecording] = useState(false);
  const [liveInterimTranscript, setLiveInterimTranscript] = useState<string>('');
  const [liveFinalTranscript, setLiveFinalTranscript] = useState<string>('');
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [voiceTranscriptText, setVoiceTranscriptText] = useState<string>('');
  const [selectedCropName, setSelectedCropName] = useState<string>('Cotton');

  // Text to Speech (Read Aloud)
  const [speakingSection, setSpeakingSection] = useState<string | null>(null);

  // Loading & Diagnostics
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [diagnosisResult, setDiagnosisResult] = useState<CropDoctorDiagnosis | null>(null);
  const [mismatchError, setMismatchError] = useState<MismatchErrorData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Track all active object URLs in a ref so they are never prematurely revoked on re-renders
  const activeObjectUrlsRef = useRef<Set<string>>(new Set());

  const createTrackedObjectURL = useCallback((blobOrFile: Blob | File): string => {
    const url = URL.createObjectURL(blobOrFile);
    activeObjectUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeTrackedObjectURL = useCallback((url: string | null | undefined) => {
    if (url && activeObjectUrlsRef.current.has(url)) {
      activeObjectUrlsRef.current.delete(url);
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Progressive loading message sequence
  const loadingMessages = [
    'Uploading photos...',
    'Understanding what you said...',
    'Checking the crop images...',
    'Comparing the submitted photos...',
    'Preparing your crop assessment...',
  ];

  useEffect(() => {
    let timer: any;
    if (isAnalyzing) {
      setLoadingStage(0);
      timer = setInterval(() => {
        setLoadingStage((prev) => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
      }, 1600);
    }
    return () => clearInterval(timer);
  }, [isAnalyzing]);

  // Clean up object URLs and speech ONLY when component unmounts
  useEffect(() => {
    return () => {
      activeObjectUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          // ignore
        }
      });
      activeObjectUrlsRef.current.clear();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Cancel speech synthesis when modal closes
  const stopAllSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeakingSection(null);
    }
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - selectedImages.length;
    const newFiles = Array.from(files).slice(0, remainingSlots);

    const newItems = newFiles.map(file => ({
      file,
      previewUrl: createTrackedObjectURL(file),
    }));

    setSelectedImages(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => {
      const target = prev[index];
      if (target?.previewUrl) {
        revokeTrackedObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Live Speech Recognition + MediaRecorder Voice Handlers
  const startVoiceRecording = async () => {
    if (isRecording) return;
    setLiveInterimTranscript('');
    setLiveFinalTranscript('');
    stopAllSpeech();

    try {
      // 1. Start standard MediaRecorder stream for authoritative backend Whisper transcription
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
        const aUrl = createTrackedObjectURL(audioBlob);
        setRecordedAudioUrl(aUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // 2. Start Browser Live Speech Recognition for immediate UI feedback
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        // Map language to locale
        recognition.lang = currentLang === 'te' ? 'te-IN' : (currentLang === 'hi' ? 'hi-IN' : 'en-IN');

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript + ' ';
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          if (final) {
            setLiveFinalTranscript(prev => (prev + final).trim());
          }
          setLiveInterimTranscript(interim);
          const fullText = (liveFinalTranscript + ' ' + final + ' ' + interim).trim();
          setVoiceTranscriptText(fullText);
        };

        recognition.onerror = (event: any) => {
          console.warn('[CropDoctor] Live speech recognition notice:', event.error);
        };

        try {
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (rErr) {
          console.warn('[CropDoctor] Recognition start fallback:', rErr);
        }
      }
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
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {
        // ignore already stopped
      }
      speechRecognitionRef.current = null;
    }
  };

  const clearVoiceRecording = () => {
    if (recordedAudioUrl) revokeTrackedObjectURL(recordedAudioUrl);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setVoiceTranscriptText('');
    setLiveInterimTranscript('');
    setLiveFinalTranscript('');
  };

  const playRecordedAudio = () => {
    if (recordedAudioUrl && audioPlayerRef.current) {
      audioPlayerRef.current.play();
    }
  };

  // Text to Speech (SpeechSynthesis) handler
  const handleSpeakText = (sectionKey: string, textToSpeak: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (speakingSection === sectionKey) {
      stopAllSpeech();
      return;
    }

    stopAllSpeech();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = currentLang === 'te' ? 'te-IN' : (currentLang === 'hi' ? 'hi-IN' : 'en-IN');
    utterance.rate = 0.95; // slightly slower for clarity

    // Try finding matching native voice
    const voices = window.speechSynthesis.getVoices();
    const targetLangPrefix = currentLang === 'te' ? 'te' : (currentLang === 'hi' ? 'hi' : 'en');
    const matchedVoice = voices.find(v => v.lang.startsWith(targetLangPrefix));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => setSpeakingSection(null);
    utterance.onerror = () => setSpeakingSection(null);

    setSpeakingSection(sectionKey);
    window.speechSynthesis.speak(utterance);
  };


  // Load history when opening modal or changing tab
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const items = await CropHealthService.getDiagnosisHistory();
      setHistoryList(items || []);
    } catch (err) {
      console.warn('[CropDoctor] History fetch error:', err);
      setHistoryList([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (showDoctorModal && activeTab === 'history') {
      loadHistory();
    }
  }, [showDoctorModal, activeTab, loadHistory]);

  const handleOpenHistoricalItem = async (item: CropDiagnosisHistoryItem) => {
    stopAllSpeech();
    setIsAnalyzing(true);
    try {
      const full = await CropHealthService.getDiagnosisById(item.id);
      if (full && full.diagnosis) {
        setDiagnosisResult(full.diagnosis);
        setIsHistoricalView(true);
        setSaveStatus('saved');
        setMismatchError(null);
        if (full.images && full.images.length > 0) {
          setAnalyzedImagesList(full.images.map((img: any, idx: number) => ({
            previewUrl: img.signedUrl || '',
            name: `Photo #${idx + 1}`
          })));
          setActiveImageIdx(0);
        } else {
          setAnalyzedImagesList([]);
        }
      } else {
        alert(t.dataUnavailable || 'Data unavailable');
      }
    } catch (err) {
      console.error('[CropDoctor] Failed to open historical record:', err);
      alert(t.dataUnavailable || 'Data unavailable');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (selectedImages.length === 0) {
      setErrorMessage(currentLang === 'te' ? 'దయచేసి కనీసం ఒక పంట ఫోటో తీయండి లేదా అప్‌లోడ్ చేయండి.' : (currentLang === 'hi' ? 'कृपया कम से कम एक फसल की तस्वीर लें या अपलोड करें।' : 'Please take or upload at least one photo of the affected plant or leaf.'));
      return;
    }

    stopAllSpeech();
    setIsAnalyzing(true);
    setErrorMessage(null);
    setMismatchError(null);
    setDiagnosisResult(null);
    setIsHistoricalView(false);

    // Save image previews for rendering in result
    setAnalyzedImagesList(selectedImages.map(img => ({ previewUrl: img.previewUrl, name: img.file.name })));
    setActiveImageIdx(0);

    const result = await CropHealthService.diagnoseCropMultimodal({
      images: selectedImages.map(item => item.file),
      audioBlob: recordedAudioBlob,
      voiceText: voiceTranscriptText,
      cropName: selectedCropName,
      language: currentLang,
    });

    setIsAnalyzing(false);

    const isMismatchDetected = 
      result.status === 'mismatch' ||
      Boolean(result.cropMismatchDetected) ||
      Boolean(result.diagnosis?.cropMismatchDetected) ||
      Boolean(result.mismatchNotice) ||
      Boolean(result.diagnosis?.mismatchNotice) ||
      /సంబంధించినది కాదు|పోస్టర్|మీరు పంటగా|పంట అసమానత|వేరే పంట|not related|poster|mismatch|different crop/i.test(
        (result.diagnosis?.summary || '') + ' ' + (result.diagnosis?.diagnosisTitle || '') + ' ' + (result.message || '')
      );

    if (isMismatchDetected) {
      // STOP! DO NOT GO TO RESULT PAGE! Stay on upload/details input page!
      setDiagnosisResult(null);
      setSaveStatus(null);
      setMismatchError({
        notice: result.mismatchNotice || result.diagnosis?.mismatchNotice || result.diagnosis?.summary || result.message || (
          currentLang === 'te'
            ? `పంట వివరాలలో తేడా గుర్తించబడింది: మీరు ఎంచుకున్న పంట '${result.diagnosis?.selectedCrop || selectedCropName}', కానీ ఫోటోలలో లేదా వాయిస్‌లో ఇతర పంట వివరాలు ఉన్నాయి. దయచేసి వివరాలను సరిచూసి మళ్లీ విశ్లేషించండి.`
            : (currentLang === 'hi'
                ? `फसल विवरण में बेमेल पाया गया: आपने '${result.diagnosis?.selectedCrop || selectedCropName}' चुनी है, लेकिन तस्वीरों या आवाज में अन्य फसल का विवरण है। कृपया पुनः जांचें।`
                : 'Crop mismatch detected between selected crop, photos, and voice description. Please recheck your inputs and analyze again.')
        ),
        selectedCrop: result.selectedCrop || result.diagnosis?.selectedCrop || selectedCropName,
        visualCrop: result.visualCropIdentified || result.diagnosis?.visualCropIdentified || (currentLang === 'te' ? 'పోస్టర్ / వేరే చిత్రం' : 'Poster / Unrelated photo'),
        voiceCrop: result.voiceCropMentioned || result.diagnosis?.voiceCropMentioned || null,
      });
      return;
    }

    if (result.status === 'success' && result.diagnosis) {
      setMismatchError(null);
      setDiagnosisResult(result.diagnosis);
      setSaveStatus('saved');
      // Refresh background history
      loadHistory();
    } else {
      setSaveStatus('failed');
      setErrorMessage(result.message || (currentLang === 'te' ? 'పంట విశ్లేషణ తాత్కాలికంగా అందుబాటులో లేదు. దయచేసి మళ్లీ ప్రయత్నించండి.' : 'Crop Doctor analysis is temporarily unavailable. Please try again.'));
    }
  };

  const handleResetModal = () => {
    stopAllSpeech();
    selectedImages.forEach(img => revokeTrackedObjectURL(img.previewUrl));
    setSelectedImages([]);
    setAnalyzedImagesList([]);
    clearVoiceRecording();
    setDiagnosisResult(null);
    setMismatchError(null);
    setErrorMessage(null);
    setLightboxImage(null);
    setIsHistoricalView(false);
    setShowFullTranscript(false);
    setShowDoctorModal(false);
  };

  const handleSpeakFullAssessment = () => {
    if (!diagnosisResult) return;

    const sections = [
      diagnosisResult.diagnosisTitle,
      diagnosisResult.summary,
      diagnosisResult.visualFindings.length > 0 ? `${t.whatISawInPhotos}: ${diagnosisResult.visualFindings.join('. ')}` : '',
      diagnosisResult.combinedAssessment ? `${t.togetherCombined}: ${diagnosisResult.combinedAssessment}` : '',
      diagnosisResult.recommendation.length > 0 ? `${t.whatYouShouldDo}: ${diagnosisResult.recommendation.join('. ')}` : '',
      diagnosisResult.whatToAvoid.length > 0 ? `${t.thingsToAvoid}: ${diagnosisResult.whatToAvoid.join('. ')}` : '',
      diagnosisResult.monitoringAdvice ? `${t.checkAgain}: ${diagnosisResult.monitoringAdvice}` : '',
    ].filter(Boolean).join('. ');

    handleSpeakText('global', sections);
  };

  // Compute Evidence Strength from backend assessment
  const getEvidenceStrengthBadge = () => {
    if (!diagnosisResult) return null;
    const confidence = (diagnosisResult as any).evidenceAssessment?.photoCropAssessment?.identityConfidence ||
                       (diagnosisResult as any).evidenceQuality ||
                       (diagnosisResult.status === 'problem_detected' ? 'high' : 'medium');
    
    if (confidence === 'high' || confidence === 'strong') {
      return { label: t.evidenceStrong, color: '#166534', bg: '#DCFCE7', border: '#86EFAC' };
    } else if (confidence === 'medium' || confidence === 'moderate') {
      return { label: t.evidenceModerate, color: '#854D0E', bg: '#FEF9C3', border: '#FDE047' };
    } else {
      return { label: t.evidenceLimited, color: '#9A3412', bg: '#FFEDD5', border: '#FDBA74' };
    }
  };

  const getCropEmoji = (name?: string) => {
    const n = (name || '').toLowerCase();
    if (n.includes('chilli') || n.includes('మిరప') || n.includes('मिर्च')) return '🌶️';
    if (n.includes('cotton') || n.includes('పత్తి') || n.includes('कपास')) return '🌾';
    if (n.includes('maize') || n.includes('మొక్కజొన్న') || n.includes('मक्का')) return '🌽';
    if (n.includes('paddy') || n.includes('వరి') || n.includes('धान') || n.includes('rice')) return '🌾';
    if (n.includes('tomato') || n.includes('టమాట') || n.includes('टमाटर')) return '🍅';
    return '🌱';
  };

  const formatDiagnosisDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `Today, ${timeStr}`;
      if (isYesterday) return `Yesterday, ${timeStr}`;
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    } catch {
      return dateStr;
    }
  };

  // Localized live speech banner label
  const getLiveVoiceLabel = () => {
    switch (currentLang) {
      case 'te': return 'మీరు చెప్పింది';
      case 'hi': return 'आपने बताया';
      default: return 'You said';
    }
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

  // Visual Annotations for currently active image
  const currentImageAnnotations = diagnosisResult?.visualAnnotations?.filter(
    (ann) => ann.imageIndex === activeImageIdx
  ) || [];

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
                padding: '8px 16px',
                borderRadius: 'var(--ag-radius-full)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: '40px',
              }}
            >
              <Camera size={16} color="var(--ag-color-primary-base)" />
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
      {/* CROP DOCTOR MULTIMODAL MODAL EXPERIENCE (Photos + Voice + History) */}
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
          onClick={() => { if (!isAnalyzing) handleResetModal(); }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '92vh',
              overflowY: 'auto',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: 'var(--ag-shadow-modal)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Modal Header with Tabs */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--ag-color-primary-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Camera size={20} color="var(--ag-color-primary-base)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ag-color-text-primary)', margin: 0 }}>
                      AgriGuide Crop Doctor
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)', margin: 0 }}>
                      {currentLang === 'te' ? 'ఫోటోలు + వాయిస్ పంట ఆరోగ్య విశ్లేషణ' : (currentLang === 'hi' ? 'तस्वीरें + आवाज फसल स्वास्थ्य मूल्यांकन' : 'Multimodal Photos + Voice Assessment')}
                    </p>
                  </div>
                </div>

                {!isAnalyzing && (
                  <button 
                    onClick={handleResetModal}
                    aria-label="Close Crop Doctor"
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer', 
                      padding: '8px',
                      minWidth: '40px',
                      minHeight: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                    }}
                  >
                    <X size={22} color="var(--ag-color-text-secondary)" />
                  </button>
                )}
              </div>

              {/* Navigation Tabs (Assess vs History) */}
              {!diagnosisResult && !isAnalyzing && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  backgroundColor: 'var(--ag-color-bg-base)',
                  padding: '4px',
                  borderRadius: '12px',
                  border: '1px solid var(--ag-border-default)',
                }}>
                  <button
                    onClick={() => setActiveTab('assess')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: activeTab === 'assess' ? '#FFFFFF' : 'transparent',
                      color: activeTab === 'assess' ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-text-secondary)',
                      fontWeight: activeTab === 'assess' ? 800 : 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: activeTab === 'assess' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      minHeight: '38px',
                    }}
                  >
                    <Camera size={16} />
                    <span>{t.assessCropTab}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('history');
                      loadHistory();
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: activeTab === 'history' ? '#FFFFFF' : 'transparent',
                      color: activeTab === 'history' ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-text-secondary)',
                      fontWeight: activeTab === 'history' ? 800 : 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      minHeight: '38px',
                    }}
                  >
                    <History size={16} />
                    <span>{t.historyTab}</span>
                    {historyList.length > 0 && (
                      <span style={{
                        backgroundColor: activeTab === 'history' ? 'var(--ag-color-primary-light)' : '#E2E8F0',
                        color: activeTab === 'history' ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-text-secondary)',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '10px',
                      }}>
                        {historyList.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: HISTORY VIEW */}
            {activeTab === 'history' && !diagnosisResult && !isAnalyzing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ag-color-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {t.doctorHistoryTitle}
                  </h4>
                  <button
                    onClick={loadHistory}
                    disabled={isLoadingHistory}
                    aria-label="Refresh history"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--ag-color-primary-base)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      minHeight: '36px',
                    }}
                  >
                    <RefreshCw size={14} className={isLoadingHistory ? 'animate-spin' : ''} />
                    <span>{isLoadingHistory ? '...' : 'Refresh'}</span>
                  </button>
                </div>

                {isLoadingHistory ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--ag-color-text-secondary)', fontSize: '13px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '3px solid var(--ag-color-primary-light)',
                      borderTopColor: 'var(--ag-color-primary-base)',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 12px auto',
                    }} />
                    <span>{t.loadingHistory}</span>
                  </div>
                ) : historyList.length === 0 ? (
                  /* Honest Empty State - Strictly NO Mock Data */
                  <div style={{
                    backgroundColor: 'var(--ag-color-bg-base)',
                    borderRadius: '16px',
                    border: '1.5px dashed var(--ag-border-default)',
                    padding: '36px 20px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--ag-border-default)',
                    }}>
                      <History size={24} color="var(--ag-color-text-secondary)" />
                    </div>
                    <h5 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--ag-color-text-primary)', margin: 0 }}>
                      {t.noAssessmentsYet}
                    </h5>
                    <p style={{ fontSize: '13px', color: 'var(--ag-color-text-secondary)', maxWidth: '340px', margin: 0, lineHeight: 1.4 }}>
                      {t.noAssessmentsDesc}
                    </p>
                    <button
                      onClick={() => setActiveTab('assess')}
                      style={{
                        marginTop: '8px',
                        backgroundColor: 'var(--ag-color-primary-base)',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: 'var(--ag-radius-full)',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        minHeight: '40px',
                      }}
                    >
                      {t.diagnoseCta}
                    </button>
                  </div>
                ) : (
                  /* Supabase History Records List */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '58vh', overflowY: 'auto' }}>
                    {historyList.map((item) => {
                      const isProblem = item.status === 'problem_detected';
                      const isHealthy = item.status === 'no_issue';

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleOpenHistoricalItem(item)}
                          style={{
                            backgroundColor: 'var(--ag-color-bg-base)',
                            borderRadius: '14px',
                            border: '1px solid var(--ag-border-default)',
                            padding: '14px 16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                            e.currentTarget.style.borderColor = 'var(--ag-color-primary-base)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(47, 125, 50, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--ag-color-bg-base)';
                            e.currentTarget.style.borderColor = 'var(--ag-border-default)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            {/* Thumbnail or Fallback Emoji */}
                            {item.thumbnailSignedUrl ? (
                              <img 
                                src={item.thumbnailSignedUrl} 
                                alt={item.cropName} 
                                style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--ag-border-default)' }}
                              />
                            ) : (
                              <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '10px',
                                backgroundColor: isProblem ? '#FEE2E2' : (isHealthy ? 'var(--ag-color-primary-light)' : '#FEF3C7'),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '22px',
                                flexShrink: 0,
                              }}>
                                {getCropEmoji(item.cropName)}
                              </div>
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ag-color-text-primary)' }}>
                                  {getCropEmoji(item.cropName)} {item.cropName}
                                </span>

                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 'var(--ag-radius-full)',
                                  backgroundColor: isProblem ? '#FEE2E2' : (isHealthy ? '#DCFCE7' : '#FEF3C7'),
                                  color: isProblem ? '#991B1B' : (isHealthy ? '#166534' : '#92400E'),
                                  border: `1px solid ${isProblem ? '#FCA5A5' : (isHealthy ? '#86EFAC' : '#FDE047')}`,
                                }}>
                                  {isProblem ? t.possibleProblem : (isHealthy ? t.cropLooksHealthy : t.needClearerLook)}
                                </span>
                              </div>

                              <div style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: isProblem ? '#991B1B' : 'var(--ag-color-text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginBottom: '4px',
                              }}>
                                {item.diagnosisTitle}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--ag-color-text-secondary)', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Camera size={12} />
                                  {item.imageCount} {t.photosAnalyzed.toLowerCase()}
                                </span>
                                <span>•</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Mic size={12} />
                                  {item.voiceContextUsed ? t.voiceIncluded : t.noVoice}
                                </span>
                                <span>•</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Clock size={12} />
                                  {formatDiagnosisDate(item.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <ChevronRight size={18} color="var(--ag-color-text-secondary)" style={{ flexShrink: 0 }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* TAB 2 & RESULTS: CLEAN FARMER-FIRST RESULT SCREEN */}
            {diagnosisResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* TOP BAR: Save Confirmation Status + Global Listen Action */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  paddingBottom: '4px',
                  borderBottom: '1px solid var(--ag-border-default)',
                }}>
                  {/* Left: Save Confirmation Badge */}
                  <div>
                    {saveStatus === 'saved' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: '#DCFCE7',
                          color: '#166534',
                          border: '1px solid #86EFAC',
                          padding: '3px 10px',
                          borderRadius: 'var(--ag-radius-full)',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}>
                          <ShieldCheck size={14} />
                          {isHistoricalView ? t.reconstructedRecord : t.assessmentSaved}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)' }}>
                          {t.savedToHistory}
                        </span>
                      </div>
                    ) : saveStatus === 'failed' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#FEE2E2',
                        color: '#991B1B',
                        border: '1px solid #FCA5A5',
                        padding: '3px 10px',
                        borderRadius: 'var(--ag-radius-full)',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}>
                        <AlertTriangle size={14} />
                        {t.assessmentSaveFailed}
                      </span>
                    ) : null}
                  </div>

                  {/* Right: One Prominent Global Read-Aloud Action */}
                  <button
                    onClick={handleSpeakFullAssessment}
                    aria-label="Listen to assessment"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: speakingSection === 'global' ? 'var(--ag-color-primary-base)' : 'var(--ag-color-primary-light)',
                      color: speakingSection === 'global' ? '#FFFFFF' : 'var(--ag-color-primary-dark)',
                      border: '1.5px solid #86EFAC',
                      padding: '10px 18px',
                      borderRadius: 'var(--ag-radius-full)',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      minHeight: '48px',
                      boxShadow: '0 2px 6px rgba(47, 125, 50, 0.12)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {speakingSection === 'global' ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    <span>{speakingSection === 'global' ? t.stopListening : t.listenAssessment}</span>
                  </button>
                </div>

                {/* COMPACT STATUS HERO */}
                {(() => {
                  const strength = getEvidenceStrengthBadge();
                  const isProblem = diagnosisResult.status === 'problem_detected';
                  const isHealthy = diagnosisResult.status === 'no_issue';
                  const isUncertain = diagnosisResult.status === 'uncertain';

                  return (
                    <div style={{
                      backgroundColor: isProblem ? '#FEF2F2' : (isHealthy ? 'var(--ag-color-primary-light)' : '#FFFBEB'),
                      border: `1.5px solid ${isProblem ? '#FCA5A5' : (isHealthy ? '#86EFAC' : '#FDE68A')}`,
                      borderRadius: '16px',
                      padding: '16px 18px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isProblem && <AlertOctagon size={18} color="#991B1B" />}
                          {isHealthy && <CheckCircle size={18} color="#166534" />}
                          {isUncertain && <HelpCircle size={18} color="#92400E" />}
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            color: isProblem ? '#991B1B' : (isHealthy ? '#166534' : '#92400E'),
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {isProblem ? t.possibleProblem : (isHealthy ? t.cropLooksHealthy : t.needClearerLook)}
                          </span>
                        </div>

                        {/* Evidence Strength Badge (Derived cleanly without fake percentages) */}
                        {strength && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--ag-radius-full)',
                            backgroundColor: strength.bg,
                            color: strength.color,
                            border: `1px solid ${strength.border}`,
                          }}>
                            {strength.label}
                          </span>
                        )}
                      </div>

                      <h4 style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        color: isProblem ? '#7F1D1D' : (isHealthy ? 'var(--ag-color-primary-dark)' : '#78350F'),
                        margin: '0 0 6px 0',
                        lineHeight: 1.3,
                      }}>
                        {getCropEmoji(diagnosisResult.selectedCrop)} {diagnosisResult.diagnosisTitle}
                      </h4>

                      <p style={{
                        fontSize: '13.5px',
                        color: isProblem ? '#991B1B' : (isHealthy ? '#14532D' : '#92400E'),
                        margin: 0,
                        lineHeight: 1.45,
                      }}>
                        {isHealthy ? t.noObviousProblem : (isUncertain ? t.uncertainEvidenceMsg : diagnosisResult.summary)}
                      </p>
                    </div>
                  );
                })()}

                {/* UNIFIED EVIDENCE SECTION: "WHAT AGRIGUIDE FOUND" */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid var(--ag-border-default)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <h4 style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: 'var(--ag-color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    margin: 0,
                  }}>
                    {t.whatAgriGuideFound}
                  </h4>

                  {/* BLOCK A: What I saw in your photos */}
                  <div style={{
                    backgroundColor: 'var(--ag-color-bg-base)',
                    borderRadius: '12px',
                    border: '1px solid var(--ag-border-default)',
                    padding: '14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ag-color-text-primary)' }}>
                        🌿 A. {t.whatISawInPhotos}
                      </span>
                      {analyzedImagesList.length > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)', fontWeight: 600 }}>
                          {t.photosAnalyzed}: {analyzedImagesList.length}
                        </span>
                      )}
                    </div>

                    {/* Gallery Thumbnails row if > 1 photo */}
                    {analyzedImagesList.length > 1 && (
                      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '10px' }}>
                        {analyzedImagesList.map((img, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveImageIdx(idx)}
                            aria-label={`View photo ${idx + 1}`}
                            style={{
                              position: 'relative',
                              width: '64px',
                              height: '64px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: activeImageIdx === idx ? '2.5px solid var(--ag-color-primary-base)' : '1px solid var(--ag-border-default)',
                              padding: 0,
                              cursor: 'pointer',
                              flexShrink: 0,
                              backgroundColor: '#000',
                            }}
                          >
                            <img 
                              src={img.previewUrl} 
                              alt={`Photo ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <span style={{
                              position: 'absolute',
                              bottom: '2px',
                              left: '2px',
                              backgroundColor: 'rgba(0,0,0,0.65)',
                              color: '#FFF',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 4px',
                              borderRadius: '3px',
                            }}>
                              #{idx + 1}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Main Image with Annotation Overlays */}
                    {analyzedImagesList[activeImageIdx] && (
                      <div 
                        onClick={() => setLightboxImage({ url: analyzedImagesList[activeImageIdx].previewUrl, index: activeImageIdx })}
                        style={{
                          position: 'relative',
                          width: '100%',
                          backgroundColor: '#0F172A',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: '4px 0',
                          marginBottom: '10px',
                        }}
                      >
                        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0 }}>
                          <img 
                            src={analyzedImagesList[activeImageIdx].previewUrl} 
                            alt={`Crop View ${activeImageIdx + 1}`}
                            style={{ 
                              display: 'block',
                              maxWidth: '100%', 
                              maxHeight: '280px', 
                              width: 'auto',
                              height: 'auto',
                              objectFit: 'contain',
                              borderRadius: '6px',
                            }}
                          />

                          {/* Annotation Bounding Boxes */}
                          {currentImageAnnotations.map((ann, aIdx) => (
                            <div
                              key={aIdx}
                              style={{
                                position: 'absolute',
                                left: `${ann.x}%`,
                                top: `${ann.y}%`,
                                width: `${ann.width}%`,
                                height: `${ann.height}%`,
                                border: '2.5px solid #EF4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                borderRadius: '4px',
                                pointerEvents: 'none',
                                boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9)',
                                boxSizing: 'border-box',
                              }}
                            >
                              <span style={{
                                position: 'absolute',
                                top: ann.y < 16 ? '100%' : '-22px',
                                left: '0',
                                backgroundColor: '#DC2626',
                                color: '#FFFFFF',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: '3px',
                                whiteSpace: 'nowrap',
                                lineHeight: '1.2',
                                zIndex: 2,
                              }}>
                                {ann.label}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div style={{
                          position: 'absolute',
                          bottom: '6px',
                          right: '6px',
                          backgroundColor: 'rgba(0,0,0,0.75)',
                          color: '#FFFFFF',
                          borderRadius: '4px',
                          padding: '3px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '10px',
                          fontWeight: 600,
                          zIndex: 3,
                        }}>
                          <Maximize2 size={11} />
                          <span>{t.tapToEnlarge}</span>
                        </div>
                      </div>
                    )}

                    {/* Visual Findings List */}
                    {diagnosisResult.visualFindings && diagnosisResult.visualFindings.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--ag-color-text-primary)', lineHeight: 1.45 }}>
                        {diagnosisResult.visualFindings.map((vf, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{vf}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* BLOCK B: What you told AgriGuide (Farmer Voice Quote) */}
                  {(diagnosisResult.farmerReportedSymptoms.length > 0 || voiceTranscriptText) && (
                    <div style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: '12px',
                      border: '1px dashed #CBD5E1',
                      padding: '12px 14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <Mic size={14} color="var(--ag-color-primary-base)" />
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ag-color-text-primary)' }}>
                          🎙️ B. {t.whatYouToldAgriGuide}
                        </span>
                      </div>

                      {(() => {
                        const transcript = voiceTranscriptText || diagnosisResult.farmerReportedSymptoms.join(' ');
                        const isLong = transcript.length > 120;
                        const displayText = !isLong || showFullTranscript ? transcript : `${transcript.slice(0, 115)}...`;

                        return (
                          <div>
                            <p style={{
                              margin: 0,
                              fontStyle: 'italic',
                              fontSize: '13px',
                              color: '#334155',
                              lineHeight: 1.4,
                            }}>
                              "{displayText}"
                            </p>
                            {isLong && (
                              <button
                                onClick={() => setShowFullTranscript(!showFullTranscript)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--ag-color-primary-base)',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: '4px 0 0 0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                {showFullTranscript ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                <span>{showFullTranscript ? t.hideTranscript : t.showFullTranscript}</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* BLOCK C: Together (Combined Assessment) */}
                  {diagnosisResult.combinedAssessment && (
                    <div style={{
                      backgroundColor: 'var(--ag-color-primary-light)',
                      borderRadius: '12px',
                      border: '1px solid #86EFAC',
                      padding: '12px 14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <Sparkles size={14} color="var(--ag-color-primary-dark)" />
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ag-color-primary-dark)' }}>
                          ⚖️ C. {t.togetherCombined}
                        </span>
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: '13px',
                        color: '#166534',
                        lineHeight: 1.45,
                        fontWeight: 500,
                      }}>
                        {diagnosisResult.combinedAssessment}
                      </p>
                    </div>
                  )}
                </div>

                {/* ACTION SECTION: "WHAT YOU SHOULD DO" */}
                {diagnosisResult.recommendation && diagnosisResult.recommendation.length > 0 && (
                  <div style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid var(--ag-border-default)',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    <h4 style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: 'var(--ag-color-primary-dark)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      margin: 0,
                    }}>
                      🎯 {t.whatYouShouldDo}
                    </h4>

                    <ol style={{
                      margin: 0,
                      paddingLeft: '20px',
                      fontSize: '13.5px',
                      color: 'var(--ag-color-text-primary)',
                      lineHeight: 1.5,
                      fontWeight: 600,
                    }}>
                      {diagnosisResult.recommendation.map((rec, idx) => (
                        <li key={idx} style={{ marginBottom: '8px' }}>
                          <span style={{ fontWeight: 400, color: 'var(--ag-color-text-primary)' }}>{rec}</span>
                        </li>
                      ))}
                    </ol>

                    {/* Things to Avoid */}
                    {diagnosisResult.whatToAvoid && diagnosisResult.whatToAvoid.length > 0 && (
                      <div style={{
                        backgroundColor: '#FFFBEB',
                        borderRadius: '10px',
                        border: '1px solid #FDE68A',
                        padding: '12px 14px',
                        marginTop: '4px',
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', marginBottom: '6px' }}>
                          🚫 {t.thingsToAvoid}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12.5px', color: '#B45309', lineHeight: 1.4 }}>
                          {diagnosisResult.whatToAvoid.map((avoid, idx) => (
                            <li key={idx} style={{ marginBottom: '3px' }}>{avoid}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* MONITORING & ADDITIONAL PHOTO REQUESTS */}
                {(diagnosisResult.monitoringAdvice || (diagnosisResult.additionalPhotosNeeded && diagnosisResult.additionalPhotosNeeded.length > 0)) && (
                  <div style={{
                    backgroundColor: 'var(--ag-color-bg-base)',
                    borderRadius: '16px',
                    border: '1px solid var(--ag-border-default)',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}>
                    {diagnosisResult.monitoringAdvice && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          🔍 {t.checkAgain}
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--ag-color-text-primary)', lineHeight: 1.45 }}>
                          {diagnosisResult.monitoringAdvice}
                        </p>
                      </div>
                    )}

                    {diagnosisResult.additionalPhotosNeeded && diagnosisResult.additionalPhotosNeeded.length > 0 && (
                      <div style={{
                        backgroundColor: '#FEF2F2',
                        borderRadius: '10px',
                        border: '1px solid #FCA5A5',
                        padding: '12px',
                        marginTop: '4px',
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#991B1B', marginBottom: '4px' }}>
                          📷 {t.pleaseCaptureNext}:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12.5px', color: '#7F1D1D', lineHeight: 1.4 }}>
                          {diagnosisResult.additionalPhotosNeeded.map((photoReq, idx) => (
                            <li key={idx} style={{ marginBottom: '2px' }}>{photoReq}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* ACTION BUTTONS: Done & Check Another Crop */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    onClick={handleResetModal}
                    style={{
                      flex: 1,
                      minHeight: '48px',
                      backgroundColor: 'var(--ag-color-primary-base)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 'var(--ag-radius-md)',
                      fontSize: '14px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: 'var(--ag-shadow-button)',
                    }}
                  >
                    {t.doneBtn}
                  </button>
                  <button
                    onClick={() => {
                      stopAllSpeech();
                      selectedImages.forEach(img => revokeTrackedObjectURL(img.previewUrl));
                      setDiagnosisResult(null);
                      setSelectedImages([]);
                      setAnalyzedImagesList([]);
                      clearVoiceRecording();
                      setIsHistoricalView(false);
                      setActiveTab('assess');
                    }}
                    style={{
                      flex: 1,
                      minHeight: '48px',
                      backgroundColor: 'var(--ag-color-surface-base)',
                      color: 'var(--ag-color-text-primary)',
                      border: '1px solid var(--ag-border-default)',
                      borderRadius: 'var(--ag-radius-md)',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {t.checkAnotherCropBtn}
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
                <p style={{ fontSize: '13px', color: 'var(--ag-color-text-secondary)', maxWidth: '360px', lineHeight: 1.4 }}>
                  Comparing {selectedImages.length} photo(s) with verified crop knowledge and farmer voice description...
                </p>
              </div>
            ) : activeTab === 'assess' ? (
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
                      padding: '12px 14px',
                      borderRadius: 'var(--ag-radius-md)',
                      border: '1px solid var(--ag-border-default)',
                      backgroundColor: 'var(--ag-color-surface-base)',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--ag-color-text-primary)',
                      minHeight: '48px',
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
                          aria-label={`Remove photo ${idx + 1}`}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            backgroundColor: 'rgba(0,0,0,0.65)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Add Photo Button */}
                    {selectedImages.length < 5 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Add another photo"
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
                        <Plus size={22} />
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

                {/* 2. Voice Input Section with Live Transcript */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ag-color-text-primary)', display: 'block', marginBottom: '6px' }}>
                    Tell AgriGuide what you noticed (Voice Description)
                  </label>

                  <div style={{
                    border: isRecording ? '1.5px solid var(--ag-color-danger-base)' : '1px solid var(--ag-border-default)',
                    borderRadius: 'var(--ag-radius-md)',
                    padding: '14px',
                    backgroundColor: isRecording ? '#FEF3F2' : 'var(--ag-color-bg-base)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                          aria-label={isRecording ? 'Stop recording voice' : 'Start recording voice'}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            backgroundColor: isRecording ? 'var(--ag-color-danger-base)' : 'var(--ag-color-primary-base)',
                            color: '#FFFFFF',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                          }}
                        >
                          {isRecording ? <Square size={18} /> : <Mic size={22} />}
                        </button>

                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: isRecording ? 'var(--ag-color-danger-base)' : 'var(--ag-color-text-primary)' }}>
                            {isRecording ? '🔴 Listening... Tap to stop' : (recordedAudioBlob ? 'Voice recording ready' : '🎙 Tap to speak (Telugu / Hindi / English)')}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)' }}>
                            {isRecording ? 'AgriGuide is listening to your words in real time' : (recordedAudioBlob ? 'Spoken description will be transcribed by Whisper' : 'Describe spots, color changes, or weather noticed')}
                          </div>
                        </div>
                      </div>

                      {recordedAudioBlob && !isRecording && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={playRecordedAudio}
                            aria-label="Play recorded audio"
                            style={{
                              background: 'none',
                              border: '1px solid var(--ag-border-default)',
                              borderRadius: '6px',
                              color: 'var(--ag-color-primary-base)',
                              cursor: 'pointer',
                              padding: '6px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: 700,
                              minHeight: '36px',
                            }}
                          >
                            <Play size={14} />
                            <span>Play</span>
                          </button>

                          <button
                            onClick={clearVoiceRecording}
                            aria-label="Record voice again"
                            style={{
                              background: 'none',
                              border: '1px solid #FECDCA',
                              borderRadius: '6px',
                              color: 'var(--ag-color-danger-base)',
                              cursor: 'pointer',
                              padding: '6px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: 700,
                              minHeight: '36px',
                            }}
                          >
                            <RotateCcw size={14} />
                            <span>Record again</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Live Speech Recognition Box */}
                    {(isRecording || voiceTranscriptText) && (
                      <div style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--ag-border-default)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        fontSize: '13px',
                        lineHeight: 1.4,
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ag-color-primary-base)', marginBottom: '4px', textTransform: 'uppercase' }}>
                          {getLiveVoiceLabel()}
                        </div>
                        <div style={{ color: 'var(--ag-color-text-primary)' }}>
                          {liveFinalTranscript || voiceTranscriptText ? (
                            <span>{liveFinalTranscript || voiceTranscriptText}</span>
                          ) : null}
                          {liveInterimTranscript && (
                            <span style={{ color: 'var(--ag-color-text-secondary)', fontStyle: 'italic', marginLeft: '4px' }}>
                              {liveInterimTranscript}...
                            </span>
                          )}
                          {!liveFinalTranscript && !liveInterimTranscript && !voiceTranscriptText && (
                            <span style={{ color: 'var(--ag-color-text-secondary)', fontStyle: 'italic' }}>
                              Speak now...
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {recordedAudioUrl && (
                      <audio ref={audioPlayerRef} src={recordedAudioUrl} style={{ display: 'none' }} />
                    )}
                  </div>
                </div>

                {/* 3-Way Crop Mismatch Error on Upload Page */}
                {mismatchError && (
                  <div style={{
                    backgroundColor: '#FEF3F2',
                    border: '1.5px solid #FECDCA',
                    borderRadius: 'var(--ag-radius-md)',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertOctagon size={20} color="var(--ag-color-danger-base)" />
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ag-color-danger-base)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          ⚠️ {currentLang === 'te' ? 'పంట వివరాలలో తేడా ఉంది — దయచేసి సరిచూసుకోండి' : (currentLang === 'hi' ? 'फसल विवरण में बेमेल है — कृपया जांचें' : 'Crop Input Mismatch — Please Recheck')}
                        </span>
                      </div>

                      {mismatchError.notice && (
                        <button
                          onClick={() => handleSpeakText('mismatchError', mismatchError.notice)}
                          aria-label="Listen to mismatch notice"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--ag-color-danger-base)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            fontWeight: 700,
                            minHeight: '36px',
                            padding: '4px 8px',
                          }}
                        >
                          {speakingSection === 'mismatchError' ? <Square size={14} /> : <Volume2 size={16} />}
                          <span>{speakingSection === 'mismatchError' ? 'Stop' : 'Listen'}</span>
                        </button>
                      )}
                    </div>

                    {/* 3-Modality Comparison Badges */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '8px',
                      marginBottom: '10px',
                      backgroundColor: '#FFFFFF',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #FECDCA',
                    }}>
                      <div style={{ fontSize: '12px', color: '#7F1D1D' }}>
                        <strong style={{ display: 'block', color: '#991B1B', fontSize: '11px', textTransform: 'uppercase' }}>
                          {currentLang === 'te' ? 'ఎంచుకున్న పంట:' : (currentLang === 'hi' ? 'चुनी गई फसल:' : 'Selected Crop:')}
                        </strong>
                        <span style={{ fontWeight: 700 }}>{mismatchError.selectedCrop}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#7F1D1D' }}>
                        <strong style={{ display: 'block', color: '#991B1B', fontSize: '11px', textTransform: 'uppercase' }}>
                          {currentLang === 'te' ? 'ఫోటోలో కనిపించేది:' : (currentLang === 'hi' ? 'फोटो में पहचान:' : 'Photo Identified:')}
                        </strong>
                        <span style={{ fontWeight: 700 }}>{mismatchError.visualCrop}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#7F1D1D' }}>
                        <strong style={{ display: 'block', color: '#991B1B', fontSize: '11px', textTransform: 'uppercase' }}>
                          {currentLang === 'te' ? 'వాయిస్‌లో మాట్లాడింది:' : (currentLang === 'hi' ? 'आवाज में बताया गया:' : 'Voice Mentioned:')}
                        </strong>
                        <span style={{ fontWeight: 700 }}>{mismatchError.voiceCrop || (currentLang === 'te' ? 'ఏమీ చెప్పలేదు' : 'None')}</span>
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '13px', color: '#991B1B', lineHeight: 1.45, fontWeight: 500 }}>
                      {mismatchError.notice}
                    </p>
                  </div>
                )}

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
                    backgroundColor: selectedImages.length > 0 
                      ? (mismatchError ? '#B42318' : 'var(--ag-color-primary-base)') 
                      : '#94A3B8',
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
                  <span>
                    {mismatchError 
                      ? (currentLang === 'te' ? 'సరిచూసి మళ్లీ విశ్లేషించండి (Recheck & Analyze)' : (currentLang === 'hi' ? 'पुनः जांचें और विश्लेषण करें' : 'Recheck & Re-analyze Crop'))
                      : `Analyze Crop (${selectedImages.length} Photos ${recordedAudioBlob ? '+ Voice' : ''})`}
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FULLSCREEN LIGHTBOX FOR ANALYZED CROP PHOTO                               */}
      {/* ========================================================================= */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '20px',
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => setLightboxImage(null)}
              aria-label="Close enlarged view"
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            <div style={{
              position: 'relative',
              display: 'inline-block',
              maxWidth: '90vw',
              maxHeight: '82vh',
              lineHeight: 0,
            }}>
              <img 
                src={lightboxImage.url} 
                alt={`Crop Photo Full View ${lightboxImage.index + 1}`}
                style={{
                  display: 'block',
                  maxWidth: '90vw',
                  maxHeight: '82vh',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '8px',
                }}
              />

              {/* Accurately positioned visual annotations in fullscreen lightbox */}
              {diagnosisResult?.visualAnnotations?.filter(a => a.imageIndex === lightboxImage.index).map((ann, aIdx) => (
                <div
                  key={aIdx}
                  style={{
                    position: 'absolute',
                    left: `${ann.x}%`,
                    top: `${ann.y}%`,
                    width: `${ann.width}%`,
                    height: `${ann.height}%`,
                    border: '3px solid #EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    borderRadius: '6px',
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 2px rgba(255,255,255,0.95), 0 4px 12px rgba(0,0,0,0.5)',
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: ann.y < 15 ? '100%' : '-28px',
                    left: '0',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    lineHeight: '1.2',
                    zIndex: 2,
                  }}>
                    {ann.label}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ color: '#FFFFFF', fontSize: '13px', marginTop: '8px', fontWeight: 600 }}>
              Photo #{lightboxImage.index + 1} of {analyzedImagesList.length}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
