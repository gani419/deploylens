#!/usr/bin/env node

import { Command } from 'commander';
import { runDoctorCommand } from './doctor.js';
import { runScanCommand } from './scan.js';

const program = new Command();

program
  .name('deploylens')
  .description('DeployLens - Fully local mobile app build inspection & release readiness assessment')
  .version('1.0.0');

program
  .command('doctor')
  .description('Inspect local environment tool availability and capabilities')
  .option('--format <format>', 'Output format (human or json)', 'human')
  .action(async (options) => {
    const exitCode = await runDoctorCommand(options.format);
    process.exit(exitCode);
  });

program
  .command('scan')
  .description('Inspect an Android APK/AAB or iOS IPA build artifact')
  .argument('<artifact-path>', 'Path to .apk, .aab, or .ipa file')
  .option('--format <format>', 'Output format: "human" (default) or "json"', 'human')
  .option('--purpose <purpose>', 'Optional app purpose summary for store listing generation')
  .option('--users <users>', 'Optional intended audience for store listing generation')
  .option('--features <features>', 'Optional comma-separated list of core features')
  .option('--lang <language>', 'Preferred listing language code (e.g. en-US)')
  .action(async (artifactPath, options) => {
    const exitCode = await runScanCommand(artifactPath, {
      format: options.format,
      purpose: options.purpose,
      users: options.users,
      features: options.features,
      lang: options.lang,
    });
    process.exit(exitCode);
  });

program.parse(process.argv);
