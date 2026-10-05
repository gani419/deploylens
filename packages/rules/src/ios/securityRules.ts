import type { IosMetadata } from '@deploylens/contracts';
import type { Rule } from '../types.js';

export const iosTransportSecurityRule: Rule<IosMetadata> = {
  id: 'RULE-IOS-SEC-001',
  revision: '2026.1',
  platform: 'ios',
  category: 'permissions-security',
  severity: 'security',
  name: 'App Transport Security (ATS) Configuration',
  description: 'Audits NSAppTransportSecurity settings and broad NSAllowsArbitraryLoads exemptions.',
  whyItMatters: 'Apple App Store reviewers scrutinize NSAllowsArbitraryLoads. Unrestricted HTTP communication without appropriate justification causes review rejection.',
  remediation: 'Remove NSAllowsArbitraryLoads=true or restrict exemptions to explicit domains using NSExceptionDomains in Info.plist.',
  officialReferenceUrl: 'https://developer.apple.com/documentation/security/preventing_insecure_network_connections',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all iOS apps.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    if (metadata.transportSecurity.allowsArbitraryLoads === true) {
      return {
        ruleId: 'RULE-IOS-SEC-001',
        outcome: 'needs-review',
        evidence: 'NSAppTransportSecurity contains NSAllowsArbitraryLoads=YES. App Store reviewers require explicit justification for disabling HTTPS system-wide.',
        affectedFileOrConfig: 'Info.plist (NSAppTransportSecurity)',
      };
    }

    if (metadata.transportSecurity.exceptionDomains.length > 0) {
      return {
        ruleId: 'RULE-IOS-SEC-001',
        outcome: 'pass',
        evidence: `ATS is enabled with ${metadata.transportSecurity.exceptionDomains.length} scoped exception domain(s): [${metadata.transportSecurity.exceptionDomains.join(', ')}].`,
        affectedFileOrConfig: 'Info.plist (NSAppTransportSecurity)',
      };
    }

    return {
      ruleId: 'RULE-IOS-SEC-001',
      outcome: 'pass',
      evidence: 'ATS enforcement is enabled with default secure HTTPS requirements (no arbitrary loads allowed).',
      affectedFileOrConfig: 'Info.plist',
    };
  },
};

export const iosPurposeStringsRule: Rule<IosMetadata> = {
  id: 'RULE-IOS-SEC-002',
  revision: '2026.1',
  platform: 'ios',
  category: 'permissions-security',
  severity: 'blocker',
  name: 'Privacy Purpose Usage Descriptions',
  description: 'Validates that declared hardware / data access keys have meaningful, user-facing purpose description strings.',
  whyItMatters: 'iOS will immediately terminate an app at runtime if it attempts to access protected resources (camera, microphone, photo library, location) without an Info.plist purpose string. App Store review also rejects generic or placeholder strings.',
  remediation: 'Provide clear, user-facing descriptions explaining why the permission is needed (e.g. "We need camera access to scan invoices").',
  officialReferenceUrl: 'https://developer.apple.com/documentation/bundleresources/information_property_list/protected_resources',
  sourceReviewDate: '2026-01-10',
  applicabilityDescription: 'Applies to all iOS apps accessing hardware or privacy-sensitive data.',
  requiredCapabilities: [],
  evaluate: ({ metadata }) => {
    const keys = Object.keys(metadata.purposeStrings);
    if (keys.length === 0) {
      return {
        ruleId: 'RULE-IOS-SEC-002',
        outcome: 'pass',
        evidence: 'No hardware purpose description keys detected in Info.plist.',
        affectedFileOrConfig: 'Info.plist',
      };
    }

    const placeholderIssues: string[] = [];
    for (const key of keys) {
      const desc = metadata.purposeStrings[key] ?? '';
      if (!desc.trim() || desc.length < 5 || /test|placeholder|todo|asdf/i.test(desc)) {
        placeholderIssues.push(`${key}: "${desc}"`);
      }
    }

    if (placeholderIssues.length > 0) {
      return {
        ruleId: 'RULE-IOS-SEC-002',
        outcome: 'fail',
        evidence: `Detected generic or empty purpose string(s): [${placeholderIssues.join(', ')}]. App Store Review rejects placeholder permission explanations.`,
        affectedFileOrConfig: 'Info.plist',
      };
    }

    return {
      ruleId: 'RULE-IOS-SEC-002',
      outcome: 'pass',
      evidence: `Found ${keys.length} valid purpose string(s) with user-facing descriptions (e.g. ${keys.slice(0, 3).join(', ')}).`,
      affectedFileOrConfig: 'Info.plist',
    };
  },
};
