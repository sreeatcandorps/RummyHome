// Version configuration for Rummy Home App
// Increment this number every time you make changes

const APP_VERSION = {
  version: "1.0.0",
  build: 21, // Increment this number for each change
  lastUpdated: "2024-12-19",
  changes: [
    "v1.0.0 (Build 21) - Fixed dev login accounts and added test script",
    "v1.0.0 (Build 20) - Removed version display from all screens except home screen",
    "v1.0.0 (Build 19) - Fixed back to 6-digit passcodes for Supabase compatibility",
    "v1.0.0 (Build 18) - Made all passcodes consistent (4-digit) across dev and regular login",
    "v1.0.0 (Build 17) - Removed splash screen and dev login popup alerts",
    "v1.0.0 (Build 16) - Fixed dev login to use 4-digit passcodes (0000)",
    "v1.0.0 (Build 15) - Updated to 6-digit passcodes for Supabase compatibility",
    "v1.0.0 (Build 14) - Added dev login screen and test accounts",
    "v1.0.0 (Build 13) - Fixed reset password page with number keyboard",
    "v1.0.0 (Build 12) - Added forgot password functionality",
    "v1.0.0 (Build 11) - Removed SMS/phone authentication",
    "v1.0.0 (Build 10) - Simplified to email-only authentication",
    "v1.0.0 (Build 9) - Added optional phone number collection",
    "v1.0.0 (Build 8) - Removed Google/Apple authentication",
    "v1.0.0 (Build 7) - Fixed bundling issues",
    "v1.0.0 (Build 6) - Added country detection (disabled)",
    "v1.0.0 (Build 5) - Initial authentication setup",
    "v1.0.0 (Build 4) - Basic app structure",
    "v1.0.0 (Build 3) - Supabase integration",
    "v1.0.0 (Build 2) - React Native setup",
    "v1.0.0 (Build 1) - Project initialization"
  ]
};

export default APP_VERSION; 