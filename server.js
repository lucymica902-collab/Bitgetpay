const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

const ADMIN_USERNAME = "bitpay00@";
const ADMIN_PASSWORD = "Bitpay@02";

const settingsFile = path.join(__dirname, 'settings.json');
if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({
        trc_address: "TRjGbgMkRbbhzdjXU1QMCN4AM1BrtfnG5B",
        usdt_rate: "108.12",
        bonus_ratio: "2",
        vip_levels: [
            { level: "Level - I", price: "10", daily: "1.5", days: "49", desc: "USDT Invest for 49 days" },
            { level: "Level - II", price: "50", daily: "8.0", days: "49", desc: "USDT Invest for 49 days" },
            { level: "Level - III", price: "100", daily: "18.0", days: "49", desc: "USDT Invest for 49 days" },
            { level: "Level - IV", price: "500", daily: "95.0", days: "49", desc: "USDT Invest for 49 days" },
            { level: "Level - V", price: "1000", daily: "200.0", days: "49", desc: "USDT Invest for 49 days" }
        ]
    }, null, 2));
}

// Middleware
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

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

const dbFile = path.join(__dirname, 'database.json');
if (!fs.existsSync(dbFile)) { fs.writeFileSync(dbFile, JSON.stringify([])); }

const usersFile = path.join(__dirname, 'users.json');
if (!fs.existsSync(usersFile)) { fs.writeFileSync(usersFile, JSON.stringify([])); }

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

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

// User Routes
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
    users.push({
        id: Date.now(), phone, password, balance: 0.00,
        referral_code: myReferralCode, referred_by: referral_code || '',
        upi: '', bank_details: '', qr_code: '', digital_rupee: ''
    });
    saveUsers(users);
    res.redirect('/login');
});

app.get('/login', (req, res) => { res.render('user-login', { error: null }); });
app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    let users = getUsers();
    const user = users.find(u => u.phone === phone && u.password === password);
    if (user) { req.session.user = user; res.redirect('/'); }
    else { res.render('user-login', { error: 'Invalid phone number or password' }); }
});
app.get('/logout', (req, res) => { req.session.user = null; res.redirect('/login'); });

app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let users = getUsers();
    req.session.user = users.find(u => u.id === req.session.user.id) || req.session.user;
    res.render('index', { user: req.session.user });
});

app.get('/deposit', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const settings = getSettings();
    const success = req.query.success === 'true';
    res.render('deposit', { user: req.session.user, settings, success });
});

app.post('/submit-deposit', upload.single('screenshot'), (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { amount, txid } = req.body;
    let txs = getTransactions();
    txs.unshift({ id: Date.now(), phone: req.session.user.phone, amount, txid, screenshot: req.file ? req.file.filename : '', date: new Date().toLocaleString(), status: 'Pending' });
    saveTransactions(txs);
    res.redirect('/deposit?success=true');
});

// VIP Page - Dynamic from Admin Settings
app.get('/vip', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const settings = getSettings();
    res.render('vip', { user: req.session.user, vip_levels: settings.vip_levels || [] });
});

app.get('/team', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let users = getUsers();
    const myTeam = users.filter(u => u.referred_by === req.session.user.referral_code);
    res.render('team', { user: req.session.user, myTeam });
});

app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('profile', { user: req.session.user, success: req.query.success === 'true' });
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

// Admin Routes
app.get('/admin-login', (req, res) => { res.render('admin-login', { error: false }); });
app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.admin = true;
        res.redirect('/admin');
    } else { res.render('admin-login', { error: true }); }
});

app.get('/admin', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    res.render('admin', { transactions: getTransactions(), users: getUsers(), settings: getSettings() });
});

// Update Settings & VIP Plans from Admin
app.post('/admin/settings', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    const { trc_address, usdt_rate, bonus_ratio, v_price, v_daily, v_days } = req.body;
    
    let settings = getSettings();
    settings.trc_address = trc_address;
    settings.usdt_rate = usdt_rate;
    settings.bonus_ratio = bonus_ratio;

    // Update VIP levels dynamically if provided
    if (v_price && Array.isArray(v_price)) {
        for (let i = 0; i < settings.vip_levels.length; i++) {
            settings.vip_levels[i].price = v_price[i];
            settings.vip_levels[i].daily = v_daily[i];
            settings.vip_levels[i].days = v_days[i];
        }
    }
    saveSettings(settings);
    res.redirect('/admin');
});

app.post('/admin/verify/:id', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    let txs = getTransactions();
    let tx = txs.find(t => t.id == req.params.id);
    if (tx && tx.status === 'Pending') {
        tx.status = 'Approved & Verified';saveTransactions(txs);
        let users = getUsers();
        let user = users.find(u => u.phone === tx.phone);
        if (user) { user.balance += parseFloat(tx.amount); saveUsers(users); }
    }
    res.redirect('/admin');
});

app.post('/admin/reject/:id', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    let txs = getTransactions();
    let tx = txs.find(t => t.id == req.params.id);
    if (tx) { tx.status = 'Rejected'; saveTransactions(txs); }
    res.redirect('/admin');
});

app.get('/admin-logout', (req, res) => { req.session.admin = false; res.redirect('/admin-login'); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
