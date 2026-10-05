export const STORE_LIMITS = {
  android: {
    appNameMax: 30,
    shortDescriptionMax: 80,
    fullDescriptionMax: 4000,
    iconResolution: '512 x 512 px, 32-bit PNG, max 1MB',
    featureGraphicResolution: '1024 x 500 px, JPG or 24-bit PNG, max 15MB',
    screenshotMin: 2,
    screenshotMax: 8,
  },
  ios: {
    appNameMax: 30,
    subtitleMax: 30,
    keywordsMax: 100,
    fullDescriptionMax: 4000,
    promotionalTextMax: 170,
    appIconResolution: '1024 x 1024 px, PNG, no transparency',
    screenshotMin: 1,
    screenshotMax: 10,
  },
} as const;
