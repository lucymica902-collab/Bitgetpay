const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();

// --- CONFIGURATION ---
const TRC20_WALLET_ADDRESS = "TRjGbgMkRbbhzdjXU1QMCN4AM1BrtfnG5B"; 
const ADMIN_USERNAME = "bitpay00@";
const ADMIN_PASSWORD = "Bitpay@02"; 

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.set('view engine', 'ejs');

app.use(session({
    secret: 'bitgetpay_super_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Database Connection & Table Creation
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Database opening error: ', err.message);
    else console.log('Connected to SQLite Database.');
});

db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    amount TEXT,
    txid TEXT,
    screenshot TEXT,
    status TEXT DEFAULT 'Pending',
    date TEXT
)`);

// File Upload Setup (Multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- USER ROUTES ---
app.get('/', (req, res) => {
    res.render('index', { wallet: TRC20_WALLET_ADDRESS, success: req.query.success });
});

app.post('/submit-payment', upload.single('screenshot'), (req, res) => {
    const { username, txid, amount } = req.body;
    const screenshot = req.file ? req.file.filename : '';
    const date = new Date().toLocaleString();

    const query = `INSERT INTO transactions (username, amount, txid, screenshot, date) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [username, amount, txid, screenshot, date], (err) => {
        if (err) {
            console.error(err.message);
            return res.send("Error saving transaction!");
        }
        res.redirect('/?success=1');
    });
});

// --- ADMIN ROUTES ---
app.get('/admin-login', (req, res) => {
    res.render('login', { error: req.query.error });
});

app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin-panel');
    } else {
        res.redirect('/admin-login?error=1');
    }
});

app.get('/admin-panel', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin-login');

    db.all(`SELECT * FROM transactions ORDER BY id DESC`, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.send("Database error");
        }
        res.render('admin', { transactions: rows });
    });
});

app.post('/admin/verify/:id', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin-login');
    const txId = req.params.id;

    db.run(`UPDATE transactions SET status = 'Approved & Verified' WHERE id = ?`, [txId], (err) => {
        res.redirect('/admin-panel');
    });
});

app.post('/admin/reject/:id', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin-login');
    const txId = req.params.id;

    db.run(`UPDATE transactions SET status = 'Rejected' WHERE id = ?`, [txId], (err) => {
        res.redirect('/admin-panel');
    });
});

app.get('/admin-logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin-login');
});

// Server Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`BitGetPay Server is running on port ${PORT}`);
});
