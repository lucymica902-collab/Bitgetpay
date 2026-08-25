const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();

const ADMIN_USERNAME = "bitpay008";
const ADMIN_PASSWORD = "Bitpay002";

// Secure MongoDB Connection URI
const MONGO_URI = 'mongodb+srv://admin0207:Hukam02@cluster0.grxfume.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB Database Connected Successfully!');
  })
  .catch((err) => {
    console.error('MongoDB Connection Error:', err);
  });

// --- MONGODB SCHEMAS & MODELS ---
const userSchema = new mongoose.Schema({
    id: Number,
    phone: { type: String, unique: true },
    password: String,
    balance: { type: Number, default: 0.00 },
    team_commission: { type: Number, default: 0.00 },
    referral_code: String,
    referred_by: { type: String, default: '' },
    investments: { type: Array, default: [] },
    deposit_history: { type: Array, default: [] },
    withdraw_history: { type: Array, default: [] },
    bank_details: { type: Object, default: {} }
});
const User = mongoose.model('User', userSchema);

const transactionSchema = new mongoose.Schema({
    id: Number,
    phone: String,
    amount: Number,
    txid: String,
    screenshot: String,
    date: String,
    status: { type: String, default: 'Pending' }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

const settingsSchema = new mongoose.Schema({
    key: { type: String, default: 'global_settings' },
    trc_address: { type: String, default: 'TRJgbgMkRbbhzdjXU1QMCN4AM1BrtfnG5B' },
    usdt_rate: { type: String, default: '108.12' },
    support_link: { type: String, default: 'https://t.me/lucy9029' },
    vip_levels: { type: Array, default: [
        { level: "Level - I", price: "10", daily: "1.5", days: "49" },
        { level: "Level - II", price: "50", daily: "8.0", days: "49" },
        { level: "Level - III", price: "100", daily: "18.0", days: "49" },
        { level: "Level - IV", price: "500", daily: "95.0", days: "49" },
        { level: "Level - V", price: "1000", daily: "200.0", days: "49" }
    ]}
});
const Setting = mongoose.model('Setting', settingsSchema);

async function getSettings() {
    let setting = await Setting.findOne({ key: 'global_settings' });
    if (!setting) {
        setting = new Setting();
        await setting.save();
    }
    return setting;
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: 'bitpay_secure_key_2026',
    resave: false,
    saveUninitialized: true
}));

// --- MULTER STORAGE SETUP (AUTO FOLDER CREATION) ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- ROUTES ---
app.get('/register', (req, res) => {
    res.render('register', { error: null, ref: req.query.ref || '' });
});

app.post('/register', async (req, res) => {
    try {
        const { phone, password, referral_code } = req.body;
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.render('register', { error: 'Phone number already registered', ref: '' });
        }
        const myReferralCode = 'BP' + Math.floor(100000 + Math.random() * 900000);
        const newUser = new User({
            id: Date.now(),
            phone,
            password,
            balance: 0.00,
            team_commission: 0.00,
            referral_code: myReferralCode,
            referred_by: referral_code || ''
        });
        await newUser.save();
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.render('register', { error: 'Registration failed', ref: '' });
    }
});

app.get('/login', (req, res) => res.render('user-login', { error: null }));
app.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone, password });
        if (user) {
            req.session.user = user;
            res.redirect('/');
        } else {
            res.render('user-login', { error: 'Invalid phone number or password' });
        }
    } catch (err) {
        console.error(err);
        res.render('user-login', { error: 'Something went wrong' });
    }
});

app.get('/logout', (req, res) => {
    req.session.user = null;
    res.redirect('/login');
});

app.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.user._id);
        req.session.user = user;
        res.render('index', { user, settings: await getSettings() });
    } catch (err) {
        res.redirect('/login');
    }
});

app.get('/deposit', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.user._id);
        res.render('deposit', { user, settings: await getSettings() });
    } catch (err) {
        res.redirect('/login');
    }
});

app.post('/submit-deposit', upload.single('screenshot'), async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const { amount, txid } = req.body;
        const newTx = new Transaction({
            id: Date.now(),
            phone: req.session.user.phone,
            amount: parseFloat(amount),
            txid,
            screenshot: req.file ? req.file.filename : '',
            date: new Date().toLocaleString(),
            status: 'Pending'
        });
        await newTx.save();
        res.redirect('/deposit?success=true');
    } catch (err) {
        console.error(err);
        res.redirect('/deposit?error=true');
    }
});

app.get('/vip', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.user._id);
        res.render('vip', { user, settings: await getSettings() });
    } catch (err) {
        res.redirect('/login');
    }
});

app.post('/buy-vip', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const { level, price, daily, days } = req.body;
        let user = await User.findById(req.session.user._id);

        if (user.balance >= parseFloat(price)) {
            user.balance -= parseFloat(price);
            if (!user.investments) user.investments = [];
            user.investments.push({ level, price, daily, days, date: new Date().toLocaleString() });
            await user.save();
            req.session.user = user;
            res.redirect('/vip?success=true');
        } else {
            res.redirect('/vip?error=true');
        }
    } catch (err) {
        console.error(err);
        res.redirect('/vip?error=true');
    }
});

app.get('/team', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.user._id);
        let users = await User.find({});
        let teamA = users.filter(u => u.referred_by === user.referral_code);
        let teamA_codes = teamA.map(u => u.referral_code);
        let teamB = users.filter(u => teamA_codes.includes(u.referred_by));
        res.render('team', { user, teamA, teamB });
    } catch (err) {
        res.redirect('/login');
    }
});

