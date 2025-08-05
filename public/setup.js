// setup.js - Setup and Installation Script
const fs = require('fs');
const path = require('path');

class SetupScript {
    constructor() {
        this.projectStructure = {
            'frontend': {},
            'logs': {},
            'backups': {}
        };
    }

    async run() {
        console.log('🚀 Setting up Single User Visa Monitor...\n');
        
        try {
            this.createDirectories();
            this.createFrontendDirectory();
            this.createConfigFile();
            this.createStartupScript();
            this.displayInstructions();
            
            console.log('✅ Setup completed successfully!\n');
        } catch (error) {
            console.error('❌ Setup failed:', error);
            process.exit(1);
        }
    }

    createDirectories() {
        console.log('📁 Creating project directories...');
        
        Object.keys(this.projectStructure).forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`   ✓ Created ${dir}/`);
            }
        });
    }

    createFrontendDirectory() {
        console.log('🌐 Setting up frontend directory...');
        
        // Create a simple index.html placeholder if frontend/index.html doesn't exist
        const frontendIndexPath = path.join('frontend', 'index.html');
        
        if (!fs.existsSync(frontendIndexPath)) {
            console.log('   ⚠️  Frontend index.html not found');
            console.log('   📝 Please ensure you have the frontend/index.html file from the artifacts');
        } else {
            console.log('   ✓ Frontend files ready');
        }
    }

    createConfigFile() {
        console.log('⚙️  Creating configuration file...');
        
        const configPath = 'config.json';
        
        if (!fs.existsSync(configPath)) {
            const defaultConfig = {
                "server": {
                    "port": 3000,
                    "host": "localhost"
                },
                "database": {
                    "path": "./visa_monitor.db",
                    "backup_interval_hours": 24
                },
                "monitoring": {
                    "check_interval_seconds": 15,
                    "max_concurrent_applications": 10,
                    "enable_notifications": true,
                    "enable_sound_alerts": true
                },
                "countries": {
                    "spain": {
                        "enabled": true,
                        "base_url": "https://appointment.thespainvisa.com"
                    },
                    "italy": {
                        "enabled": true,
                        "base_url": "https://blsitalyvisa.com/cameroon"
                    }
                },
                "browser": {
                    "headless": false,
                    "timeout_seconds": 30,
                    "enable_stealth": true
                },
                "security": {
                    "encrypt_passwords": true,
                    "log_retention_days": 30
                }
            };
            
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            console.log('   ✓ Created config.json with default settings');
        } else {
            console.log('   ✓ Configuration file already exists');
        }
    }

    createStartupScript() {
        console.log('🔧 Creating startup scripts...');
        
        // Windows batch file
        const windowsScript = `@echo off
title Single User Visa Monitor
echo Starting Single User Visa Monitor...
echo.
node server.js
pause`;
        
        fs.writeFileSync('start.bat', windowsScript);
        console.log('   ✓ Created start.bat for Windows');
        
        // Linux/Mac shell script
        const unixScript = `#!/bin/bash
echo "Starting Single User Visa Monitor..."
echo ""
node server.js`;
        
        fs.writeFileSync('start.sh', unixScript);
        
        // Make shell script executable (on Unix systems)
        try {
            fs.chmodSync('start.sh', '755');
            console.log('   ✓ Created start.sh for Linux/Mac');
        } catch (error) {
            console.log('   ✓ Created start.sh (may need chmod +x start.sh)');
        }
    }

    displayInstructions() {
        console.log('\n📋 INSTALLATION INSTRUCTIONS:\n');
        
        console.log('1️⃣  Install Dependencies:');
        console.log('   npm install\n');
        
        console.log('2️⃣  File Structure (ensure you have these files):');
        console.log('   ├── server.js           (Backend server)');
        console.log('   ├── database.js         (Database module)');
        console.log('   ├── visa-monitor.js     (Monitoring module)');
        console.log('   ├── frontend/');
        console.log('   │   └── index.html      (Frontend interface)');
        console.log('   ├── package.json        (Dependencies)');
        console.log('   └── config.json         (Configuration)\n');
        
        console.log('3️⃣  Start the Application:');
        console.log('   npm start               (or node server.js)');
        console.log('   OR');
        console.log('   ./start.sh              (Linux/Mac)');
        console.log('   start.bat               (Windows)\n');
        
        console.log('4️⃣  Access the Dashboard:');
        console.log('   🌐 Open: http://localhost:3000\n');
        
        console.log('5️⃣  Usage Steps:');
        console.log('   a) Open the web dashboard');
        console.log('   b) Add new visa applications with your details');
        console.log('   c) Include visa website login credentials');
        console.log('   d) Click "Start Monitoring"');
        console.log('   e) System will automatically check for slots');
        console.log('   f) Get instant notifications when slots are found');
        console.log('   g) Auto-booking will attempt to secure appointments\n');
        
        console.log('📁 Important Directories:');
        console.log('   • frontend/    - Web interface files');
        console.log('   • logs/        - Application logs');
        console.log('   • backups/     - Database backups\n');
        
        console.log('🔧 Configuration:');
        console.log('   • Edit config.json to customize settings');
        console.log('   • Database: visa_monitor.db (auto-created)');
        console.log('   • Logs: Stored in database + console\n');
        
        console.log('⚠️  Important Notes:');
        console.log('   • Keep your visa site credentials secure');
        console.log('   • Run with stable internet connection');
        console.log('   • Monitor browser windows for CAPTCHAs');
        console.log('   • Check logs for any errors or issues\n');
        
        console.log('🆘 Troubleshooting:');
        console.log('   • Port 3000 busy? Change in config.json');
        console.log('   • Database issues? Delete visa_monitor.db to reset');
        console.log('   • Browser crashes? Restart the application');
        console.log('   • CAPTCHA problems? Solve manually in browser window\n');
        
        console.log('📞 Support:');
        console.log('   • Check activity logs in the dashboard');
        console.log('   • Monitor console output for errors');
        console.log('   • Ensure all files are in correct locations\n');
    }
}

