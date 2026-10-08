import { env } from '../../config/env.js';
import { supabase, isSupabaseConfigured, getOrCreateDefaultFarmerUser } from '../../config/supabase.js';

export async function diagnoseCropMultimodal({
  images = [],
  voiceTranscript = null,
  cropName = 'Cotton',
  language = 'en',
  farmerContext = null,
  user = null,
  audioFile = null,
}) {
  if (!env.FIREWORKS_API_KEY) {
    const error = new Error('Fireworks AI vision model service is not configured on server.');
    error.code = 'VISION_UNCONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  if (!images || images.length === 0) {
    const error = new Error('At least one crop photo (1 to 5 images) is required for analysis.');
    error.code = 'IMAGES_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  // Cap at 5 images
  const analyzedImages = images.slice(0, 5);

  const languageInstruction =
    language === 'te' ? 'Output all diagnostic titles, summaries, visual findings, conflict reasons, and practical recommendations in authentic Telugu language (తెలుగు).' :
    language === 'hi' ? 'Output all diagnostic titles, summaries, visual findings, conflict reasons, and practical recommendations in authentic Hindi language (हिन्दी).' :
    'Output all diagnostic titles, summaries, visual findings, conflict reasons, and practical recommendations in clear, simple English accessible for an Indian farmer.';

  const languageName = language === 'te' ? 'Telugu (తెలుగు)' : (language === 'hi' ? 'Hindi (हिन्दी)' : 'English');

  const systemPrompt = `You are AgriGuide Crop Doctor, an expert agricultural multimodal diagnostic reasoning system for Indian farmers.
You are evaluating multiple independent evidence sources together:
1. Selected Crop: User-selected UI context ("${cropName}"), not guaranteed ground truth.
2. Uploaded Photos: Visual evidence (${analyzedImages.length} image(s) provided), not guaranteed ground truth.
3. Farmer Voice Transcript: Farmer-reported description (${voiceTranscript ? `"${voiceTranscript.trim()}"` : 'None provided'}), not verified fact.

Compare all evidence before diagnosis. Do NOT force agreement.

CRITICAL EVIDENCE REASONING PRINCIPLES:
1. INDEPENDENT EVIDENCE EVALUATION:
   - "photoCropAssessment":
     * cropIdentified: What crop is actually visible in the photos? (e.g. "Chilli", "Tomato", "Cotton", "Maize", "Rice", "Non-crop", "Poster", "Unclear")
     * identityConfidence: "high" | "medium" | "low" | "unknown"
     * isAgriculturalImage: true if actual field/plant/leaf photos, false if poster, infographic, or non-plant.
     * reason: Brief objective description of visual evidence.
   - "voiceAssessment":
     * cropMentioned: Crop name explicitly spoken by farmer (e.g. "Tomato", "Chilli", "Cotton"), or null if no crop was named.
     * cropMentionedExplicitly: true if the farmer explicitly named a crop, false if they only described symptoms without naming a crop.
     * reportedSymptoms: Array of symptoms described in speech.
     * reportedContext: Array of timeline, weather, or actions described.

2. CROSS-MODAL CONSISTENCY EVALUATION (Must be exactly one of: "consistent" | "conflict" | "insufficient"):
   - "consistent": The selected crop, visual evidence, and spoken voice information are compatible.
     * CRITICAL RULE: A farmer does NOT have to mention the crop name in voice! If selected is "${cropName}", photos show ${cropName}, and voice only describes symptoms (e.g. "leaves have black spots and are drying"), this is CONSISTENT! The absence of a crop name in voice is NOT a conflict (cropMentioned is null, cropMentionedExplicitly is false).
   - "conflict": There is an explicit contradiction between the evidence sources.
     * Example 1: Selected is "Chilli", photo shows Chilli, but voice says "My tomato plants have black spots" (Farmer explicitly refers to Tomato) -> "conflict".
     * Example 2: Selected is "Chilli", but photo clearly shows Tomato or Cotton -> "conflict".
     * When "conflict": Set "crossModalConsistency": "conflict", and provide a clear, polite "conflictReason" in ${languageName} explaining the mismatch.
   - "insufficient": The evidence is not strong enough to establish crop identity or diagnose reliably (e.g. blurry photos, dark/unclear, soil only, poster with text, non-crop object without clear plant foliage).
     * Do NOT convert insufficient evidence into a conflict.

3. UNIFIED MULTIMODAL DIAGNOSIS (When evidence is "consistent"):
   - DO NOT give analysis or recommendations based only on the images!
   - You MUST deeply integrate and combine BOTH the visual symptoms from all photos AND any specific details/symptoms/questions mentioned in the farmer's voice:
     * "combinedAssessment": Comprehensive explanation connecting what is visible in photos with what the farmer reported in voice.
     * "symptomsObserved": Merge visual observations and farmer-reported symptoms.
     * "visualFindings": Visible symptoms on foliage/fruit.
     * "farmerReportedSymptoms": Spoken symptoms.
     * "likelyCause": Agronomic cause synthesizing visual symptoms with spoken timeline/conditions.
     * "recommendation" & "immediateAction": Practical steps addressing both the photographed condition and the farmer's spoken concerns.
     * "summary": Direct farmer-friendly summary.
   - Deterministic Outcomes:
     * "problem_detected": Clear visual disease/pest/deficiency signs.
     * "no_issue": Crop foliage is healthy, green, and vigorous with no disease or pest damage. (Title in ${languageName}: "Crop is Healthy & Fine").
     * "uncertain": When photos are inconclusive or additional angles are needed.

4. MULTI-IMAGE REASONING: Compare all ${analyzedImages.length} submitted photos together.

5. RECOMMENDATION SAFETY: Give practical agronomic steps (e.g. field sanitation, inspecting underside of leaves, consulting local KVK officer).

6. VISUAL ANNOTATIONS: If visible symptoms or damage areas are identifiable in the images, provide approximate normalized bounding box coordinates (0-100% relative to image width/height) with imageIndex (0 to ${analyzedImages.length - 1}) and a brief label. If no clear region or if healthy/uncertain/conflict, return empty array [].

7. ${languageInstruction}

Return ONLY a valid JSON object matching EXACTLY this schema:
{
  "evidenceAssessment": {
    "selectedCrop": "${cropName}",
    "photoCropAssessment": {
      "cropIdentified": string | null,
      "identityConfidence": "high" | "medium" | "low" | "unknown",
      "isAgriculturalImage": boolean,
      "reason": string
    },
    "voiceAssessment": {
      "cropMentioned": string | null,
      "cropMentionedExplicitly": boolean,
      "reportedSymptoms": string[],
      "reportedContext": string[]
    },
    "crossModalConsistency": "consistent" | "conflict" | "insufficient",
    "conflictReason": string | null,
    "evidenceQuality": "sufficient" | "insufficient"
  },
  "combinedAssessment": string,
  "status": "no_issue" | "problem_detected" | "uncertain",
  "diagnosisTitle": string,
  "summary": string,
  "severity": "none" | "low" | "moderate" | "high" | "unknown",
  "symptomsObserved": string[],
  "farmerReportedSymptoms": string[],
  "visualFindings": string[],
  "likelyCause": string | null,
  "recommendation": string[],
  "immediateAction": string | null,
  "whatToAvoid": string[],
  "monitoringAdvice": string | null,
  "needsExpertReview": boolean,
  "additionalPhotosNeeded": string[],
  "voiceContextUsed": boolean,
  "imageCount": number,
  "visualAnnotations": [
    {
      "imageIndex": number,
      "label": string,
      "x": number,
      "y": number,
      "width": number,
      "height": number
    }
  ]
}

Keep all strings, explanations, and list items concise, crisp, and direct so the JSON is always complete and compact.`;

  // Build multimodal content array with text context + all images
  const userContent = [];

  let contextDescription = `Selected Crop: ${cropName}\nTotal Photos Attached: ${analyzedImages.length}\n`;
  if (voiceTranscript && voiceTranscript.trim().length > 0) {
    contextDescription += `Farmer's Spoken Description (Voice): "${voiceTranscript.trim()}"\n`;
  } else {
    contextDescription += `Farmer Voice Description: None provided (visual-only assessment).\n`;
  }

  if (farmerContext) {
    contextDescription += `Farm Context: ${typeof farmerContext === 'string' ? farmerContext : JSON.stringify(farmerContext)}\n`;
  }

  userContent.push({
    type: 'text',
    text: `${contextDescription}\nPlease analyze these ${analyzedImages.length} photo(s) together with the selected crop ("${cropName}") and spoken voice transcript, evaluate cross-modal evidence consistency, and provide the structured crop assessment combining both voice and visual evidence.`
  });

  // Attach all images as multimodal image_url base64 payloads
  for (const img of analyzedImages) {
    const mimeType = img.mimetype || 'image/jpeg';
    const base64Data = img.buffer.toString('base64');
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${base64Data}`
      }
    });
  }

  const completionsUrl = `${env.FIREWORKS_BASE_URL}/chat/completions`;

  const t0_ai = performance.now();
  const response = await fetch(completionsUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.FIREWORKS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.FIREWORKS_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(120000),
  });
  const t1_ai = performance.now();
  const aiLatencyMs = Math.round(t1_ai - t0_ai);

  console.log(`[CropDoctor AI] HTTP status: ${response.status}`);
  console.log(`[CropDoctor AI] model: ${env.FIREWORKS_MODEL}`);

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[CropDoctor AI] HTTP error (${response.status}): ${errText}`);
    const error = new Error(`Fireworks vision model error (${response.status}): ${errText}`);
    error.code = 'VISION_PROVIDER_ERROR';
    error.statusCode = 502;
    throw error;
  }

  const aiJson = await response.json();
  const choice = aiJson.choices?.[0] || {};
  const finishReason = choice.finish_reason || 'unknown';
  const messageObj = choice.message || {};
  let rawContent = (messageObj.content || '').trim();
  
  if (!rawContent && messageObj.reasoning_content) {
    rawContent = messageObj.reasoning_content.trim();
  }

  console.log(`[CropDoctor AI] finish_reason: ${finishReason}`);
  console.log(`[CropDoctor AI] response content length: ${rawContent.length}`);
  
  let diagnosisResult = parseOrRepairDiagnosticJson(rawContent);
  if (!diagnosisResult) {
    console.error('[CropDoctor AI] Failed to parse JSON. Raw content was:\n', rawContent);
    throw new Error('Failed to parse AI model response into structured JSON.');
  }

  const evidenceAssessment = diagnosisResult.evidenceAssessment || {};
  const photoAssessment = evidenceAssessment.photoCropAssessment || {};
  const voiceAssessment = evidenceAssessment.voiceAssessment || {};
  
  const crossModalConsistency = ['consistent', 'conflict', 'insufficient'].includes(evidenceAssessment.crossModalConsistency)
    ? evidenceAssessment.crossModalConsistency
    : (diagnosisResult.cropMismatchDetected ? 'conflict' : 'consistent');

  const isConflict = crossModalConsistency === 'conflict';
  const isInsufficient = crossModalConsistency === 'insufficient';

  const selectedCropVal = evidenceAssessment.selectedCrop || diagnosisResult.selectedCrop || cropName;
  const visualCropVal = photoAssessment.cropIdentified || diagnosisResult.visualCropIdentified || cropName;
  const voiceCropVal = voiceAssessment.cropMentioned || diagnosisResult.voiceCropMentioned || null;
  const conflictReasonVal = evidenceAssessment.conflictReason || diagnosisResult.mismatchNotice || null;

  // Determine final status
  let finalStatus;
  if (isConflict) {
    finalStatus = 'mismatch';
  } else if (isInsufficient) {
    finalStatus = 'uncertain';
  } else {
    finalStatus = ['no_issue', 'problem_detected', 'uncertain'].includes(diagnosisResult.status)
      ? diagnosisResult.status
      : (diagnosisResult.severity === 'none' ? 'no_issue' : 'problem_detected');
  }

  const normalizedSeverity = ['none', 'low', 'moderate', 'high', 'unknown'].includes(diagnosisResult.severity)
    ? diagnosisResult.severity
    : (finalStatus === 'no_issue' ? 'none' : (finalStatus === 'mismatch' ? 'unknown' : 'moderate'));

  const rawAnnotations = Array.isArray(diagnosisResult.visualAnnotations)
    ? diagnosisResult.visualAnnotations
    : (Array.isArray(diagnosisResult.visual_annotations) ? diagnosisResult.visual_annotations : []);

  const visualAnnotations = isConflict ? [] : rawAnnotations
    .filter(a => a && typeof a === 'object')
    .map(a => {
      const imgIdx = Number.isInteger(a.imageIndex) ? a.imageIndex : 0;
      const x = Math.max(0, Math.min(100, Math.round(Number(a.x) || 0)));
      const y = Math.max(0, Math.min(100, Math.round(Number(a.y) || 0)));
      const width = Math.max(5, Math.min(100 - x, Math.round(Number(a.width) || 20)));
      const height = Math.max(5, Math.min(100 - y, Math.round(Number(a.height) || 20)));
      const label = typeof a.label === 'string' ? a.label.trim() : 'Observed region';
      return {
        imageIndex: Math.max(0, Math.min(analyzedImages.length - 1, imgIdx)),
        label,
        x,
        y,
        width,
        height,
      };
    })
    .filter(a => a.imageIndex >= 0 && a.imageIndex < analyzedImages.length);

  const structuredResponse = {
    status: finalStatus,
    evidenceAssessment: {
      selectedCrop: selectedCropVal,
      photoCropAssessment: {
        cropIdentified: visualCropVal,
        identityConfidence: photoAssessment.identityConfidence || (isInsufficient ? 'low' : 'high'),
        isAgriculturalImage: photoAssessment.isAgriculturalImage !== false,
        reason: photoAssessment.reason || 'Visual plant evaluation',
      },
      voiceAssessment: {
        cropMentioned: voiceCropVal,
        cropMentionedExplicitly: Boolean(voiceAssessment.cropMentionedExplicitly || voiceCropVal),
        reportedSymptoms: Array.isArray(voiceAssessment.reportedSymptoms) ? voiceAssessment.reportedSymptoms : (voiceTranscript ? [voiceTranscript] : []),
        reportedContext: Array.isArray(voiceAssessment.reportedContext) ? voiceAssessment.reportedContext : [],
      },
      crossModalConsistency,
      conflictReason: conflictReasonVal,
      evidenceQuality: isInsufficient ? 'insufficient' : 'sufficient',
    },
    combinedAssessment: diagnosisResult.combinedAssessment || diagnosisResult.summary || 'Evidence evaluated.',
    cropMismatchDetected: isConflict,
    selectedCrop: selectedCropVal,
    visualCropIdentified: visualCropVal,
    voiceCropMentioned: voiceCropVal,
    mismatchNotice: conflictReasonVal,
    diagnosisTitle: isConflict
      ? (language === 'te' ? 'పంట వివరాలలో తేడా గుర్తించబడింది' : language === 'hi' ? 'फसल विवरण में बेमेल' : 'Crop Input Mismatch')
      : (diagnosisResult.diagnosisTitle || (finalStatus === 'no_issue' ? (language === 'te' ? 'పంట ఆరోగ్యంగా ఉంది' : language === 'hi' ? 'फसल स्वस्थ है' : 'Crop is Healthy & Fine') : 'Crop Observation')),
    summary: isConflict ? conflictReasonVal : (diagnosisResult.summary || 'Visual inspection completed.'),
    severity: normalizedSeverity,
    symptomsObserved: Array.isArray(diagnosisResult.symptomsObserved) ? diagnosisResult.symptomsObserved : [],
    farmerReportedSymptoms: Array.isArray(diagnosisResult.farmerReportedSymptoms) 
      ? diagnosisResult.farmerReportedSymptoms 
      : (voiceTranscript ? [voiceTranscript] : []),
    visualFindings: Array.isArray(diagnosisResult.visualFindings) ? diagnosisResult.visualFindings : [],
    likelyCause: isConflict ? null : (diagnosisResult.likelyCause || null),
    recommendation: Array.isArray(diagnosisResult.recommendation) 
      ? diagnosisResult.recommendation 
      : (diagnosisResult.recommendation ? [diagnosisResult.recommendation] : ['Continue regular crop scouting.']),
    immediateAction: diagnosisResult.immediateAction || null,
    whatToAvoid: Array.isArray(diagnosisResult.whatToAvoid) ? diagnosisResult.whatToAvoid : [],
    monitoringAdvice: diagnosisResult.monitoringAdvice || 'Check lower and upper leaf surfaces during morning hours.',
    needsExpertReview: Boolean(diagnosisResult.needsExpertReview),
    additionalPhotosNeeded: Array.isArray(diagnosisResult.additionalPhotosNeeded) ? diagnosisResult.additionalPhotosNeeded : [],
    voiceContextUsed: Boolean(voiceTranscript && voiceTranscript.trim().length > 0),
    imageCount: analyzedImages.length,
    visualAnnotations,
    title: isConflict ? 'Crop Input Mismatch' : (diagnosisResult.diagnosisTitle || 'Crop Assessment'),
    model: env.FIREWORKS_MODEL,
    aiLatencyMs,
  };

  // If status is 'mismatch' (conflict), do NOT persist to database, return immediately!
  if (finalStatus === 'mismatch') {
    console.log('[CropDoctor] Cross-modal conflict detected by GLM-5.3-Flash. Returning mismatch response directly without database insert.');
    return {
      status: 'mismatch',
      cropMismatchDetected: true,
      selectedCrop: selectedCropVal,
      visualCropIdentified: visualCropVal,
      voiceCropMentioned: voiceCropVal,
      mismatchNotice: conflictReasonVal,
      message: conflictReasonVal,
      diagnosis: structuredResponse,
      uploadedPaths: [],
      voiceStoragePath: null,
      aiLatencyMs,
      createdAt: new Date().toISOString(),
    };
  }

  // Persist images, audio and diagnostic record to Supabase
  const uploadedPaths = [];
  let voiceStoragePath = null;

  if (isSupabaseConfigured()) {
    let resolvedUserId = user?.id || null;
    if (!resolvedUserId) {
      resolvedUserId = await getOrCreateDefaultFarmerUser();
    }

    if (!resolvedUserId) {
      console.error('[CropDoctor DB] Cannot persist: No authenticated or default farmer user ID available.');
      throw new Error('Database persistence failed: User identity could not be resolved.');
    }

    // 1. Ensure profile exists in profiles table
    try {
      await supabase.from('profiles').upsert({
        id: resolvedUserId,
        full_name: 'Ramesh ji',
        district: 'Warangal',
        state: 'Telangana',
        village: 'Geesugonda',
        preferred_language: language || 'en',
      }, { onConflict: 'id' });
    } catch (profErr) {
      console.warn('[CropDoctor DB] Profile sync notice:', profErr.message);
    }

    // 2. Upload crop photos to crop-images private storage bucket
    for (let i = 0; i < analyzedImages.length; i++) {
      const img = analyzedImages[i];
      const filePath = `diagnoses/${resolvedUserId}/${Date.now()}_img${i}_${img.originalname || 'leaf.jpg'}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('crop-images')
        .upload(filePath, img.buffer, { contentType: img.mimetype || 'image/jpeg' });

      if (uploadErr) {
        console.error('[CropDoctor Storage] upload failed', {
          index: i,
          message: uploadErr.message,
          error: uploadErr,
        });
        throw new Error(`Failed to upload crop image #${i + 1} to storage: ${uploadErr.message}`);
      }

      console.log('[CropDoctor Storage] upload success');
      console.log(`[CropDoctor Storage] image index: ${i}`);
      console.log(`[CropDoctor Storage] path created: ${uploadData.path}`);
      uploadedPaths.push(uploadData.path);
    }

    // 3. Upload voice audio if provided
    if (audioFile?.buffer) {
      try {
        const audioPath = `voice/${resolvedUserId}/${Date.now()}_recording.webm`;
        const { data: audioUpload, error: audioErr } = await supabase.storage
          .from('crop-audio')
          .upload(audioPath, audioFile.buffer, { contentType: audioFile.mimetype || 'audio/webm' });
        if (!audioErr && audioUpload) {
          voiceStoragePath = audioUpload.path;
        }
      } catch (aErr) {
        console.warn('[CropDoctor Storage] Voice audio notice:', aErr.message);
      }
    }

    // 4. Insert unified record into crop_diagnoses
    console.log('[CropDoctor DB] About to insert diagnosis');
    console.log('[CropDoctor DB] user_id present:', Boolean(resolvedUserId));
    console.log('[CropDoctor DB] crop_name:', cropName);
    console.log('[CropDoctor DB] status:', structuredResponse.status);
    console.log('[CropDoctor DB] image_count:', structuredResponse.imageCount);

    const { data: diagRecord, error: diagErr } = await supabase
      .from('crop_diagnoses')
      .insert({
        user_id: resolvedUserId,
        crop_name: cropName,
        status: structuredResponse.status,
        diagnosis_title: structuredResponse.diagnosisTitle,
        summary: structuredResponse.summary,
        severity: structuredResponse.severity,
        symptoms_observed: structuredResponse.symptomsObserved,
        farmer_reported_symptoms: structuredResponse.farmerReportedSymptoms,
        visual_findings: structuredResponse.visualFindings,
        likely_cause: structuredResponse.likelyCause,
        recommendation: structuredResponse.recommendation,
        immediate_action: structuredResponse.immediateAction,
        what_to_avoid: structuredResponse.whatToAvoid,
        monitoring_advice: structuredResponse.monitoringAdvice,
        needs_expert_review: structuredResponse.needsExpertReview,
        additional_photos_needed: structuredResponse.additionalPhotosNeeded,
        voice_context_used: structuredResponse.voiceContextUsed,
        voice_storage_path: voiceStoragePath,
        voice_transcript: voiceTranscript || null,
        voice_language: language || 'en',
        image_count: structuredResponse.imageCount,
        visual_annotations: structuredResponse.visualAnnotations,
        model_name: env.FIREWORKS_MODEL,
      })
      .select()
      .single();

    if (diagErr) {
      console.error('[CropDoctor DB] diagnosis insert FAILED', {
        message: diagErr.message,
        code: diagErr.code,
        details: diagErr.details,
        hint: diagErr.hint,
      });
      throw diagErr;
    }

    if (!diagRecord) {
      throw new Error('Crop diagnosis insert returned no row');
    }

    console.log('[CropDoctor DB] diagnosis inserted successfully');
    console.log(`[CropDoctor DB] diagnosis_id: ${diagRecord.id}`);

    // 5. Insert normalized image records into crop_diagnosis_images
    if (uploadedPaths.length > 0) {
      const imageRows = uploadedPaths.map((path, idx) => ({
        diagnosis_id: diagRecord.id,
        user_id: resolvedUserId,
        image_index: idx,
        storage_path: path,
      }));

      const { data: imgData, error: imgErr } = await supabase
        .from('crop_diagnosis_images')
        .insert(imageRows)
        .select();

      if (imgErr) {
        console.error('[CropDoctor DB] diagnosis images insert FAILED', {
          message: imgErr.message,
          code: imgErr.code,
          details: imgErr.details,
          hint: imgErr.hint,
        });
        throw imgErr;
      }
      console.log(`[CropDoctor DB] ${imageRows.length} diagnosis image records inserted successfully`);
    }

    // 6. Development verification query
    try {
      const { data: vDiag } = await supabase.from('crop_diagnoses').select('id, crop_name, status').eq('id', diagRecord.id);
      const { data: vImgs } = await supabase.from('crop_diagnosis_images').select('id, storage_path').eq('diagnosis_id', diagRecord.id);
      console.log(`[CropDoctor DB Verification] Verified in DB: diagnosis rows = ${vDiag?.length || 0}, image rows = ${vImgs?.length || 0}`);
    } catch (vErr) {
      console.warn('[CropDoctor DB Verification] notice:', vErr.message);
    }
  }

  return {
    status: 'success',
    diagnosis: structuredResponse,
    uploadedPaths,
    voiceStoragePath,
    aiLatencyMs,
    createdAt: new Date().toISOString(),
  };
}

