// server.js - Railway Port Fix
const express = require('express');
const cors = require('cors');
const path = require('path');

class BackendServer {
    constructor() {
        this.app = express();
        this.isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupDatabase() {
        try {
            // Simple database path for Railway
            const Database = require('./database');
            const dbPath = this.isRailway ? './railway_visa_monitor.db' : './visa_monitor.db';
            this.db = new Database(dbPath);
            console.log(`✅ Database initialized: ${dbPath}`);
        } catch (error) {
            console.error('❌ Database error:', error);
            // Create fallback mock database if SQLite fails
            console.log('🔄 Falling back to in-memory storage...');
            this.db = this.createFallbackDatabase();
        }
    }

    createFallbackDatabase() {
        // Simple in-memory fallback
        return {
            applications: [],
            getApplications: async () => [],
            createApplication: async (data) => {
                const id = Date.now();
                this.db.applications.push({ id, ...data });
                return id;
            },
            updateApplication: async (id, data) => true,
            deleteApplication: async (id) => true,
            getSystemStats: async () => ({
                totals: { total_applications: 0, total_slots_found: 0, completed_applications: 0, active_applications: 0 }
            }),
            getActivityLogs: async () => [],
            logActivity: async () => true,
            close: async () => console.log('✅ Fallback database closed')
        };
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use(express.static('frontend'));
        
        // Basic logging
        this.app.use((req, res, next) => {
            console.log(`${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy',
                platform: this.isRailway ? 'Railway' : 'Local',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                port: process.env.PORT || 3000,
                environment: process.env.NODE_ENV || 'development'
            });
        });

        // Simple test endpoint
        this.app.get('/api/test', (req, res) => {
            res.json({
                success: true,
                message: 'Railway deployment is working!',
                platform: 'Railway',
                timestamp: new Date().toISOString()
            });
        });

        // Serve frontend
        this.app.get('/', (req, res) => {
            const indexPath = path.join(__dirname, 'frontend', 'index.html');
            res.sendFile(indexPath, (err) => {
                if (err) {
                    console.error('Frontend file error:', err);
                    res.json({
                        message: 'Railway deployment working - frontend file issue',
                        error: err.message,
                        suggestion: 'Check if frontend/index.html exists'
                    });
                }
            });
        });

        // Basic API routes
        this.app.get('/api/applications', async (req, res) => {
            try {
                const applications = await this.db.getApplications();
                res.json(applications || []);
            } catch (error) {
                console.error('API error:', error);
                res.json([]);
            }
        });

        this.app.post('/api/applications', async (req, res) => {
            try {
                const id = await this.db.createApplication(req.body);
                res.json({ success: true, applicationId: id });
            } catch (error) {
                console.error('Create application error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.db.getSystemStats();
                res.json(stats);
            } catch (error) {
                console.error('Stats error:', error);
                res.json({
                    totals: { total_applications: 0, total_slots_found: 0, completed_applications: 0, active_applications: 0 }
                });
            }
        });

        // Monitoring endpoints (simplified for Railway)
        this.app.post('/api/monitoring/start', (req, res) => {
            res.json({
                success: false,
                message: 'Browser automation not available in Railway cloud environment',
                platform: 'Railway',
                recommendation: 'Use desktop version for actual monitoring'
            });
        });

        this.app.get('/api/monitoring/status', (req, res) => {
            res.json({
                isRunning: false,
                platform: 'Railway',
                message: 'Monitoring not available in cloud - interface testing only',
                stats: { total: { checks: 0, slotsFound: 0, bookings: 0 } }
            });
        });

        // Catch all
        this.app.use('*', (req, res) => {
            if (req.path.startsWith('/api/')) {
                return res.status(404).json({ error: 'API endpoint not found' });
            }
            res.redirect('/');
        });
    }

    // CRITICAL: Proper Railway port binding
    start() {
        const port = process.env.PORT || 3000;
        const host = '0.0.0.0'; // IMPORTANT: Railway requires 0.0.0.0
        
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, host, (err) => {
                if (err) {
                    console.error('❌ Server failed to start:', err);
                    reject(err);
                } else {
                    console.log(`🚀 Server running on ${host}:${port}`);
                    console.log(`🌐 Platform: ${this.isRailway ? 'Railway' : 'Local'}`);
                    console.log(`📊 Health check: http://${host}:${port}/health`);
                    console.log(`🧪 Test endpoint: http://${host}:${port}/api/test`);
                    resolve();
                }
            });
        });
    }

    // Graceful shutdown
    async shutdown() {
        console.log('🛑 Shutting down gracefully...');
        
        if (this.db && this.db.close) {
            await this.db.close();
        }
        
        if (this.server) {
            this.server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
    console.log('🔔 SIGTERM received');
    if (global.server) {
        await global.server.shutdown();
    } else {
        process.exit(0);
    }
});

process.on('SIGINT', async () => {
    console.log('🔔 SIGINT received');
    if (global.server) {
        await global.server.shutdown();
    } else {
        process.exit(0);
    }
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start server
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