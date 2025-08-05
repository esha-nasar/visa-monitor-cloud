// visa-monitor.js - Universal Version (Works in Cloud + Local)
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const notifier = require('node-notifier');

puppeteer.use(StealthPlugin());

class VisaMonitor {
    constructor(database) {
        this.db = database;
        this.isRunning = false;
        this.monitorInterval = null;
        this.startTime = null;
        this.stats = {
            spain: { checks: 0, slotsFound: 0, bookings: 0 },
            italy: { checks: 0, slotsFound: 0, bookings: 0 }
        };
        this.lastActivity = null;
        
        // Environment detection
        this.isRender = process.env.RENDER !== undefined;
        this.isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
        this.isVercel = process.env.VERCEL === '1';
        this.isCloud = this.isRender || this.isRailway || this.isVercel || process.env.NODE_ENV === 'production';
        
        console.log(`🌍 Environment: ${this.getEnvironment()}`);
        console.log(`🤖 Browser mode: ${this.isCloud ? 'Headless (Cloud)' : 'Visible (Local)'}`);
        
        // Browser pool for rotation (cloud-optimized)
        this.browserPool = [];
        this.maxBrowsers = this.isCloud ? 1 : 3; // Single browser for cloud, multiple for local
        this.checkInterval = this.isCloud ? 45000 : 15000; // Longer intervals for cloud
        
        // Country configurations
        this.countryConfigs = {
            spain: {
                name: 'Spain',
                flag: '🇪🇸',
                baseUrl: 'https://appointment.thespainvisa.com',
                loginUrl: 'https://appointment.thespainvisa.com/Global/account/login',
                appointmentUrl: 'https://appointment.thespainvisa.com/Global/bls/Appointment',
                selectors: {
                    email: '#Email',
                    password: '#Password',
                    submitLogin: 'button[type="submit"]',
                    availableSlots: '.available-date, .calendar-day.available, .appointment-available',
                    bookingButton: '.book-appointment, .submit-btn, .continue-btn',
                    visaTypeDropdown: '#VisaType, #visa_type, select[name="visa_type"]',
                    centerDropdown: '#Center, #center, select[name="center"]',
                    captcha: '.g-recaptcha, .captcha, [data-sitekey]'
                }
            },
            italy: {
                name: 'Italy',
                flag: '🇮🇹',
                baseUrl: 'https://blsitalyvisa.com/cameroon',
                loginUrl: 'https://blsitalyvisa.com/cameroon/account/login',
                appointmentUrl: 'https://blsitalyvisa.com/cameroon/appointment',
                selectors: {
                    email: '#username, #email, input[name="email"]',
                    password: '#password, input[name="password"]',
                    submitLogin: '#submit, .login-button, button[type="submit"]',
                    availableSlots: '.available, .appointment-slot, .slot-available',
                    bookingButton: '.book-now, .continue, .submit-application',
                    visaTypeDropdown: '#visa_type, select[name="visa_type"]',
                    centerDropdown: '#center, select[name="center"]',
                    captcha: '.g-recaptcha, .captcha, [data-sitekey]'
                }
            }
        };
    }

    getEnvironment() {
        if (this.isRender) return 'Render';
        if (this.isRailway) return 'Railway';
        if (this.isVercel) return 'Vercel';
        if (this.isCloud) return 'Cloud';
        return 'Local';
    }

    async start() {
        if (this.isRunning) {
            throw new Error('Monitor is already running');
        }

        console.log(`🚀 Starting visa monitoring on ${this.getEnvironment()}...`);
        this.isRunning = true;
        this.startTime = new Date();

        const activeApplications = await this.db.getActiveApplications();
        
        if (activeApplications.length === 0) {
            throw new Error('No active applications to monitor');
        }

        console.log(`📋 Found ${activeApplications.length} active applications`);

        // Test browser capability first
        try {
            await this.testBrowserCapability();
            console.log('✅ Browser automation confirmed working!');
        } catch (error) {
            console.error('❌ Browser test failed:', error);
            throw new Error(`Browser automation not available: ${error.message}`);
        }

        // Initialize browser pool
        await this.initializeBrowserPool();

        // Start monitoring loop
        this.startMonitoringLoop();

        const spainApps = activeApplications.filter(app => app.country === 'spain');
        const italyApps = activeApplications.filter(app => app.country === 'italy');

        console.log(`✅ Monitoring started successfully!`);
        console.log(`🇪🇸 Spain: ${spainApps.length} applications`);
        console.log(`🇮🇹 Italy: ${italyApps.length} applications`);
        console.log(`⚡ Check interval: ${this.checkInterval/1000} seconds`);
        console.log(`🌐 Browser pool: ${this.maxBrowsers} browser(s)`);
    }

