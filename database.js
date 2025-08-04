// database.js - Database Module (Complete Fixed Version)
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor(dbPath = './visa_monitor.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.init();
    }

    init() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('❌ Database connection failed:', err);
            } else {
                console.log('✅ Connected to SQLite database');
                this.createTables();
            }
        });
    }

    createTables() {
        // Use serialize to ensure tables are created in sequence
        this.db.serialize(() => {
            // Applications table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    country TEXT NOT NULL,
                    visa_type TEXT NOT NULL,
                    
                    -- Personal Information
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    passport_number TEXT NOT NULL,
                    date_of_birth DATE NOT NULL,
                    nationality TEXT NOT NULL,
                    address TEXT,
                    
                    -- Application Details
                    preferred_center TEXT,
                    preferred_date DATE,
                    purpose_of_visit TEXT,
                    duration_of_stay TEXT,
                    
                    -- Visa Site Credentials
                    site_email TEXT NOT NULL,
                    site_password TEXT NOT NULL,
                    
                    -- Settings
                    priority INTEGER DEFAULT 1,
                    auto_book BOOLEAN DEFAULT 1,
                    status TEXT DEFAULT 'active',
                    
                    -- Tracking
                    attempts INTEGER DEFAULT 0,
                    slots_found INTEGER DEFAULT 0,
                    last_check DATETIME,
                    booking_result TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME
                )
            `, (err) => {
                if (err) console.error('Error creating applications table:', err);
                else console.log('✅ Applications table ready');
            });

            // Activity logs table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS activity_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    application_id INTEGER,
                    country TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (application_id) REFERENCES applications (id)
                )
            `, (err) => {
                if (err) console.error('Error creating activity_logs table:', err);
                else console.log('✅ Activity logs table ready');
            });

            // System settings table - THEN insert default settings
            this.db.run(`
                CREATE TABLE IF NOT EXISTS system_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    setting_key TEXT UNIQUE NOT NULL,
                    setting_value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating system_settings table:', err);
                } else {
                    console.log('✅ System settings table ready');
                    // Only insert default settings AFTER table is created
                    this.insertDefaultSettings();
                }
            });
        });
    }

    insertDefaultSettings() {
        const defaultSettings = [
            ['check_interval', '15'],
            ['max_concurrent_applications', '10'],
            ['spain_enabled', 'true'],
            ['italy_enabled', 'true'],
            ['auto_restart_on_error', 'true'],
            ['notification_enabled', 'true']
        ];

        defaultSettings.forEach(([key, value]) => {
            this.db.run(
                'INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
                [key, value],
                (err) => {
                    if (err) {
                        console.error(`Error inserting setting ${key}:`, err);
                    }
                }
            );
        });
        console.log('✅ Default settings initialized');
    }

    // Application CRUD operations
    createApplication(data) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO applications (
                    country, visa_type, first_name, last_name, email, phone,
                    passport_number, date_of_birth, nationality, address,
                    preferred_center, site_email, site_password, priority, auto_book
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(sql, [
                data.country, data.visa_type, data.first_name, data.last_name,
                data.email, data.phone, data.passport_number, data.date_of_birth,
                data.nationality, data.address, data.preferred_center,
                data.site_email, data.site_password, data.priority, data.auto_book
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    getApplications() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM applications ORDER BY priority DESC, created_at DESC',
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    getApplicationById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM applications WHERE id = ?',
                [id],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    getActiveApplications(country = null) {
        return new Promise((resolve, reject) => {
            let sql = 'SELECT * FROM applications WHERE status = "active"';
            const params = [];

            if (country) {
                sql += ' AND country = ?';
                params.push(country);
            }

            sql += ' ORDER BY priority DESC, created_at ASC';

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    updateApplication(id, updates) {
        return new Promise((resolve, reject) => {
            const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
            const updateValues = Object.values(updates);
            updateValues.push(id);

            const sql = `UPDATE applications SET ${updateFields} WHERE id = ?`;

            this.db.run(sql, updateValues, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    deleteApplication(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM applications WHERE id = ?',
                [id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    // Update application tracking info
    incrementAttempts(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE applications SET attempts = attempts + 1, last_check = CURRENT_TIMESTAMP WHERE id = ?',
                [id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    incrementSlotsFound(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE applications SET slots_found = slots_found + 1 WHERE id = ?',
                [id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    markCompleted(id, result) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE applications SET status = "completed", completed_at = CURRENT_TIMESTAMP, booking_result = ? WHERE id = ?',
                [result, id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    markFailed(id, reason) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE applications SET status = "failed", booking_result = ? WHERE id = ?',
                [reason, id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // Activity logging
    logActivity(applicationId, country, action, details) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO activity_logs (application_id, country, action, details) VALUES (?, ?, ?, ?)',
                [applicationId, country, action, details],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    getActivityLogs(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT al.*, a.first_name, a.last_name, a.visa_type 
                 FROM activity_logs al 
                 LEFT JOIN applications a ON al.application_id = a.id 
                 ORDER BY al.timestamp DESC LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    // System statistics
    getSystemStats() {
        return new Promise((resolve, reject) => {
            Promise.all([
                this.getApplicationCountByStatus(),
                this.getApplicationCountByCountry(),
                this.getTotalStats()
            ]).then(([statusCounts, countryCounts, totals]) => {
                resolve({
                    statusCounts,
                    countryCounts,
                    totals
                });
            }).catch(reject);
        });
    }

    getApplicationCountByStatus() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT status, COUNT(*) as count FROM applications GROUP BY status',
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    getApplicationCountByCountry() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT country, COUNT(*) as count FROM applications GROUP BY country',
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    getTotalStats() {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT 
                    COUNT(*) as total_applications,
                    SUM(attempts) as total_attempts,
                    SUM(slots_found) as total_slots_found,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_applications,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_applications
                 FROM applications`,
                [],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    // Settings management
    getSetting(key) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT setting_value FROM system_settings WHERE setting_key = ?',
                [key],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row ? row.setting_value : null);
                    }
                }
            );
        });
    }

    setSetting(key, value) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                [key, value],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // Database maintenance
    vacuum() {
        return new Promise((resolve, reject) => {
            this.db.run('VACUUM', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    backup(backupPath) {
        return new Promise((resolve, reject) => {
            const fs = require('fs');
            const readStream = fs.createReadStream(this.dbPath);
            const writeStream = fs.createWriteStream(backupPath);

            readStream.on('error', reject);
            writeStream.on('error', reject);
            writeStream.on('close', resolve);

            readStream.pipe(writeStream);
        });
    }

    // Close database connection
    close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('✅ Database connection closed');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = Database;