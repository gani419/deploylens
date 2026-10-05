import fs from 'node:fs';
import path from 'node:path';
import { DeployLensEngine } from '@deploylens/core';
import type { ScanEvent, UserAppInfo } from '@deploylens/contracts';

export interface ScanCliOptions {
  format?: 'human' | 'json';
  purpose?: string;
  users?: string;
  features?: string;
  lang?: string;
}

export async function runScanCommand(
  artifactPath: string,
  options: ScanCliOptions
): Promise<number> {
  const isJson = options.format === 'json';

  const resolved = path.resolve(artifactPath);
  if (!fs.existsSync(resolved)) {
    if (isJson) {
      process.stdout.write(
        JSON.stringify({ error: `File not found: "${artifactPath}"` }, null, 2) + '\n'
      );
    } else {
      console.error(`\x1b[31mError: Build artifact not found at "${artifactPath}"\x1b[0m`);
    }
    return 1;
  }

  const userAppInfo: UserAppInfo = {
    appPurpose: options.purpose,
    intendedUsers: options.users,
    mainFeatures: options.features,
    preferredListingLanguage: options.lang,
  };

  const engine = new DeployLensEngine();

  const handleEvent = (event: ScanEvent) => {
    if (isJson) return; // Do not output text in JSON mode to preserve valid JSON stdout

    if (event.type === 'scan.started') {
      console.log('\n========================================================');
      console.log('  DeployLens - Local Build Inspection & Release Assessment');
      console.log('========================================================\n');
      console.log(`Artifact : ${event.artifact.fileName}`);
      console.log(`Platform : ${event.artifact.platform.toUpperCase()} (${event.artifact.artifactType.toUpperCase()})`);
      console.log(`Size     : ${(event.artifact.sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`Location : ${event.artifact.path}\n`);
      console.log('Executing Inspection Stages:');
      console.log('----------------------------');
    } else if (event.type === 'stage.started') {
      process.stdout.write(`[Stage ${event.stageNumber}/${event.totalStages}] ${event.stageName} ... `);
    } else if (event.type === 'stage.completed') {
      const hasFail = event.stage.checks.some((c) => c.outcome === 'fail');
      const hasWarn = event.stage.checks.some((c) => c.outcome === 'needs-review');
      if (hasFail) {
        console.log('\x1b[31m✕ FAILED CHECKS\x1b[0m');
      } else if (hasWarn) {
        console.log('\x1b[33m⚠ REVIEW REQUIRED\x1b[0m');
      } else {
        console.log('\x1b[32m✓ PASSED\x1b[0m');
      }
    } else if (event.type === 'stage.error') {
      console.log(`\x1b[31m✕ ERROR: ${event.error}\x1b[0m`);
    }
  };

  try {
    const summary = await engine.inspectArtifact(
      {
        artifactPath: resolved,
        userAppInfo,
      },
      handleEvent
    );

    if (isJson) {
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    } else {
      console.log('\n========================================================');
      console.log(`  FINAL READINESS ASSESSMENT: \x1b[1m${summary.assessment.status}\x1b[0m`);
      console.log('========================================================\n');
      console.log(`Summary: ${summary.assessment.summary}`);
      console.log(`Elapsed: ${(summary.elapsedMs / 1000).toFixed(2)}s\n`);

      console.log('Key Metrics:');
      console.log(`• Submission Blockers     : ${summary.assessment.blockerCount}`);
      console.log(`• Needs Review / Risks    : ${summary.assessment.warningReviewCount}`);
      console.log(`• Passed Checks           : ${summary.assessment.passedCheckCount}`);
      console.log(`• Checks Not Performed    : ${summary.assessment.notCheckedCount}`);
      console.log(`• Coverage Ratio          : ${summary.assessment.coverageRatio.description}\n`);

      // Print findings if any
      const allFindings = summary.stages.flatMap((s) => s.checks.flatMap((c) => c.findings));
      if (allFindings.length > 0) {
        console.log('Findings & Remediation:');
        console.log('-----------------------');
        for (const f of allFindings) {
          const color = f.severity === 'blocker' ? '\x1b[31m' : f.severity === 'risk' ? '\x1b[33m' : '\x1b[36m';
          console.log(`\n${color}[${f.severity.toUpperCase()}] ${f.title} (${f.ruleId})\x1b[0m`);
          console.log(`  Outcome    : ${f.outcome}`);
          console.log(`  Evidence   : ${f.evidence}`);
          if (f.affectedFileOrConfig) {
            console.log(`  Target     : ${f.affectedFileOrConfig}`);
          }
          console.log(`  Remediation: ${f.suggestedRemediation}`);
          if (f.officialReferenceUrl) {
            console.log(`  Reference  : ${f.officialReferenceUrl}`);
          }
        }
        console.log('\n-------------------------------------------------------');
      }

      // Store guidance snippet
      console.log('\nStore Preparation Guidance:');
      console.log(`• App Name Title Suggestion: "${summary.storeGuidance.listingTemplates.appName.value}"`);
      console.log(`• Total Checklist Tasks    : ${summary.storeGuidance.checklist.length}`);
      for (const item of summary.storeGuidance.checklist.slice(0, 3)) {
        console.log(`  - [${item.severity.toUpperCase()}] ${item.title}: ${item.description}`);
      }

      console.log('\nUnverified Areas (Must be tested manually):');
      for (const area of summary.assessment.unverifiedAreas) {
        console.log(`• ${area.area}: ${area.reason}`);
      }

      console.log('\n========================================================');
      console.log(`\x1b[33mDISCLAIMER: ${summary.assessment.disclaimer}\x1b[0m`);
      console.log('========================================================\n');
    }

    // Determine exit code
    switch (summary.assessment.status) {
      case 'PASSED AVAILABLE CHECKS':
        return 0;
      case 'ACTION REQUIRED':
        return 2;
      case 'REVIEW REQUIRED':
        return 3;
      case 'INCOMPLETE':
        return 4;
      default:
        return 0;
    }
  } catch (err: any) {
    if (isJson) {
      process.stdout.write(JSON.stringify({ error: err.message }, null, 2) + '\n');
    } else {
      console.error(`\n\x1b[31mScan failed: ${err.message}\x1b[0m`);
    }
    return 4;
  }
}
