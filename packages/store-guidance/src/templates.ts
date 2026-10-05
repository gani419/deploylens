import type {
  Platform,
  UserAppInfo,
  StoreListingTemplates,
  ListingField,
} from '@deploylens/contracts';
import { STORE_LIMITS } from './limits.js';

function createField(label: string, value: string, maxChars: number, notes: string): ListingField {
  const charCount = value.length;
  return {
    label,
    value,
    charCount,
    maxChars,
    isWithinLimit: charCount <= maxChars,
    notes,
  };
}

export function generateDeterministicListingTemplates(
  platform: Platform,
  extractedAppName: string,
  userAppInfo?: UserAppInfo
): StoreListingTemplates {
  const baseName = (extractedAppName || 'My Application').trim();
  const hasInfo = Boolean(
    userAppInfo?.appPurpose?.trim() ||
    userAppInfo?.mainFeatures?.trim() ||
    userAppInfo?.intendedUsers?.trim()
  );

  if (platform === 'android') {
    const limits = STORE_LIMITS.android;

    if (!hasInfo) {
      // Deterministic empty/fill-in template without inventing claims
      return {
        appName: createField(
          'App Name',
          baseName.slice(0, limits.appNameMax),
          limits.appNameMax,
          'Extracted from build. Max 30 characters. Avoid buzzwords like "Free" or "Top".'
        ),
        shortDescription: createField(
          'Short Description',
          `[Summary of ${baseName} in under 80 characters]`,
          limits.shortDescriptionMax,
          'Single sentence highlighting key utility. Max 80 characters.'
        ),
        fullDescription: createField(
          'Full Description',
          `Overview:\n[Describe what ${baseName} does and who it helps]\n\nKey Features:\n• [Core feature 1]\n• [Core feature 2]\n• [Core feature 3]\n\nGetting Started:\n[Provide instructions or onboarding context]`,
          limits.fullDescriptionMax,
          'Structured details, features, and usage instructions. Max 4000 characters.'
        ),
        suggestedCategory: undefined,
      };
    }

    // Has user provided info
    const purpose = userAppInfo?.appPurpose?.trim() ?? '';
    const users = userAppInfo?.intendedUsers?.trim() ?? '';
    const features = userAppInfo?.mainFeatures?.trim() ?? '';

    // Generate short description deterministically
    let shortDesc = purpose ? `${baseName}: ${purpose}` : `${baseName} for ${users}`;
    if (shortDesc.length > limits.shortDescriptionMax) {
      shortDesc = shortDesc.slice(0, limits.shortDescriptionMax - 3) + '...';
    }

    const featureLines = features
      ? features
          .split(/[\n,;]+/)
          .map((f) => f.trim())
          .filter(Boolean)
          .map((f) => `• ${f}`)
          .join('\n')
      : '• [Specify key feature]';

    const fullDesc = [
      purpose ? `${baseName} is built to ${purpose}.` : `${baseName} provides tools for mobile users.`,
      users ? `\nDesigned for: ${users}.` : '',
      '\nKey Capabilities:\n' + featureLines,
      '\nHow to use:\n1. Open the app.\n2. Follow the setup walkthrough.\n3. Access tools directly from the home screen.',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      appName: createField(
        'App Name',
        baseName.slice(0, limits.appNameMax),
        limits.appNameMax,
        'Max 30 characters.'
      ),
      shortDescription: createField(
        'Short Description',
        shortDesc,
        limits.shortDescriptionMax,
        'Derived deterministically from app purpose.'
      ),
      fullDescription: createField(
        'Full Description',
        fullDesc,
        limits.fullDescriptionMax,
        'Structured template using your supplied features and user profile.'
      ),
      suggestedCategory: inferCategory(purpose, features),
    };
  } else {
    // iOS App Store
    const limits = STORE_LIMITS.ios;

    if (!hasInfo) {
      return {
        appName: createField(
          'App Name',
          baseName.slice(0, limits.appNameMax),
          limits.appNameMax,
          'Extracted from CFBundleDisplayName. Max 30 characters.'
        ),
        subtitle: createField(
          'Subtitle',
          `[Concise summary]`,
          limits.subtitleMax,
          'App Store subtitle appears below app name. Max 30 characters.'
        ),
        fullDescription: createField(
          'Description',
          `[Detail the primary purpose, benefits, and workflows of ${baseName}]\n\nFeatures:\n- [Feature 1]\n- [Feature 2]\n\nSupport:\n[Include support link or contact guidance]`,
          limits.fullDescriptionMax,
          'App Store description. Max 4000 characters.'
        ),
        keywords: createField(
          'Keywords',
          baseName.toLowerCase().replace(/[^a-z0-9]/g, ','),
          limits.keywordsMax,
          'Comma-separated search keywords. Max 100 characters. Avoid duplicate terms.'
        ),
        suggestedCategory: undefined,
      };
    }

    const purpose = userAppInfo?.appPurpose?.trim() ?? '';
    const users = userAppInfo?.intendedUsers?.trim() ?? '';
    const features = userAppInfo?.mainFeatures?.trim() ?? '';

    let sub = purpose || `Essential tool for ${users}`;
    if (sub.length > limits.subtitleMax) {
      sub = sub.slice(0, limits.subtitleMax - 3) + '...';
    }

    const featureLines = features
      ? features
          .split(/[\n,;]+/)
          .map((f) => f.trim())
          .filter(Boolean)
          .map((f) => `• ${f}`)
          .join('\n')
      : '• [Specify key feature]';

    const fullDesc = [
      purpose ? `${baseName} helps you ${purpose}.` : `${baseName} is designed for mobile efficiency.`,
      users ? `\nTarget Audience:\nBuilt specifically for ${users}.` : '',
      '\nHighlights:\n' + featureLines,
      '\nPrivacy & Security:\nData handled locally according to declared app permissions.',
    ]
      .filter(Boolean)
      .join('\n');

    // Keywords generated deterministically from features and name without punctuation
    const rawTokens = [baseName, ...features.split(/[\s,;]+/), users.split(/[\s,;]+/)[0]]
      .filter(Boolean)
      .map((t) => t?.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter((t): t is string => Boolean(t && t.length > 2));
    const uniqueKeywords = Array.from(new Set(rawTokens)).join(',').slice(0, limits.keywordsMax);

    return {
      appName: createField(
        'App Name',
        baseName.slice(0, limits.appNameMax),
        limits.appNameMax,
        'Extracted from build. Max 30 characters.'
      ),
      subtitle: createField(
        'Subtitle',
        sub,
        limits.subtitleMax,
        'Derived from purpose. Max 30 characters.'
      ),
      fullDescription: createField(
        'Description',
        fullDesc,
        limits.fullDescriptionMax,
        'Structured template using your supplied features and user profile.'
      ),
      keywords: createField(
        'Keywords',
        uniqueKeywords,
        limits.keywordsMax,
        'Comma-separated tokens. Max 100 characters.'
      ),
      suggestedCategory: inferCategory(purpose, features),
    };
  }
}

function inferCategory(purpose: string, features: string): string {
  const combined = (purpose + ' ' + features).toLowerCase();
  if (/finance|money|budget|crypto|wallet|stock/i.test(combined)) return 'Finance';
  if (/health|fitness|workout|diet|medical/i.test(combined)) return 'Health & Fitness';
  if (/education|learn|student|study|course/i.test(combined)) return 'Education';
  if (/photo|video|camera|edit|media|filter/i.test(combined)) return 'Photo & Video';
  if (/game|play|arcade|puzzle/i.test(combined)) return 'Games';
  if (/productivity|task|note|organizer|calendar/i.test(combined)) return 'Productivity';
  if (/shop|store|cart|buy|commerce/i.test(combined)) return 'Shopping';
  if (/social|chat|message|connect|community/i.test(combined)) return 'Social';
  return 'Utilities / Developer Tools';
}
