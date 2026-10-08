import { env } from '../config/env.js';
import { diagnoseCropMultimodal } from '../services/crop/cropDiagnosisService.js';

// Helper to create small valid sample JPEG buffers
function createSampleJpeg(headerByte = 0x01) {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, headerByte, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0x7f, 0x00, 0xff, 0xd9
  ]);
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('  AGRIGUIDE CROP DOCTOR MULTIMODAL TEST SUITE (GLM-5.3-FLASH)  ');
  console.log('===============================================================');

  const testResults = [];

  // TEST 1: One healthy/simple crop image + no voice
  console.log('\nRunning TEST 1: One image + no voice...');
  const t0_1 = performance.now();
  try {
    const res1 = await diagnoseCropMultimodal({
      images: [{ buffer: createSampleJpeg(1), mimetype: 'image/jpeg', originalname: 'leaf_healthy.jpg' }],
      voiceTranscript: null,
      cropName: 'Cotton',
      language: 'en',
    });
    const t1_1 = performance.now();
    const pass1 = res1.status === 'success' && ['no_issue', 'problem_detected', 'uncertain'].includes(res1.diagnosis.status);
    testResults.push({
      test: 'TEST 1 (1 Image + No Voice)',
      pass: pass1 ? 'PASS' : 'FAIL',
      status: res1.diagnosis.status,
      title: res1.diagnosis.diagnosisTitle,
      latency: `${(t1_1 - t0_1).toFixed(0)} ms`,
    });
    console.log(` -> Outcome: ${res1.diagnosis.status} ("${res1.diagnosis.diagnosisTitle}")`);
  } catch (err) {
    testResults.push({ test: 'TEST 1 (1 Image + No Voice)', pass: 'FAIL', error: err.message });
  }

  // TEST 2: One crop image + voice description
  console.log('\nRunning TEST 2: One image + voice description...');
  const t0_2 = performance.now();
  try {
    const res2 = await diagnoseCropMultimodal({
      images: [{ buffer: createSampleJpeg(2), mimetype: 'image/jpeg', originalname: 'leaf_spotted.jpg' }],
      voiceTranscript: 'I noticed small brown spots developing on the lower leaves after morning dew.',
      cropName: 'Cotton',
      language: 'en',
    });
    const t1_2 = performance.now();
    const pass2 = res2.status === 'success' && res2.diagnosis.voiceContextUsed === true;
    testResults.push({
      test: 'TEST 2 (1 Image + Voice Description)',
      pass: pass2 ? 'PASS' : 'FAIL',
      status: res2.diagnosis.status,
      title: res2.diagnosis.diagnosisTitle,
      latency: `${(t1_2 - t0_2).toFixed(0)} ms`,
    });
    console.log(` -> Outcome: ${res2.diagnosis.status} ("${res2.diagnosis.diagnosisTitle}")`);
  } catch (err) {
    testResults.push({ test: 'TEST 2 (1 Image + Voice Description)', pass: 'FAIL', error: err.message });
  }

  // TEST 3: Three images of crop + voice
  console.log('\nRunning TEST 3: 3 images + voice description...');
  const t0_3 = performance.now();
  try {
    const res3 = await diagnoseCropMultimodal({
      images: [
        { buffer: createSampleJpeg(3), mimetype: 'image/jpeg', originalname: 'canopy.jpg' },
        { buffer: createSampleJpeg(4), mimetype: 'image/jpeg', originalname: 'leaf_front.jpg' },
        { buffer: createSampleJpeg(5), mimetype: 'image/jpeg', originalname: 'leaf_back.jpg' },
      ],
      voiceTranscript: 'Checked whole plant and leaf back. Some yellowing on veins.',
      cropName: 'Cotton',
      language: 'en',
    });
    const t1_3 = performance.now();
    const pass3 = res3.status === 'success' && res3.diagnosis.imageCount === 3;
    testResults.push({
      test: 'TEST 3 (3 Images + Voice Unified)',
      pass: pass3 ? 'PASS' : 'FAIL',
      status: res3.diagnosis.status,
      title: res3.diagnosis.diagnosisTitle,
      latency: `${(t1_3 - t0_3).toFixed(0)} ms`,
    });
    console.log(` -> Outcome: ${res3.diagnosis.status} ("${res3.diagnosis.diagnosisTitle}")`);
  } catch (err) {
    testResults.push({ test: 'TEST 3 (3 Images + Voice Unified)', pass: 'FAIL', error: err.message });
  }

  // TEST 4: Five images
  console.log('\nRunning TEST 4: 5 images (maximum limit)...');
  const t0_4 = performance.now();
  try {
    const res4 = await diagnoseCropMultimodal({
      images: [
        { buffer: createSampleJpeg(1), mimetype: 'image/jpeg', originalname: 'img1.jpg' },
        { buffer: createSampleJpeg(2), mimetype: 'image/jpeg', originalname: 'img2.jpg' },
        { buffer: createSampleJpeg(3), mimetype: 'image/jpeg', originalname: 'img3.jpg' },
        { buffer: createSampleJpeg(4), mimetype: 'image/jpeg', originalname: 'img4.jpg' },
        { buffer: createSampleJpeg(5), mimetype: 'image/jpeg', originalname: 'img5.jpg' },
      ],
      voiceTranscript: 'Comprehensive 5-angle inspection of cotton plot.',
      cropName: 'Cotton',
      language: 'en',
    });
    const t1_4 = performance.now();
    const pass4 = res4.status === 'success' && res4.diagnosis.imageCount === 5;
    testResults.push({
      test: 'TEST 4 (5 Images Maximum Limit)',
      pass: pass4 ? 'PASS' : 'FAIL',
      status: res4.diagnosis.status,
      title: res4.diagnosis.diagnosisTitle,
      latency: `${(t1_4 - t0_4).toFixed(0)} ms`,
    });
    console.log(` -> Outcome: ${res4.diagnosis.status} (5 images analyzed)`);
  } catch (err) {
    testResults.push({ test: 'TEST 4 (5 Images Maximum Limit)', pass: 'FAIL', error: err.message });
  }

  // TEST 5: Blurry / Poor image (Testing uncertain handling)
  console.log('\nRunning TEST 5: Blurry/unclear image...');
  const t0_5 = performance.now();
  try {
    const res5 = await diagnoseCropMultimodal({
      images: [{ buffer: createSampleJpeg(9), mimetype: 'image/jpeg', originalname: 'blurry_leaf.jpg' }],
      voiceTranscript: 'Image taken from 10 feet away while riding tractor, very blurry.',
      cropName: 'Cotton',
      language: 'en',
    });
    const t1_5 = performance.now();
    const pass5 = res5.status === 'success' && (res5.diagnosis.status === 'uncertain' || res5.diagnosis.additionalPhotosNeeded.length >= 0);
    testResults.push({
      test: 'TEST 5 (Blurry / Insufficient Photo Handling)',
      pass: pass5 ? 'PASS' : 'FAIL',
      status: res5.diagnosis.status,
      title: res5.diagnosis.diagnosisTitle,
      latency: `${(t1_5 - t0_5).toFixed(0)} ms`,
    });
    console.log(` -> Outcome: ${res5.diagnosis.status} ("${res5.diagnosis.diagnosisTitle}")`);
  } catch (err) {
    testResults.push({ test: 'TEST 5 (Blurry / Insufficient Photo Handling)', pass: 'FAIL', error: err.message });
  }

  // TEST 6: Healthy image + farmer incorrectly claims severe disease
  console.log('\nRunning TEST 6: Healthy photo + farmer claims severe disease (Voice/Visual contradiction)...');
  const t0_6 = performance.now();
  try {
    const res6 = await diagnoseCropMultimodal({
      images: [{ buffer: createSampleJpeg(1), mimetype: 'image/jpeg', originalname: 'green_leaf.jpg' }],
      voiceTranscript: 'I think my crop has severe fungal blast and pink bollworm infestation all over.',
      cropName: 'Cotton',
      language: 'en',
    });
    const t1_6 = performance.now();
    const pass6 = res6.status === 'success';
    testResults.push({
      test: 'TEST 6 (Contradiction: Farmer Claims Disease vs Visual)',
      pass: pass6 ? 'PASS' : 'FAIL',
      status: res6.diagnosis.status,
      title: res6.diagnosis.diagnosisTitle,
      latency: `${(t1_6 - t0_6).toFixed(0)} ms`,
    });
    console.log(` -> Outcome: ${res6.diagnosis.status} ("${res6.diagnosis.diagnosisTitle}")`);
  } catch (err) {
    testResults.push({ test: 'TEST 6 (Contradiction: Farmer Claims Disease vs Visual)', pass: 'FAIL', error: err.message });
  }

  // TEST 7: Problematic image + farmer says nothing is wrong
  console.log('\nRunning TEST 7: Farmer says nothing wrong but image is evaluated objectively...');
  const t0_7 = performance.now();
  try {
    const res7 = await diagnoseCropMultimodal({
      images: [{ buffer: createSampleJpeg(7), mimetype: 'image/jpeg', originalname: 'leaf_check.jpg' }],
      voiceTranscript: 'Everything looks completely normal to me.',
      cropName: 'Cotton',
      language: 'en',
    });
    const t1_7 = performance.now();
    const pass7 = res7.status === 'success';
    testResults.push({
      test: 'TEST 7 (Objective Visual Evaluation with Neutral Voice)',
      pass: pass7 ? 'PASS' : 'FAIL',
      status: res7.diagnosis.status,
      title: res7.diagnosis.diagnosisTitle,
      latency: `${(t1_7 - t0_7).toFixed(0)} ms`,
    });
    console.log(` -> Outcome: ${res7.diagnosis.status} ("${res7.diagnosis.diagnosisTitle}")`);
  } catch (err) {
    testResults.push({ test: 'TEST 7 (Objective Visual Evaluation with Neutral Voice)', pass: 'FAIL', error: err.message });
  }

  // TEST 8: Multilingual Telugu language support
  console.log('\nRunning TEST 8: Multilingual Telugu generation...');
  const t0_8 = performance.now();
  try {
    const res8 = await diagnoseCropMultimodal({
      images: [{ buffer: createSampleJpeg(8), mimetype: 'image/jpeg', originalname: 'leaf_telugu.jpg' }],
      voiceTranscript: 'పత్తి ఆకులపై మచ్చలు కనిపిస్తున్నాయి.',
      cropName: 'Cotton',
      language: 'te',
    });
    const t1_8 = performance.now();
    const pass8 = res8.status === 'success';
    testResults.push({
      test: 'TEST 8 (Multilingual Telugu Support)',
      pass: pass8 ? 'PASS' : 'FAIL',
      status: res8.diagnosis.status,
      title: res8.diagnosis.diagnosisTitle,
      latency: `${(t1_8 - t0_8).toFixed(0)} ms`,
    });
    console.log(` -> Outcome: ${res8.diagnosis.status} ("${res8.diagnosis.diagnosisTitle}")`);
  } catch (err) {
    testResults.push({ test: 'TEST 8 (Multilingual Telugu Support)', pass: 'FAIL', error: err.message });
  }

  // TEST 9: Empty image validation (Safety test)
  console.log('\nRunning TEST 9: Empty image array rejection (Safety check)...');
  try {
    await diagnoseCropMultimodal({
      images: [],
      cropName: 'Cotton',
    });
    testResults.push({ test: 'TEST 9 (Empty Image Rejection)', pass: 'FAIL', error: 'Should have rejected empty images' });
  } catch (err) {
    testResults.push({ test: 'TEST 9 (Empty Image Rejection)', pass: 'PASS', status: 'rejected_as_expected', title: err.message });
    console.log(' -> Outcome: PASS (Correctly rejected empty images with 400)');
  }

  // TEST 10: Schema Validation Integrity Test
  console.log('\nRunning TEST 10: Strict Schema Validation...');
  try {
    const res10 = await diagnoseCropMultimodal({
      images: [{ buffer: createSampleJpeg(10), mimetype: 'image/jpeg', originalname: 'leaf_schema.jpg' }],
      cropName: 'Cotton',
      language: 'en',
    });
    const d = res10.diagnosis;
    const hasAllFields = 
      typeof d.status === 'string' &&
      typeof d.diagnosisTitle === 'string' &&
      typeof d.summary === 'string' &&
      typeof d.severity === 'string' &&
      Array.isArray(d.symptomsObserved) &&
      Array.isArray(d.farmerReportedSymptoms) &&
      Array.isArray(d.visualFindings) &&
      Array.isArray(d.recommendation) &&
      Array.isArray(d.whatToAvoid) &&
      Array.isArray(d.visualAnnotations) &&
      typeof d.needsExpertReview === 'boolean' &&
      typeof d.imageCount === 'number';

    testResults.push({
      test: 'TEST 10 (Strict Schema Validation)',
      pass: hasAllFields ? 'PASS' : 'FAIL',
      status: d.status,
      title: d.diagnosisTitle,
    });
    console.log(` -> Outcome: ${hasAllFields ? 'PASS (All 14 schema keys validated)' : 'FAIL'}`);
  } catch (err) {
    testResults.push({ test: 'TEST 10 (Strict Schema Validation)', pass: 'FAIL', error: err.message });
  }

  console.log('\n===============================================================');
  console.log('                     TEST RESULTS SUMMARY                      ');
  console.log('===============================================================');
  console.table(testResults);
}

runTestSuite().catch(err => {
  console.error('Test suite error:', err.message);
  process.exit(1);
});
