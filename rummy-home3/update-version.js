// Script to update version number
// Run this script when you make changes to increment the build number

const fs = require('fs');
const path = require('path');

// Read current version
const versionPath = path.join(__dirname, 'version.js');
const packagePath = path.join(__dirname, 'package.json');

function updateVersion() {
  try {
    // Read current version file
    const versionContent = fs.readFileSync(versionPath, 'utf8');
    
    // Extract current build number
    const buildMatch = versionContent.match(/build: (\d+)/);
    if (!buildMatch) {
      console.error('❌ Could not find build number in version.js');
      return;
    }
    
    const currentBuild = parseInt(buildMatch[1]);
    const newBuild = currentBuild + 1;
    
    console.log(`🔄 Updating build number from ${currentBuild} to ${newBuild}`);
    
    // Update version.js
    const newVersionContent = versionContent.replace(
      /build: \d+/,
      `build: ${newBuild}`
    ).replace(
      /lastUpdated: "[^"]*"/,
      `lastUpdated: "${new Date().toISOString().split('T')[0]}"`
    );
    
    fs.writeFileSync(versionPath, newVersionContent);
    console.log('✅ Updated version.js');
    
    // Update package.json
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const newPackageContent = packageContent.replace(
      /"build": \d+/,
      `"build": ${newBuild}`
    );
    
    fs.writeFileSync(packagePath, newPackageContent);
    console.log('✅ Updated package.json');
    
    console.log('');
    console.log(`🎉 Version updated to Build ${newBuild}!`);
    console.log('');
    console.log('📱 The app will now show the new version number.');
    console.log('🔄 Run "npx expo start --clear" to see the changes.');
    
  } catch (error) {
    console.error('❌ Error updating version:', error);
  }
}

// Get command line argument for change description
const changeDescription = process.argv[2];

if (changeDescription) {
  console.log(`📝 Change Description: ${changeDescription}`);
  console.log('');
}

updateVersion(); 