// Create README file
function createReadme() {
    const readmeContent = `# Single User Visa Monitor

Automated visa appointment monitoring system for Spain and Italy visa applications.

## Features

- 🇪🇸 **Spain Visa Monitoring** - Monitors thespainvisa.com for appointment slots
- 🇮🇹 **Italy Visa Monitoring** - Monitors blsitalyvisa.com for appointment slots
- 🤖 **Auto-booking** - Automatically fills and submits applications when slots found
- 🔔 **Instant Notifications** - Desktop notifications with sound alerts
- 📊 **Web Dashboard** - Easy-to-use interface for managing applications
- 💾 **Database Storage** - SQLite database for persistent storage
- 📝 **Activity Logging** - Complete audit trail of all activities

## Installation

1. **Install Node.js** (version 16 or higher)
2. **Install Dependencies**:
   \`\`\`bash
   npm install
   \`\`\`
3. **Run Setup** (optional):
   \`\`\`bash
   node setup.js
   \`\`\`

## Usage

1. **Start the Application**:
   \`\`\`bash
   npm start
   \`\`\`

2. **Open Dashboard**:
   Open http://localhost:3000 in your browser

3. **Add Applications**:
   - Click "Add New Application"
   - Fill in personal information
   - Enter visa website login credentials
   - Set preferences (priority, auto-book)

4. **Start Monitoring**:
   - Click "Start Monitoring" in the dashboard
   - System will check for appointment slots every 15 seconds
   - Get instant notifications when slots are found

## File Structure

\`\`\`
visa-monitor/
├── server.js              # Backend server
├── database.js            # Database module  
├── visa-monitor.js        # Monitoring engine
├── package.json           # Dependencies
├── config.json            # Configuration
├── frontend/
│   └── index.html         # Web dashboard
├── logs/                  # Application logs
└── backups/               # Database backups
\`\`\`

## Configuration

Edit \`config.json\` to customize:

- Server port and host
- Monitoring intervals
- Browser settings
- Notification preferences
- Country-specific URLs

## Important Notes

### Security
- Keep visa website credentials secure
- Database stores encrypted passwords
- Regular backups recommended

### Browser Automation
- Browser windows will open for each country
- Manual CAPTCHA solving may be required
- Keep browser windows visible during monitoring

### Monitoring Best Practices
- Run during business hours (9 AM - 5 PM local time)
- Ensure stable internet connection
- Monitor console output for errors
- Check activity logs regularly

## Troubleshooting

### Common Issues

**Port Already in Use**:
- Change port in config.json
- Or stop other applications using port 3000

**Database Errors**:
- Delete visa_monitor.db to reset database
- Check file permissions

**Browser Crashes**:
- Restart the application
- Check system resources
- Update Chrome/Chromium

**CAPTCHA Problems**:
- Solve CAPTCHAs manually in browser windows
- System will wait for manual solving

**No Slots Found**:
- Verify login credentials are correct
- Check if applications are set to "active" status
- Ensure monitoring is started

### Logs and Debugging

- Check Activity Logs tab in dashboard
- Monitor console output while running
- Database logs stored in activity_logs table
- Browser automation logs in console

## API Endpoints

- \`GET /\` - Dashboard interface
- \`POST /api/applications\` - Create application
- \`GET /api/applications\` - List applications  
- \`PUT /api/applications/:id\` - Update application
- \`DELETE /api/applications/:id\` - Delete application
- \`POST /api/monitoring/start\` - Start monitoring
- \`POST /api/monitoring/stop\` - Stop monitoring
- \`GET /api/monitoring/status\` - Get status
- \`GET /api/stats\` - Get statistics
- \`GET /api/logs\` - Get activity logs

## System Requirements

- **Node.js** 16.0.0 or higher
- **Chrome/Chromium** (installed automatically with Puppeteer)
- **RAM** 4GB recommended
- **Storage** 1GB free space
- **Network** Stable internet connection

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review activity logs in dashboard
3. Check console output for errors
4. Verify all files are in correct locations

---

**⚠️ Disclaimer**: This tool is for legitimate visa application purposes only. Users are responsible for complying with website terms of service and applicable laws.
`;

    fs.writeFileSync('README.md', readmeContent);
    console.log('   ✓ Created README.md with documentation');
}

// Run setup if this file is executed directly
if (require.main === module) {
    const setup = new SetupScript();
    setup.run().then(() => {
        createReadme();
        
        console.log('🎉 Setup Complete! Follow the instructions above to get started.\n');
        console.log('Next steps:');
        console.log('1. npm install');
        console.log('2. npm start');
        console.log('3. Open http://localhost:3000\n');
    });
}

module.exports = SetupScript;