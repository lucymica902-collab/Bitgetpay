user = users.find(u => u.id === req.session.user.id) || req.session.user;
    res.render('index', { user: req.session.user, settings: getSettings() });
});

app.get('/deposit', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('deposit', { user: req.session.user, settings: getSettings(), success: req.query.success === 'true' });
});

app.post('/submit-deposit', upload.single('screenshot'), (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { amount, txid } = req.body;
    let txs = getTransactions();
    txs.unshift({
        id: Date.now(), phone: req.session.user.phone, amount: parseFloat(amount),
        txid, screenshot: req.file ? req.file.filename : '', date: new Date().toLocaleString(), status: 'Pending'
    });
    saveTransactions(txs);
    res.redirect('/deposit?success=true');
});

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
        user.investments.push({ level, price, daily, days, date: new Date().toLocaleString() });
        saveUsers(users);
        req.session.user = user;
        res.redirect('/vip?success=true');
    } else {
        res.redirect('/vip?error=true');
    }
});

app.get('/team', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let users = getUsers();
    const teamA = users.filter(u => u.referred_by === req.session.user.referral_code);
    let teamA_codes = teamA.map(u => u.referral_code);
    const teamB = users.filter(u => teamA_codes.includes(u.referred_by));
    res.render('team', { user: req.session.user, teamA, teamB });
});

// Profile route mein settings pass ki gayi hai taaki support link dynamically aaye
app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let users = getUsers();
    req.session.user = users.find(u => u.id === req.session.user.id);
    res.render('profile', { user: req.session.user, settings: getSettings() });
});

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

// Admin settings route jisme support_link save hoga
app.post('/admin/settings', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin-login');
    const { trc_address, usdt_rate, support_link, v_price, v_daily, v_days } = req.body;
    let settings = getSettings();
    settings.trc_address = trc_address;
    settings.usdt_rate = usdt_rate;
    settings.support_link = support_link; // Support link update hoga
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
    let tx = txs.find(t => t.id == req.params.id);if (tx && tx.status === 'Pending') {
        tx.status = 'Approved & Verified';
        saveTransactions(txs);
        let users = getUsers();
        let user = users.find(u => u.phone === tx.phone);
        if (user) {
            user.balance += tx.amount;
            if (!user.deposit_history) user.deposit_history = [];
            user.deposit_history.push({ amount: tx.amount, date: tx.date, txid: tx.txid });
            if (user.referred_by) {
                let referrerA = users.find(u => u.referral_code === user.referred_by);
                if (referrerA) {
                    referrerA.team_commission += (tx.amount * 0.003);
                    if (tx.amount >= 100) referrerA.balance += 5;
                    if (referrerA.referred_by) {
                        let referrerB = users.find(u => u.referral_code === referrerA.referred_by);
                        if (referrerB) { referrerB.team_commission += (tx.amount * 0.001); }
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
