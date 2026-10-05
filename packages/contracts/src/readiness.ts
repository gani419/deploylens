export type ReadinessStatus =
  | 'ACTION REQUIRED'
  | 'REVIEW REQUIRED'
  | 'PASSED AVAILABLE CHECKS'
  | 'INCOMPLETE';

export const OFFICIAL_DISCLAIMER =
  'This tool can make mistakes or miss issues. Results are guidance and do not guarantee production readiness or approval by Google Play or the App Store. Always verify findings manually and test your app before submitting it.';

export interface UnverifiedArea {
  area: string;
  reason: string;
}

export const MANDATORY_UNVERIFIED_AREAS: UnverifiedArea[] = [
  { area: 'Runtime crashes and hangs', reason: 'DeployLens does not launch the app in a simulator or physical runtime environment.' },
  { area: 'Login and backend behavior', reason: 'No network, mock server, or credential-based execution is performed.' },
  { area: 'Payments and subscriptions', reason: 'In-app billing and StoreKit flows require sandbox/production account testing.' },
  { area: 'Account deletion', reason: 'In-app account deletion compliance must be verified within the active UI and server backend.' },
  { area: 'Phone/tablet/iPad visual layouts', reason: 'Manifest/plist device declarations cannot verify responsive UI rendering or split-screen adaptations.' },
  { area: 'Privacy declaration accuracy', reason: 'Privacy manifest existence or permissions do not verify runtime data transmission practices.' },
  { area: 'Content and legal requirements', reason: 'Intellectual property, rating, and local jurisdiction compliance require legal review.' },
  { area: 'Store-account eligibility', reason: 'DeployLens cannot inspect developer console standing, D-U-N-S verification, or target merchant requirements.' },
];

export interface FindingCategoryBreakdown {
  blockers: number;
  policyRisks: number;
  securityConcerns: number;
  qualityRecommendations: number;
  manualTestingRequirements: number;
}

export interface ScanAssessment {
  status: ReadinessStatus;
  summary: string;
  findingBreakdown: FindingCategoryBreakdown;
  blockerCount: number;
  warningReviewCount: number;
  passedCheckCount: number;
  notCheckedCount: number;
  notApplicableCount: number;
  totalChecksEvaluated: number;
  coverageRatio: {
    performed: number;
    totalPossible: number;
    description: string;
  };
  unverifiedAreas: UnverifiedArea[];
  toolVersionsUsed: Record<string, string>;
  ruleRevisionsUsed: Record<string, string>;
  disclaimer: string;
}
