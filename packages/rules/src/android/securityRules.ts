import type { AndroidMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const androidCleartextTrafficRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-SEC-001',
  revision: '2026.1',
  platform: 'android',
  category: 'permissions-security',
  severity: 'security',
  name: 'Cleartext HTTP Traffic Policy',
  description: 'Audits whether android:usesCleartextTraffic is permitted across the application.',
  whyItMatters: 'Allowing unencrypted cleartext HTTP traffic exposes sensitive authentication credentials and data payloads to eavesdropping and man-in-the-middle attacks.',
  remediation: 'Set android:usesCleartextTraffic="false" and configure res/xml/network_security_config.xml to pin trusted domains or enforce TLS 1.3.',
  officialReferenceUrl: 'https://developer.android.com/privacy-and-security/security-config',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all Android builds.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    if (metadata.security.usesCleartextTraffic === true) {
      return {
        ruleId: 'RULE-AND-SEC-001',
        outcome: 'needs-review',
        evidence: 'android:usesCleartextTraffic is explicitly enabled ("true"). Cleartext HTTP communication is permitted by default.',
        affectedFileOrConfig: 'AndroidManifest.xml (<application android:usesCleartextTraffic="true">)',
        isSuspectedHeuristic: false,
      };
    }

    if (metadata.security.networkSecurityConfigPresent) {
      return {
        ruleId: 'RULE-AND-SEC-001',
        outcome: 'pass',
        evidence: 'Dedicated network security configuration detected (res/xml/network_security_config.xml). Cleartext traffic is governed by custom domain rules.',
        affectedFileOrConfig: 'res/xml/network_security_config.xml',
      };
    }

    return {
      ruleId: 'RULE-AND-SEC-001',
      outcome: 'pass',
      evidence: 'usesCleartextTraffic is not enabled. Target SDK default enforces TLS-only traffic.',
      affectedFileOrConfig: 'AndroidManifest.xml',
    };
  },
};

export const androidSensitivePermissionsRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-SEC-002',
  revision: '2026.1',
  platform: 'android',
  category: 'permissions-security',
  severity: 'risk',
  name: 'Sensitive and High-Risk Permissions Audit',
  description: 'Flags dangerous or restricted permissions that require Google Play policy declaration or approval forms.',
  whyItMatters: 'Google Play restricts high-privilege permissions (e.g. SMS, Call Logs, All Files Access, Background Location) to core app functions. Declaring them without acceptable justification results in app rejection or removal.',
  remediation: 'Verify whether sensitive permissions are strictly required for your core user-facing functionality. Prepare a Play Console declaration video and justification.',
  officialReferenceUrl: 'https://support.google.com/googleplay/android-developer/answer/9214102',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all Android builds.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const sensitive = metadata.permissions.sensitivePermissions;
    const specialApproval = metadata.permissions.requiresSpecialApproval;

    if (specialApproval.length > 0) {
      return {
        ruleId: 'RULE-AND-SEC-002',
        outcome: 'needs-review',
        evidence: `Build declares ${specialApproval.length} restricted permission(s) requiring Google Play Policy Declaration: [${specialApproval.join(', ')}]. Note: This is an audit flag, not an automatic store rejection. Justification is required in Play Console.`,
        affectedFileOrConfig: 'AndroidManifest.xml (<uses-permission>)',
        isSuspectedHeuristic: false,
      };
    }

    if (sensitive.length > 0) {
      return {
        ruleId: 'RULE-AND-SEC-002',
        outcome: 'needs-review',
        evidence: `Build requests ${sensitive.length} dangerous runtime permission(s): [${sensitive.join(', ')}]. Ensure runtime permission request prompts are handled properly.`,
        affectedFileOrConfig: 'AndroidManifest.xml (<uses-permission>)',
        isSuspectedHeuristic: false,
      };
    }

    return {
      ruleId: 'RULE-AND-SEC-002',
      outcome: 'pass',
      evidence: `Declared permissions count: ${metadata.permissions.declared.length}. No high-risk or restricted policy permissions detected.`,
      affectedFileOrConfig: 'AndroidManifest.xml',
    };
  },
};

export const androidExportedComponentsRule: Rule<AndroidMetadata> = {
  id: 'RULE-AND-SEC-003',
  revision: '2026.1',
  platform: 'android',
  category: 'permissions-security',
  severity: 'security',
  name: 'Exported Component Exposure Audit',
  description: 'Reviews exported activities, services, receivers, and content providers for missing permission guards.',
  whyItMatters: 'Android 12+ requires explicit android:exported declarations. Components exported without permission enforcement can be invoked by any malicious app on the device.',
  remediation: 'Set android:exported="false" on components that do not need to receive external intents, or protect them with custom signature-level permissions.',
  officialReferenceUrl: 'https://developer.android.com/about/versions/12/behavior-changes-12#exported',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all Android manifests.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const suspected = metadata.security.exportedComponents.filter((c) => c.isSuspectedVulnerable);

    if (suspected.length > 0) {
      return {
        ruleId: 'RULE-AND-SEC-003',
        outcome: 'needs-review',
        evidence: `Found ${suspected.length} exported component(s) without explicit permission guard (e.g. ${suspected.slice(0, 3).map((c) => c.name).join(', ')}). Label: Suspected unprotected entry points.`,
        affectedFileOrConfig: 'AndroidManifest.xml',
        isSuspectedHeuristic: true,
      };
    }

    return {
      ruleId: 'RULE-AND-SEC-003',
      outcome: 'pass',
      evidence: `Audited ${metadata.security.exportedComponents.length} components. All exported components declare appropriate permissions or intent-filter restrictions.`,
      affectedFileOrConfig: 'AndroidManifest.xml',
    };
  },
};
