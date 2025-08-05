// server.js - Railway Optimized
const express = require('express');
const cors = require('cors');
const path = require('path');

// Railway environment detection
const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
const isProduction = process.env.NODE_ENV === 'production' || isRailway;

// Database selection based on environment
let Database;
if (isRailway || isProduction) {
    console.log('🚂 Railway environment detected - using SQLite database');
    Database = require('./database');
} else {
    console.log('💻 Local environment - using SQLite database');
    Database = require('./database');
}

class BackendServer {
    constructor() {
        this.app = express();
        this.isRailway = isRailway;
        this.isProduction = isProduction;
        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupDatabase() {
        try {
            // Railway persistent storage path
            const dbPath = this.isRailway 
                ? path.join(process.cwd(), 'data', 'visa_monitor.db')
                : './visa_monitor.db';
            
            // Create data directory if it doesn't exist (Railway)
            if (this.isRailway) {
                const fs = require('fs');
                const dataDir = path.dirname(dbPath);
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                    console.log(`✅ Created data directory: ${dataDir}`);
                }
            }
            
            this.db = new Database(dbPath);
            console.log(`💾 Database initialized: ${dbPath}`);
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            // Fallback to current directory
            this.db = new Database('./visa_monitor.db');
        }
    }

    setupMiddleware() {
        // Enable trust proxy for Railway
        if (this.isRailway) {
            this.app.set('trust proxy', 1);
        }

        this.app.use(cors({
            origin: this.isProduction ? true : 'http://localhost:3000',
            credentials: true
        }));
        
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Serve static files
        this.app.use(express.static('frontend'));
        
        // Security headers
        this.app.use((req, res, next) => {
            res.header('X-Powered-By', 'Visa Monitor - Railway');
            res.header('X-Content-Type-Options', 'nosniff');
            res.header('X-Frame-Options', 'DENY');
            res.header('X-XSS-Protection', '1; mode=block');
            
            // Railway-specific headers
            if (this.isRailway) {
                res.header('X-Environment', 'Railway');
            }
            
            next();
        });

        // Request logging (only in development)
        if (!this.isProduction) {
            this.app.use((req, res, next) => {
                console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
                next();
            });
        }

        // API middleware
        this.app.use('/api', (req, res, next) => {
            res.setHeader('Content-Type', 'application/json');
            next();
        });
    }