// Backwards-compatible single-image wrapper
export async function diagnoseCropLeaf({
  imageBuffer,
  mimeType = 'image/jpeg',
  cropName = 'Cotton',
  user = null,
  filename = 'leaf.jpg',
  voiceTranscript = null,
  language = 'en',
}) {
  return diagnoseCropMultimodal({
    images: [{
      buffer: imageBuffer,
      mimetype: mimeType,
      originalname: filename,
    }],
    voiceTranscript,
    cropName,
    language,
    user,
  });
}

/**
 * Resilient multi-tier JSON parser and auto-repair utility
 */
export function parseOrRepairDiagnosticJson(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;
  text = text.slice(firstBrace);

  // Strategy 1: Slice from first { to last }
  const lastBrace = text.lastIndexOf('}');
  if (lastBrace > 0) {
    try {
      return JSON.parse(text.slice(0, lastBrace + 1));
    } catch (_) {}
  }

  // Strategy 2: Bracket & brace balance repair
  try {
    let candidate = text;
    const quoteMatches = candidate.match(/(?<!\\)"/g) || [];
    if (quoteMatches.length % 2 !== 0) {
      candidate += '"';
    }

    let openBrackets = 0;
    let openBraces = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (!inString) {
        if (ch === '[') openBrackets++;
        else if (ch === ']') openBrackets--;
        else if (ch === '{') openBraces++;
        else if (ch === '}') openBraces--;
      }
    }

    let fixed = candidate;
    while (openBrackets > 0) { fixed += ']'; openBrackets--; }
    while (openBraces > 0) { fixed += '}'; openBraces--; }

    return JSON.parse(fixed);
  } catch (_) {}

  // Strategy 3: Backtrack line-by-line to salvage preceding valid fields
  const lines = text.split('\n');
  for (let l = lines.length - 1; l > 0; l--) {
    let sub = lines.slice(0, l).join('\n').trim();
    if (sub.endsWith(',')) sub = sub.slice(0, -1);

    let ob = 0, obr = 0, is = false, esc = false;
    const qm = sub.match(/(?<!\\)"/g) || [];
    if (qm.length % 2 !== 0) sub += '"';
    for (let i = 0; i < sub.length; i++) {
      const c = sub[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { is = !is; continue; }
      if (!is) {
        if (c === '[') ob++;
        else if (c === ']') ob--;
        else if (c === '{') obr++;
        else if (c === '}') obr--;
      }
    }
    while (ob > 0) { sub += ']'; ob--; }
    while (obr > 0) { sub += '}'; obr--; }

    try {
      return JSON.parse(sub);
    } catch (_) {}
  }

  // Strategy 4: Regex extract core fields
  try {
    const statusMatch = text.match(/"status"\s*:\s*"([^"]+)"/i);
    const titleMatch = text.match(/"diagnosisTitle"\s*:\s*"([^"]+)"/i);
    const summaryMatch = text.match(/"summary"\s*:\s*"([^"]+)"/i);
    const severityMatch = text.match(/"severity"\s*:\s*"([^"]+)"/i);

    if (statusMatch || titleMatch || summaryMatch) {
      return {
        status: statusMatch ? statusMatch[1] : 'problem_detected',
        diagnosisTitle: titleMatch ? titleMatch[1] : 'Crop Observation',
        summary: summaryMatch ? summaryMatch[1] : 'Visual inspection completed.',
        severity: severityMatch ? severityMatch[1] : 'moderate',
        symptomsObserved: [],
        farmerReportedSymptoms: [],
        visualFindings: [],
        likelyCause: null,
        recommendation: [],
        immediateAction: null,
        whatToAvoid: [],
        monitoringAdvice: null,
        needsExpertReview: false,
        additionalPhotosNeeded: [],
        visualAnnotations: []
      };
    }
  } catch (_) {}

  return null;
}
