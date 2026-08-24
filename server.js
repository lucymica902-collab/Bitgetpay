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
        vip_levels: [
            { level: "Level - I", price: "10", daily: "1.5", days: "49" },
            { level: "Level - II", price: "50", daily: "8.0", days: "49" },
            { level: "Level - III", price: "100", daily: "18.0", days: "49" },
            { level: "Level - IV", price: "500", daily: "95.0", days: "49" },
            { level: "Level - V", price: "1000", daily: "200.0", days: "49" }
        ]
    }, null, 2));
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: 'bitgetpay_secure_key_2026',
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

// Routes
app.get('/register', (req, res) => {
    res.render('register', { error: null, ref: req.query.ref || '' });
});

app.post('/register', (req, res) => {
    const { phone, password, referral_code } = req.body;
    let users = getUsers();
    if (users.find(u => u.phone === phone)) {
        return res.render('register', { error: 'Phone number already registered!', ref: '' });
    }
    const myReferralCode = 'BP' + Math.floor(100000 + Math.random() * 900000);
    users.push({
        id: Date.now(),
        phone,
        password,
        balance: 0.00,
        team_commission: 0.00,
        referral_code: myReferralCode,
        referred_by: referral_code || '',
        investments: [],
        deposit_history: []
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

// Home
app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let users = getUsers();
    req.session.user = users.find(u => u.id === req.session.user.id) || req.session.user;
    res.render('index', { user: req.session.user, settings: getSettings() });
});

// Deposit
app.get('/deposit', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('deposit', { user: req.session.user, settings: getSettings(), success: req.query.success === 'true' });
});

app.post('/submit-deposit', upload.single('screenshot'), (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { amount, txid } = req.body;
    let txs = getTransactions();
    txs.unshift({
        id: Date.now(),
        phone: req.session.user.phone,
        amount: parseFloat(amount),
        txid,
        screenshot: req.file ? req.file.filename : '',
        date: new Date().toLocaleString(),
        status: 'Pending'
    });
    saveTransactions(txs);
    res.redirect('/deposit?success=true');
});

// VIP Invest
app.get('/vip', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('vip', { user: req.session.user, settings: getSettings(), success: req.query.success === 'true', error: req.query.error === 'true' });
});

app.post('/buy-vip', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { level, price, daily, days } = req.body;
    let users = getUsers();
    let user = users.find(u => u.id === req.session.user.id);

    if (user.balance >= parseFloat(price)) {
        user.balance -= parseFloat(price);
        if (!user.investments) user.investments = [];
        user.investments.push({
            level,
            price,
            daily,
            days,
            date: new Date().toLocaleString()
        });
        saveUsers(users);
        req.session.user = user;
        res.redirect('/vip?success=true');
    } else {
        res.redirect('/vip?error=true');
    }
});

// Team
app.get('/team', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let users = getUsers();
    const teamA = users.filter(u => u.referred_by === req.session.user.referral_code);
    let teamA_codes = teamA.map(u => u.referral_code);
    const teamB = users.filter(u => teamA_codes.includes(u.referred_by));
    res.render('team', { user: req.session.user, teamA, teamB });
});

// Profile / Me
app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let users = getUsers();
    req.session.user = users.find(u => u.id === req.session.user.id);
    res.render('profile', { user: req.session.user });
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

app.post('/admin/settings', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    const { trc_address, usdt_rate, v_price, v_daily, v_days } = req.body;
    let settings = getSettings();
    settings.trc_address = trc_address;
    settings.usdt_rate = usdt_rate;
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

// Approve Transaction & Team Commission / Bonus Logic
app.post('/admin/verify/:id', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    let txs = getTransactions();
    let tx = txs.find(t => t.id == req.params.id);
    if (tx && tx.status === 'Pending') {
        tx.status = 'Approved & Verified';
        saveTransactions(txs);

        let users = getUsers();
        let user = users.find(u => u.phone === tx.phone);
        if (user) {
            user.balance += tx.amount;
            if (!user.deposit_history) user.deposit_history = [];
            user.deposit_history.push({ amount: tx.amount, date: tx.date, txid: tx.txid });

            // Referral / Team Commission (Level A: 0.3%, Level B: 0.1%, Invite Bonus if >= 100 USDT)
            if (user.referred_by) {
                let referrerA = users.find(u => u.referral_code === user.referred_by);
                if (referrerA) {
                    let commA = tx.amount * 0.003; // 0.3%
                    referrerA.team_commission += commA;
                    if (tx.amount >= 100) referrerA.balance += 5; // 5 USDT per invite bonus if recharge >= 100

                    if (referrerA.referred_by) {
                        let referrerB = users.find(u => u.referral_code === referrerA.referred_by);
                        if (referrerB) {
                            let commB = tx.amount * 0.001; // 0.1%
                            referrerB.team_commission += commB;
                        }
                    }
                }
            }
            saveUsers(users);
        }
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
