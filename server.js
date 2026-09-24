const express = require('express');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');

const app = express();

const ADMIN_USERNAME = "bitpay008";
const ADMIN_PASSWORD = "Bitpay002";

const MONGO_URI = 'mongodb+srv://admin0207:Hukam02@cluster0.grxfume.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Database Connected Successfully!'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Multer & Uploads Directory Setup (Database ko bloat hone se bachane ke liye)
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

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
        if (!amount || !txid) return res.redirect('/deposit?error=missing');

        const newTx = new Transaction({
            id: Date.now(), 
            phone: req.session.user.phone,
            amount: parseFloat(amount), 
            txid, 
            date: new Date().toLocaleString(), 
            status: 'Pending'
        });
        
        await newTx.save();
        res.redirect('/deposit?success=true');
    } catch (err) { 
        res.redirect('/deposit?error=true'); 
    }
});

app.post('/submit-vip-deposit', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const { amount, txid, vip_level } = req.body;
        const newTx = new Transaction({
            id: Date.now(), phone: req.session.user.phone,
            amount: parseFloat(amount), txid: `${txid} [VIP Level: ${vip_level}]`,
            date: new Date().toLocaleString(), status: 'Pending'
        });
        await newTx.save();
        res.redirect('/vip?success=true');
    } catch (err) { res.redirect('/vip?error=true'); }
});

app.get('/vip', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.user._id);
        res.render('vip', { user, settings: await getSettings(), success: req.query.success || null });
    } catch (err) { res.redirect('/login'); }
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
    } catch (err) { res.redirect('/login'); }
});

app.get('/profile', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.user._id);
        req.session.user = user;
        res.render('profile', { user, settings: await getSettings() });
    } catch (err) { res.redirect('/login'); }
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

app.post('/save-bank', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const { fullname, bank_name, account_no, ifsc, upi_id } = req.body;
        let user = await User.findById(req.session.user._id);

        user.bank_details = { 
            fullname: fullname || '', 
            bank_name: bank_name || '', 
            account_no: account_no || '', 
            ifsc: ifsc || '', 
            upi_id: upi_id || '',
            qr_image: user.bank_details ? user.bank_details.qr_image : ''
        };
        
        user.markModified('bank_details');
        await user.save();
        req.session.user = user;
        res.redirect('/withdraw?success=bank');
    } catch (err) { res.redirect('/withdraw?error=true'); }
});

// Multer middleware added to handle direct file upload instead of Base64
app.post('/submit-withdraw', upload.single('qr_image_file'), async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const { amount, method, details } = req.body;
        let user = await User.findById(req.session.user._id);
        let withdrawAmount = parseFloat(amount);

        if (user.balance >= withdrawAmount && withdrawAmount > 0) {
            user.balance -= withdrawAmount;
            if (!user.withdraw_history) user.withdraw_history = [];
            
            // File path save hoga database mein, base64 nahi
            let finalQR = req.file ? ('/uploads/' + req.file.filename) : (user.bank_details ? user.bank_details.qr_image : '');

            user.withdraw_history.unshift({
                id: Date.now(), 
                amount: withdrawAmount, 
                method, 
                details,
                qr_image: finalQR,
                date: new Date().toLocaleString(), 
                status: 'Pending'
            });
            user.markModified('withdraw_history');
            await user.save();
            req.session.user = user;
            res.redirect('/withdraw?success=true');
        } else {
            res.redirect('/withdraw?error=true');
        }
    } catch (err) { res.redirect('/withdraw?error=true'); }
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

app.post('/admin/settings', upload.single('deposit_qr'), async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    try {
        const { trc_address, usdt_rate, support_link, v_price, v_daily, v_days } = req.body;
        let settings = await getSettings();
        
        settings.trc_address = trc_address;
        if (req.file) settings.deposit_qr = '/uploads/' + req.file.filename;
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
                let settings = await getSettings();
                let rate = parseFloat(settings.usdt_rate) || 108.12;
                
                let convertedINR = tx.amount * rate;
                user.balance += convertedINR;
                
                if (!user.deposit_history) user.deposit_history = [];
                user.deposit_history.push({ 
                    amount: convertedINR, 
                    usdt_amount: tx.amount, 
                    date: tx.date,
                    txid: tx.txid 
                });
                user.markModified('deposit_history');
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
    } catch (err) { res.redirect('/admin'); }
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
    } catch (err) { res.redirect('/admin'); }
});

app.get('/admin-logout', (req, res) => { req.session.admin = false; res.redirect('/admin-login'); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