    setupRoutes() {
        // Health check with Railway info
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy',
                environment: this.isRailway ? 'railway' : 'local',
                database: 'sqlite',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                railway: {
                    detected: this.isRailway,
                    environment: process.env.RAILWAY_ENVIRONMENT || 'none',
                    service: process.env.RAILWAY_SERVICE_NAME || 'unknown'
                }
            });
        });

        // Railway-specific info endpoint
        this.app.get('/api/railway-info', (req, res) => {
            res.json({
                platform: 'Railway',
                environment: process.env.RAILWAY_ENVIRONMENT || 'unknown',
                service: process.env.RAILWAY_SERVICE_NAME || 'visa-monitor',
                region: process.env.RAILWAY_REGION || 'unknown',
                deployment: process.env.RAILWAY_DEPLOYMENT_ID || 'unknown',
                features: {
                    persistentStorage: true,
                    sqliteSupport: true,
                    browserAutomation: true, // Possible but challenging
                    fileSystem: true
                }
            });
        });

        // Serve frontend
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
        });

        // API Routes
        this.setupApiRoutes();

        // Error handling
        this.setupErrorHandlers();
    }

    setupApiRoutes() {
        // Application management routes
        this.app.post('/api/applications', this.wrapAsync(this.createApplication.bind(this)));
        this.app.get('/api/applications', this.wrapAsync(this.getApplications.bind(this)));
        this.app.put('/api/applications/:id', this.wrapAsync(this.updateApplication.bind(this)));
        this.app.delete('/api/applications/:id', this.wrapAsync(this.deleteApplication.bind(this)));

        // Monitoring control routes (Railway-aware)
        this.app.post('/api/monitoring/start', this.wrapAsync(this.startMonitoring.bind(this)));
        this.app.post('/api/monitoring/stop', this.wrapAsync(this.stopMonitoring.bind(this)));
        this.app.get('/api/monitoring/status', this.wrapAsync(this.getMonitoringStatus.bind(this)));

        // System information routes
        this.app.get('/api/stats', this.wrapAsync(this.getStats.bind(this)));
        this.app.get('/api/logs', this.wrapAsync(this.getLogs.bind(this)));

        // API info endpoint
        this.app.get('/api/info', (req, res) => {
            res.json({
                name: 'Visa Monitor API',
                version: '2.0.0',
                description: 'Railway-optimized visa appointment monitoring',
                platform: this.isRailway ? 'Railway' : 'Local',
                database: 'SQLite',
                features: {
                    persistentStorage: true,
                    browserAutomation: this.isRailway ? 'limited' : 'full',
                    realTimeMonitoring: !this.isRailway // Desktop only for now
                },
                endpoints: {
                    health: '/health',
                    railwayInfo: '/api/railway-info',
                    applications: '/api/applications',
                    monitoring: '/api/monitoring/*',
                    stats: '/api/stats',
                    logs: '/api/logs'
                }
            });
        });
    }

    // Async wrapper for better error handling
    wrapAsync(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    // Application CRUD operations (same as before but with better error handling)
    async createApplication(req, res) {
        try {
            const applicationData = {
                country: req.body.country,
                visa_type: req.body.visa_type,
                first_name: req.body.first_name,
                last_name: req.body.last_name,
                email: req.body.email,
                phone: req.body.phone,
                passport_number: req.body.passport_number,
                date_of_birth: req.body.date_of_birth,
                nationality: req.body.nationality,
                address: req.body.address,
                preferred_center: req.body.preferred_center,
                site_email: req.body.site_email,
                site_password: req.body.site_password,
                priority: req.body.priority || 1,
                auto_book: req.body.auto_book !== false
            };

            const applicationId = await this.db.createApplication(applicationData);
            
            res.json({
                success: true,
                message: 'Application created successfully',
                applicationId: applicationId,
                platform: this.isRailway ? 'Railway' : 'Local'
            });

        } catch (error) {
            console.error('Error creating application:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create application',
                details: this.isProduction ? undefined : error.message
            });
        }
    }

    async getApplications(req, res) {
        try {
            const applications = await this.db.getApplications();
            res.json(applications || []);
        } catch (error) {
            console.error('Error fetching applications:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch applications',
                applications: []
            });
        }
    }

    async updateApplication(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            await this.db.updateApplication(id, updates);
            
            res.json({
                success: true,
                message: 'Application updated successfully'
            });

        } catch (error) {
            console.error('Error updating application:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update application'
            });
        }
    }

    async deleteApplication(req, res) {
        try {
            const { id } = req.params;
            
            await this.db.deleteApplication(id);
            
            res.json({
                success: true,
                message: 'Application deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting application:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete application'
            });
        }
    }

    // Monitoring control (Railway-aware)
    async startMonitoring(req, res) {
        if (this.isRailway) {
            res.json({
                success: false,
                message: 'Browser automation is limited in Railway cloud environment',
                info: 'Railway supports the feature but requires careful configuration. Use desktop version for full monitoring capabilities.',
                platform: 'Railway',
                recommendation: 'Consider hybrid setup: Railway for management, Desktop for monitoring'
            });
        } else {
            // Local environment - full monitoring available
            try {
                if (!this.monitor) {
                    const VisaMonitor = require('./visa-monitor');
                    this.monitor = new VisaMonitor(this.db);
                }

                if (this.monitor.isRunning) {
                    return res.json({
                        success: false,
                        message: 'Monitoring is already running'
                    });
                }

                await this.monitor.start();
                
                res.json({
                    success: true,
                    message: 'Monitoring started successfully',
                    platform: 'Local'
                });

            } catch (error) {
                console.error('Error starting monitoring:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    }

    async stopMonitoring(req, res) {
        if (this.isRailway) {
            res.json({
                success: true,
                message: 'No monitoring to stop in Railway environment',
                platform: 'Railway'
            });
        } else {
            try {
                if (!this.monitor || !this.monitor.isRunning) {
                    return res.json({
                        success: false,
                        message: 'Monitoring is not currently running'
                    });
                }

                await this.monitor.stop();
                
                res.json({
                    success: true,
                    message: 'Monitoring stopped successfully',
                    platform: 'Local'
                });

            } catch (error) {
                console.error('Error stopping monitoring:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    }

    async getMonitoringStatus(req, res) {
        const baseStatus = {
            platform: this.isRailway ? 'Railway' : 'Local',
            databaseType: 'SQLite',
            persistentStorage: true
        };

        if (this.isRailway) {
            res.json({
                ...baseStatus,
                isRunning: false,
                message: 'Browser automation limited in Railway cloud environment',
                capabilities: {
                    webInterface: true,
                    dataManagement: true,
                    browserAutomation: false,
                    persistentStorage: true
                },
                stats: { total: { checks: 0, slotsFound: 0, bookings: 0 } },
                activeCountries: []
            });
        } else {
            const status = {
                ...baseStatus,
                isRunning: this.monitor ? this.monitor.isRunning : false,
                capabilities: {
                    webInterface: true,
                    dataManagement: true,
                    browserAutomation: true,
                    persistentStorage: true
                }
            };

            if (this.monitor) {
                status.stats = this.monitor.getStats();
                status.activeCountries = this.monitor.getActiveCountries();
                status.lastActivity = this.monitor.getLastActivity();
                status.startTime = this.monitor.startTime;
            }

            res.json(status);
        }
    }

    // System information
    async getStats(req, res) {
        try {
            const stats = await this.db.getSystemStats();
            res.json({
                ...stats,
                platform: this.isRailway ? 'Railway' : 'Local',
                serverUptime: process.uptime(),
                databaseType: 'SQLite'
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch statistics',
                totals: {
                    total_applications: 0,
                    total_slots_found: 0,
                    completed_applications: 0,
                    active_applications: 0
                }
            });
        }
    }

    async getLogs(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const logs = await this.db.getActivityLogs(limit);
            res.json(logs || []);
        } catch (error) {
            console.error('Error fetching logs:', error);
            res.status(500).json([]);
        }
    }

    setupErrorHandlers() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error('Global error handler:', error);
            
            if (req.path.startsWith('/api/')) {
                return res.status(500).json({
                    success: false,
                    error: this.isProduction ? 'Internal server error' : error.message,
                    platform: this.isRailway ? 'Railway' : 'Local'
                });
            }
            
            res.redirect('/');
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            if (req.path.startsWith('/api/')) {
                return res.status(404).json({ 
                    success: false,
                    error: 'API endpoint not found',
                    platform: this.isRailway ? 'Railway' : 'Local'
                });
            }
            res.redirect('/');
        });
    }

    // Start the server
    start(port = process.env.PORT || 3000) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, '0.0.0.0', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`🚀 Visa Monitor Server`);
                    console.log(`🌐 Port: ${port}`);
                    console.log(`🚂 Platform: ${this.isRailway ? 'Railway' : 'Local'}`);
                    console.log(`💾 Database: SQLite ${this.isRailway ? '(Persistent)' : '(Local)'}`);
                    console.log(`🤖 Browser Automation: ${this.isRailway ? 'Limited' : 'Full'}`);
                    
                    if (this.isRailway) {
                        console.log(`📊 Railway Service: ${process.env.RAILWAY_SERVICE_NAME || 'visa-monitor'}`);
                        console.log(`🌍 Railway Region: ${process.env.RAILWAY_REGION || 'unknown'}`);
                    }
                    
                    resolve();
                }
            });
        });
    }

    // Graceful shutdown
    async shutdown() {
        console.log('🛑 Shutting down server...');
        
        if (this.monitor && this.monitor.isRunning) {
            await this.monitor.stop();
        }
        
        if (this.db) {
            await this.db.close();
        }
        
        if (this.server) {
            this.server.close();
        }
        
        console.log('✅ Server shutdown complete');
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    if (global.server) {
        await global.server.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    if (global.server) {
        await global.server.shutdown();
    }
    process.exit(0);
});

// Start server
if (require.main === module) {
    const server = new BackendServer();
    global.server = server;
    
    server.start().catch(console.error);
}

module.exports = BackendServer;