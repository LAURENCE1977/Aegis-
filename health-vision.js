import { createHealthObservation, formatHealthVisionReport } from './health-vision-core.mjs';

(() => {
  const section = document.getElementById('healthVisionSection');
  if (!section) return;

  const form = document.getElementById('healthObservationForm');
  const kind = document.getElementById('healthKind');
  const bodyArea = document.getElementById('healthBodyArea');
  const observedOn = document.getElementById('healthObservedOn');
  const description = document.getElementById('healthDescription');
  const symptoms = document.getElementById('healthSymptoms');
  const changes = document.getElementById('healthChanges');
  const status = document.getElementById('healthVisionStatus');
  const list = document.getElementById('healthObservationList');
  const photoInput = document.getElementById('healthPhotoInput');
  const photoPreview = document.getElementById('healthPhotoPreview');
  const photoPreviewImage = document.getElementById('healthPhotoPreviewImage');
  const cameraVideo = document.getElementById('healthCameraVideo');
  const startCamera = document.getElementById('healthStartCameraBtn');
  const captureFrame = document.getElementById('healthCaptureFrameBtn');
  const stopCameraButton = document.getElementById('healthStopCameraBtn');
  const clearPhoto = document.getElementById('healthClearPhotoBtn');
  const exportButton = document.getElementById('healthExportBtn');
  const clearButton = document.getElementById('healthClearAllBtn');

  const observations = [];
  let cameraStream = null;
  let previewUrl = null;
  let selectedPhoto = null;

  observedOn.value = new Date().toISOString().slice(0, 10);
  observedOn.max = observedOn.value;

  function stopCamera() {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    cameraVideo.pause();
    cameraVideo.srcObject = null;
    cameraVideo.hidden = true;
    captureFrame.hidden = true;
    stopCameraButton.hidden = true;
    startCamera.hidden = false;
  }

  function clearPhotoPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    selectedPhoto = null;
    photoPreviewImage.removeAttribute('src');
    photoPreview.hidden = true;
    photoInput.value = '';
  }

  function clearAll() {
    stopCamera();
    clearPhotoPreview();
    observations.splice(0, observations.length);
    form.reset();
    observedOn.value = new Date().toISOString().slice(0, 10);
    renderObservations();
    status.textContent = 'Session notes cleared. Nothing was uploaded or saved.';
  }

  function renderObservations() {
    list.replaceChildren();
    if (!observations.length) {
      const empty = document.createElement('p');
      empty.className = 'memory-empty';
      empty.textContent = 'No observations recorded in this session.';
      list.appendChild(empty);
      exportButton.disabled = true;
      clearButton.disabled = true;
      return;
    }
    observations.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'workspace-card';
      const heading = document.createElement('h3');
      heading.textContent = item.kind.toUpperCase() + ' · ' + item.observedOn;
      const area = document.createElement('p');
      area.textContent = 'Area: ' + (item.bodyArea || 'Not recorded');
      const note = document.createElement('p');
      note.textContent = item.description;
      const symptomsText = document.createElement('p');
      symptomsText.textContent = 'Symptoms: ' + (item.symptoms || 'Not recorded');
      const changesText = document.createElement('p');
      changesText.textContent = 'Changes: ' + (item.changes || 'Not recorded');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'secondary';
      remove.textContent = 'Remove this note';
      remove.addEventListener('click', () => {
        observations.splice(index, 1);
        renderObservations();
        status.textContent = 'Observation removed from this session.';
      });
      card.append(heading, area, note, symptomsText, changesText, remove);
      list.appendChild(card);
    });
    exportButton.disabled = false;
    clearButton.disabled = false;
  }

  async function showPhoto(file) {
    clearPhotoPreview();
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      status.textContent = 'Choose an image file supported by this browser.';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      status.textContent = 'Image is larger than 10 MB. Choose a smaller image.';
      return;
    }
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width < 320 || bitmap.height < 240) {
        bitmap.close();
        status.textContent = 'Image resolution is very small. Retake it if you can.';
        return;
      }
      bitmap.close();
    } catch {
      status.textContent = 'This browser could not preview that image. Try JPEG, PNG or WebP.';
      return;
    }
    selectedPhoto = file;
    previewUrl = URL.createObjectURL(file);
    photoPreviewImage.src = previewUrl;
    photoPreview.hidden = false;
    status.textContent = 'Image preview ready. It stays in this browser session and is not uploaded or analysed.';
  }

  photoInput.addEventListener('change', () => showPhoto(photoInput.files && photoInput.files[0]));

  startCamera.addEventListener('click', async () => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      status.textContent = 'Live camera is not available here. Use the Take photo button instead.';
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      cameraVideo.srcObject = cameraStream;
      cameraVideo.hidden = false;
      await cameraVideo.play();
      captureFrame.hidden = false;
      stopCameraButton.hidden = false;
      startCamera.hidden = true;
      status.textContent = 'Camera is active on this device only. No video is transmitted.';
    } catch {
      stopCamera();
      status.textContent = 'Camera permission was unavailable. You can still use Take photo.';
    }
  });

  captureFrame.addEventListener('click', () => {
    if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
      status.textContent = 'Camera is not ready yet. Please wait a moment.';
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    canvas.getContext('2d').drawImage(cameraVideo, 0, 0);
    canvas.toBlob(async blob => {
      if (!blob) {
        status.textContent = 'Could not capture this frame. Please try again.';
        return;
      }
      await showPhoto(new File([blob], 'health-observation.jpg', { type: 'image/jpeg' }));
      stopCamera();
    }, 'image/jpeg', 0.9);
  });

  stopCameraButton.addEventListener('click', () => {
    stopCamera();
    status.textContent = 'Camera stopped.';
  });
  clearPhoto.addEventListener('click', () => {
    clearPhotoPreview();
    status.textContent = 'Image preview cleared.';
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (observations.length >= 20) {
      status.textContent = 'This session is limited to 20 notes. Export or clear the session before adding more.';
      return;
    }
    try {
      const observation = createHealthObservation({
        kind: kind.value,
        bodyArea: bodyArea.value,
        observedOn: observedOn.value,
        description: description.value,
        symptoms: symptoms.value,
        changes: changes.value,
      });
      observations.push(observation);
      form.reset();
      observedOn.value = new Date().toISOString().slice(0, 10);
      stopCamera();
      clearPhotoPreview();
      renderObservations();
      status.textContent = 'Observation added to temporary session memory only. No image or note was uploaded.';
    } catch (error) {
      status.textContent = error.message || 'Please check the observation details.';
    }
  });

  exportButton.addEventListener('click', () => {
    if (!observations.length) return;
    const report = formatHealthVisionReport(observations);
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aegis-health-observations.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Text report prepared on this device. It contains notes only, no images.';
  });

  clearButton.addEventListener('click', () => {
    if (confirm('Clear all Health Vision notes and image previews from this browser session? This cannot be undone.')) clearAll();
  });

  clearPhotoPreview();
  renderObservations();

  const sectionObserver = new MutationObserver(() => {
    if (section.hidden) stopCamera();
  });
  sectionObserver.observe(section, { attributes: true, attributeFilter: ['hidden'] });

  const appPanel = document.getElementById('appPanel');
  const appObserver = new MutationObserver(() => {
    if (appPanel.hidden) clearAll();
  });
  appObserver.observe(appPanel, { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('pagehide', clearAll, { once: true });
})();
