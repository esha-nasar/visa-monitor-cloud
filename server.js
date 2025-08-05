// server.js - Railway Version (Uses Original Database)
const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('./database'); // ✅ Your original database
const VisaMonitor = require('./visa-monitor'); // ✅ Your original monitor

class BackendServer {
    constructor() {
        this.app = express();
        this.isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
        this.db = new Database(); // ✅ Use your original database as-is
        this.monitor = new VisaMonitor(this.db); // ✅ Use your original monitor
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('frontend')); // ✅ Serve your original frontend
        
        // Simple logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                platform: this.isRailway ? 'Railway' : 'Local',
                database: 'Original SQLite',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // Serve frontend
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
        });

        // ✅ Use all your original API routes
        this.app.post('/api/applications', this.createApplication.bind(this));
        this.app.get('/api/applications', this.getApplications.bind(this));
        this.app.put('/api/applications/:id', this.updateApplication.bind(this));
        this.app.delete('/api/applications/:id', this.deleteApplication.bind(this));

        // ✅ Use your original monitoring routes
        this.app.post('/api/monitoring/start', this.startMonitoring.bind(this));
        this.app.post('/api/monitoring/stop', this.stopMonitoring.bind(this));
        this.app.get('/api/monitoring/status', this.getMonitoringStatus.bind(this));

        // ✅ Use your original system routes
        this.app.get('/api/stats', this.getStats.bind(this));
        this.app.get('/api/logs', this.getLogs.bind(this));

        // API info endpoint
        this.app.get('/api/info', (req, res) => {
            res.json({
                name: 'Visa Monitor API',
                version: '1.0.0',
                description: 'Original visa appointment monitoring system',
                platform: this.isRailway ? 'Railway' : 'Local',
                database: 'Original SQLite Database',
                monitoring: 'Original VisaMonitor System',
                endpoints: {
                    health: '/health',
                    dashboard: '/',
                    applications: '/api/applications',
                    monitoring: '/api/monitoring/*',
                    stats: '/api/stats',
                    logs: '/api/logs'
                }
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            if (req.path.startsWith('/api/')) {
                return res.status(404).json({ error: 'API endpoint not found' });
            }
            res.redirect('/');
        });
    }

    // ✅ Your original application methods (keep exactly as they were)
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
                auto_book: req.body.auto_book !== false,
                status: 'active'
            };

            const applicationId = await this.db.createApplication(applicationData);
            
            res.json({
                success: true,
                message: 'Application created successfully',
                applicationId: applicationId
            });

            this.db.logActivity(applicationId, applicationData.country, 'APPLICATION_CREATED', 
                `New ${applicationData.visa_type} visa application created`);

        } catch (error) {
            console.error('Error creating application:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create application'
            });
        }
    }

    async getApplications(req, res) {
        try {
            const applications = await this.db.getApplications();
            res.json(applications);
        } catch (error) {
            console.error('Error fetching applications:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch applications'
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

            this.db.logActivity(id, updates.country || 'unknown', 'APPLICATION_UPDATED', 
                'Application details updated');

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
            
            const app = await this.db.getApplicationById(id);
            await this.db.deleteApplication(id);
            
            res.json({
                success: true,
                message: 'Application deleted successfully'
            });

            if (app) {
                this.db.logActivity(id, app.country, 'APPLICATION_DELETED', 
                    `${app.visa_type} visa application deleted`);
            }

        } catch (error) {
            console.error('Error deleting application:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete application'
            });
        }
    }

    // ✅ Your original monitoring methods
    async startMonitoring(req, res) {
        try {
            if (this.monitor.isRunning) {
                return res.json({
                    success: false,
                    message: 'Monitoring is already running'
                });
            }

            if (this.isRailway) {
                // Note about Railway limitations but still try to start
                console.warn('⚠️ Starting monitoring on Railway - browser automation may be limited');
            }

            await this.monitor.start();
            
            res.json({
                success: true,
                message: 'Monitoring started successfully',
                platform: this.isRailway ? 'Railway (Limited)' : 'Local (Full)'
            });

            this.db.logActivity(null, 'system', 'MONITORING_STARTED', 
                'Visa monitoring system started');

        } catch (error) {
            console.error('Error starting monitoring:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                note: this.isRailway ? 'Browser automation limited on Railway' : undefined
            });
        }
    }

    async stopMonitoring(req, res) {
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
                message: 'Monitoring stopped successfully'
            });

            this.db.logActivity(null, 'system', 'MONITORING_STOPPED', 
                'Visa monitoring system stopped');

        } catch (error) {
            console.error('Error stopping monitoring:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    getMonitoringStatus(req, res) {
        const status = {
            isRunning: this.monitor.isRunning,
            platform: this.isRailway ? 'Railway' : 'Local',
            browserAutomation: this.isRailway ? 'Limited (Cloud)' : 'Full (Local)',
            stats: this.monitor.getStats(),
            activeCountries: this.monitor.getActiveCountries(),
            lastActivity: this.monitor.getLastActivity(),
            startTime: this.monitor.startTime
        };

        if (this.isRailway && this.monitor.isRunning) {
            status.note = 'Browser automation may be limited in Railway cloud environment';
        }

        res.json(status);
    }

    // ✅ Your original system methods
    async getStats(req, res) {
        try {
            const stats = await this.db.getSystemStats();
            res.json(stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch statistics'
            });
        }
    }

    async getLogs(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const logs = await this.db.getActivityLogs(limit);
            res.json(logs);
        } catch (error) {
            console.error('Error fetching logs:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch logs'
            });
        }
    }

    // Start the server
    start(port = process.env.PORT || 3000) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, '0.0.0.0', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`🚀 Visa Monitor Server running on port ${port}`);
                    console.log(`🌐 Platform: ${this.isRailway ? 'Railway' : 'Local'}`);
                    console.log(`💾 Database: Original SQLite (${this.db.dbPath})`);
                    console.log(`🤖 Monitoring: Original VisaMonitor System`);
                    console.log(`📱 Frontend: Original Dashboard`);
                    
                    if (this.isRailway) {
                        console.log(`⚠️ Note: Browser automation may be limited in Railway cloud environment`);
                        console.log(`✅ All other features (database, API, dashboard) work fully`);
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