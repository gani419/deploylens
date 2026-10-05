import { DeployLensEngine } from '@deploylens/core';

export async function runDoctorCommand(format: 'human' | 'json' = 'human'): Promise<number> {
  const engine = new DeployLensEngine();
  const caps = await engine.detectCapabilities();

  if (format === 'json') {
    process.stdout.write(JSON.stringify(caps, null, 2) + '\n');
    return 0;
  }

  console.log('\n========================================================');
  console.log('  DeployLens Doctor - Local Environment Tool Capability Check');
  console.log('========================================================\n');

  console.log(`Operating System: ${process.platform} (${process.arch})`);
  console.log(`Node.js Runtime : ${process.version}\n`);

  console.log('Tool Capabilities:');
  console.log('------------------');

  for (const [name, cap] of Object.entries(caps)) {
    const status = cap.available ? '✓ AVAILABLE' : '✕ NOT FOUND';
    const colorStatus = cap.available ? `\x1b[32m${status}\x1b[0m` : `\x1b[33m${status}\x1b[0m`;
    console.log(`\n• ${name.toUpperCase()}: ${colorStatus}`);

    if (cap.version) {
      console.log(`  Version : ${cap.version}`);
    }
    if (cap.path) {
      console.log(`  Location: ${cap.path}`);
    }

    if (cap.supportedFeatures.length > 0) {
      console.log(`  Features: ${cap.supportedFeatures.join(', ')}`);
    }

    if (cap.limitations.length > 0) {
      console.log(`  Notes   : ${cap.limitations.join('; ')}`);
    }
  }

  console.log('\n--------------------------------------------------------');
  console.log('Inspection Strategy:');
  console.log('• DeployLens includes built-in TypeScript engines for APK, AAB,');
  console.log('  and IPA inspection, allowing scans even without platform tools.');
  console.log('• Installed platform tools (apksigner, zipalign, codesign) are');
  console.log('  utilized when available for authoritative store verification.');
  console.log('========================================================\n');

  return 0;
}
