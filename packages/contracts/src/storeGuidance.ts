import type { Platform } from './artifact.js';

export interface UserAppInfo {
  appPurpose?: string;
  intendedUsers?: string;
  mainFeatures?: string;
  preferredListingLanguage?: string;
}

export interface ListingField {
  label: string;
  value: string;
  charCount: number;
  maxChars: number;
  isWithinLimit: boolean;
  notes: string;
}

export interface StoreListingTemplates {
  appName: ListingField;
  shortDescription?: ListingField; // Google Play (80 max)
  subtitle?: ListingField; // iOS App Store (30 max)
  fullDescription: ListingField; // 4000 max
  keywords?: ListingField; // iOS App Store (100 max)
  suggestedCategory?: string;
}

export interface StoreChecklistItem {
  id: string;
  topic:
    | 'App Name & Listing'
    | 'Icons & Screenshots'
    | 'Privacy & Data Declarations'
    | 'Sensitive Permissions'
    | 'Reviewer Access'
    | 'Build & Versioning'
    | 'Signing Verification'
    | 'Device Testing';
  title: string;
  severity: 'blocker' | 'recommended' | 'reminder';
  description: string;
  isDetectedFromArtifact: boolean;
  evidence?: string;
  officialReferenceUrl?: string;
}

export interface StoreGuidance {
  platform: Platform;
  listingTemplates: StoreListingTemplates;
  checklist: StoreChecklistItem[];
  detectedFacts: string[];
  generalReminders: string[];
  ruleRevision: string;
}
