import type {
  Platform,
  StoreChecklistItem,
  AndroidMetadata,
  IosMetadata,
  UserAppInfo,
} from '@deploylens/contracts';

export function buildStoreChecklist(
  platform: Platform,
  metadata: { android?: AndroidMetadata; ios?: IosMetadata },
  userAppInfo?: UserAppInfo
): { checklist: StoreChecklistItem[]; detectedFacts: string[]; generalReminders: string[] } {
  const checklist: StoreChecklistItem[] = [];
  const detectedFacts: string[] = [];
  const generalReminders: string[] = [];

  if (platform === 'android' && metadata.android) {
    const and = metadata.android;
    detectedFacts.push(`Package ID: ${and.packageId}`);
    detectedFacts.push(`Version: ${and.versionName} (${and.versionCode})`);
    detectedFacts.push(`Target SDK: ${and.targetSdkVersion} (Min SDK: ${and.minSdkVersion})`);
    detectedFacts.push(`Artifact format: ${and.signing?.isBundleSigning ? 'AAB (App Bundle)' : 'APK'}`);
    detectedFacts.push(`Native ABIs: ${and.nativeLibraries?.abis && and.nativeLibraries.abis.length > 0 ? and.nativeLibraries.abis.join(', ') : 'None (Pure Java/Kotlin DEX)'}`);

    // Checklist Item 1: App Name & Listing
    checklist.push({
      id: 'CHK-AND-001',
      topic: 'App Name & Listing',
      title: 'Google Play Listing Metadata',
      severity: 'recommended',
      description: 'Prepare App Title (<= 30 chars), Short Description (<= 80 chars), and Full Description (<= 4000 chars) in Google Play Console.',
      isDetectedFromArtifact: Boolean(and.appLabel),
      evidence: and.appLabel ? `Detected app label: "${and.appLabel}"` : undefined,
      officialReferenceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
    });

    // Checklist Item 2: Icons & Screenshots
    checklist.push({
      id: 'CHK-AND-002',
      topic: 'Icons & Screenshots',
      title: 'Store Graphics Assets',
      severity: 'blocker',
      description: 'Prepare High-res icon (512x512 px PNG, max 1MB) and Feature graphic (1024x500 px JPG/PNG). Provide minimum 2 phone screenshots (up to 8, aspect ratio 16:9 or 9:16).',
      isDetectedFromArtifact: false,
      officialReferenceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151#graphics',
    });

    // Checklist Item 3: Privacy & Data Safety
    checklist.push({
      id: 'CHK-AND-003',
      topic: 'Privacy & Data Declarations',
      title: 'Google Play Data Safety Form',
      severity: 'blocker',
      description: 'Complete the Google Play Data Safety questionnaire. You must declare all collected user data (location, identifiers, crash logs) and whether data is shared or encrypted in transit.',
      isDetectedFromArtifact: true,
      evidence: and.permissions?.declared && and.permissions.declared.length > 0 ? `Build requests ${and.permissions.declared.length} permissions including: ${and.permissions.declared.slice(0, 3).join(', ')}` : 'No explicit permissions declared',
      officialReferenceUrl: 'https://support.google.com/googleplay/android-developer/answer/10787469',
    });

    // Checklist Item 4: Sensitive Permissions
    if (and.permissions?.requiresSpecialApproval && and.permissions.requiresSpecialApproval.length > 0) {
      checklist.push({
        id: 'CHK-AND-004',
        topic: 'Sensitive Permissions',
        title: 'Restricted Permission Declaration & Demonstration Video',
        severity: 'blocker',
        description: `Your app declares restricted permissions [${and.permissions.requiresSpecialApproval.join(', ')}]. Google Play requires submitting a link to a video demonstrating user-facing need in the Play Console declaration form.`,
        isDetectedFromArtifact: true,
        evidence: `Permissions: ${and.permissions.requiresSpecialApproval.join(', ')}`,
        officialReferenceUrl: 'https://support.google.com/googleplay/android-developer/answer/9214102',
      });
    }

    // Checklist Item 5: Reviewer Access
    checklist.push({
      id: 'CHK-AND-005',
      topic: 'Reviewer Access',
      title: 'App Access Credentials for Reviewers',
      severity: 'recommended',
      description: 'If parts of your app are restricted by authentication, subscription, or geographical location, supply valid test credentials and 2FA bypass in Play Console > App Access.',
      isDetectedFromArtifact: false,
      officialReferenceUrl: 'https://support.google.com/googleplay/android-developer/answer/9859455',
    });

    // Checklist Item 6: Signing Preparation
    checklist.push({
      id: 'CHK-AND-006',
      topic: 'Signing Verification',
      title: 'Play App Signing Enrollment',
      severity: and.signing?.signingVerified ? 'reminder' : 'blocker',
      description: 'Ensure your app is signed with your registered upload keystore. Google Play App Signing securely manages the distribution key.',
      isDetectedFromArtifact: true,
      evidence: `Signature verified: ${and.signing?.signingVerified ? 'Yes' : 'No'}. Fingerprint SHA-256: ${and.signing?.signers?.[0]?.fingerprintSha256 ?? 'None'}`,
      officialReferenceUrl: 'https://support.google.com/googleplay/android-developer/answer/9842756',
    });

    // Checklist Item 7: Device Testing
    checklist.push({
      id: 'CHK-AND-007',
      topic: 'Device Testing',
      title: 'Internal & Closed Testing Tracks',
      severity: 'recommended',
      description: 'Run an internal test track build on physical Android devices covering Android 12 through Android 15. Verify edge-to-edge UI rendering and predictive back gestures.',
      isDetectedFromArtifact: false,
    });

    generalReminders.push('Google Play requires personal developer accounts created after Nov 13, 2023 to test with at least 20 testers for 14 days before applying for production access.');
    generalReminders.push('Ensure your privacy policy URL is publicly accessible without login and matches the Play Console declared privacy policy link.');
    generalReminders.push('If targeting children or family audiences, ensure compliance with Google Play Designed for Families and COPPA regulations.');

  } else if (platform === 'ios' && metadata.ios) {
    const ios = metadata.ios;
    detectedFacts.push(`Bundle ID: ${ios.bundleIdentifier}`);
    detectedFacts.push(`Version: ${ios.marketingVersion} (Build ${ios.buildNumber})`);
    detectedFacts.push(`Minimum OS: iOS ${ios.minimumOsVersion}`);
    detectedFacts.push(`Target Devices: ${ios.declaredDeviceFamilies.join(', ')}`);
    detectedFacts.push(`Frameworks: ${ios.embeddedFrameworks.length} embedded`);
    detectedFacts.push(`Architectures: ${ios.architectures.join(', ')}`);

    // Checklist Item 1: App Name & Listing
    checklist.push({
      id: 'CHK-IOS-001',
      topic: 'App Name & Listing',
      title: 'App Store Connect Metadata Limits',
      severity: 'recommended',
      description: 'App Name (<= 30 chars), Subtitle (<= 30 chars), Keywords (<= 100 chars comma-separated), Description (<= 4000 chars).',
      isDetectedFromArtifact: Boolean(ios.displayName),
      evidence: ios.displayName ? `Detected display name: "${ios.displayName}"` : undefined,
      officialReferenceUrl: 'https://developer.apple.com/app-store/product-page/',
    });

    // Checklist Item 2: Icons & Screenshots
    checklist.push({
      id: 'CHK-IOS-002',
      topic: 'Icons & Screenshots',
      title: 'App Store Screenshots and App Icon',
      severity: 'blocker',
      description: 'Provide 1024x1024 px PNG icon with no alpha transparency. Screenshots required for 6.7" iPhone (1290x2796 or 1179x2556) and 13" iPad (if iPad support is declared).',
      isDetectedFromArtifact: true,
      evidence: `Declared device families: [${ios.declaredDeviceFamilies.join(', ')}]`,
      officialReferenceUrl: 'https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications',
    });

    // Checklist Item 3: Privacy & Manifest
    checklist.push({
      id: 'CHK-IOS-003',
      topic: 'Privacy & Data Declarations',
      title: 'App Privacy Details & Required Reason APIs',
      severity: ios.privacyManifest.present ? 'recommended' : 'blocker',
      description: 'Complete App Privacy nutrition labels in App Store Connect. If accessing Required Reason APIs (UserDefaults, File timestamps), verify entries in PrivacyInfo.xcprivacy.',
      isDetectedFromArtifact: true,
      evidence: ios.privacyManifest.present ? 'PrivacyInfo.xcprivacy detected' : 'No PrivacyInfo.xcprivacy found in bundle root',
      officialReferenceUrl: 'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files',
    });

    // Checklist Item 4: Purpose Strings
    const purposeKeys = Object.keys(ios.purposeStrings);
    if (purposeKeys.length > 0) {
      checklist.push({
        id: 'CHK-IOS-004',
        topic: 'Sensitive Permissions',
        title: 'Privacy Purpose Descriptions Review',
        severity: 'blocker',
        description: 'Ensure purpose strings (e.g. NSCameraUsageDescription) clearly explain why access is necessary and how the user benefits.',
        isDetectedFromArtifact: true,
        evidence: `Purpose strings declared: [${purposeKeys.join(', ')}]`,
        officialReferenceUrl: 'https://developer.apple.com/design/human-interface-guidelines/privacy',
      });
    }

    // Checklist Item 5: Reviewer Access
    checklist.push({
      id: 'CHK-IOS-005',
      topic: 'Reviewer Access',
      title: 'App Review Notes and Demo Account',
      severity: 'blocker',
      description: 'Provide working demo account credentials, test phone numbers, and hardware notes in App Review Information section of App Store Connect.',
      isDetectedFromArtifact: false,
      officialReferenceUrl: 'https://developer.apple.com/app-store/review/guidelines/',
    });

    // Checklist Item 6: Signing Verification
    checklist.push({
      id: 'CHK-IOS-006',
      topic: 'Signing Verification',
      title: 'Distribution Code Signing and Entitlements',
      severity: 'recommended',
      description: 'Ensure IPA is signed with an Apple Distribution Certificate and matching App Store Provisioning Profile before uploading via Transporter or Xcode.',
      isDetectedFromArtifact: true,
      evidence: ios.signing.provisioningProfilePresent ? `Profile type: ${ios.signing.provisioningProfileType ?? 'detected'}` : 'No embedded provisioning profile found (expected if uploaded via Xcode Archive direct export)',
      officialReferenceUrl: 'https://developer.apple.com/support/code-signing/',
    });

    // Checklist Item 7: Device Testing
    checklist.push({
      id: 'CHK-IOS-007',
      topic: 'Device Testing',
      title: 'TestFlight External and Internal Beta',
      severity: 'recommended',
      description: 'Deploy to physical iOS devices via TestFlight. Verify dynamic island, dark mode appearance, and safe area insets.',
      isDetectedFromArtifact: false,
    });

    generalReminders.push('App Store Review Guidelines 5.1.1(v) requires account deletion functionality if users can create an account in your app.');
    generalReminders.push('In-app purchases for digital goods or services must use Apple StoreKit APIs; external payment links are subject to specific regional entitlement rules.');
    generalReminders.push('An IPA built for physical devices will not run in the standard iOS Simulator.');
  }

  // Policy-sensitive features based on userAppInfo
  if (userAppInfo?.appPurpose || userAppInfo?.mainFeatures) {
    const combined = `${userAppInfo.appPurpose} ${userAppInfo.mainFeatures}`.toLowerCase();
    if (combined.includes('crypto') || combined.includes('bitcoin') || combined.includes('wallet')) {
      generalReminders.push('Cryptocurrency and digital wallet apps must comply with financial licensing regulations and store exchange policies.');
    }
    if (combined.includes('kid') || combined.includes('children') || combined.includes('toddler')) {
      generalReminders.push('Apps targeted at children require strict COPPA / GDPR-K compliance, no behavioral advertising, and parental gates.');
    }
    if (combined.includes('health') || combined.includes('medical') || combined.includes('patient')) {
      generalReminders.push('Medical and health apps must avoid unverified diagnostic claims and include disclaimers directing users to medical professionals.');
    }
  }

  return { checklist, detectedFacts, generalReminders };
}
