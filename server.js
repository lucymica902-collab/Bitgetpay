const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURATION ---
const TRC20_WALLET_ADDRESS = "TRjGbgMkRbbhzdjXU1QMCN4AM1BrtfnG5B"; 
const ADMIN_USERNAME = "bitpay00@";
const ADMIN_PASSWORD = "Bitpay@02"; 

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: 'bitgetpay_super_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// JSON File Database Setup
const dbFile = path.join(__dirname, 'database.json');
if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify([]));
}

function getTransactions() {
    try {
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveTransactions(txs) {
    fs.writeFileSync(dbFile, JSON.stringify(txs, null, 2));
}

// File Upload Setup (Multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
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

    let txs = getTransactions();
    const newTx = {
        id: txs.length > 0 ? txs[0].id + 1 : 1,
        username,
        amount,
        txid,
        screenshot,
        status: 'Pending',
        date
    };

    txs.unshift(newTx);
    saveTransactions(txs);
    res.redirect('/?success=1');
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
    const txs = getTransactions();
    res.render('admin', { transactions: txs });
});

app.post('/admin/verify/:id', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin-login');
    const txId = parseInt(req.params.id);

    let txs = getTransactions();
    let tx = txs.find(t => t.id === txId);
    if (tx) {
        tx.status = 'Approved & Verified';
        saveTransactions(txs);
    }
    res.redirect('/admin-panel');
});

app.post('/admin/reject/:id', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin-login');
    const txId = parseInt(req.params.id);

    let txs = getTransactions();
    let tx = txs.find(t => t.id === txId);
    if (tx) {
        tx.status = 'Rejected';
        saveTransactions(txs);
    }
    res.redirect('/admin-panel');
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
