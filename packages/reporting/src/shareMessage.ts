import type { ScanSummary } from '@deploylens/contracts';
import { identity } from '@deploylens/utils';

export function createSharingDraft(summary: ScanSummary) {
  return { subject: `${identity(summary).name} — ${summary.artifact.artifactType.toUpperCase()} build report — ${summary.assessment.status}`,
    body: defaultMessage(summary), to: '', includeBuild: false, destination: 'gmail' };
}

export function defaultMessage(summary: ScanSummary) {
  const app = identity(summary), a = summary.assessment;
  const findings = summary.stages.flatMap(stage => stage.checks.flatMap(check => check.findings)).filter(f => f.outcome === 'fail' || f.outcome === 'needs-review');
  return `Hello team,\n\nPlease review the ${summary.artifact.artifactType.toUpperCase()} build report for ${app.name}.\n\nApp: ${app.identifier}\nVersion: ${app.version} (${app.build})\nBuild: ${summary.artifact.fileName}\nAssessment: ${a.status}\nResults: ${a.blockerCount} blockers, ${a.warningReviewCount} need review, ${a.passedCheckCount} passed, ${a.notCheckedCount} not checked.\n${findings.length ? `\nPriority findings:\n${[...findings].sort((x, y) => Number(y.outcome === 'fail') - Number(x.outcome === 'fail')).slice(0, 5).map(f => `- ${f.title}: ${f.suggestedRemediation}`).join('\n')}\n` : ''}\nKindly review the findings, fix the issues, and share an update with the team. Please also complete the device and developer checks before release.\n\nThe report is available as a separate attachment. Please attach the downloaded report before sending.\n${a.disclaimer}\n\nRegards,\n[Name]\n[Number]`;
}
