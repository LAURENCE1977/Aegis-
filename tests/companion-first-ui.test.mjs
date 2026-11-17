import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('the signed-in home is companion-first and exposes an accessible presentation stage', () => {
  assert.match(html, /<section[^>]+id="companionStage"[^>]+aria-labelledby="companionTitle"/);
  assert.match(html, /id="companionVisual"/);
  assert.match(html, /id="companionTitle"/);
  assert.match(html, /id="companionStatus"/);
  const stage = html.indexOf('id="companionStage"');
  const chat = html.indexOf('id="chatBox"');
  assert.ok(stage >= 0 && chat > stage, 'companion stage must appear before the conversation');
  assert.match(html, /aria-label="Agent AEGIS companion presentation"/);
});

test('the companion presentation is honest about the avatar runtime and does not impersonate a live human', () => {
  assert.match(html, /companion presentation layer/i);
  assert.match(html, /interactive avatar runtime is in development/i);
  assert.match(html, /aria-live="polite"/);
});

test('the companion stage adapts to narrow screens and respects reduced-motion preferences', () => {
  assert.match(html, /\.companion-stage[\s\S]*?@media\s*\(max-width:\s*980px\)/);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('the existing chat controls remain present after the companion stage is added', () => {
  for (const id of ['chatBox', 'userInput', 'sendBtn', 'chatProjectSelect', 'status']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});

test('the public sign-in experience is a designed product welcome screen, not a centred legacy form', () => {
  assert.match(html, /class="welcome-shell"/);
  assert.match(html, /class="welcome-story"/);
  assert.match(html, /class="welcome-art"/);
  assert.match(html, /class="welcome-auth"/);
  assert.match(html, /id="loginForm"/);
  assert.match(html, /id="loginPassword"/);
  assert.match(html, /id="loginStatus"/);
  assert.match(html, /Built around your life, not the other way around\./);
});

test('the welcome screen has responsive composition, real visual geometry and reduced-motion support', () => {
  assert.match(html, /\.welcome-shell[\s\S]*?grid-template-columns/);
  assert.match(html, /\.welcome-art[\s\S]*?radial-gradient/);
  assert.match(html, /@media\s*\(max-width:\s*820px\)/);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('mobile welcome layout hides decorative captions that can collide with the tagline', () => {
  assert.match(html, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.art-caption\s*\{[^}]*display:\s*none/s);
});

test('public login status text does not expose deployment secret names', () => {
  assert.doesNotMatch(html, /Add AEGIS_PASSWORD and AEGIS_SESSION_SECRET/);
});


test('the signed-in experience opens on a dedicated companion-led home dashboard', () => {
  assert.match(html, /id="homeTab"[^>]*>Home<\/button>/);
  assert.match(html, /<section[^>]+id="homeSection"/);
  assert.match(html, /id="homeWelcomeTitle"/);
  assert.match(html, /id="companionStage"/);
  assert.match(html, /showPanel\('home'\)/);
  assert.match(html, /homeSection\.hidden = panel !== 'home'/);
});

test('home dashboard quick actions navigate to real AEGIS work areas', () => {
  for (const target of ['chat', 'projects', 'memory', 'approvals', 'forge', 'security']) {
    assert.match(html, new RegExp('data-panel-target="' + target + '"'));
  }
  assert.match(html, /data-panel-target/);
  assert.match(html, /querySelectorAll\('\[data-panel-target\]'\)/);
});

test('conversation view is a focused workspace separate from the companion home', () => {
  assert.match(html, /<section id="chatSection">/);
  assert.match(html, /id="chatBox"/);
  assert.match(html, /id="userInput"/);
  const home = html.indexOf('id="homeSection"');
  const chat = html.indexOf('id="chatSection"');
  assert.ok(home >= 0 && chat > home, 'home dashboard must precede the focused conversation view');
  assert.match(html, /\.home-dashboard[\s\S]*?@media\s*\(max-width:\s*820px\)/);
});


test('opening the Home dashboard does not move keyboard focus into the hidden conversation composer', () => {
  const showApp = html.match(/function showApp\(\) \{([\s\S]*?)\n    \}/)?.[1] || '';
  assert.match(showApp, /showPanel\('home'\)/);
  assert.doesNotMatch(showApp, /userInput\.focus\(\)/);
});


test('the signed-in application shell collapses to one column on tablet and mobile widths', () => {
  assert.match(html, /@media\s*\(max-width:\s*820px\)[\s\S]*?#appPanel:not\(\[hidden\]\)\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(html, /@media\s*\(max-width:\s*820px\)[\s\S]*?#appPanel\s*>\s*\.toolbar\s*\{[^}]*grid-column:\s*1/);
  assert.match(html, /@media\s*\(max-width:\s*820px\)[\s\S]*?#appPanel\s*>\s*section\s*\{[^}]*grid-column:\s*1/);
});


test('the companion home exposes official and custom profile selection with honest session-only persistence status', () => {
  for (const id of ['companionProfileSelect', 'customCompanionName', 'createCompanionProfile', 'companionProfileStatus']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /session only/i);
  assert.match(html, /custom companion/i);
});

test('custom companion profiles remain presentation preferences and cannot create permissions or a second identity', () => {
  assert.match(html, /data-companion-profile="aegis"/);
  assert.match(html, /custom-[a-z0-9-]+/);
  assert.match(html, /companionProfileSelect\.addEventListener/);
  assert.match(html, /createCompanionProfile\.addEventListener/);
  assert.doesNotMatch(html, /companionProfiles[^;]{0,240}(?:permissions|toolAccess|sentinelPolicy|ownerId)/);
});

test('companion profile selection is not persisted outside the authenticated owner-scoped API', () => {
  assert.match(html, /session only/i);
  assert.doesNotMatch(html, /localStorage\.(?:setItem|getItem)\([^)]*companion/i);
});


test('official companion is presented as Agent AEGIS — Your Personal Guardian', () => {
  assert.ok(html.includes('<title>Agent AEGIS · Your Personal Guardian</title>'));
  assert.match(html, /content="Agent AEGIS — Your Personal Guardian/);
  assert.match(html, /YOUR PERSONAL GUARDIAN/);
  assert.match(html, /aria-label="Agent AEGIS companion presentation"/);
  assert.match(html, /Official Agent AEGIS/);
});

test('companion profiles load and persist through the authenticated owner-scoped API when storage is available', () => {
  assert.match(html, /controlApi\('\/api\/companion\/profiles'/);
  assert.match(html, /controlApi\('\/api\/companion\/profile-selection'/);
  assert.match(html, /companionProfilePersistenceAvailable/);
  assert.match(html, /session only/i);
  assert.match(html, /persistent profile storage is unavailable/i);
});

test('companion mode provides a full-screen conversation workspace using the existing live chat controls', () => {
  for (const id of ['openCompanionMode', 'companionModeOverlay', 'closeCompanionMode', 'companionModeChatSlot']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /moveChatToCompanionMode/);
  assert.match(html, /restoreChatFromCompanionMode/);
  assert.match(html, /companionModeOverlay\.hidden = panel !== 'companion'/);
  assert.match(html, /companion-mode-active/);
  assert.match(html, /event\.key === 'Escape'/);
  assert.match(html, /VOICE NOT CONNECTED/);
});

test('full-screen companion mode remains responsive and honours reduced motion', () => {
  assert.match(html, /\.companion-mode-overlay[\s\S]*?position:\s*fixed/);
  assert.match(html, /\.companion-mode-layout[\s\S]*?grid-template-columns/);
  assert.match(html, /@media\s*\(max-width:\s*820px\)[\s\S]*?\.companion-mode-layout/);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('custom companion profiles expose user-controlled interaction preferences with versioned saves', () => {
  for (const id of [
    'companionWarmth', 'companionHumour', 'companionDirectness', 'companionInitiative',
    'companionVerbosity', 'companionVisualPreset', 'saveCompanionSettings',
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /controlApi\('\/api\/companion\/profiles\/' \+/);
  assert.match(html, /expectedVersion/);
  assert.match(html, /interaction:\s*\{/);
  assert.match(html, /presentation preferences only/i);
});

test('companion presence responds to live text conversation states without implying voice capture', () => {
  assert.match(html, /function setCompanionModePresence/);
  assert.match(html, /setCompanionModePresence\('thinking'/);
  assert.match(html, /setCompanionModePresence\('responding'/);
  assert.match(html, /setCompanionModePresence\('idle'/);
  assert.match(html, /data-presence="thinking"/);
  assert.match(html, /@keyframes companion-presence-pulse/);
  assert.match(html, /Microphone capture and spoken responses are not connected/);
});

test('chat sends only the active companion numeric and enum style settings to the server', () => {
  assert.match(html, /function getActiveCompanionInteraction/);
  assert.match(html, /companionInteraction:\s*getActiveCompanionInteraction\(\)/);
});
