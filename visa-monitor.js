// visa-monitor.js - Fixed Detached Frame Issue
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
        
        // Browser Pool System - Store browsers only, create pages on-demand
        this.browserPools = {
            spain: [],
            italy: []
        };
        
        this.maxBrowsersPerCountry = 3;
        this.checkInterval = 15000; // Keep fast 15-second checking!
        
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

    async start() {
        if (this.isRunning) {
            throw new Error('Monitor is already running');
        }

        console.log('🚀 Starting visa monitoring with browser rotation system...');
        this.isRunning = true;
        this.startTime = new Date();

        const activeApplications = await this.db.getActiveApplications();
        
        if (activeApplications.length === 0) {
            throw new Error('No active applications to monitor');
        }

        const spainApps = activeApplications.filter(app => app.country === 'spain');
        const italyApps = activeApplications.filter(app => app.country === 'italy');

        // Initialize browser pools
        if (spainApps.length > 0) {
            await this.initializeBrowserPool('spain');
        }
        if (italyApps.length > 0) {
            await this.initializeBrowserPool('italy');
        }

        // Start fast monitoring loop
        this.startMonitoringLoop();

        console.log(`✅ Fast monitoring started with browser rotation!`);
        console.log(`🇪🇸 Spain: ${spainApps.length} applications (${this.browserPools.spain.length} browsers)`);
        console.log(`🇮🇹 Italy: ${italyApps.length} applications (${this.browserPools.italy.length} browsers)`);
        console.log(`⚡ Check interval: ${this.checkInterval/1000} seconds (FAST!)`);
    }

    async stop() {
        if (!this.isRunning) return;

        console.log('🛑 Stopping visa monitoring...');
        this.isRunning = false;

        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        // Close all browser pools
        for (const country in this.browserPools) {
            const pool = this.browserPools[country];
            for (const browserInstance of pool) {
                try {
                    await browserInstance.browser.close();
                    console.log(`✅ Closed browser ${browserInstance.index + 1} for ${country}`);
                } catch (error) {
                    console.error(`Error closing browser:`, error);
                }
            }
            this.browserPools[country] = [];
        }

        console.log('✅ All browser pools closed');
    }

    // Create browser pool - only browsers, no pages stored
    async initializeBrowserPool(country) {
        console.log(`🌐 Creating browser pool for ${country} (${this.maxBrowsersPerCountry} browsers)...`);
        
        for (let i = 0; i < this.maxBrowsersPerCountry; i++) {
            try {
                const browser = await this.createStealthBrowser(i);
                
                this.browserPools[country].push({
                    browser: browser,
                    country: country,
                    index: i,
                    lastUsed: 0,
                    rateLimited: false,
                    rateLimitedUntil: 0
                });
                
                console.log(`✅ Browser ${i + 1} ready for ${country}`);
                
                // Small delay between browser creation
                await this.delay(2000);
                
            } catch (error) {
                console.error(`❌ Failed to create browser ${i} for ${country}:`, error);
            }
        }
    }

    async createStealthBrowser(index) {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];

        const viewports = [
            { width: 1366, height: 768 },
            { width: 1920, height: 1080 },
            { width: 1440, height: 900 },
            { width: 1536, height: 864 }
        ];

        const viewport = viewports[index % viewports.length];
        const userAgent = userAgents[index % userAgents.length];

        console.log(`🔧 Creating browser ${index + 1} with ${viewport.width}x${viewport.height}...`);

        const browser = await puppeteer.launch({
            headless: false, // Keep false for CAPTCHA handling
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                `--window-size=${viewport.width},${viewport.height}`,
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--no-first-run',
                '--disable-default-apps',
                '--disable-extensions',
                `--user-agent=${userAgent}`,
                '--incognito',
                `--user-data-dir=/tmp/chrome-${index}-${Date.now()}` // Separate data directory
            ],
            defaultViewport: viewport,
            ignoreDefaultArgs: ['--enable-automation']
        });

        return browser;
    }

    // Create fresh page for each request
    async createFreshPage(browserInstance, index) {
        try {
            const page = await browserInstance.browser.newPage();
            
            // Configure page fingerprint
            await this.configureBrowserFingerprint(page, index);
            
            return page;
        } catch (error) {
            console.error(`❌ Failed to create page for browser ${index + 1}:`, error);
            throw error;
        }
    }

    async configureBrowserFingerprint(page, index) {
        // Different timezone per browser
        const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];
        const timezone = timezones[index % timezones.length];
        
        try {
            await page.emulateTimezone(timezone);
        } catch (e) {
            console.log(`Could not set timezone for browser ${index + 1}`);
        }

        // Enhanced stealth configuration
        await page.evaluateOnNewDocument((index) => {
            // Remove webdriver traces
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            
            // Different platform per browser
            const platforms = ['Win32', 'MacIntel', 'Linux x86_64'];
            Object.defineProperty(navigator, 'platform', { 
                get: () => platforms[index % platforms.length]
            });
            
            // Different hardware concurrency
            const cores = [4, 8, 12, 16];
            Object.defineProperty(navigator, 'hardwareConcurrency', { 
                get: () => cores[index % cores.length]
            });
            
        }, index);

        // Set different request headers per browser
        const languages = ['en-US,en;q=0.9', 'en-GB,en;q=0.9', 'en-CA,en;q=0.9'];
        await page.setExtraHTTPHeaders({
            'Accept-Language': languages[index % languages.length],
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        // Set request interception for faster loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            
            // Block unnecessary resources
            if (resourceType === 'stylesheet' || 
                resourceType === 'font' || 
                resourceType === 'image' ||
                resourceType === 'media') {
                req.abort();
            } else {
                req.continue();
            }
        });
    }

    // Get next available browser from pool
    getNextBrowser(country) {
        const pool = this.browserPools[country];
        if (!pool || pool.length === 0) {
            console.log(`❌ No browser pool available for ${country}`);
            return null;
        }

        // Filter out rate limited browsers (check if cooldown period passed)
        const now = Date.now();
        const availableBrowsers = pool.filter(b => {
            if (!b.rateLimited) return true;
            
            // Check if cooldown period (10 minutes) has passed
            const cooldownPeriod = 10 * 60 * 1000; // 10 minutes
            if (now - b.rateLimitedUntil > cooldownPeriod) {
                b.rateLimited = false;
                b.rateLimitedUntil = 0;
                console.log(`✅ Browser ${b.index + 1} for ${country} cooldown expired - available again`);
                return true;
            }
            
            return false;
        });
        
        if (availableBrowsers.length === 0) {
            console.log(`⏳ All browsers for ${country} are rate limited, using least recently limited`);
            // Return the browser that was rate limited longest ago
            pool.sort((a, b) => a.rateLimitedUntil - b.rateLimitedUntil);
            return pool[0];
        }

        // Sort by last used time and return least recently used
        availableBrowsers.sort((a, b) => a.lastUsed - b.lastUsed);
        const browser = availableBrowsers[0];
        browser.lastUsed = now;
        
        console.log(`🔄 Using browser ${browser.index + 1} for ${country}`);
        return browser;
    }

    // Mark browser as rate limited
    markBrowserRateLimited(country, browserIndex) {
        const pool = this.browserPools[country];
        const browser = pool.find(b => b.index === browserIndex);
        
        if (browser) {
            browser.rateLimited = true;
            browser.rateLimitedUntil = Date.now();
            console.log(`❄️ Browser ${browserIndex + 1} for ${country} marked as rate limited (10min cooldown)`);
            
            this.db.logActivity(null, country, 'BROWSER_RATE_LIMITED', 
                `Browser ${browserIndex + 1} rate limited - switching to next browser`);
        }
    }

    startMonitoringLoop() {
        // KEEP FAST CHECKING - 15 seconds!
        console.log(`⚡ Starting fast monitoring loop (${this.checkInterval/1000} seconds)`);
        
        this.monitorInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                const activeApps = await this.db.getActiveApplications();
                const spainApps = activeApps.filter(app => app.country === 'spain');
                const italyApps = activeApps.filter(app => app.country === 'italy');

                // Process with browser rotation (keep fast!)
                if (spainApps.length > 0) {
                    setTimeout(() => this.processCountryApplicationsWithRotation('spain', spainApps), 0);
                }

                if (italyApps.length > 0) {
                    // Short stagger to avoid conflicts
                    setTimeout(() => this.processCountryApplicationsWithRotation('italy', italyApps), 3000);
                }

            } catch (error) {
                console.error('Error in monitoring loop:', error);
                this.db.logActivity(null, 'system', 'MONITORING_ERROR', error.message);
            }
        }, this.checkInterval); // Keep 15 seconds!
    }

    async processCountryApplicationsWithRotation(country, applications) {
        console.log(`🔄 Processing ${applications.length} ${country} applications with browser rotation...`);

        for (const app of applications) {
            try {
                // Get next available browser
                const browserInstance = this.getNextBrowser(country);
                
                if (!browserInstance) {
                    console.log(`⚠️ No available browsers for ${country}, skipping...`);
                    continue;
                }

                await this.processApplicationWithBrowser(country, app, browserInstance);
                await this.db.incrementAttempts(app.id);
                
                // Short delay between apps (keep fast!)
                await this.delay(1000);

            } catch (error) {
                console.error(`❌ Error processing application ${app.id}:`, error);
                this.db.logActivity(app.id, country, 'PROCESSING_ERROR', error.message);
            }
        }

        this.lastActivity = new Date();
    }

    async processApplicationWithBrowser(country, application, browserInstance) {
        const config = this.countryConfigs[country];
        
        // CREATE FRESH PAGE FOR EACH REQUEST - This fixes the detached frame issue
        let page = null;
        
        try {
            console.log(`📋 Processing ${config.name} application for ${application.first_name} ${application.last_name} (Browser ${browserInstance.index + 1})`);
            
            // Create fresh page for this request
            page = await this.createFreshPage(browserInstance, browserInstance.index);
            
            // Use the fresh page for this check
            await this.loginToSite(page, country, application);
            await this.delay(1000);
            
            const slotsFound = await this.checkAppointmentSlots(page, country, application);
            
            if (slotsFound) {
                console.log(`🎯 SLOTS FOUND for ${config.name} using Browser ${browserInstance.index + 1}!`);
                
                await this.db.incrementSlotsFound(application.id);
                this.stats[country].slotsFound++;
                
                this.db.logActivity(application.id, country, 'SLOTS_FOUND', 
                    `${application.visa_type} visa slots found using browser ${browserInstance.index + 1}`);
                
                this.sendNotification(application, country, 'slots_found');
                
                if (application.auto_book) {
                    await this.delay(2000);
                    const bookingSuccess = await this.attemptBooking(page, country, application);
                    
                    if (bookingSuccess) {
                        await this.db.markCompleted(application.id, 'booking_successful');
                        this.stats[country].bookings++;
                        
                        this.db.logActivity(application.id, country, 'BOOKING_SUCCESS', 
                            `Appointment booked successfully using browser ${browserInstance.index + 1}`);
                        
                        this.sendNotification(application, country, 'booking_success');
                    }
                }
            }
            
            this.stats[country].checks++;

        } catch (error) {
            // Check for rate limiting
            if (error.message.includes('Too Many Requests') || 
                error.message.includes('rate limit') ||
                (page && page.url && page.url().includes('too-many-requests'))) {
                
                console.log(`⚠️ Rate limit detected on browser ${browserInstance.index + 1} for ${country}`);
                this.markBrowserRateLimited(country, browserInstance.index);
                
                // Don't throw error - just switch to next browser
                return;
            }
            
            // Log other errors but don't crash
            console.error(`❌ Error in browser ${browserInstance.index + 1} for ${country}:`, error.message);
            
        } finally {
            // ALWAYS close the page to prevent detached frame issues
            if (page) {
                try {
                    await page.close();
                } catch (e) {
                    console.log(`Could not close page for browser ${browserInstance.index + 1}`);
                }
            }
        }
    }

    async loginToSite(page, country, application) {
        const config = this.countryConfigs[country];
        
        try {
            console.log(`🔐 Logging into ${config.name}...`);
            
            await page.goto(config.loginUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Check for rate limiting page immediately
            const content = await page.content();
            if (content.includes('Too Many Requests') || 
                content.includes('rate limit') ||
                content.includes('unusual traffic')) {
                throw new Error('Too Many Requests detected on login page');
            }
            
            await this.delay(1000 + Math.random() * 2000);
            
            // Fill login form
            await page.waitForSelector(config.selectors.email, { timeout: 10000 });
            await this.humanType(page, config.selectors.email, application.site_email);
            
            await this.delay(500 + Math.random() * 1000);
            
            await page.waitForSelector(config.selectors.password, { timeout: 5000 });
            await this.humanType(page, config.selectors.password, application.site_password);
            
            // Check for CAPTCHA
            const captcha = await page.$(config.selectors.captcha);
            if (captcha) {
                console.log(`⚠️ CAPTCHA detected for ${config.name} - please solve manually`);
                
                await page.waitForFunction(() => {
                    const captchaElement = document.querySelector('.g-recaptcha, .captcha');
                    return !captchaElement || captchaElement.style.display === 'none';
                }, { timeout: 60000 });
            }
            
            await this.delay(500 + Math.random() * 1000);
            
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
            await page.goto(config.appointmentUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
            
            // Check for rate limiting
            const content = await page.content();
            if (content.includes('Too Many Requests') || 
                content.includes('rate limit') ||
                content.includes('unusual traffic')) {
                throw new Error('Too Many Requests detected on appointment page');
            }
            
            await this.delay(2000 + Math.random() * 2000);
            
            // Select visa type if dropdown exists
            const visaDropdown = await page.$(config.selectors.visaTypeDropdown);
            if (visaDropdown) {
                try {
                    await page.select(config.selectors.visaTypeDropdown, application.visa_type);
                    await this.delay(1000 + Math.random() * 1000);
                } catch (e) {
                    console.log(`Could not select visa type for ${country}`);
                }
            }
            
            // Select center if dropdown exists
            if (application.preferred_center) {
                const centerDropdown = await page.$(config.selectors.centerDropdown);
                if (centerDropdown) {
                    try {
                        await page.select(config.selectors.centerDropdown, application.preferred_center);
                        await this.delay(1000 + Math.random() * 1000);
                    } catch (e) {
                        console.log(`Could not select center for ${country}`);
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
            
            return slotsAvailable;

        } catch (error) {
            console.error(`Error checking slots for ${country}:`, error);
            throw error;
        }
    }

    async attemptBooking(page, country, application) {
        const config = this.countryConfigs[country];
        
        try {
            console.log(`🤖 Attempting to book appointment for ${config.name}...`);
            
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
                    
                    console.log(`✅ Successfully booked appointment for ${config.name}!`);
                    return true;
                    
                } catch (confirmationError) {
                    console.log(`⚠️ Could not confirm booking for ${config.name}`);
                    return false;
                }
            } else {
                console.log(`⚠️ Could not find booking button for ${config.name}`);
                return false;
            }

        } catch (error) {
            console.error(`❌ Booking failed for ${config.name}:`, error);
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
                await this.delay(300 + Math.random() * 500);
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
            message = `${application.visa_type.toUpperCase()} visa appointment slots are now available for ${application.first_name} ${application.last_name}`;
        } else if (eventType === 'booking_success') {
            title = `${config.flag} ${config.name.toUpperCase()} BOOKING SUCCESS!`;
            message = `Successfully booked ${application.visa_type} visa appointment for ${application.first_name} ${application.last_name}`;
        }

        notifier.notify({
            title: title,
            message: message,
            sound: true,
            wait: false,
            timeout: 10
        });

        console.log(`🔔 ${title} - ${message}`);
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
        return Object.keys(this.browserPools).filter(country => 
            this.browserPools[country] && this.browserPools[country].length > 0
        );
    }

    getLastActivity() {
        return this.lastActivity;
    }
}

module.exports = VisaMonitor;