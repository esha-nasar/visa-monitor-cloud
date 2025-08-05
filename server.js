// server.js - Using Original VisaMonitor (Universal)
const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('./database');
const VisaMonitor = require('./visa-monitor'); // Using your original file

class BackendServer {
    constructor() {
        this.app = express();
        this.isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
        this.isRender = process.env.RENDER !== undefined;
        this.isCloud = this.isRailway || this.isRender || process.env.NODE_ENV === 'production';
        
        this.setupExpressFirst();
        this.setupDatabase();
        this.setupMonitor();
        this.setupRoutes();
    }

    setupExpressFirst() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Immediate health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy',
                platform: this.getPlatform(),
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                monitoring: this.monitor ? 'ready' : 'initializing',
                browserAutomation: 'universal'
            });
        });

        this.app.get('/api/test', (req, res) => {
            res.json({
                success: true,
                message: 'Universal monitoring server ready!',
                platform: this.getPlatform(),
                timestamp: new Date().toISOString(),
                features: ['Web Interface', 'Database', 'Universal Browser Automation']
            });
        });

        console.log('⚡ Express configured with immediate health checks');
    }

    getPlatform() {
        if (this.isRender) return 'Render';
        if (this.isRailway) return 'Railway';
        if (this.isCloud) return 'Cloud';
        return 'Local';
    }

    setupDatabase() {
        try {
            const dbPath = this.isCloud ? './cloud_visa_monitor.db' : './visa_monitor.db';
            this.db = new Database(dbPath);
            console.log(`✅ Database initialized: ${dbPath}`);
        } catch (error) {
            console.error('❌ Database error:', error);
            throw error;
        }
    }

    setupMonitor() {
        try {
            this.monitor = new VisaMonitor(this.db); // Using your original monitor
            console.log(`✅ Universal visa monitoring system initialized for ${this.getPlatform()}`);
        } catch (error) {
            console.error('❌ Monitor initialization error:', error);
            throw error;
        }
    }

    setupRoutes() {
        this.app.use(express.static('frontend'));
        
        this.app.use((req, res, next) => {
            setImmediate(() => console.log(`${req.method} ${req.path}`));
            next();
        });

        // Serve frontend
        this.app.get('/', (req, res) => {
            const indexPath = path.join(__dirname, 'frontend', 'index.html');
            res.sendFile(indexPath, (err) => {
                if (err) {
                    res.json({
                        message: 'Server running - frontend loading issue',
                        platform: this.getPlatform(),
                        suggestion: 'Check frontend/index.html file'
                    });
                }
            });
        });

        // API routes
        this.app.get('/api/applications', this.asyncHandler(async (req, res) => {
            const applications = await this.db.getApplications();
            res.json(applications || []);
        }));

        this.app.post('/api/applications', this.asyncHandler(async (req, res) => {
            const id = await this.db.createApplication(req.body);
            res.json({ 
                success: true, 
                applicationId: id, 
                platform: this.getPlatform(),
                message: 'Application created - ready for universal monitoring'
            });
        }));

        this.app.put('/api/applications/:id', this.asyncHandler(async (req, res) => {
            await this.db.updateApplication(req.params.id, req.body);
            res.json({ success: true, message: 'Application updated' });
        }));

        this.app.delete('/api/applications/:id', this.asyncHandler(async (req, res) => {
            await this.db.deleteApplication(req.params.id);
            res.json({ success: true, message: 'Application deleted' });
        }));

        this.app.get('/api/stats', this.asyncHandler(async (req, res) => {
            const stats = await this.db.getSystemStats();
            res.json({ ...stats, platform: this.getPlatform() });
        }));

        this.app.get('/api/logs', this.asyncHandler(async (req, res) => {
            const limit = parseInt(req.query.limit) || 50;
            const logs = await this.db.getActivityLogs(limit);
            res.json(logs || []);
        }));

        // Universal monitoring endpoints
        this.app.post('/api/monitoring/start', this.asyncHandler(async (req, res) => {
            try {
                if (this.monitor.isRunning) {
                    return res.json({
                        success: false,
                        message: 'Monitoring is already running'
                    });
                }

                console.log(`🚀 Starting universal monitoring on ${this.getPlatform()}...`);
                await this.monitor.start();
                
                res.json({
                    success: true,
                    message: 'Universal monitoring started successfully!',
                    platform: this.getPlatform(),
                    mode: this.isCloud ? 'Cloud (Headless)' : 'Local (Visible)',
                    features: ['Browser Automation', 'Slot Detection', 'Auto-booking'],
                    info: `Optimized for ${this.getPlatform()} environment`
                });

                await this.db.logActivity(null, 'system', 'MONITORING_STARTED', 
                    `Universal visa monitoring started on ${this.getPlatform()}`);

            } catch (error) {
                console.error('Error starting monitoring:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    platform: this.getPlatform(),
                    suggestion: 'Check server logs for browser automation issues'
                });
            }
        }));

        this.app.post('/api/monitoring/stop', this.asyncHandler(async (req, res) => {
            try {
                if (!this.monitor.isRunning) {
                    return res.json({
                        success: false,
                        message: 'Monitoring is not currently running'
                    });
                }

                await this.monitor.stop();
                
                res.json({
                    success: true,
                    message: 'Universal monitoring stopped successfully',
                    platform: this.getPlatform()
                });

                await this.db.logActivity(null, 'system', 'MONITORING_STOPPED', 
                    `Universal visa monitoring stopped on ${this.getPlatform()}`);

            } catch (error) {
                console.error('Error stopping monitoring:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }));

        this.app.get('/api/monitoring/status', (req, res) => {
            const status = {
                isRunning: this.monitor.isRunning,
                platform: this.getPlatform(),
                browserAutomation: this.isCloud ? 'Headless Cloud Browsers' : 'Visible Local Browsers',
                environment: this.monitor.getEnvironment ? this.monitor.getEnvironment() : this.getPlatform(),
                capabilities: {
                    slotDetection: true,
                    autoBooking: true,
                    multiCountry: true,
                    universalBrowsers: true,
                    desktopNotifications: !this.isCloud
                },
                stats: this.monitor.getStats(),
                activeCountries: this.monitor.getActiveCountries(),
                lastActivity: this.monitor.getLastActivity(),
                startTime: this.monitor.startTime,
                browserPool: this.monitor.browserPool ? this.monitor.browserPool.length : 0
            };

            res.json(status);
        });

        // API info
        this.app.get('/api/info', (req, res) => {
            res.json({
                name: 'Visa Monitor API',
                version: '3.0.0 - Universal Edition',
                platform: this.getPlatform(),
                database: 'SQLite',
                monitoring: 'Universal Browser Automation',
                features: [
                    'Web Dashboard',
                    'Real Database',
                    'Universal Browser Automation',
                    'Cloud + Local Support',
                    'Visa Slot Detection',
                    'Auto-booking',
                    'Multi-country Support',
                    'Browser Pool Management'
                ],
                environments: {
                    cloud: 'Headless browsers, optimized intervals',
                    local: 'Visible browsers, fast intervals, desktop notifications'
                },
                endpoints: {
                    health: '/health',
                    test: '/api/test',
                    applications: '/api/applications',
                    monitoring: '/api/monitoring/*',
                    stats: '/api/stats',
                    logs: '/api/logs'
                }
            });
        });

        // Error handlers
        this.app.use('/api/*', (req, res) => {
            res.status(404).json({ 
                error: 'API endpoint not found',
                platform: this.getPlatform()
            });
        });

        this.app.use('*', (req, res) => {
            res.redirect('/');
        });

        console.log('🛣️ All routes configured with universal monitoring support');
    }

    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(err => {
                console.error('Async route error:', err);
                res.status(500).json({ 
                    error: 'Internal server error',
                    platform: this.getPlatform()
                });
            });
        };
    }

    start() {
        const port = process.env.PORT || 3000;
        const host = '0.0.0.0';
        
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, host, (err) => {
                if (err) {
                    console.error('❌ Server failed to start:', err);
                    reject(err);
                    return;
                }

                console.log(`🚀 Universal Visa Monitor Server running on ${host}:${port}`);
                console.log(`🌐 Platform: ${this.getPlatform()}`);
                console.log(`💾 Database: SQLite (Universal)`);
                console.log(`🤖 Monitoring: Universal Browser Automation`);
                console.log(`🎯 Mode: ${this.isCloud ? 'Cloud (Headless)' : 'Local (Visible)'}`);
                console.log(`🌍 Environment: ${this.monitor.getEnvironment ? this.monitor.getEnvironment() : this.getPlatform()}`);
                console.log(`📊 Health: http://${host}:${port}/health`);
                console.log(`✅ Ready for universal monitoring!`);
                
                resolve();
            });

            this.server.on('error', (error) => {
                console.error('❌ Server error:', error);
                reject(error);
            });

            this.server.keepAliveTimeout = 65000;
            this.server.headersTimeout = 66000;
        });
    }

    async shutdown(signal = 'UNKNOWN') {
        console.log(`🔔 Shutdown signal received: ${signal}`);
        
        const cleanup = async () => {
            console.log('🧹 Starting cleanup...');
            
            if (this.monitor && this.monitor.isRunning) {
                try {
                    await this.monitor.stop();
                    console.log('✅ Monitor stopped');
                } catch (err) {
                    console.error('❌ Monitor stop error:', err);
                }
            }
            
            if (this.db && this.db.close) {
                try {
                    await this.db.close();
                    console.log('✅ Database closed');
                } catch (err) {
                    console.error('❌ Database close error:', err);
                }
            }
            
            if (this.server) {
                try {
                    await new Promise((resolve, reject) => {
                        this.server.close((err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    console.log('✅ Server closed');
                } catch (err) {
                    console.error('❌ Server close error:', err);
                }
            }
            
            console.log('✅ Cleanup completed');
        };

        const cleanupTimeout = setTimeout(() => {
            console.log('⏰ Cleanup timeout - forcing exit');
            process.exit(0);
        }, 5000);

        try {
            await cleanup();
            clearTimeout(cleanupTimeout);
            process.exit(0);
        } catch (error) {
            console.error('❌ Cleanup error:', error);
            clearTimeout(cleanupTimeout);
            process.exit(1);
        }
    }
}

// Signal handlers
process.on('SIGTERM', async () => {
    console.log('🔔 SIGTERM received from cloud platform');
    if (global.server) {
        await global.server.shutdown('SIGTERM');
    } else {
        console.log('🔄 No server instance - exiting immediately');
        process.exit(0);
    }
});

process.on('SIGINT', async () => {
    console.log('🔔 SIGINT received');
    if (global.server) {
        await global.server.shutdown('SIGINT');
    } else {
        process.exit(0);
    }
});

// Error handlers
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    if (global.server) {
        global.server.shutdown('UNCAUGHT_EXCEPTION');
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
    if (global.server) {
        global.server.shutdown('UNHANDLED_REJECTION');
    } else {
        process.exit(1);
    }
});

// Start application
if (require.main === module) {
    console.log('🚀 Starting Universal Visa Monitor Server...');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`☁️ Platform: Auto-detected cloud/local`);
    console.log(`📦 Port: ${process.env.PORT || 3000}`);
    console.log(`🤖 Browser Automation: Universal (Cloud + Local)`);
    
    const server = new BackendServer();
    global.server = server;
    
    server.start().catch((error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = BackendServer;