    async testBrowserCapability() {
        console.log(`🧪 Testing browser capability on ${this.getEnvironment()}...`);
        
        const browser = await this.createBrowser(0);
        const page = await browser.newPage();
        
        try {
            console.log('🌐 Testing navigation...');
            await page.goto('https://httpbin.org/user-agent', { 
                waitUntil: 'networkidle2', 
                timeout: 15000 
            });
            
            const userAgent = await page.evaluate(() => navigator.userAgent);
            console.log('🔍 User agent detected:', userAgent.substring(0, 60) + '...');
            
            console.log('📝 Testing form interaction...');
            await page.goto('https://httpbin.org/forms/post', { 
                waitUntil: 'networkidle2', 
                timeout: 15000 
            });
            
            await page.type('input[name="custname"]', 'Test User', { delay: 50 });
            console.log('✍️ Form typing successful');
            
        } finally {
            await browser.close();
        }
        
        console.log('✅ Browser capability test passed!');
    }

    async createBrowser(index) {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0'
        ];

        const viewports = [
            { width: 1366, height: 768 },
            { width: 1920, height: 1080 },
            { width: 1440, height: 900 }
        ];

        // Universal browser arguments (works in both cloud and local)
        let browserArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--disable-web-security',
            '--allow-running-insecure-content'
        ];

        // Cloud-specific optimizations
        if (this.isCloud) {
            browserArgs.push(
                '--single-process', // Critical for cloud memory limits
                '--no-zygote',
                '--memory-pressure-off',
                '--max_old_space_size=4096',
                '--disable-background-networking',
                '--disable-default-browser-check',
                '--disable-plugins',
                '--disable-hang-monitor',
                '--disable-popup-blocking',
                '--no-crash-upload',
                '--password-store=basic',
                '--use-mock-keychain'
            );
        }

        const browserOptions = {
            headless: this.isCloud, // Headless in cloud, visible locally
            args: browserArgs,
            ignoreDefaultArgs: ['--enable-automation'],
            defaultViewport: viewports[index % viewports.length],
            timeout: 30000
        };

        console.log(`🔧 Creating ${this.isCloud ? 'headless' : 'visible'} browser ${index + 1}/${this.maxBrowsers}...`);
        
        const browser = await puppeteer.launch(browserOptions);
        
        return browser;
    }

    async initializeBrowserPool() {
        console.log(`🌐 Initializing browser pool (${this.maxBrowsers} browser(s))...`);
        
        for (let i = 0; i < this.maxBrowsers; i++) {
            try {
                const browser = await this.createBrowser(i);
                
                this.browserPool.push({
                    browser: browser,
                    index: i,
                    lastUsed: 0,
                    inUse: false
                });
                
                console.log(`✅ Browser ${i + 1} ready`);
                
                // Small delay between browser creation
                if (i < this.maxBrowsers - 1) {
                    await this.delay(2000);
                }
                
            } catch (error) {
                console.error(`❌ Failed to create browser ${i + 1}:`, error);
            }
        }
        
        console.log(`🎉 Browser pool initialized with ${this.browserPool.length} browser(s)`);
    }

    startMonitoringLoop() {
        console.log(`⚡ Starting monitoring loop (${this.checkInterval/1000}s interval)`);
        
        this.monitorInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                console.log(`🔄 Running monitoring cycle at ${new Date().toLocaleTimeString()}`);
                
                const activeApps = await this.db.getActiveApplications();
                const spainApps = activeApps.filter(app => app.country === 'spain');
                const italyApps = activeApps.filter(app => app.country === 'italy');

                // Process countries (cloud uses sequential, local can use parallel)
                if (this.isCloud) {
                    // Sequential processing for cloud
                    if (spainApps.length > 0) {
                        await this.processCountryApplications('spain', spainApps);
                    }

                    if (spainApps.length > 0 && italyApps.length > 0) {
                        await this.delay(5000); // Gap between countries
                    }

                    if (italyApps.length > 0) {
                        await this.processCountryApplications('italy', italyApps);
                    }
                } else {
                    // Parallel processing for local (original behavior)
                    const promises = [];
                    if (spainApps.length > 0) {
                        promises.push(this.processCountryApplications('spain', spainApps));
                    }
                    if (italyApps.length > 0) {
                        promises.push(this.processCountryApplications('italy', italyApps));
                    }
                    await Promise.all(promises);
                }

                console.log(`✅ Monitoring cycle completed`);

            } catch (error) {
                console.error('❌ Error in monitoring loop:', error);
                await this.db.logActivity(null, 'system', 'MONITORING_ERROR', error.message);
            }
        }, this.checkInterval);
    }

    getAvailableBrowser() {
        const availableBrowsers = this.browserPool.filter(b => !b.inUse);
        
        if (availableBrowsers.length === 0) {
            console.log('⏳ No available browsers, waiting...');
            return this.browserPool.sort((a, b) => a.lastUsed - b.lastUsed)[0];
        }

        // Return least recently used browser
        availableBrowsers.sort((a, b) => a.lastUsed - b.lastUsed);
        const browser = availableBrowsers[0];
        browser.lastUsed = Date.now();
        browser.inUse = true;
        
        return browser;
    }

    releaseBrowser(browserInstance) {
        browserInstance.inUse = false;
    }

    async processCountryApplications(country, applications) {
        console.log(`🔄 Processing ${applications.length} ${country} applications...`);

        const browserInstance = this.getAvailableBrowser();
        
        try {
            console.log(`🌐 Using browser ${browserInstance.index + 1} for ${country}`);
            
            for (let i = 0; i < applications.length; i++) {
                const app = applications[i];
                
                try {
                    console.log(`📋 Processing ${i + 1}/${applications.length}: ${app.first_name} ${app.last_name}`);
                    
                    await this.processApplicationWithBrowser(country, app, browserInstance.browser);
                    await this.db.incrementAttempts(app.id);
                    
                    // Delay between applications
                    if (i < applications.length - 1) {
                        await this.delay(this.isCloud ? 3000 : 1000);
                    }

                } catch (error) {
                    console.error(`❌ Error processing application ${app.id}:`, error);
                    await this.db.logActivity(app.id, country, 'PROCESSING_ERROR', error.message);
                }
            }

        } catch (error) {
            console.error(`❌ Browser error for ${country}:`, error);
        } finally {
            this.releaseBrowser(browserInstance);
        }

        this.lastActivity = new Date();
    }

    async processApplicationWithBrowser(country, application, browser) {
        const config = this.countryConfigs[country];
        let page = null;
        
        try {
            console.log(`📋 Checking ${config.name} for ${application.first_name} ${application.last_name}`);
            
            page = await browser.newPage();
            
            // Configure page
            await this.configurePage(page);
            
            // Login and check
            await this.loginToSite(page, country, application);
            await this.delay(2000);
            
            const slotsFound = await this.checkAppointmentSlots(page, country, application);
            
            if (slotsFound) {
                console.log(`🎯 SLOTS FOUND for ${config.name}! 🎉`);
                
                await this.db.incrementSlotsFound(application.id);
                this.stats[country].slotsFound++;
                
                await this.db.logActivity(application.id, country, 'SLOTS_FOUND', 
                    `${application.visa_type} visa slots found on ${this.getEnvironment()}`);
                
                this.sendNotification(application, country, 'slots_found');
                
                if (application.auto_book) {
                    await this.delay(3000);
                    const bookingSuccess = await this.attemptBooking(page, country, application);
                    
                    if (bookingSuccess) {
                        await this.db.markCompleted(application.id, `booking_successful_${this.getEnvironment().toLowerCase()}`);
                        this.stats[country].bookings++;
                        
                        await this.db.logActivity(application.id, country, 'BOOKING_SUCCESS', 
                            `Appointment booked successfully on ${this.getEnvironment()}`);
                        
                        this.sendNotification(application, country, 'booking_success');
                    }
                }
            }
            
            this.stats[country].checks++;

        } catch (error) {
            console.error(`❌ Error processing ${country}:`, error.message);
            
        } finally {
            if (page) {
                try {
                    await page.close();
                } catch (e) {
                    console.log(`⚠️ Could not close page`);
                }
            }
        }
    }

    async configurePage(page) {
        // Set user agent and viewport
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });
        
        // Block unnecessary resources for faster loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            
            if (this.isCloud && ['stylesheet', 'font', 'image', 'media'].includes(resourceType)) {
                req.abort(); // Block in cloud for speed
            } else if (!this.isCloud && ['font', 'image', 'media'].includes(resourceType)) {
                req.abort(); // Block some in local
            } else {
                req.continue();
            }
        });
    }

    async loginToSite(page, country, application) {
        const config = this.countryConfigs[country];
        
        try {
            console.log(`🔐 Logging into ${config.name}...`);
            
            await page.goto(config.loginUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 20000 
            });
            
            await this.delay(2000);
            
            // Fill login form with human-like typing
            await page.waitForSelector(config.selectors.email, { timeout: 10000 });
            await this.humanType(page, config.selectors.email, application.site_email);
            
            await this.delay(1000);
            
            await page.waitForSelector(config.selectors.password, { timeout: 5000 });
            await this.humanType(page, config.selectors.password, application.site_password);
            
            // Check for CAPTCHA (only in local mode)
            if (!this.isCloud) {
                const captcha = await page.$(config.selectors.captcha);
                if (captcha) {
                    console.log(`⚠️ CAPTCHA detected for ${config.name} - please solve manually`);
                    
                    await page.waitForFunction(() => {
                        const captchaElement = document.querySelector('.g-recaptcha, .captcha');
                        return !captchaElement || captchaElement.style.display === 'none';
                    }, { timeout: 60000 });
                }
            }
            
            await this.delay(1000);
            
            // Submit login
            await page.click(config.selectors.submitLogin);
            await page.waitForNavigation({ timeout: 15000 });
            
            console.log(`✅ Successfully logged into ${config.name}`);

        } catch (error) {
            console.error(`❌ Login failed for ${config.name}:`, error);
            throw error;
        }
    }

    async humanType(page, selector, text) {
        await page.click(selector, { clickCount: 3 });
        
        for (const char of text) {
            await page.keyboard.type(char);
            await this.delay(50 + Math.random() * 100);
        }
    }

    async checkAppointmentSlots(page, country, application) {
        const config = this.countryConfigs[country];
        
        try {
            console.log(`🔍 Checking appointment slots...`);
            
            await page.goto(config.appointmentUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 20000 
            });
            
            await this.delay(3000);
            
            // Select visa type if dropdown exists
            const visaDropdown = await page.$(config.selectors.visaTypeDropdown);
            if (visaDropdown) {
                try {
                    await page.select(config.selectors.visaTypeDropdown, application.visa_type);
                    await this.delay(1000);
                } catch (e) {
                    console.log(`Could not select visa type`);
                }
            }
            
            // Select center if dropdown exists
            if (application.preferred_center) {
                const centerDropdown = await page.$(config.selectors.centerDropdown);
                if (centerDropdown) {
                    try {
                        await page.select(config.selectors.centerDropdown, application.preferred_center);
                        await this.delay(1000);
                    } catch (e) {
                        console.log(`Could not select center`);
                    }
                }
            }
            
            // Check for available slots
            const slotsAvailable = await page.evaluate((selector) => {
                const slots = document.querySelectorAll(selector);
                return Array.from(slots).some(slot => {
                    const text = slot.textContent.toLowerCase();
                    const classes = slot.className.toLowerCase();
                    const isDisabled = slot.disabled || slot.hasAttribute('disabled');
                    
                    return !isDisabled &&
                           !text.includes('no slots') && 
                           !text.includes('unavailable') && 
                           !text.includes('not available') &&
                           !classes.includes('disabled') &&
                           !classes.includes('unavailable') &&
                           (text.includes('available') || text.includes('book') || text.includes('select'));
                });
            }, config.selectors.availableSlots);
            
            console.log(`📊 Slots check: ${slotsAvailable ? 'AVAILABLE ✅' : 'NOT AVAILABLE ❌'}`);
            return slotsAvailable;

        } catch (error) {
            console.error(`Error checking slots:`, error);
            return false;
        }
    }

    async attemptBooking(page, country, application) {
        const config = this.countryConfigs[country];
        
        try {
            console.log(`🤖 Attempting to book appointment...`);
            
            await page.click(config.selectors.availableSlots + ':first-child');
            await this.delay(3000);
            
            await this.fillApplicationForm(page, application);
            
            const submitButton = await page.$(config.selectors.bookingButton);
            if (submitButton) {
                await submitButton.click();
                
                try {
                    await page.waitForSelector('.confirmation, .success-message, .booking-confirmed', { 
                        timeout: 15000 
                    });
                    
                    console.log(`✅ Booking confirmed!`);
                    return true;
                    
                } catch (confirmationError) {
                    console.log(`⚠️ Could not confirm booking`);
                    return false;
                }
            }
            
            return false;

        } catch (error) {
            console.error(`❌ Booking failed:`, error);
            return false;
        }
    }

    async fillApplicationForm(page, application) {
        const fieldMappings = {
            '#FirstName, [name="firstName"], [name="first_name"]': application.first_name,
            '#LastName, [name="lastName"], [name="last_name"]': application.last_name,
            '#Email, [name="email"]': application.email,
            '#Phone, [name="phone"], [name="mobile"]': application.phone,
            '#PassportNumber, [name="passport"], [name="passportNumber"]': application.passport_number,
            '#DateOfBirth, [name="dob"], [name="dateOfBirth"]': application.date_of_birth,
            '#Nationality, [name="nationality"]': application.nationality,
            '#Address, [name="address"]': application.address
        };

        for (const [selector, value] of Object.entries(fieldMappings)) {
            if (!value) continue;
            
            try {
                await page.waitForSelector(selector, { timeout: 3000 });
                await page.click(selector, { clickCount: 3 });
                await this.humanType(page, selector, value);
                await this.delay(300);
            } catch (e) {
                console.log(`Field ${selector} not found, skipping`);
            }
        }
    }

    sendNotification(application, country, eventType) {
        const config = this.countryConfigs[country];
        let title, message;
        
        if (eventType === 'slots_found') {
            title = `${config.flag} ${config.name.toUpperCase()} SLOTS FOUND!`;
            message = `${application.visa_type.toUpperCase()} visa slots available for ${application.first_name} ${application.last_name}`;
        } else if (eventType === 'booking_success') {
            title = `${config.flag} ${config.name.toUpperCase()} BOOKING SUCCESS!`;
            message = `Successfully booked ${application.visa_type} appointment for ${application.first_name} ${application.last_name}`;
        }

        // Desktop notifications (only in local environment)
        if (!this.isCloud) {
            try {
                notifier.notify({
                    title: title,
                    message: message,
                    sound: true,
                    wait: false,
                    timeout: 10
                });
            } catch (error) {
                console.log('Could not send desktop notification');
            }
        }

        // Console notification (always)
        console.log(`🔔 ${title} - ${message}`);
    }

    async stop() {
        if (!this.isRunning) return;

        console.log('🛑 Stopping visa monitoring...');
        this.isRunning = false;

        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        // Close all browsers in pool
        for (const browserInstance of this.browserPool) {
            try {
                await browserInstance.browser.close();
                console.log(`✅ Closed browser ${browserInstance.index + 1}`);
            } catch (error) {
                console.error(`Error closing browser:`, error);
            }
        }
        this.browserPool = [];

        console.log('✅ All browsers closed - monitoring stopped');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Status getters
    getStats() {
        return {
            ...this.stats,
            total: {
                checks: this.stats.spain.checks + this.stats.italy.checks,
                slotsFound: this.stats.spain.slotsFound + this.stats.italy.slotsFound,
                bookings: this.stats.spain.bookings + this.stats.italy.bookings
            }
        };
    }

    getActiveCountries() {
        return this.isRunning ? Object.keys(this.countryConfigs) : [];
    }

    getLastActivity() {
        return this.lastActivity;
    }
}

module.exports = VisaMonitor;