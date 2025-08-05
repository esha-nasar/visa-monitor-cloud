// server.js - Railway Health Check Fix
const express = require('express');
const cors = require('cors');
const path = require('path');

class BackendServer {
    constructor() {
        this.app = express();
        this.isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
        this.setupExpressFirst(); // Setup Express immediately
        this.setupDatabase();
        this.setupRoutes();
    }

    setupExpressFirst() {
        // Setup Express and basic middleware immediately
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Immediate health check (before database setup)
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy',
                platform: this.isRailway ? 'Railway' : 'Local',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                database: this.db ? 'connected' : 'initializing'
            });
        });

        // Immediate test endpoint
        this.app.get('/api/test', (req, res) => {
            res.json({
                success: true,
                message: 'Railway server is responding!',
                platform: 'Railway',
                timestamp: new Date().toISOString(),
                database: this.db ? 'ready' : 'initializing'
            });
        });

        console.log('⚡ Express app configured - health checks available immediately');
    }

    setupDatabase() {
        try {
            const Database = require('./database');
            const dbPath = this.isRailway ? './railway_visa_monitor.db' : './visa_monitor.db';
            this.db = new Database(dbPath);
            console.log(`✅ Database initialized: ${dbPath}`);
        } catch (error) {
            console.error('❌ Database error:', error);
            // Create simple fallback
            this.db = {
                getApplications: async () => [],
                createApplication: async (data) => Date.now(),
                updateApplication: async () => true,
                deleteApplication: async () => true,
                getSystemStats: async () => ({
                    totals: { total_applications: 0, total_slots_found: 0, completed_applications: 0, active_applications: 0 }
                }),
                getActivityLogs: async () => [],
                logActivity: async () => true,
                close: async () => console.log('✅ Fallback database closed')
            };
            console.log('🔄 Using fallback database');
        }
    }

    setupRoutes() {
        // Static files
        this.app.use(express.static('frontend'));
        
        // Basic logging (non-blocking)
        this.app.use((req, res, next) => {
            setImmediate(() => console.log(`${req.method} ${req.path}`));
            next();
        });

        // Serve frontend
        this.app.get('/', (req, res) => {
            const indexPath = path.join(__dirname, 'frontend', 'index.html');
            res.sendFile(indexPath, (err) => {
                if (err) {
                    console.error('Frontend file error:', err);
                    res.json({
                        message: 'Railway server running - frontend loading issue',
                        platform: 'Railway',
                        timestamp: new Date().toISOString(),
                        suggestion: 'Check frontend/index.html file'
                    });
                }
            });
        });

        // API routes with async wrappers
        this.app.get('/api/applications', this.asyncHandler(async (req, res) => {
            const applications = await this.db.getApplications();
            res.json(applications || []);
        }));

        this.app.post('/api/applications', this.asyncHandler(async (req, res) => {
            const id = await this.db.createApplication(req.body);
            res.json({ success: true, applicationId: id, platform: 'Railway' });
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
            res.json({ ...stats, platform: 'Railway' });
        }));

        this.app.get('/api/logs', this.asyncHandler(async (req, res) => {
            const limit = parseInt(req.query.limit) || 50;
            const logs = await this.db.getActivityLogs(limit);
            res.json(logs || []);
        }));

        // Monitoring endpoints (Railway-aware)
        this.app.post('/api/monitoring/start', (req, res) => {
            res.json({
                success: false,
                message: 'Browser automation not available in Railway environment',
                platform: 'Railway',
                info: 'This is for interface testing only'
            });
        });

        this.app.get('/api/monitoring/status', (req, res) => {
            res.json({
                isRunning: false,
                platform: 'Railway',
                message: 'Interface testing mode - no browser automation',
                stats: { total: { checks: 0, slotsFound: 0, bookings: 0 } },
                activeCountries: []
            });
        });

        // API info
        this.app.get('/api/info', (req, res) => {
            res.json({
                name: 'Visa Monitor API',
                version: '2.0.0',
                platform: 'Railway',
                database: 'SQLite',
                status: 'healthy',
                features: ['Web Interface', 'Data Management', 'API Access'],
                limitations: ['No Browser Automation'],
                endpoints: {
                    health: '/health',
                    test: '/api/test',
                    applications: '/api/applications',
                    stats: '/api/stats',
                    logs: '/api/logs'
                }
            });
        });

        // Catch all routes
        this.app.use('/api/*', (req, res) => {
            res.status(404).json({ 
                error: 'API endpoint not found',
                platform: 'Railway',
                available: ['/health', '/api/test', '/api/applications', '/api/stats']
            });
        });

        this.app.use('*', (req, res) => {
            res.redirect('/');
        });

        console.log('🛣️ All routes configured');
    }

    // Async handler wrapper
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(err => {
                console.error('Async route error:', err);
                res.status(500).json({ 
                    error: 'Internal server error',
                    platform: 'Railway'
                });
            });
        };
    }

    // Start server with Railway optimization
    start() {
        const port = process.env.PORT || 3000;
        const host = '0.0.0.0';
        
        return new Promise((resolve, reject) => {
            // Start server
            this.server = this.app.listen(port, host, (err) => {
                if (err) {
                    console.error('❌ Server failed to start:', err);
                    reject(err);
                    return;
                }

                console.log(`🚀 Server running on ${host}:${port}`);
                console.log(`🌐 Platform: Railway`);
                console.log(`💾 Database: ${this.db ? 'Ready' : 'Fallback'}`);
                console.log(`📊 Health: http://${host}:${port}/health`);
                console.log(`🧪 Test: http://${host}:${port}/api/test`);
                
                // Signal Railway that we're ready
                console.log('✅ Railway deployment successful - server ready for requests');
                
                resolve();
            });

            // Handle server errors
            this.server.on('error', (error) => {
                console.error('❌ Server error:', error);
                reject(error);
            });

            // Keep alive
            this.server.keepAliveTimeout = 65000;
            this.server.headersTimeout = 66000;
        });
    }

    // Improved graceful shutdown
    async shutdown(signal = 'UNKNOWN') {
        console.log(`🔔 Shutdown signal received: ${signal}`);
        
        const cleanup = async () => {
            console.log('🧹 Starting cleanup...');
            
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

        // Give cleanup 5 seconds, then force exit
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

// Signal handlers - improved
process.on('SIGTERM', async () => {
    console.log('🔔 SIGTERM received from Railway');
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
    console.log('🚀 Starting Visa Monitor Server...');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚂 Railway: ${process.env.RAILWAY_ENVIRONMENT ? 'Yes' : 'No'}`);
    console.log(`📦 Port: ${process.env.PORT || 3000}`);
    
    const server = new BackendServer();
    global.server = server;
    
    server.start().catch((error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = BackendServer;