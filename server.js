// Add this to your server.js - Better error handling for API routes

// Add this middleware BEFORE your API routes
app.use('/api', (req, res, next) => {
    // Ensure all API responses are JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Override res.send to ensure JSON responses
    const originalSend = res.send;
    res.send = function(data) {
        if (typeof data === 'string' && !data.startsWith('{') && !data.startsWith('[')) {
            // If sending plain text, wrap in JSON
            data = JSON.stringify({ message: data });
        }
        return originalSend.call(this, data);
    };
    
    next();
});

// Better error handler for API routes
app.use('/api', (error, req, res, next) => {
    console.error('API Error:', error);
    
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
        path: req.path,
        method: req.method
    });
});

// Update your existing route handlers with try-catch
app.get('/api/applications', async (req, res) => {
    try {
        const applications = await this.db.getApplications();
        res.json(applications || []);
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch applications',
            details: error.message
        });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const stats = await this.db.getSystemStats();
        res.json({
            ...stats,
            cloudMode: this.isCloudMode,
            serverUptime: process.uptime()
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
});

// Add a test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working correctly',
        timestamp: new Date().toISOString(),
        cloudMode: process.env.CLOUD_MODE === 'true'
    });
});