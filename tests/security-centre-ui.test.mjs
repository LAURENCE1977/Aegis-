import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Security Centre provides explicit exact-resource grant and Sentinel invocation controls', () => {
  for (const id of [
    'securitySection', 'capabilityList', 'grantForm', 'grantCapabilitySelect',
    'grantActionSelect', 'grantResourceId', 'grantExpiresAt', 'createGrantBtn',
    'grantStatus', 'grantList', 'invokeModuleCatalogueBtn',
    'sentinelInvokeStatus', 'sentinelInvokeOutput',
  ]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /controlApi\('\/api\/grants'/);
  assert.match(html, /capabilityId:\s*grantCapabilitySelect\.value/);
  assert.match(html, /actionIds,/);
  assert.match(html, /resourceId:\s*grantResourceId\.value\.trim\(\)/);
  assert.match(html, /expiresAt,/);
  assert.match(html, /controlApi\('\/api\/sentinel\/invoke'/);
  assert.match(html, /capabilityId:\s*'aegis-module-catalogue'/);
  assert.match(html, /actionId:\s*'list'/);
  assert.match(html, /resourceId:\s*'aegis:modules'/);
  assert.match(html, /input:\s*\{\}/);
});

test('Security Centre does not create grants or invoke Sentinel during page load', () => {
  assert.match(html, /grantForm\.addEventListener\('submit'/);
  assert.match(html, /invokeModuleCatalogueBtn\.addEventListener\('click'/);
  assert.match(html, /loadSecurityCentre\(\)/);
  assert.match(html, /loadGrantManager\(\)/);
  assert.doesNotMatch(html, /loadSecurityCentre\(\)[\s\S]{0,300}controlApi\('\/api\/grants',\s*\{\s*method:\s*'POST'/);
});

test('grant history and invocation output are rendered as text nodes, not HTML', () => {
  assert.match(html, /grantList\.replaceChildren\(\)/);
  assert.match(html, /title\.textContent\s*=/);
  assert.match(html, /detail\.textContent\s*=/);
  assert.match(html, /sentinelInvokeOutput\.textContent\s*=/);
});


test('Composio read-only controls expose exact PR, workflow-run and workflow-job grants', () => {
  for (const id of [
    'composioPullNumber', 'composioPreparePullRequestGrantBtn', 'composioReadPullRequestBtn',
    'composioWorkflowBranch', 'composioPrepareWorkflowGrantBtn', 'composioReadWorkflowRunsBtn',
    'composioWorkflowRunId', 'composioPrepareWorkflowJobsGrantBtn', 'composioReadWorkflowJobsBtn',
  ]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /invokeComposioRead\(\s*'\/api\/sentinel\/composio-github-pull-request'/);
  assert.match(html, /invokeComposioRead\(\s*'\/api\/sentinel\/composio-github-workflows'/);
  assert.match(html, /invokeComposioRead\(\s*'\/api\/sentinel\/composio-github-workflow-jobs'/);
  assert.match(html, /github:pull-request:/);
  assert.match(html, /github:workflow-run:/);
  assert.match(html, /github:repository:/);
});

test('Composio read-only controls only prepare grants on explicit clicks', () => {
  assert.match(html, /composioPreparePullRequestGrantBtn\.addEventListener\('click'/);
  assert.match(html, /composioPrepareWorkflowGrantBtn\.addEventListener\('click'/);
  assert.match(html, /composioPrepareWorkflowJobsGrantBtn\.addEventListener\('click'/);
  assert.doesNotMatch(html, /loadComposioStatus\(\)[\s\S]{0,500}createGrant/);
});


test('Security Centre exposes an owner-proxied plan-only agent run console and event timeline', () => {
  for (const id of [
    'agentRunSection', 'agentRunForm', 'agentRunObjective', 'agentRunSubmitBtn',
    'agentRunRefreshBtn', 'agentRunStatus', 'agentRunList', 'agentRunDetail',
    'agentRunEvents', 'agentRunCancelBtn', 'agentRunLoadOlderEventsBtn',
    'agentSpecialistResearcher', 'agentSpecialistPlanner', 'agentSpecialistEngineer',
    'agentSpecialistSecurity', 'agentSpecialistReviewer',
  ]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /controlApi\('\/api\/agent-runs'/);
  assert.match(html, /controlApi\('\/api\/agent-runs\/' \+ encodeURIComponent\(agentRunId\)/);
  assert.match(html, /\/events/);
  assert.match(html, /\/cancel/);
  assert.match(html, /plan-only/i);
  assert.match(html, /does not execute specialist work/i);
  assert.match(html, /agentRunCancelBtn\.addEventListener\('click'/);
  assert.match(html, /agentRunForm\.addEventListener\('submit'/);
});

test('Agent run console renders provider data with textContent and never auto-submits or auto-cancels', () => {
  const start = html.indexOf('id="agentRunSection"');
  const end = html.indexOf('</section>', start);
  assert.ok(start >= 0 && end > start);
  const section = html.slice(start, end);
  assert.match(html, /agentRunList\.replaceChildren\(\)/);
  assert.match(html, /agentRunList\.textContent\s*=/);
  assert.doesNotMatch(section, /innerHTML\s*=/);
  assert.doesNotMatch(section, /fetch\('\/api\/agent-runs',\s*\{\s*method:\s*'POST'/);
});

test('planned agent runs expose an explicit human approval request and use the scoped Sentinel decision route', () => {
  assert.match(html, /id="agentRunRequestApprovalBtn"/);
  assert.match(html, /agentRunRequestApprovalBtn\.addEventListener\('click'/);
  assert.match(html, /controlApi\('\/api\/sentinel\/agent-run-approval'/);
  assert.match(html, /approval\.capabilityId\s*===\s*'aegis-agent-run'/);
  assert.match(html, /\/api\/sentinel\/agent-run-approval\/['"]?\s*\+\s*encodeURIComponent\(approval\.id\)/);
  assert.match(html, /method:\s*'PATCH'/);
  assert.match(html, /Request execution approval/);
});
