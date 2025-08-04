// server.js - Cloud Ready Version
const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('./database');
const VisaMonitor = require('./visa-monitor');

class BackendServer {
    constructor() {
        this.app = express();
        this.db = new Database();
        this.monitor = new VisaMonitor(this.db);
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('frontend'));
        
        // Cloud deployment headers
        this.app.use((req, res, next) => {
            res.header('X-Powered-By', 'Visa Monitor Cloud');
            next();
        });
    }

    setupRoutes() {
        // Health check for cloud platforms
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                monitoring: this.monitor.isRunning
            });
        });

        // Serve frontend
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
        });

        // Application management routes
        this.app.post('/api/applications', this.createApplication.bind(this));
        this.app.get('/api/applications', this.getApplications.bind(this));
        this.app.put('/api/applications/:id', this.updateApplication.bind(this));
        this.app.delete('/api/applications/:id', this.deleteApplication.bind(this));

        // Monitoring control routes
        this.app.post('/api/monitoring/start', this.startMonitoring.bind(this));
        this.app.post('/api/monitoring/stop', this.stopMonitoring.bind(this));
        this.app.get('/api/monitoring/status', this.getMonitoringStatus.bind(this));

        // System information routes
        this.app.get('/api/stats', this.getStats.bind(this));
        this.app.get('/api/logs', this.getLogs.bind(this));

        // API info endpoint
        this.app.get('/api/info', (req, res) => {
            res.json({
                name: 'Visa Monitor API',
                version: '1.0.0',
                description: 'Cloud-based visa appointment monitoring',
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
            res.redirect('/');
        });
    }

    // Application CRUD operations (keep your existing methods)
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

    // Monitoring control (Note: Limited browser automation in cloud)
    async startMonitoring(req, res) {
        try {
            // In cloud environment, browsers might not work properly
            // This is a limitation for Puppeteer in cloud deployments
            res.json({
                success: false,
                message: 'Browser automation not available in cloud environment. Please use desktop version for monitoring.',
                info: 'Cloud version is for application management only.'
            });

        } catch (error) {
            console.error('Error starting monitoring:', error);
            res.status(500).json({
                success: false,
                error: 'Monitoring not available in cloud environment'
            });
        }
    }

    async stopMonitoring(req, res) {
        try {
            res.json({
                success: true,
                message: 'No monitoring to stop in cloud environment'
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to stop monitoring'
            });
        }
    }

    getMonitoringStatus(req, res) {
        const status = {
            isRunning: false,
            cloudMode: true,
            message: 'Browser automation not available in cloud. Use desktop version for monitoring.',
            stats: { total: { checks: 0, slotsFound: 0, bookings: 0 } },
            activeCountries: [],
            lastActivity: null
        };

        res.json(status);
    }

    // System information
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
                    console.log(`🚀 Cloud server running on port ${port}`);
                    console.log(`🌐 Access at: http://localhost:${port}`);
                    console.log(`☁️ Cloud mode: Browser automation disabled`);
                    resolve();
                }
            });
        });
    }

    // Graceful shutdown
    async shutdown() {
        console.log('🛑 Shutting down cloud server...');
        
        if (this.monitor && this.monitor.isRunning) {
            await this.monitor.stop();
        }
        
        if (this.db) {
            await this.db.close();
        }
        
        if (this.server) {
            this.server.close();
        }
        
        console.log('✅ Cloud server shutdown complete');
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