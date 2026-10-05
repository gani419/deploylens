import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to construct a simple valid ZIP file in Buffer
function createZip(entries: Array<{ name: string; content: Buffer }>): Buffer {
  const localHeaders: Buffer[] = [];
  const cdHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const compData = entry.content; // stored method 0
    const crc = 0;
    const compSize = compData.length;
    const uncompSize = compData.length;

    // Local Header
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // signature
    lh.writeUInt16LE(20, 4); // version needed
    lh.writeUInt16LE(0, 6); // flags
    lh.writeUInt16LE(0, 8); // compression method (0 = stored)
    lh.writeUInt16LE(0, 10); // time
    lh.writeUInt16LE(0, 12); // date
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compSize, 18);
    lh.writeUInt32LE(uncompSize, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28); // extra len
    nameBuf.copy(lh, 30);

    localHeaders.push(lh, compData);

    // Central Directory Header
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0); // signature
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0, 8); // flags
    cd.writeUInt16LE(0, 10); // compression method (0)
    cd.writeUInt16LE(0, 12); // time
    cd.writeUInt16LE(0, 14); // date
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compSize, 20);
    cd.writeUInt32LE(uncompSize, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // extra len
    cd.writeUInt16LE(0, 32); // comment len
    cd.writeUInt16LE(0, 34); // disk number
    cd.writeUInt16LE(0, 36); // internal attr
    cd.writeUInt32LE(0, 38); // external attr
    cd.writeUInt32LE(offset, 42); // local header offset
    nameBuf.copy(cd, 46);

    cdHeaders.push(cd);
    offset += lh.length + compData.length;
  }

  const cdStart = offset;
  const cdSize = cdHeaders.reduce((acc, b) => acc + b.length, 0);

  // End of Central Directory Record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk num
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(entries.length, 8); // entries on disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([...localHeaders, ...cdHeaders, eocd]);
}

// Create ELF 64-bit binary buffer with 16KB aligned load segment
function createElf64(is16KbAligned = true): Buffer {
  const buf = Buffer.alloc(128);
  buf[0] = 0x7f;
  buf[1] = 0x45;
  buf[2] = 0x4c;
  buf[3] = 0x46;
  buf[4] = 2; // 64-bit
  buf[5] = 1; // Little-endian
  buf[6] = 1; // ELF version
  buf[7] = 0; // OS ABI
  buf.writeUInt16LE(2, 16); // ET_EXEC
  buf.writeUInt16LE(183, 18); // AArch64 (arm64-v8a)
  buf.writeBigUInt64LE(64n, 32); // e_phoff (program headers start at offset 64)
  buf.writeUInt16LE(56, 54); // e_phentsize
  buf.writeUInt16LE(1, 56); // e_phnum (1 load segment)

  // Program header at offset 64 (PT_LOAD)
  buf.writeUInt32LE(1, 64); // p_type = PT_LOAD
  buf.writeUInt32LE(7, 68); // p_flags = rwx
  buf.writeBigUInt64LE(0n, 72); // p_offset
  buf.writeBigUInt64LE(0n, 80); // p_vaddr
  buf.writeBigUInt64LE(0n, 88); // p_paddr
  buf.writeBigUInt64LE(128n, 96); // p_filesz
  buf.writeBigUInt64LE(128n, 104); // p_memsz
  const align = is16KbAligned ? 16384n : 4096n;
  buf.writeBigUInt64LE(align, 112); // p_align

  return buf;
}

// Create ELF 32-bit ARM binary buffer
function createElf32Arm(): Buffer {
  const buf = Buffer.alloc(128);
  buf[0] = 0x7f;
  buf[1] = 0x45;
  buf[2] = 0x4c;
  buf[3] = 0x46;
  buf[4] = 1; // 32-bit
  buf[5] = 1; // Little-endian
  buf[6] = 1; // ELF version
  buf[7] = 0; // OS ABI
  buf.writeUInt16LE(2, 16); // ET_EXEC
  buf.writeUInt16LE(40, 18); // ARM (armeabi-v7a)
  buf.writeUInt32LE(52, 28); // e_phoff
  buf.writeUInt16LE(32, 42); // e_phentsize
  buf.writeUInt16LE(1, 44); // e_phnum

  // Program header at offset 52 (PT_LOAD)
  buf.writeUInt32LE(1, 52); // p_type = PT_LOAD
  buf.writeUInt32LE(0, 56); // p_offset
  buf.writeUInt32LE(0, 60); // p_vaddr
  buf.writeUInt32LE(0, 64); // p_paddr
  buf.writeUInt32LE(128, 68); // p_filesz
  buf.writeUInt32LE(128, 72); // p_memsz
  buf.writeUInt32LE(7, 76); // p_flags
  buf.writeUInt32LE(4096, 80); // p_align (4KB)

  return buf;
}

