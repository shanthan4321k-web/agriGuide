import React, { useState, useEffect, useRef } from 'react';
import type { 
  Language, 
  LocationContext, 
  Farm, 
  CropPlanData, 
  CropComparisonItem, 
  CropComparisonResponse 
} from '../../types';
import { translations } from '../../i18n/translations';
import { FarmService } from '../../services/farm/farmService';
import { SpeechService } from '../../utils/speechSynthesis';
import { fetchApi } from '../../services/apiConfig';
import { 
  X, 
  Sprout, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  AlertTriangle, 
  Mic, 
  Square, 
  Volume2 
} from 'lucide-react';

interface PlanCropWizardProps {
  isOpen: boolean;
  onClose: () => void;
  farms: Farm[];
  location: LocationContext;
  currentLang: Language;
  onCropStarted: () => void;
}

export const PlanCropWizard: React.FC<PlanCropWizardProps> = ({
  isOpen,
  onClose,
  farms,
  location,
  currentLang,
  onCropStarted,
}) => {
  const t = translations[currentLang];

  // Steps: 1: Farm Info, 2: Field Info, 3: Crop Comparison ("What can I grow here?"), 4: Plan Review
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Farm Info State
  const [selectedFarmId, setSelectedFarmId] = useState<string>(farms.length > 0 ? farms[0].id : 'new_farm');
  const [farmName, setFarmName] = useState<string>(farms.length > 0 ? farms[0].farmName : 'My Farm');
  const [totalFarmAcres, setTotalFarmAcres] = useState<number>(farms.length > 0 ? farms[0].totalAcres : 4.0);
  const [farmDistrict, setFarmDistrict] = useState<string>(location.district || 'Warangal');
  const [farmState, setFarmState] = useState<string>(location.state || 'Telangana');
  const [farmVillage, setFarmVillage] = useState<string>(location.village || '');

  // Step 2: Field Info State
  const [plannedAcres, setPlannedAcres] = useState<number>(2.0);
  const [soilType, setSoilType] = useState<string>('Red Loamy Soil');
  const [irrigationSource, setIrrigationSource] = useState<string>('Borewell & Drip');
  const [sowingWindow, setSowingWindow] = useState<string>('Kharif (June - July)');

  // Step 3: Crop Comparison State
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<CropComparisonResponse | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<CropComparisonItem | null>(null);
  const [selectedVariety] = useState<string>('');

  // Voice Assistant / QA on Step 3
  const [voiceQAAnswer, setVoiceQAAnswer] = useState<string>('');
  const [isAnsweringQA, setIsAnsweringQA] = useState<boolean>(false);

  // Step 4: AI Plan State
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [planResult, setPlanResult] = useState<CropPlanData | null>(null);
  const [isStartingCrop, setIsStartingCrop] = useState<boolean>(false);

  // Global Error & Audio State
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [activeSpeechSection, setActiveSpeechSection] = useState<string>('');

  // Voice Input (Whisper) State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [lastVoiceTranscript, setLastVoiceTranscript] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Update selected farm details on farm selection
  useEffect(() => {
    if (selectedFarmId && selectedFarmId !== 'new_farm') {
      const f = farms.find(farm => farm.id === selectedFarmId);
      if (f) {
        setFarmName(f.farmName);
        setTotalFarmAcres(f.totalAcres);
        setFarmDistrict(f.district);
        setFarmState(f.state);
        setFarmVillage(f.village || '');
        setSoilType(f.soilType || 'Red Loamy Soil');
        setIrrigationSource(f.irrigationSource || 'Borewell & Drip');
        
        // Default planned acres to remaining available acres if possible
        const available = f.availableAcres !== undefined ? f.availableAcres : f.totalAcres;
        if (available > 0) {
          setPlannedAcres(Math.min(2.0, available));
        }
      }
    }
  }, [selectedFarmId, farms]);

  // Clean up speech on unmount or close
  useEffect(() => {
    return () => {
      SpeechService.stop();
    };
  }, []);

  if (!isOpen) return null;

  // Compute remaining acres on current farm
  const currentFarmObj = farms.find(f => f.id === selectedFarmId);
  const allocatedOnFarm = currentFarmObj?.allocatedAcres || 0;
  const availableOnFarm = currentFarmObj ? Math.max(0, currentFarmObj.totalAcres - allocatedOnFarm) : totalFarmAcres;
  const isAcreageExceeded = selectedFarmId !== 'new_farm' && currentFarmObj && plannedAcres > availableOnFarm;

  // ---------------------------------------------------------------------------
  // Voice Recording & Whisper Transcription
  // ---------------------------------------------------------------------------
  const startRecording = async (target: 'step1' | 'step2' | 'step3_qa') => {
    setErrorMessage('');
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
        await processVoiceAudio(audioBlob, target);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('[PlanCrop] Mic error:', err);
      setErrorMessage('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceAudio = async (blob: Blob, target: 'step1' | 'step2' | 'step3_qa') => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('language', currentLang);

      const res = await fetchApi<{ text: string }>('/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.data?.text) {
        const transcript = res.data.text.trim();
        setLastVoiceTranscript(transcript);

        if (target === 'step1' || target === 'step2') {
          // Extract structured field info
          const extracted = await FarmService.extractFieldInfo(transcript, currentLang);
          
          if (target === 'step1') {
            if (extracted.acres) setTotalFarmAcres(extracted.acres);
            if (extracted.district) setFarmDistrict(extracted.district);
            if (extracted.location && !extracted.district) setFarmDistrict(extracted.location);
            if (extracted.village) setFarmVillage(extracted.village);
            
            // Read-back confirmation
            const readText = currentLang === 'te'
              ? `మీరు ${extracted.acres || totalFarmAcres} ఎకరాలు ${extracted.district || farmDistrict} లో ఉన్నట్లు చెప్పారు.`
              : currentLang === 'hi'
              ? `आपने ${extracted.acres || totalFarmAcres} एकड़ ${extracted.district || farmDistrict} में बताया है।`
              : `You said you have ${extracted.acres || totalFarmAcres} acres near ${extracted.district || farmDistrict}.`;
            SpeechService.speak(readText, currentLang);
          } else if (target === 'step2') {
            if (extracted.acres) setPlannedAcres(extracted.acres);
            if (extracted.soilType) setSoilType(extracted.soilType);
            if (extracted.irrigationSource) setIrrigationSource(extracted.irrigationSource);
            if (extracted.sowingWindow) setSowingWindow(extracted.sowingWindow);

            // Read-back confirmation
            const readText = currentLang === 'te'
              ? `మీ నేల ${extracted.soilType || soilType} మరియు నీటి వనరు ${extracted.irrigationSource || irrigationSource} అని నిర్ధారించబడింది.`
              : currentLang === 'hi'
              ? `आपकी मिट्टी ${extracted.soilType || soilType} और सिंचाई ${extracted.irrigationSource || irrigationSource} दर्ज की गई है।`
              : `You told me your soil is ${extracted.soilType || soilType} and irrigation is ${extracted.irrigationSource || irrigationSource}.`;
            SpeechService.speak(readText, currentLang);
          }
        } else if (target === 'step3_qa') {
          // Process crop comparison question
          await handleCropVoiceQA(transcript);
        }
      }
    } catch (err: any) {
      console.warn('[PlanCrop] Voice parsing notice:', err.message);
      setErrorMessage('Voice processing temporarily unavailable.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step Navigation & Logic
  // ---------------------------------------------------------------------------
  const handleProceedToStep2 = () => {
    setErrorMessage('');
    if (totalFarmAcres <= 0) {
      setErrorMessage('Please specify valid farm acreage.');
      return;
    }
    setCurrentStep(2);
  };

  const handleProceedToStep3 = async () => {
    setErrorMessage('');
    if (plannedAcres <= 0) {
      setErrorMessage('Planned acreage must be greater than zero.');
      return;
    }

    if (isAcreageExceeded) {
      setErrorMessage(`Cannot allocate ${plannedAcres} acres. Only ${availableOnFarm.toFixed(1)} acres unallocated on ${farmName}.`);
      return;
    }

    setCurrentStep(3);
    await loadCropComparison();
  };

  const loadCropComparison = async () => {
    setIsComparing(true);
    setErrorMessage('');
    try {
      const res = await FarmService.compareCrops({
        farmId: selectedFarmId !== 'new_farm' ? selectedFarmId : undefined,
        farmName,
        acres: plannedAcres,
        soilType,
        irrigationSource,
        sowingWindow,
        district: farmDistrict,
        state: farmState,
        language: currentLang,
      });

      setComparisonResult(res);

      // Auto-select top-suitable crop if none selected
      if (res.crops && res.crops.length > 0 && !selectedCrop) {
        setSelectedCrop(res.crops[0]);
      }

      // Read summary aloud
      if (res.summary) {
        SpeechService.speak(res.summary, currentLang);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to compare crops.');
    } finally {
      setIsComparing(false);
    }
  };

  const handleCropVoiceQA = async (queryText: string) => {
    if (!comparisonResult || !queryText.trim()) return;
    setIsAnsweringQA(true);
    try {
      const answer = await FarmService.cropVoiceQA({
        question: queryText,
        comparedCrops: comparisonResult.crops,
        fieldInfo: { farmName, acres: plannedAcres, soilType, irrigationSource, district: farmDistrict },
        language: currentLang,
      });
      setVoiceQAAnswer(answer);
      if (answer) {
        SpeechService.speak(answer, currentLang);
      }
    } catch (err: any) {
      console.warn('[PlanCrop] QA error:', err.message);
    } finally {
      setIsAnsweringQA(false);
    }
  };

  const handleSelectCropAndGeneratePlan = async (crop: CropComparisonItem) => {
    setSelectedCrop(crop);
    setCurrentStep(4);
    setIsGeneratingPlan(true);
    setErrorMessage('');
    try {
      const plan = await FarmService.planCropWithAI({
        farmId: selectedFarmId !== 'new_farm' ? selectedFarmId : undefined,
        farmName,
        acres: plannedAcres,
        soilType,
        irrigationSource,
        cropName: crop.cropName,
        variety: selectedVariety || 'Standard Recommended Hybrid',
        sowingWindow,
        district: farmDistrict,
        state: farmState,
        language: currentLang,
      });

      setPlanResult(plan);

      // Read summary aloud
      if (plan.summary) {
        SpeechService.speak(plan.summary, currentLang);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate crop plan.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleStartCropAcceptance = async () => {
    if (!selectedCrop || !planResult) return;

    if (isAcreageExceeded) {
      setErrorMessage(`No unallocated acreage available on this farm (Available: ${availableOnFarm} acres, Requested: ${plannedAcres} acres).`);
      return;
    }

    setIsStartingCrop(true);
    setErrorMessage('');
    try {
      await FarmService.acceptCropPlan({
        farmId: selectedFarmId !== 'new_farm' ? selectedFarmId : undefined,
        farmName,
        totalFarmAcres: selectedFarmId === 'new_farm' ? totalFarmAcres : undefined,
        acres: plannedAcres,
        soilType,
        irrigationSource,
        district: farmDistrict,
        state: farmState,
        village: farmVillage,
        plotName: `${selectedCrop.cropName} Plot (${plannedAcres} Acres)`,
        currentCrop: selectedCrop.cropName,
        variety: planResult.variety || 'Recommended Hybrid',
        sowingDate: new Date().toISOString().split('T')[0],
        stage: 'Planned / Sowing Stage',
        initialManagementPlan: planResult.initialCropManagementPlan,
      });

      // Announce success
      const successSpeech = currentLang === 'te'
        ? `${selectedCrop.cropName} పంట విజయవంతంగా ప్రారంభించబడింది!`
        : currentLang === 'hi'
        ? `${selectedCrop.cropName} फसल सफलतापूर्वक शुरू हो गई!`
        : `Successfully started ${selectedCrop.cropName} crop on ${plannedAcres} acres!`;
      SpeechService.speak(successSpeech, currentLang);

      onCropStarted();
      onClose();
    } catch (err: any) {
      console.error('[PlanCrop] Start crop error:', err);
      setErrorMessage(err.message || 'Database error starting crop. Please try again.');
    } finally {
      setIsStartingCrop(false);
    }
  };

  const toggleSpeakSection = (sectionKey: string, text: string) => {
    if (isSpeaking && activeSpeechSection === sectionKey) {
      SpeechService.stop();
      setIsSpeaking(false);
      setActiveSpeechSection('');
    } else {
      SpeechService.speak(text, currentLang, () => {
        setIsSpeaking(false);
        setActiveSpeechSection('');
      });
      setIsSpeaking(true);
      setActiveSpeechSection(sectionKey);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(25, 53, 42, 0.7)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9990,
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'var(--ag-color-surface-base)',
        borderRadius: 'var(--ag-radius-card)',
        width: '100%',
        maxWidth: '780px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--ag-shadow-elevated)',
        border: '1px solid var(--ag-border-default)',
        overflow: 'hidden',
      }}>
        {/* Header with Step Progress */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--ag-border-default)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FAFBF7',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ag-color-primary-base)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Step {currentStep} of 4
              </span>
              <span style={{ color: 'var(--ag-color-text-secondary)', fontSize: '11px' }}>·</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)' }}>
                {currentStep === 1 ? 'Farm Context' : currentStep === 2 ? 'Field Parameters' : currentStep === 3 ? 'Crop Comparison' : 'Production Plan'}
              </span>
            </div>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 800, color: 'var(--ag-color-text-primary)' }}>
              {currentStep === 1 && t.tellAgriGuideAboutFarm}
              {currentStep === 2 && 'Field & Irrigation Information'}
              {currentStep === 3 && t.whatCanIGrowHere}
              {currentStep === 4 && `${selectedCrop?.cropName} Production Plan`}
            </h3>
          </div>

          <button
            onClick={() => {
              SpeechService.stop();
              onClose();
            }}
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

        {/* Scrollable Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {errorMessage && (
            <div style={{
              backgroundColor: '#FDF0F0',
              border: '1px solid #F7B5B3',
              borderRadius: '12px',
              padding: '12px 16px',
              color: 'var(--ag-color-danger-base)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}>
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 1: FARM INFORMATION (VOICE-FIRST)                            */}
          {/* ================================================================= */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Voice Input Banner */}
              <div style={{
                backgroundColor: 'var(--ag-color-harvest-light)',
                border: '1px solid #FAD48C',
                borderRadius: '16px',
                padding: '18px',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ag-color-text-primary)', margin: '0 0 12px 0' }}>
                  🎙 {t.tellAgriGuideHelper}
                </p>
                
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : () => startRecording('step1')}
                  disabled={isTranscribing}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: isRecording ? '#DC2626' : 'var(--ag-color-warning-base)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: 'var(--ag-radius-full)',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    minHeight: '48px',
                    boxShadow: 'var(--ag-shadow-button)',
                  }}
                >
                  {isRecording ? <Square size={16} fill="#FFFFFF" /> : <Mic size={18} />}
                  <span>
                    {isTranscribing 
                      ? t.voiceProcessing 
                      : isRecording 
                      ? t.voiceListening 
                      : `🎙 ${t.tellAgriGuideAboutFarm}`}
                  </span>
                </button>

                {lastVoiceTranscript && (
                  <div style={{ marginTop: '14px', textAlign: 'left', backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '10px', border: '1px solid #FAD48C' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase' }}>
                      YOU SAID:
                    </span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--ag-color-text-primary)', fontWeight: 600 }}>
                      "{lastVoiceTranscript}"
                    </p>
                  </div>
                )}
              </div>

              {/* Existing Farm Selector (if farmer has multiple farms) */}
              {farms.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ag-color-text-primary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Select Existing Farm or Describe New
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {farms.map((f) => {
                      const isSel = f.id === selectedFarmId;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setSelectedFarmId(f.id)}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '12px',
                            border: isSel ? '2px solid var(--ag-color-primary-base)' : '1px solid var(--ag-border-default)',
                            backgroundColor: isSel ? 'var(--ag-color-primary-light)' : 'var(--ag-color-surface-base)',
                            color: isSel ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-text-primary)',
                            fontWeight: isSel ? 800 : 600,
                            fontSize: '13px',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>{f.farmName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)', marginTop: '2px' }}>
                            {f.totalAcres} Acres ({f.availableAcres !== undefined ? f.availableAcres.toFixed(1) : f.totalAcres} Available)
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFarmId('new_farm');
                        setFarmName('New Farm');
                      }}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        border: selectedFarmId === 'new_farm' ? '2px solid var(--ag-color-primary-base)' : '1px dashed var(--ag-border-default)',
                        backgroundColor: selectedFarmId === 'new_farm' ? 'var(--ag-color-primary-light)' : '#FFFFFF',
                        color: selectedFarmId === 'new_farm' ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-text-primary)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      + Describe New Farm
                    </button>
                  </div>
                </div>
              )}

              {/* Editable Structured Fields */}
              <div style={{
                backgroundColor: '#FAFAF7',
                border: '1px solid var(--ag-border-default)',
                borderRadius: '16px',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Farm Name
                  </label>
                  <input
                    type="text"
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--ag-border-default)',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Total Farm Acres
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={totalFarmAcres}
                    onChange={(e) => setTotalFarmAcres(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--ag-border-default)',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    District
                  </label>
                  <input
                    type="text"
                    value={farmDistrict}
                    onChange={(e) => setFarmDistrict(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--ag-border-default)',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Village / Mandal
                  </label>
                  <input
                    type="text"
                    value={farmVillage}
                    onChange={(e) => setFarmVillage(e.target.value)}
                    placeholder="e.g. Geesugonda"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--ag-border-default)',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 2: FIELD & IRRIGATION PARAMETERS (VOICE-FIRST)               */}
          {/* ================================================================= */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Voice Field Input Banner */}
              <div style={{
                backgroundColor: 'var(--ag-color-primary-light)',
                border: '1px solid #A3D9A5',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ag-color-primary-dark)', margin: '0 0 10px 0' }}>
                  🎙 "My field is red loamy soil, borewell drip irrigation, planning 2 acres."
                </p>
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : () => startRecording('step2')}
                  disabled={isTranscribing}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: isRecording ? '#DC2626' : 'var(--ag-color-primary-base)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 'var(--ag-radius-full)',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  {isRecording ? <Square size={16} fill="#FFFFFF" /> : <Mic size={16} />}
                  <span>{isRecording ? 'Listening... Tap to stop' : '🎙 Speak Field Details'}</span>
                </button>

                {lastVoiceTranscript && (
                  <div style={{ marginTop: '12px', textAlign: 'left', backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #A3D9A5' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ag-color-primary-dark)', textTransform: 'uppercase' }}>
                      YOU SAID:
                    </span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--ag-color-text-primary)', fontWeight: 600 }}>
                      "{lastVoiceTranscript}"
                    </p>
                  </div>
                )}
              </div>

              {/* Structured Field Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ag-color-text-primary)', marginBottom: '6px' }}>
                    Acres Planned for this Crop
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max={totalFarmAcres}
                    value={plannedAcres}
                    onChange={(e) => setPlannedAcres(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isAcreageExceeded ? '2px solid var(--ag-color-danger-base)' : '1px solid var(--ag-border-default)',
                      fontSize: '15px',
                      fontWeight: 700,
                    }}
                  />
                  {selectedFarmId !== 'new_farm' && currentFarmObj && (
                    <div style={{ fontSize: '11px', color: isAcreageExceeded ? 'var(--ag-color-danger-base)' : 'var(--ag-color-text-secondary)', marginTop: '4px', fontWeight: 600 }}>
                      {availableOnFarm.toFixed(1)} acres unallocated on {farmName}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ag-color-text-primary)', marginBottom: '6px' }}>
                    Soil Type
                  </label>
                  <select
                    value={soilType}
                    onChange={(e) => setSoilType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--ag-border-default)',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  >
                    <option value="Red Loamy Soil">Red Loamy Soil (చల్కా / ఎర్ర నేల)</option>
                    <option value="Black Cotton Soil">Black Cotton Soil (నల్ల రేగడి)</option>
                    <option value="Sandy Loam">Sandy Loam (ఇసుక నేల)</option>
                    <option value="Clayey Loam">Clayey / Heavy Loam (జిగురు నేల)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ag-color-text-primary)', marginBottom: '6px' }}>
                    Irrigation Source
                  </label>
                  <select
                    value={irrigationSource}
                    onChange={(e) => setIrrigationSource(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--ag-border-default)',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  >
                    <option value="Borewell & Drip">Borewell & Drip (డ్రిప్ ఇరిగేషన్)</option>
                    <option value="Borewell Flood">Borewell (కాలువ / వరద)</option>
                    <option value="Canal Irrigation">Canal Irrigation (సాగునీటి కాలువ)</option>
                    <option value="Rainfed (Monsoon)">Rainfed (వర్షాధార)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ag-color-text-primary)', marginBottom: '6px' }}>
                    Planting Season / Window
                  </label>
                  <select
                    value={sowingWindow}
                    onChange={(e) => setSowingWindow(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--ag-border-default)',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  >
                    <option value="Kharif (June - July)">Kharif (June - July Onset)</option>
                    <option value="Rabi (Oct - Nov)">Rabi (October - November)</option>
                    <option value="Summer (Jan - Feb)">Summer / Zaid (Jan - Feb)</option>
                  </select>
                </div>
              </div>

              {/* Confirmation Readback pill */}
              <div style={{
                backgroundColor: '#FAFBF7',
                border: '1px solid var(--ag-border-default)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: '13px', color: 'var(--ag-color-text-primary)', fontWeight: 600 }}>
                  🌾 <strong>{plannedAcres} Acres</strong> · {soilType} · {irrigationSource} · {sowingWindow}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const text = `You told me your field is ${plannedAcres} acres on ${soilType} with ${irrigationSource} for ${sowingWindow}.`;
                    SpeechService.speak(text, currentLang);
                  }}
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
                  }}
                >
                  <Volume2 size={15} />
                  <span>Listen</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 3: "WHAT CAN I GROW HERE?" DATA-DRIVEN CROP COMPARISON       */}
          {/* ================================================================= */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isComparing && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <Sparkles size={32} color="var(--ag-color-primary-base)" style={{ animation: 'spin 2s linear infinite', margin: '0 auto 12px auto' }} />
                  <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--ag-color-text-primary)' }}>
                    Analyzing Verified Agronomic Data & Economics...
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--ag-color-text-secondary)', margin: 0 }}>
                    Grounding comparison in live Warangal weather, APMC Mandi price baselines, and ICAR benchmarks.
                  </p>
                </div>
              )}

              {!isComparing && comparisonResult && (
                <div>
                  {/* Executive Summary & Audio */}
                  <div style={{
                    backgroundColor: 'var(--ag-color-primary-light)',
                    border: '1px solid #A3D9A5',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ag-color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Agronomic Assessment
                      </span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 700, color: 'var(--ag-color-text-primary)', lineHeight: 1.4 }}>
                        {comparisonResult.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSpeakSection('comparison_summary', comparisonResult.summary)}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #A3D9A5',
                        borderRadius: 'var(--ag-radius-full)',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--ag-color-primary-dark)',
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Volume2 size={15} />
                      <span>{activeSpeechSection === 'comparison_summary' ? 'Stop' : 'Listen'}</span>
                    </button>
                  </div>

                  {/* Voice QA Assistant on Crop Comparison */}
                  <div style={{
                    backgroundColor: '#FAFBF7',
                    border: '1px solid var(--ag-border-default)',
                    borderRadius: '14px',
                    padding: '14px',
                    marginBottom: '18px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ag-color-text-primary)' }}>
                        🎙 Ask AgriGuide about these crops
                      </span>
                      <button
                        type="button"
                        onClick={isRecording ? stopRecording : () => startRecording('step3_qa')}
                        disabled={isAnsweringQA || isTranscribing}
                        style={{
                          backgroundColor: isRecording ? '#DC2626' : 'var(--ag-color-harvest-light)',
                          color: isRecording ? '#FFFFFF' : 'var(--ag-color-warning-base)',
                          border: '1px solid #FAD48C',
                          borderRadius: 'var(--ag-radius-full)',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {isRecording ? <Square size={13} fill="currentColor" /> : <Mic size={14} />}
                        <span>{isRecording ? 'Stop' : '🎙 Ask Question'}</span>
                      </button>
                    </div>

                    <p style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)', margin: '0 0 8px 0' }}>
                      Try: <em>"Which crop needs less water?"</em> or <em>"Which crop is safer for my soil?"</em>
                    </p>

                    {voiceQAAnswer && (
                      <div style={{ backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--ag-border-default)' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ag-color-primary-base)', textTransform: 'uppercase' }}>
                          AGRIGUIDE ANSWER:
                        </span>
                        <p style={{ margin: '2px 0 0 0', fontSize: '13px', fontWeight: 600, color: 'var(--ag-color-text-primary)' }}>
                          {voiceQAAnswer}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Crop Comparison Cards Grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {comparisonResult.crops.map((crop, idx) => {
                      const isSelected = selectedCrop?.cropName === crop.cropName;
                      return (
                        <div
                          key={crop.cropName || idx}
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '16px',
                            border: isSelected ? '2px solid var(--ag-color-primary-base)' : '1px solid var(--ag-border-default)',
                            padding: '16px',
                            boxShadow: isSelected ? '0 4px 12px rgba(47, 125, 50, 0.12)' : 'var(--ag-shadow-card)',
                            position: 'relative',
                          }}
                        >
                          {/* Card Top */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h4 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--ag-color-text-primary)' }}>
                                  {crop.cropName} {crop.localName ? `(${crop.localName})` : ''}
                                </h4>
                                <span style={{
                                  backgroundColor: crop.suitabilityScore === 'High' ? 'var(--ag-color-primary-light)' : 'var(--ag-color-harvest-light)',
                                  color: crop.suitabilityScore === 'High' ? 'var(--ag-color-primary-dark)' : 'var(--ag-color-warning-base)',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 'var(--ag-radius-full)',
                                }}>
                                  {crop.suitabilityScore} Suitability
                                </span>
                              </div>
                              <p style={{ fontSize: '12px', color: 'var(--ag-color-text-secondary)', margin: '4px 0 0 0' }}>
                                {crop.scientificName} · {crop.durationDays} Days Duration · Water: {crop.waterRequirement}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectCropAndGeneratePlan(crop)}
                              style={{
                                backgroundColor: isSelected ? 'var(--ag-color-primary-base)' : '#FAFBF7',
                                color: isSelected ? '#FFFFFF' : 'var(--ag-color-text-primary)',
                                border: isSelected ? 'none' : '1px solid var(--ag-border-default)',
                                padding: '8px 16px',
                                borderRadius: 'var(--ag-radius-full)',
                                fontSize: '13px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <Check size={14} />
                              <span>{isSelected ? 'Selected' : 'Choose this crop'}</span>
                            </button>
                          </div>

                          {/* Suitability reason */}
                          <p style={{ fontSize: '13px', color: 'var(--ag-color-text-primary)', margin: '10px 0', fontWeight: 600 }}>
                            {crop.suitabilityReason}
                          </p>

                          {/* Data-Driven Economic Metrics Grid */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: '8px',
                            backgroundColor: '#FAFAF7',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            fontSize: '12px',
                          }}>
                            <div>
                              <span style={{ color: 'var(--ag-color-text-secondary)', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
                                Est. Investment
                              </span>
                              <strong style={{ color: 'var(--ag-color-text-primary)' }}>
                                ₹{crop.estimatedInvestmentPerAcre.min.toLocaleString('en-IN')} - ₹{crop.estimatedInvestmentPerAcre.max.toLocaleString('en-IN')}/ac
                              </strong>
                            </div>

                            <div>
                              <span style={{ color: 'var(--ag-color-text-secondary)', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
                                Expected Yield
                              </span>
                              <strong style={{ color: 'var(--ag-color-text-primary)' }}>
                                {crop.expectedYieldPerAcre.minQ} - {crop.expectedYieldPerAcre.maxQ} Q/ac (Est.)
                              </strong>
                            </div>

                            <div>
                              <span style={{ color: 'var(--ag-color-text-secondary)', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
                                Mandi Price Baseline
                              </span>
                              <strong style={{ color: crop.mandiPrice.includes('unavailable') ? 'var(--ag-color-text-secondary)' : 'var(--ag-color-primary-base)' }}>
                                {crop.mandiPrice}
                              </strong>
                            </div>

                            <div>
                              <span style={{ color: 'var(--ag-color-text-secondary)', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
                                Est. Margin Range
                              </span>
                              <strong style={{ color: 'var(--ag-color-primary-dark)' }}>
                                ₹{crop.estimatedMarginPerAcre.min.toLocaleString('en-IN')} - ₹{crop.estimatedMarginPerAcre.max.toLocaleString('en-IN')}/ac*
                              </strong>
                            </div>
                          </div>

                          {/* Provenance Footer */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '11px', color: 'var(--ag-color-text-secondary)' }}>
                            <span>🏛 Source: {crop.dataSource}</span>
                            <span style={{ fontStyle: 'italic' }}>*Estimates only · Profit not guaranteed</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 4: PRODUCTION PLAN REVIEW & START CROP                       */}
          {/* ================================================================= */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isGeneratingPlan && (
                <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                  <Sparkles size={36} color="var(--ag-color-primary-base)" style={{ animation: 'spin 2s linear infinite', margin: '0 auto 16px auto' }} />
                  <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--ag-color-text-primary)' }}>
                    Formulating Production Plan with Fireworks GLM-5.3-Flash...
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--ag-color-text-secondary)', margin: 0 }}>
                    Reasoning over {plannedAcres} acres of {selectedCrop?.cropName} in {farmDistrict} with live weather & university benchmarks.
                  </p>
                </div>
              )}

              {!isGeneratingPlan && planResult && (
                <div>
                  {/* Summary & Audio Banner */}
                  <div style={{
                    backgroundColor: 'var(--ag-color-primary-light)',
                    border: '1px solid #A3D9A5',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ag-color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Crop Strategy Summary
                      </span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 700, color: 'var(--ag-color-text-primary)', lineHeight: 1.4 }}>
                        {planResult.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSpeakSection('plan_summary', planResult.summary)}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #A3D9A5',
                        borderRadius: 'var(--ag-radius-full)',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--ag-color-primary-dark)',
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Volume2 size={15} />
                      <span>{activeSpeechSection === 'plan_summary' ? 'Stop' : 'Listen'}</span>
                    </button>
                  </div>

                  {/* Economic Overview Cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    marginBottom: '18px',
                  }}>
                    <div style={{ backgroundColor: '#FAFBF7', border: '1px solid var(--ag-border-default)', borderRadius: '12px', padding: '14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase' }}>
                        Est. Total Investment
                      </span>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--ag-color-text-primary)', margin: '4px 0 2px 0' }}>
                        ₹{planResult.estimatedInvestment.totalMin.toLocaleString('en-IN')} - ₹{planResult.estimatedInvestment.totalMax.toLocaleString('en-IN')}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)' }}>
                        ₹{planResult.estimatedInvestment.minPerAcre.toLocaleString('en-IN')} - ₹{planResult.estimatedInvestment.maxPerAcre.toLocaleString('en-IN')}/ac
                      </span>
                    </div>

                    <div style={{ backgroundColor: '#FAFBF7', border: '1px solid var(--ag-border-default)', borderRadius: '12px', padding: '14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase' }}>
                        Expected Total Yield
                      </span>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--ag-color-text-primary)', margin: '4px 0 2px 0' }}>
                        {planResult.expectedYield.expectedTotalQuintalsMin} - {planResult.expectedYield.expectedTotalQuintalsMax} Quintals
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)' }}>
                        {planResult.expectedYield.minQuintalsPerAcre} - {planResult.expectedYield.maxQuintalsPerAcre} Q/ac (Estimate)
                      </span>
                    </div>

                    <div style={{ backgroundColor: '#FAFBF7', border: '1px solid var(--ag-border-default)', borderRadius: '12px', padding: '14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ag-color-text-secondary)', textTransform: 'uppercase' }}>
                        Est. Net Margin Range
                      </span>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--ag-color-primary-base)', margin: '4px 0 2px 0' }}>
                        ₹{planResult.estimatedRevenueAndMargin.estimatedNetMarginMin.toLocaleString('en-IN')} - ₹{planResult.estimatedRevenueAndMargin.estimatedNetMarginMax.toLocaleString('en-IN')}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)' }}>
                        Not guaranteed · Benchmark grounded
                      </span>
                    </div>
                  </div>

                  {/* Initial 4-Step Crop Management Schedule */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--ag-color-text-primary)' }}>
                        Initial Management Actions (Schedule)
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const stepsText = planResult.initialCropManagementPlan.map(s => `${s.timing}: ${s.title}. ${s.actionDetails}`).join('. ');
                          toggleSpeakSection('schedule', stepsText);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--ag-color-primary-base)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Volume2 size={14} />
                        <span>Listen to schedule</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {planResult.initialCropManagementPlan.map((step, sIdx) => (
                        <div
                          key={sIdx}
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid var(--ag-border-default)',
                            borderRadius: '12px',
                            padding: '12px 14px',
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'flex-start',
                          }}
                        >
                          <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--ag-color-primary-light)',
                            color: 'var(--ag-color-primary-dark)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}>
                            {step.stepNumber || sIdx + 1}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '13px', color: 'var(--ag-color-text-primary)' }}>
                                {step.title}
                              </strong>
                              <span style={{ fontSize: '11px', color: 'var(--ag-color-text-secondary)', backgroundColor: '#F3F4F6', padding: '1px 6px', borderRadius: '4px' }}>
                                {step.timing}
                              </span>
                            </div>
                            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--ag-color-text-secondary)', lineHeight: 1.4 }}>
                              {step.actionDetails}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Disclaimers & Provenance */}
                  <div style={{ backgroundColor: '#FAFBF7', padding: '12px', borderRadius: '10px', border: '1px solid var(--ag-border-default)', fontSize: '11px', color: 'var(--ag-color-text-secondary)', lineHeight: 1.5 }}>
                    <p style={{ margin: '0 0 4px 0' }}>
                      <strong>Data Provenance:</strong> Mandi Price: {planResult.estimatedRevenueAndMargin.mandiPriceSource} · Yield Benchmark: {planResult.expectedYield.benchmarkSource}
                    </p>
                    <p style={{ margin: 0, fontStyle: 'italic' }}>
                      {planResult.estimatedRevenueAndMargin.marginNote}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--ag-border-default)',
          backgroundColor: '#FAFBF7',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={isGeneratingPlan || isStartingCrop}
              style={{
                backgroundColor: '#FFFFFF',
                color: 'var(--ag-color-text-primary)',
                border: '1px solid var(--ag-border-default)',
                padding: '10px 18px',
                borderRadius: 'var(--ag-radius-full)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minHeight: '44px',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          )}

          {currentStep === 1 && <div />}

          <div>
            {currentStep === 1 && (
              <button
                type="button"
                onClick={handleProceedToStep2}
                style={{
                  backgroundColor: 'var(--ag-color-primary-base)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: 'var(--ag-radius-full)',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minHeight: '44px',
                  boxShadow: 'var(--ag-shadow-button)',
                }}
              >
                <span>Continue to Field Info</span>
                <ArrowRight size={16} />
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                onClick={handleProceedToStep3}
                style={{
                  backgroundColor: 'var(--ag-color-primary-base)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: 'var(--ag-radius-full)',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minHeight: '44px',
                  boxShadow: 'var(--ag-shadow-button)',
                }}
              >
                <Sparkles size={16} />
                <span>What Can I Grow Here?</span>
              </button>
            )}

            {currentStep === 3 && selectedCrop && (
              <button
                type="button"
                onClick={() => handleSelectCropAndGeneratePlan(selectedCrop)}
                disabled={isComparing}
                style={{
                  backgroundColor: 'var(--ag-color-primary-base)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: 'var(--ag-radius-full)',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minHeight: '44px',
                  boxShadow: 'var(--ag-shadow-button)',
                }}
              >
                <span>Generate {selectedCrop.cropName} Plan</span>
                <ArrowRight size={16} />
              </button>
            )}

            {currentStep === 4 && planResult && (
              <button
                type="button"
                onClick={handleStartCropAcceptance}
                disabled={isStartingCrop || isAcreageExceeded}
                style={{
                  backgroundColor: isAcreageExceeded ? '#9CA3AF' : 'var(--ag-color-primary-base)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: 'var(--ag-radius-full)',
                  fontSize: '15px',
                  fontWeight: 900,
                  cursor: isAcreageExceeded ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minHeight: '48px',
                  boxShadow: isAcreageExceeded ? 'none' : 'var(--ag-shadow-button)',
                }}
              >
                <Sprout size={18} />
                <span>{isStartingCrop ? 'Starting Crop...' : '[ Start this crop ]'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