app.get('/profile', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.user._id);
        req.session.user = user;
        res.render('profile', { user, settings: await getSettings() });
    } catch (err) {
        res.redirect('/login');
    }
});

app.get('/withdraw', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.user._id);
        req.session.user = user;
        res.render('withdraw', { user, success: req.query.success, error: req.query.error });
    } catch (err) {
        res.redirect('/login');
    }
});

app.post('/save-bank', upload.single('qr_image'), async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const { fullname, bank_name, account_no, ifsc_upi, erupee_address } = req.body;
        let user = await User.findById(req.session.user._id);

        let qr_image = user.bank_details ? user.bank_details.qr_image : '';
        if (req.file) {
            qr_image = req.file.filename;
        }

        user.bank_details = { fullname, bank_name, account_no, ifsc_upi, erupee_address, qr_image };
        await user.save();
        req.session.user = user;
        res.redirect('/withdraw?success=bank');
    } catch (err) {
        console.error(err);
        res.redirect('/withdraw?error=true');
    }
});

app.post('/submit-withdraw', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const { amount, method, details } = req.body;
        let user = await User.findById(req.session.user._id);
        let withdrawAmount = parseFloat(amount);

        if (user.balance >= withdrawAmount && withdrawAmount > 0) {
            user.balance -= withdrawAmount;
            if (!user.withdraw_history) user.withdraw_history = [];
            user.withdraw_history.unshift({
                id: Date.now(),
                amount: withdrawAmount,
                method,
                details,
                date: new Date().toLocaleString(),
                status: 'Pending'
            });
            await user.save();
            req.session.user = user;
            res.redirect('/withdraw?success=true');
        } else {
            res.redirect('/withdraw?error=true');
        }
    } catch (err) {
        console.error(err);
        res.redirect('/withdraw?error=true');
    }
});

app.get('/admin-login', (req, res) => res.render('admin-login', { error: null }));
app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.admin = true;
        res.redirect('/admin');
    } else {
        res.render('admin-login', { error: true });
    }
});

app.get('/admin', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    try {
        const transactions = await Transaction.find({});
        const users = await User.find({});
        const settings = await getSettings();
        res.render('admin', { transactions, users, settings });
    } catch (err) {
        res.redirect('/admin-login');
    }
});

app.post('/admin/settings', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    try {
        const { trc_address, usdt_rate, support_link, v_price, v_daily, v_days } = req.body;
        let settings = await getSettings();
        settings.trc_address = trc_address;
        settings.usdt_rate = usdt_rate;
        settings.support_link = support_link;

        if (v_price && Array.isArray(v_price)) {
            for (let i = 0; i < settings.vip_levels.length; i++) {
                settings.vip_levels[i].price = v_price[i];
                settings.vip_levels[i].daily = v_daily[i];
                settings.vip_levels[i].days = v_days[i];
            }
        }
        settings.markModified('vip_levels');
        await settings.save();
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

app.post('/admin/verify/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    try {
        let tx = await Transaction.findOne({ id: req.params.id });
        if (tx && tx.status === 'Pending') {
            tx.status = 'Approved & Verified';
            await tx.save();

            let user = await User.findOne({ phone: tx.phone });
            if (user) {
                user.balance += tx.amount;
                if (!user.deposit_history) user.deposit_history = [];
                user.deposit_history.push({ amount: tx.amount, date: tx.date });

                if (user.referred_by) {
                    let referrerA = await User.findOne({ referral_code: user.referred_by });
                    if (referrerA) {
                        referrerA.team_commission += (tx.amount * 0.003);
                        if (tx.amount >= 100) referrerA.balance += 5;
                        await referrerA.save();

                        if (referrerA.referred_by) {
                            let referrerB = await User.findOne({ referral_code: referrerA.referred_by });
                            if (referrerB) {
                                referrerB.team_commission += (tx.amount * 0.001);
                                await referrerB.save();
                            }
                        }
                    }
                }
                await user.save();
            }
        }
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

app.post('/admin/reject/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    try {
        let tx = await Transaction.findOne({ id: req.params.id });
        if (tx) { 
            tx.status = 'Rejected'; 
            await tx.save(); 
        }
        res.redirect('/admin');
    } catch (err) {
        res.redirect('/admin');
    }
});

app.post('/admin/withdraw/approve/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    try {
        let users = await User.find({});
        for (let user of users) {
            if (user.withdraw_history) {
                let tx = user.withdraw_history.find(t => t.id == req.params.id);
                if (tx) { 
                    tx.status = 'Approved'; 
                    user.markModified('withdraw_history');
                    await user.save();
                    break; 
                }
            }
        }
        res.redirect('/admin');
    } catch (err) {
        res.redirect('/admin');
    }
});

app.post('/admin/withdraw/reject/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    try {
        let users = await User.find({});
        for (let user of users) {
            if (user.withdraw_history) {
                let tx = user.withdraw_history.find(t => t.id == req.params.id);
                if (tx && tx.status === 'Pending') {
                    tx.status = 'Rejected';
                    user.balance += tx.amount;
                    user.markModified('withdraw_history');
                    await user.save();
                    break;
                }
            }
        }
        res.redirect('/admin');
    } catch (err) {
        res.redirect('/admin');
    }
});

app.get('/admin-logout', (req, res) => {
    req.session.admin = false;
    res.redirect('/admin-login');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
