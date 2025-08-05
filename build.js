// build.js - Simple build script for Vercel deployment
const fs = require('fs');
const path = require('path');

console.log('🏗️ Building for Vercel deployment...');

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
const frontendDir = path.join(__dirname, 'frontend');

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('✅ Created public directory');
}

// Copy frontend files to public directory
if (fs.existsSync(frontendDir)) {
    const frontendFiles = fs.readdirSync(frontendDir);
    
    frontendFiles.forEach(file => {
        const srcPath = path.join(frontendDir, file);
        const destPath = path.join(publicDir, file);
        
        if (fs.lstatSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`✅ Copied ${file} to public directory`);
        }
    });
} else {
    console.log('⚠️ Frontend directory not found');
}

// Create a simple index.html if none exists
const indexPath = path.join(publicDir, 'index.html');
if (!fs.existsSync(indexPath)) {
    const simpleIndex = `<!DOCTYPE html>
<html>
<head>
    <title>Visa Monitor Cloud</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <h1>Visa Monitor Cloud - Deployment Test</h1>
    <p>Application is deploying...</p>
    <script>
        // Redirect to API after 3 seconds
        setTimeout(() => {
            window.location.href = '/api/info';
        }, 3000);
    </script>
</body>
</html>`;
    
    fs.writeFileSync(indexPath, simpleIndex);
    console.log('✅ Created fallback index.html');
}

console.log('🎉 Build completed successfully!');
console.log('📁 Files in public directory:');
if (fs.existsSync(publicDir)) {
    fs.readdirSync(publicDir).forEach(file => {
        console.log(`   - ${file}`);
    });
}