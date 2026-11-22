# AEGIS Health Vision — staged delivery plan

## Purpose and intended use

Health Vision begins as a personal, non-diagnostic observation and preparation workspace. Stage 1 helps an individual capture a temporary image preview, write down what they noticed and when within the current browser session, and prepare a text-only summary to discuss with a healthcare professional.

It does not interpret images, detect disease, calculate risk, recommend treatment, triage symptoms, or replace professional care. It must not be marketed as a medical scanner or diagnostic system.

## Stage 1 — private observation workspace (this release)

- Responsive Control Centre panel for mobile and desktop.
- Phone camera file capture and optional live webcam capture.
- Basic technical image checks only: supported browser preview, file size and minimum pixel dimensions. These are not clinical image-quality checks.
- Text-only observation notes with bounded fields and a maximum of 20 entries per browser session.
- Text-only report export initiated by the user.
- Images and notes remain in JavaScript memory in the current page session; no localStorage, IndexedDB, cookies, analytics, AI calls, API requests or server persistence.
- Camera stream stops when the panel is closed, the user signs out, or the page is left.
- Clear controls and visible privacy notice. No image is included in the exported report.
- Emergency advice is static and UK-specific; it is not an automated triage engine.

Stage 1 deliberately has no diagnostic model, no AI interpretation and no external health data connection.

## Stage 2 — consented personal records

Before implementation: define data controller/processor roles, lawful basis, explicit consent where applicable, retention/deletion policy, encryption and key management, access controls, audit, breach response, data export, hosting region and privacy impact assessment. Add encrypted owner-controlled persistence only after a privacy/security review. Health data must not be sent to general chat history or model providers by default.

## Stage 3 — health-device integration

Add explicitly supported devices (for example, validated blood pressure monitors, thermometers, pulse oximeters and ECG devices) using documented standards and provenance. Preserve device, timestamp, units, calibration/status and measurement context. Do not infer a diagnosis from a single reading.

## Stage 4 — clinically validated decision support

Select one narrow clinical intended use at a time. Require clinical partners, representative datasets, external validation, bias/performance monitoring, human factors, clinical safety case, post-market monitoring and the appropriate UK regulatory route before enabling any diagnostic or risk-assessment claim. Image-based assessment may be regulated medical-device software; obtain specialist MHRA/regulatory advice before this stage.

## Stage 5 — clinician collaboration

Only after governance and clinical validation: secure clinician sharing, structured reports, referral pathways, interoperability and patient-controlled consent/revocation.

## Non-negotiable safeguards

- No autonomous diagnosis, cancer detection claim, risk score or treatment advice in Stage 1.
- No silent uploads or model-provider transmission.
- No storage of raw images in the browser or server.
- No medical data in general AEGIS memory, chat context, telemetry or logs.
- No self-approval of integrations, access grants or clinical capabilities.
- No use as an emergency service. UK emergencies: call 999; for urgent medical help that is not an emergency, use NHS 111.
- Clinical and regulatory gates are separate from ordinary software tests and must be reviewed before later stages.