// Create Mach-O 64-bit arm64 binary header
function createMachO64(): Buffer {
  const buf = Buffer.alloc(32);
  buf.writeUInt32BE(0xfeedfacf, 0); // MH_MAGIC_64
  buf.writeUInt32BE(0x0100000c, 4); // CPU_TYPE_ARM64
  buf.writeUInt32BE(0, 8); // cpusubtype
  buf.writeUInt32BE(2, 12); // filetype = MH_EXECUTE
  return buf;
}

// Build AndroidManifest.xml
function createXmlManifest(options: {
  pkg: string;
  targetSdk: number;
  minSdk: number;
  debuggable?: boolean;
  testOnly?: boolean;
}): Buffer {
  const { pkg, targetSdk, minSdk, debuggable = false, testOnly = false } = options;
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkg}"
    android:versionCode="10"
    android:versionName="1.0.0">
    <uses-sdk android:minSdkVersion="${minSdk}" android:targetSdkVersion="${targetSdk}" />
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:label="SampleApp"
        android:debuggable="${debuggable}"
        android:testOnly="${testOnly}">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;
  return Buffer.from(xml, 'utf8');
}

export function generateAllFixtures(rootDir: string) {
  const androidDir = path.join(rootDir, 'fixtures', 'android');
  const iosDir = path.join(rootDir, 'fixtures', 'ios');
  const corruptDir = path.join(rootDir, 'fixtures', 'corrupt');

  fs.mkdirSync(androidDir, { recursive: true });
  fs.mkdirSync(iosDir, { recursive: true });
  fs.mkdirSync(corruptDir, { recursive: true });

  // 1. fixtures/android/valid-app.apk
  const validApkManifest = createXmlManifest({
    pkg: 'com.deploylens.sample',
    targetSdk: 35,
    minSdk: 24,
    debuggable: false,
    testOnly: false,
  });
  const validElf = createElf64(true);
  const validApkZip = createZip([
    { name: 'AndroidManifest.xml', content: validApkManifest },
    { name: 'classes.dex', content: Buffer.from('DEX\n035\0testdexdata', 'ascii') },
    { name: 'lib/arm64-v8a/libnative.so', content: validElf },
    { name: 'META-INF/CERT.RSA', content: Buffer.from('CERT-SIGNATURE-DATA-SHA256', 'utf8') },
  ]);
  fs.writeFileSync(path.join(androidDir, 'valid-app.apk'), validApkZip);

  // 2. fixtures/android/test-app.aab
  const aabManifest = createXmlManifest({
    pkg: 'com.deploylens.sampleaab',
    targetSdk: 34,
    minSdk: 26,
  });
  const aabZip = createZip([
    { name: 'base/manifest/AndroidManifest.xml', content: aabManifest },
    { name: 'BundleConfig.pb', content: Buffer.from('proto-bundle-config', 'ascii') },
    { name: 'base/dex/classes.dex', content: Buffer.from('DEX\n035\0bundle-dex', 'ascii') },
    { name: 'base/lib/arm64-v8a/libmath.so', content: validElf },
    { name: 'META-INF/CERT.RSA', content: Buffer.from('AAB-UPLOAD-KEY-CERT', 'utf8') },
  ]);
  fs.writeFileSync(path.join(androidDir, 'test-app.aab'), aabZip);

  // 3. fixtures/android/debuggable-app.apk
  const debugApkManifest = createXmlManifest({
    pkg: 'com.deploylens.debugapp',
    targetSdk: 30, // Obsolete target SDK
    minSdk: 19,
    debuggable: true, // Blocker
    testOnly: true, // Blocker
  });
  const debugElf = createElf32Arm(); // 32-bit ARM (armeabi-v7a) without 64-bit arm64-v8a
  const debugApkZip = createZip([
    { name: 'AndroidManifest.xml', content: debugApkManifest },
    { name: 'classes.dex', content: Buffer.from('DEX\n035\0debug-dex', 'ascii') },
    { name: 'lib/armeabi-v7a/libold.so', content: debugElf }, // 32-bit only without 64-bit!
  ]);
  fs.writeFileSync(path.join(androidDir, 'debuggable-app.apk'), debugApkZip);

  // 4. fixtures/ios/valid-app.ipa
  const infoPlistStr = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.deploylens.sampleios</string>
    <key>CFBundleDisplayName</key>
    <string>Sample iOS App</string>
    <key>CFBundleShortVersionString</key>
    <string>1.2.0</string>
    <key>CFBundleVersion</key>
    <string>42</string>
    <key>MinimumOSVersion</key>
    <string>16.0</string>
    <key>UIDeviceFamily</key>
    <array>
        <integer>1</integer>
        <integer>2</integer>
    </array>
    <key>DTSDKName</key>
    <string>iphoneos17.2</string>
    <key>NSCameraUsageDescription</key>
    <string>Camera access is required to take photos.</string>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <false/>
    </dict>
</dict>
</plist>`;

  const privacyPlistStr = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>`;

  const mobileProvisionStr = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>AppIDName</key>
    <string>Sample App</string>
    <key>TeamName</key>
    <string>DeployLens Team</string>
    <key>TeamIdentifier</key>
    <array>
        <string>TEAM123456</string>
    </array>
    <key>Entitlements</key>
    <dict>
        <key>get-task-allow</key>
        <false/>
        <key>application-identifier</key>
        <string>TEAM123456.com.deploylens.sampleios</string>
    </dict>
</dict>
</plist>`;

  const validIpaZip = createZip([
    { name: 'Payload/SampleApp.app/Info.plist', content: Buffer.from(infoPlistStr, 'utf8') },
    { name: 'Payload/SampleApp.app/SampleApp', content: createMachO64() },
    { name: 'Payload/SampleApp.app/PrivacyInfo.xcprivacy', content: Buffer.from(privacyPlistStr, 'utf8') },
    { name: 'Payload/SampleApp.app/embedded.mobileprovision', content: Buffer.from(mobileProvisionStr, 'utf8') },
    { name: 'Payload/SampleApp.app/_CodeSignature/CodeResources', content: Buffer.from('sealed-hash-data', 'utf8') },
  ]);
  fs.writeFileSync(path.join(iosDir, 'valid-app.ipa'), validIpaZip);

  // 5. fixtures/ios/missing-purpose.ipa
  const missingPurposePlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.deploylens.badpurpose</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>MinimumOSVersion</key>
    <string>14.0</string>
    <key>NSCameraUsageDescription</key>
    <string>test</string>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
    </dict>
</dict>
</plist>`;

  const badIpaZip = createZip([
    { name: 'Payload/BadApp.app/Info.plist', content: Buffer.from(missingPurposePlist, 'utf8') },
    { name: 'Payload/BadApp.app/BadApp', content: createMachO64() },
  ]);
  fs.writeFileSync(path.join(iosDir, 'missing-purpose.ipa'), badIpaZip);

  // 6. fixtures/corrupt/corrupt.apk
  fs.writeFileSync(path.join(corruptDir, 'corrupt.apk'), Buffer.from('NOT A VALID ZIP ARCHIVE FILE', 'utf8'));

  // 7. fixtures/corrupt/traversal.apk (Path Traversal attempt)
  const traversalZip = createZip([
    { name: '../../etc/passwd', content: Buffer.from('root:x:0:0::/root:/bin/sh', 'utf8') },
  ]);
  fs.writeFileSync(path.join(corruptDir, 'traversal.apk'), traversalZip);
}

generateAllFixtures(path.resolve(__dirname, '..'));
console.log('Test fixtures generated successfully.');
