const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup (allow path override via DB_PATH env var)
const DB_PATH = process.env.DB_PATH || './tickets.db';
const db = new sqlite3.Database(DB_PATH);

// Create tickets table
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        reason TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Generate unique ticket ID
function generateTicketId() {
    return 'TKT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// API Routes

// Submit new ticket
app.post('/api/tickets', (req, res) => {
    const { name, email, reason, priority, note } = req.body;
    const ticketId = generateTicketId();
    
    const sql = `INSERT INTO tickets (ticket_id, name, email, reason, priority, status, note) 
                 VALUES (?, ?, ?, ?, ?, 'new', ?)`;
    
    db.run(sql, [ticketId, name, email, reason, priority, note], function(err) {
        if (err) {
            console.error('Error creating ticket:', err);
            return res.status(500).json({ error: 'Failed to create ticket' });
        }
        
        const ticket = {
            id: this.lastID,
            ticket_id: ticketId,
            name,
            email,
            reason,
            priority,
            status: 'new',
            note,
            created_at: new Date().toISOString()
        };
        
        // Emit real-time notification
        io.emit('newTicket', ticket);
        
        res.json({ success: true, ticket });
    });
});

// Get all tickets
app.get('/api/tickets', (req, res) => {
    const { priority, status, reason, search } = req.query;
    
    let sql = 'SELECT * FROM tickets';
    let params = [];
    let conditions = [];
    
    if (priority) {
        conditions.push('priority = ?');
        params.push(priority);
    }
    
    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }
    
    if (reason) {
        conditions.push('reason LIKE ?');
        params.push(`%${reason}%`);
    }
    
    if (search) {
        conditions.push('(name LIKE ? OR email LIKE ? OR reason LIKE ? OR note LIKE ?)');
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY created_at DESC';
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Error fetching tickets:', err);
            return res.status(500).json({ error: 'Failed to fetch tickets' });
        }
        res.json(rows);
    });
});

// Update ticket status
app.put('/api/tickets/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const sql = 'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    db.run(sql, [status, id], function(err) {
        if (err) {
            console.error('Error updating ticket:', err);
            return res.status(500).json({ error: 'Failed to update ticket' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        // Emit real-time update
        io.emit('ticketUpdated', { id, status });
        
        res.json({ success: true });
    });
});

// Get ticket statistics
app.get('/api/stats', (req, res) => {
    const queries = [
        'SELECT COUNT(*) as total FROM tickets',
        'SELECT COUNT(*) as urgent FROM tickets WHERE priority = "urgent"',
        'SELECT COUNT(*) as new FROM tickets WHERE status = "new"',
        'SELECT COUNT(*) as today FROM tickets WHERE DATE(created_at) = DATE("now")'
    ];
    
    Promise.all(queries.map(query => 
        new Promise((resolve, reject) => {
            db.get(query, (err, row) => {
                if (err) reject(err);
                else resolve(Object.values(row)[0]);
            });
        })
    )).then(([total, urgent, newTickets, today]) => {
        res.json({ total, urgent, new: newTickets, today });
    }).catch(err => {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/submit', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'submit-ticket.html'));
});

app.get('/view', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view-tickets.html'));
});

// Health check (useful for hosting platforms and load balancers)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', db: DB_PATH });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Support Portal running on http://localhost:${PORT}`);
    console.log(`Create requests: http://localhost:${PORT}/submit`);
    console.log(`Dashboard: http://localhost:${PORT}/view`);
    console.log(`Main portal: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});
