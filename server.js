const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// --- ADMIN & DEFAULT CONFIG ---
const ADMIN_USERNAME = "bitpay00@";
const ADMIN_PASSWORD = "Bitpay@02";

const settingsFile = path.join(__dirname, 'settings.json');
if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({
        trc_address: "TRjGbgMkRbbhzdjXU1QMCN4AM1BrtfnG5B",
        usdt_rate: "108.12",
        bonus_ratio: "2"
    }, null, 2));
}

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: 'bitgetpay_secret_key_2026',
    resave: false,
    saveUninitialized: true
}));

// Ensure directories and database files exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

const dbFile = path.join(__dirname, 'database.json');
if (!fs.existsSync(dbFile)) { fs.writeFileSync(dbFile, JSON.stringify([])); }

const usersFile = path.join(__dirname, 'users.json');
if (!fs.existsSync(usersFile)) { fs.writeFileSync(usersFile, JSON.stringify([])); }

// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// Helper Functions
function getSettings() {
    try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch (e) { return {}; }
}
function saveSettings(settings) {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

function getUsers() {
    try { return JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch (e) { return []; }
}
function saveUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function getTransactions() {
    try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch (e) { return []; }
}
function saveTransactions(txs) {
    fs.writeFileSync(dbFile, JSON.stringify(txs, null, 2));
}


// --- USER AUTHENTICATION & PAGES ---

// Register with Mobile Number & Referral
app.get('/register', (req, res) => {
    const ref = req.query.ref || '';
    res.render('register', { error: null, ref });
});

app.post('/register', (req, res) => {
    const { phone, password, referral_code } = req.body;
    let users = getUsers();

    if (users.find(u => u.phone === phone)) {
        return res.render('register', { error: 'Phone number already registered!', ref: '' });
    }

    const myReferralCode = 'BP' + Math.floor(100000 + Math.random() * 900000);
    const newUser = {
        id: Date.now(),
        phone,
        password,
        balance: 0.00,
        today_received: 0.00,
        topup_bonus: 0.00,
        team_commission: 0.00,
        referral_code: myReferralCode,
        referred_by: referral_code || '',
        upi: '',
        bank_details: '',
        qr_code: '',
        digital_rupee: ''
    };

    // Give referral bonus logic if referred by someone
    if (referral_code) {
        let referrer = users.find(u => u.referral_code === referral_code);
        if (referrer) {
            referrer.team_commission += 10; // Default invite bonus
        }
    }

    users.push(newUser);
    saveUsers(users);
    res.redirect('/login');
});

// Login via Phone
app.get('/login', (req, res) => {
    res.render('user-login', { error: null });
});

app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    let users = getUsers();
    const user = users.find(u => u.phone === phone && u.password === password);

    if (user) {
        req.session.user = user;
        res.redirect('/');
    } else {
        res.render('user-login', { error: 'Invalid phone number or password' });
    }
});

app.get('/logout', (req, res) => {
    req.session.user = null;
    res.redirect('/login');
});

// Home Dashboard
app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let users = getUsers();
    // Refresh session user data
    req.session.user = users.find(u => u.id === req.session.user.id) || req.session.user;
    res.render('index', { user: req.session.user });
});

// Deposit Page
app.get('/deposit', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const settings = getSettings();
    const success = req.query.success === 'true';
    res.render('deposit', { user: req.session.user, settings, success });
});

app.post('/submit-deposit', upload.single('screenshot'), (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { amount, txid } = req.body;
    const screenshot = req.file ? req.file.filename : '';

    let txs = getTransactions();
    txs.unshift({
        id: Date.now(),
        phone: req.session.user.phone,
        amount,
        txid,
        screenshot,
        date: new Date().toLocaleString(),
        status: 'Pending'
    });
    saveTransactions(txs);
    res.redirect('/deposit?success=true');
});

// VIP Level Page
app.get('/vip', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('vip', { user: req.session.user });
});

// Team Page
app.get('/team', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let users = getUsers();
    const myTeam = users.filter(u => u.referred_by === req.session.user.referral_code);
    res.render('team', { user: req.session.user, myTeam });
});

// Profile / Me / Payout Page (UPI, QR, Bank, Digital Rupee)
app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const success = req.query.success === 'true';
    res.render('profile', { user: req.session.user, success });
});

app.post('/profile', upload.single('qr_code'), (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let users = getUsers();
    let index = users.findIndex(u => u.id === req.session.user.id);

    if (index !== -1) {
        users[index].upi = req.body.upi || users[index].upi;
        users[index].digital_rupee = req.body.digital_rupee || users[index].digital_rupee;
        users[index].bank_details = req.body.bank_details || users[index].bank_details;
        if (req.file) users[index].qr_code = req.file.filename;
        saveUsers(users);
        req.session.user = users[index];
    }
    res.redirect('/profile?success=true');
});


// --- ADMIN PANEL ROUTES ---

app.get('/admin-login', (req, res) => {
    res.render('admin-login', { error: false });
});

app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.admin = true;
        res.redirect('/admin');
    } else {
        res.render('admin-login', { error: true });
    }
});

app.get('/admin', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    const transactions = getTransactions();
    const users = getUsers();
    const settings = getSettings();
    res.render('admin', { transactions, users, settings });
});

// Update TRC20 Address and USDT Rate from Admin
app.post('/admin/settings', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    const { trc_address, usdt_rate, bonus_ratio } = req.body;
    saveSettings({ trc_address, usdt_rate, bonus_ratio });
    res.redirect('/admin');
});

// Approve Transaction & Update User Balance
app.post('/admin/verify/:id', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    let txs = getTransactions();
    let tx = txs.find(t => t.id == req.params.id);
    
    if (tx && tx.status === 'Pending') {
        tx.status = 'Approved & Verified';
        saveTransactions(txs);
// Add amount to user balance
        let users = getUsers();
        let user = users.find(u => u.phone === tx.phone);
        if (user) {
            user.balance += parseFloat(tx.amount);
            saveUsers(users);
        }
    }
    res.redirect('/admin');
});

app.post('/admin/reject/:id', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    let txs = getTransactions();
    let tx = txs.find(t => t.id == req.params.id);
    if (tx) {
        tx.status = 'Rejected';
        saveTransactions(txs);
    }
    res.redirect('/admin');
});

app.get('/admin-logout', (req, res) => {
    req.session.admin = false;
    res.redirect('/admin-login');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Bitgetpay Server running on port ${PORT}`);
});
