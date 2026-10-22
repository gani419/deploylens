import type { Finding, ScanSummary } from '@deploylens/contracts';
import { identity } from '@deploylens/utils';

const unresolved = (finding: Finding) => finding.outcome === 'fail' || finding.outcome === 'needs-review';
// Attribute values in a manifest location are evidence, not a different location.
// Keep the XML element name so application and uses-sdk checks cannot collide.
export const findingKey = (finding: Finding) => JSON.stringify([finding.ruleId, (finding.affectedFileOrConfig || finding.title).replace(/<([\w:.-]+)\b[^>]*>/g, '<$1>')]);
export function compareBuilds(previous: ScanSummary, current: ScanSummary) {
  const before = identity(previous), after = identity(current);
  if (previous.artifact.platform !== current.artifact.platform || before.identifier === 'Not established' || before.identifier !== after.identifier) {
    return { error: 'Choose a previous build with the same platform and package/bundle identifier. Builds with unknown identity cannot be compared.' };
  }
  const groups = (summary: ScanSummary) => {
    const map = new Map<string, Finding[]>();
    for (const finding of summary.stages.flatMap(stage => stage.checks.flatMap(check => check.findings))) {
      const key = findingKey(finding); map.set(key, [...(map.get(key) || []), finding]);
    }
    return map;
  };
  const old = groups(previous), next = groups(current);
  const fixed: Finding[] = [], added: Finding[] = [], persisting: Finding[] = [], unconfirmed: Finding[] = [], changed: Finding[] = [];
  for (const [key, findings] of old) {
    const prior = findings.find(unresolved); if (!prior) continue;
    const now = next.get(key);
    // Only an explicit passing observation of the same rule AND revision proves a fix.
    if (now?.length && now.every(f => f.outcome === 'pass' && f.ruleRevision === prior.ruleRevision)) fixed.push({ ...prior, evidence: `Previous: ${prior.evidence}\nCurrent: ${now.map(f => f.evidence).join('; ')}` });
    else if (now?.some(unresolved)) persisting.push(now.find(unresolved)!);
    else unconfirmed.push(prior);
  }
  for (const [key, findings] of next) {
    const finding = findings.find(unresolved);
    if (finding && !old.get(key)?.some(unresolved)) added.push(finding);
    const prior = old.get(key);
    if (prior && (prior.some(f => !findings.some(n => n.outcome === f.outcome && n.ruleRevision === f.ruleRevision)) || findings.some(f => !prior.some(p => p.outcome === f.outcome && p.ruleRevision === f.ruleRevision)))) changed.push(findings[0]!);
  }
  const oldPermissions = previous.metadata.android?.permissions.declared ?? [];
  const newPermissions = current.metadata.android?.permissions.declared ?? [];
  const oldRevisions = new Set([...old.values()].flat().map(f => `${f.ruleId}:${f.ruleRevision}`));
  const newRevisions = new Set([...next.values()].flat().map(f => `${f.ruleId}:${f.ruleRevision}`));
  return { fixed, added, persisting, unconfirmed, changed,
    sizeDelta: current.artifact.sizeBytes - previous.artifact.sizeBytes,
    addedPermissions: newPermissions.filter(p => !oldPermissions.includes(p)), removedPermissions: oldPermissions.filter(p => !newPermissions.includes(p)),
    ruleSetChanged: [...oldRevisions].some(r => !newRevisions.has(r)) || [...newRevisions].some(r => !oldRevisions.has(r)),
    formatChanged: previous.artifact.artifactType !== current.artifact.artifactType,
    sameArchive: Boolean(current.artifact.sha256 && current.artifact.sha256 === previous.artifact.sha256),
  };
}
