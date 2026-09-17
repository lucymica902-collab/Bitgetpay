const express = require('express');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');

const app = express();

const ADMIN_USERNAME = "bitpay008";
const ADMIN_PASSWORD = "Bitpay002";

const MONGO_URI = 'mongodb+srv://admin0207:Hukam02@cluster0.grxfume.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Database Connected Successfully!'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

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
    date: String,
    status: { type: String, default: 'Pending' }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

const settingsSchema = new mongoose.Schema({
    key: { type: String, default: 'global_settings' },
    trc_address: { type: String, default: 'TRJgbgMkRbbhzdjXU1QMCN4AM1BrtfnG5B' },
    deposit_qr: { type: String, default: '' },
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

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: 'bitpay_secure_key_2026',
    resave: false,
    saveUninitialized: true
}));

app.get('/register', (req, res) => res.render('register', { error: null, ref: req.query.ref || '' }));

app.post('/register', async (req, res) => {
    try {
        const { phone, password, referral_code } = req.body;
        const existingUser = await User.findOne({ phone });
        if (existingUser) return res.render('register', { error: 'Phone number already registered', ref: '' });
        
        const myReferralCode = 'BP' + Math.floor(100000 + Math.random() * 900000);
        const newUser = new User({
            id: Date.now(), phone, password, balance: 0.00,
            team_commission: 0.00, referral_code: myReferralCode, referred_by: referral_code || ''
        });
        await newUser.save();
        res.redirect('/login');
    } catch (err) {
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
        res.render('user-login', { error: 'Something went wrong' });
    }
});

app.get('/logout', (req, res) => { req.session.user = null; res.redirect('/login'); });

app.get('/', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.user._id);
        req.session.user = user;
        res.render('index', { user, settings: await getSettings() });
    } catch (err) { res.redirect('/login'); }
});

app.get('/deposit', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.user._id);
        res.render('deposit', { user, settings: await getSettings(), success: req.query.success || null });
    } catch (err) { res.redirect('/login'); }
});

app.post('/submit-deposit', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const { amount, txid } = req.body;
        const newTx = new Transaction({
            id: Date.now(), phone: req.session.user.phone,
            amount: parseFloat(amount), txid, date: new Date().toLocaleString(), status: 'Pending'
        });
        await newTx.save();
        res.redirect('/deposit?success=true');
    } catch (err) { res.redirect('/deposit?error=true'); }
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
    } catch (err) { res.redirect('/admin-login'); }
});

// Admin Settings Route (TRC Address & Deposit QR Code Update)
app.post('/admin/settings', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    try {
        const { trc_address, deposit_qr, usdt_rate, support_link } = req.body;
        let settings = await getSettings();
        
        settings.trc_address = trc_address;
        if (deposit_qr) {
            settings.deposit_qr = deposit_qr;
        }
        settings.usdt_rate = usdt_rate;
        settings.support_link = support_link;
        
        await settings.save();
        res.redirect('/admin');
    } catch (err) { 
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
                await user.save();
            }
        }
        res.redirect('/admin');
    } catch (err) { res.redirect('/admin'); }
});

app.post('/admin/reject/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    try {
        let tx = await Transaction.findOne({ id: req.params.id });
        if (tx) { tx.status = 'Rejected'; await tx.save(); }
        res.redirect('/admin');
    } catch (err) { res.redirect('/admin'); }
});

app.get('/admin-logout', (req, res) => { req.session.admin = false; res.redirect('/admin-login'); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
