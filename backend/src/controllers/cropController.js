import * as cropDiagnosisService from '../services/crop/cropDiagnosisService.js';
import * as whisperService from '../services/voice/whisperService.js';
import { supabase, isSupabaseConfigured, getOrCreateDefaultFarmerUser } from '../config/supabase.js';

export async function diagnoseCrop(req, res, next) {
  try {
    const files = req.files || [];
    
    // Separate image files and audio files
    const imageFiles = files.filter(f => f.mimetype.startsWith('image/') || f.fieldname === 'images' || f.fieldname === 'image');
    const audioFile = files.find(f => f.mimetype.startsWith('audio/') || f.fieldname === 'audio');

    if (imageFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'IMAGES_REQUIRED',
          message: 'At least one crop photo (1 to 5 images) is required for Crop Doctor analysis.',
        },
      });
    }

    const { cropName, language = 'en', voiceDescription, farmerContext } = req.body;

    console.log('[CropDoctor] authenticated user:', req.user ? req.user.id : 'MISSING (Will resolve default farmer)');
    console.log('[CropDoctor] image count:', imageFiles.length);
    console.log('[CropDoctor] crop:', cropName || 'Cotton');
    console.log('[CropDoctor] language:', language);

    // 1. Transcribe voice audio if provided
    let voiceTranscript = voiceDescription || null;
    let voiceStatus = voiceDescription ? 'provided_text' : 'none';
    let whisperLatencyMs = 0;

    if (audioFile) {
      try {
        const t0_whisper = performance.now();
        const whisperResult = await whisperService.transcribeAudio({
          fileBuffer: audioFile.buffer,
          mimeType: audioFile.mimetype,
          language,
          filename: audioFile.originalname || 'voice_description.webm',
        });
        const t1_whisper = performance.now();
        whisperLatencyMs = Math.round(t1_whisper - t0_whisper);

        if (whisperResult.text && whisperResult.text.trim().length > 0) {
          voiceTranscript = whisperResult.text.trim();
          voiceStatus = 'transcribed';
        }
      } catch (whisperErr) {
        console.warn('[CropController] Whisper voice transcription notice:', whisperErr.message);
        voiceStatus = 'unavailable';
      }
    }

    // 2. Perform Multimodal GLM-5.3-Flash Reasoning
    const result = await cropDiagnosisService.diagnoseCropMultimodal({
      images: imageFiles,
      voiceTranscript,
      cropName: cropName || 'Cotton',
      language,
      farmerContext,
      user: req.user || null,
      audioFile,
    });

    res.json({
      success: true,
      data: {
        ...result,
        voiceStatus,
        whisperLatencyMs,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getCropObservations(req, res, next) {
  try {
    if (!isSupabaseConfigured()) {
      return res.json({
        success: true,
        data: [],
        message: 'Supabase database is not configured. Serving local state.',
      });
    }

    const userId = req.user?.id;
    let query = supabase.from('crop_observations').select('*').order('observed_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/crop/diagnoses — Retrieves Crop Doctor assessment history from Supabase
 */
export async function getCropDiagnoses(req, res, next) {
  try {
    if (!isSupabaseConfigured()) {
      return res.json({
        success: true,
        data: [],
        message: 'Supabase database is not configured.',
      });
    }

    let userId = req.user?.id;
    if (!userId) {
      userId = await getOrCreateDefaultFarmerUser();
    }

    let query = supabase
      .from('crop_diagnoses')
      .select(`
        id,
        user_id,
        crop_name,
        status,
        diagnosis_title,
        summary,
        severity,
        symptoms_observed,
        farmer_reported_symptoms,
        visual_findings,
        likely_cause,
        recommendation,
        immediate_action,
        what_to_avoid,
        monitoring_advice,
        needs_expert_review,
        additional_photos_needed,
        voice_context_used,
        voice_storage_path,
        voice_transcript,
        voice_language,
        image_count,
        visual_annotations,
        model_name,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(30);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: diagnoses, error } = await query;
    if (error) throw error;

    if (!diagnoses || diagnoses.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Fetch images for all diagnoses and create signed URLs
    const diagIds = diagnoses.map(d => d.id);
    const { data: allImages, error: imgErr } = await supabase
      .from('crop_diagnosis_images')
      .select('*')
      .in('diagnosis_id', diagIds)
      .order('image_index', { ascending: true });

    if (imgErr) {
      console.warn('[CropController] Error loading diagnosis images:', imgErr.message);
    }

    // Map images by diagnosis_id
    const imagesByDiag = {};
    (allImages || []).forEach(img => {
      if (!imagesByDiag[img.diagnosis_id]) imagesByDiag[img.diagnosis_id] = [];
      imagesByDiag[img.diagnosis_id].push(img);
    });

    // Create signed URLs for thumbnails
    const items = await Promise.all(
      diagnoses.map(async (diag) => {
        const diagImgs = imagesByDiag[diag.id] || [];
        let thumbnailSignedUrl = null;
        const signedImages = [];

        for (const img of diagImgs) {
          try {
            const { data: signed } = await supabase.storage
              .from('crop-images')
              .createSignedUrl(img.storage_path, 3600);
            if (signed?.signedUrl) {
              signedImages.push({
                imageIndex: img.image_index,
                storagePath: img.storage_path,
                previewUrl: signed.signedUrl,
              });
              if (!thumbnailSignedUrl) {
                thumbnailSignedUrl = signed.signedUrl;
              }
            }
          } catch (signErr) {
            console.warn('[CropController] Signed URL error:', signErr.message);
          }
        }

        return {
          id: diag.id,
          cropName: diag.crop_name,
          status: diag.status,
          diagnosisTitle: diag.diagnosis_title,
          summary: diag.summary,
          severity: diag.severity,
          imageCount: diag.image_count || signedImages.length || 1,
          voiceContextUsed: Boolean(diag.voice_context_used),
          voiceTranscript: diag.voice_transcript,
          createdAt: diag.created_at,
          thumbnailSignedUrl,
          signedImages,
        };
      })
    );

    res.json({
      success: true,
      data: items,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/crop/diagnoses/:id — Reconstructs a full historical diagnosis with signed URLs
 */
export async function getCropDiagnosisById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Diagnosis ID is required.' },
      });
    }

    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        success: false,
        error: { message: 'Database is not configured.' },
      });
    }

    const { data: diag, error } = await supabase
      .from('crop_diagnoses')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !diag) {
      return res.status(404).json({
        success: false,
        error: { message: 'Crop diagnosis record not found.' },
      });
    }

    // Fetch images and create signed URLs
    const { data: dbImages } = await supabase
      .from('crop_diagnosis_images')
      .select('*')
      .eq('diagnosis_id', id)
      .order('image_index', { ascending: true });

    const signedImages = [];
    for (const img of dbImages || []) {
      try {
        const { data: signed } = await supabase.storage
          .from('crop-images')
          .createSignedUrl(img.storage_path, 3600);
        if (signed?.signedUrl) {
          signedImages.push({
            imageIndex: img.image_index,
            storagePath: img.storage_path,
            previewUrl: signed.signedUrl,
            name: `Photo #${img.image_index + 1}`,
          });
        }
      } catch (signErr) {
        console.warn('[CropController] Signed URL error for image:', signErr.message);
      }
    }

    // Signed URL for voice audio if available
    let signedAudioUrl = null;
    if (diag.voice_storage_path) {
      try {
        const { data: audioSigned } = await supabase.storage
          .from('crop-audio')
          .createSignedUrl(diag.voice_storage_path, 3600);
        signedAudioUrl = audioSigned?.signedUrl || null;
      } catch (aErr) {
        console.warn('[CropController] Signed URL error for voice audio:', aErr.message);
      }
    }

    // Reconstruct full CropDoctorDiagnosis object
    const structuredDiagnosis = {
      status: diag.status,
      diagnosisTitle: diag.diagnosis_title,
      summary: diag.summary,
      severity: diag.severity,
      symptomsObserved: Array.isArray(diag.symptoms_observed) ? diag.symptoms_observed : [],
      farmerReportedSymptoms: Array.isArray(diag.farmer_reported_symptoms) ? diag.farmer_reported_symptoms : (diag.voice_transcript ? [diag.voice_transcript] : []),
      visualFindings: Array.isArray(diag.visual_findings) ? diag.visual_findings : [],
      likelyCause: diag.likely_cause,
      recommendation: Array.isArray(diag.recommendation) ? diag.recommendation : (diag.recommendation ? [diag.recommendation] : []),
      immediateAction: diag.immediate_action,
      whatToAvoid: Array.isArray(diag.what_to_avoid) ? diag.what_to_avoid : [],
      monitoringAdvice: diag.monitoring_advice,
      needsExpertReview: Boolean(diag.needs_expert_review),
      additionalPhotosNeeded: Array.isArray(diag.additional_photos_needed) ? diag.additional_photos_needed : [],
      voiceContextUsed: Boolean(diag.voice_context_used),
      imageCount: diag.image_count || signedImages.length || 1,
      visualAnnotations: Array.isArray(diag.visual_annotations) ? diag.visual_annotations : [],
      selectedCrop: diag.crop_name,
      model: diag.model_name,
      createdAt: diag.created_at,
      combinedAssessment: diag.summary,
    };

    res.json({
      success: true,
      data: {
        diagnosis: structuredDiagnosis,
        images: signedImages,
        audioUrl: signedAudioUrl,
        createdAt: diag.created_at,
        id: diag.id,
      },
    });
  } catch (err) {
    next(err);
  }
}
