const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/swift_movers', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Schemas & Models
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    email: String,
    role: { type: String, default: 'Client' }
});
const User = mongoose.model('User', userSchema);

const quoteSchema = new mongoose.Schema({
    name: String,
    origin: String,
    dest: String,
    date: String,
    amount: Number,
    status: { type: String, default: 'Pending' },
    truckId: { type: String, default: null }
});
const Quote = mongoose.model('Quote', quoteSchema);

const inventorySchema = new mongoose.Schema({
    item: String,
    category: String,
    volume: Number
});
const Inventory = mongoose.model('Inventory', inventorySchema);

const claimSchema = new mongoose.Schema({
    name: String,
    type: String,
    amount: Number,
    status: { type: String, default: 'In Review' }
});
const Claim = mongoose.model('Claim', claimSchema);

const truckSchema = new mongoose.Schema({
    truckId: { type: String, required: true, unique: true },
    type: String,
    capacity: Number,
    status: { type: String, default: 'Available' }
});
const Truck = mongoose.model('Truck', truckSchema);

// API Endpoints

// Register
// Models
const activitySchema = new mongoose.Schema({
    action: String,
    details: String,
    user: String,
    timestamp: { type: Date, default: Date.now }
});
const Activity = mongoose.model('Activity', activitySchema);

// ... (Existing Schemas: User, Quote, Inventory, Claim) ...

// API Endpoints

// Activities (Audit Log)
app.get('/api/activities', async (req, res) => {
    try {
        const activities = await Activity.find().sort({ timestamp: -1 }).limit(50);
        res.json(activities);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching activities' });
    }
});

// Helper to log activity
const logActivity = async (action, details, user = 'System') => {
    try {
        await Activity.create({ action, details, user });
    } catch (err) {
        console.error('Activity Log Error:', err);
    }
};

// Login (Admin/Staff Only)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Invalid credentials' });

        res.json({
            success: true,
            user: { name: user.name, role: 'Staff', username: user.username }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Quotes
app.get('/api/quotes', async (req, res) => {
    const quotes = await Quote.find().sort({ _id: -1 });
    res.json(quotes);
});

app.post('/api/quotes', async (req, res) => {
    const newQuote = new Quote(req.body);
    await newQuote.save();
    await logActivity('Quote Created', `New quote created for ${newQuote.name}`, 'Admin');
    res.json(newQuote);
});

app.put('/api/quotes/:id', async (req, res) => {
    try {
        const updatedQuote = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true });
        await logActivity('Job Updated', `Job ${updatedQuote.name} updated (Status: ${updatedQuote.status}, Truck: ${updatedQuote.truckId || 'None'})`, 'Admin');
        res.json(updatedQuote);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error updating quote' });
    }
});

app.delete('/api/quotes/:id', async (req, res) => {
    try {
        const quote = await Quote.findById(req.params.id);
        await Quote.findByIdAndDelete(req.params.id);
        if (quote) await logActivity('Quote Deleted', `Quote for ${quote.name} was removed`, 'Admin');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error deleting quote' });
    }
});

// Stats Endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const totalQuotes = await Quote.countDocuments();
        const approvedQuotes = await Quote.find({ status: 'Approved' });
        const scheduledMoves = approvedQuotes.length;
        const revenue = approvedQuotes.reduce((acc, q) => acc + (q.amount || 0), 0);
        const totalClaims = await Claim.countDocuments(); // Count all claims

        res.json({
            quotes: totalQuotes,
            moves: scheduledMoves,
            revenue,
            claims: totalClaims
        });
    } catch (err) {
        res.status(500).json({ error: 'Stats error' });
    }
});

// Inventory
app.get('/api/inventory', async (req, res) => {
    const items = await Inventory.find();
    res.json(items);
});

app.post('/api/inventory', async (req, res) => {
    const newItem = new Inventory(req.body);
    await newItem.save();
    await logActivity('Inventory Added', `Added ${newItem.volume}ft³ of ${newItem.item}`, 'Admin');
    res.json(newItem);
});

app.delete('/api/inventory/:id', async (req, res) => {
    const item = await Inventory.findById(req.params.id);
    await Inventory.findByIdAndDelete(req.params.id);
    if (item) await logActivity('Inventory Removed', `Removed ${item.item}`, 'Admin');
    res.json({ success: true });
});

// Claims
app.get('/api/claims', async (req, res) => {
    const claims = await Claim.find();
    res.json(claims);
});

app.post('/api/claims', async (req, res) => {
    const newClaim = new Claim(req.body);
    await newClaim.save();
    await logActivity('Claim Filed', `New claim filed: ${newClaim.type} ($${newClaim.amount})`, 'Admin');
    res.json(newClaim);
});

// Initialization
app.get('/api/init', async (req, res) => {
    // Ensure Admin Exists
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        await User.create({
            username: 'admin',
            password: hashedPassword,
            name: 'System Administrator',
            role: 'Admin'
        });
        console.log('Default Admin Created');
    }

    const quoteCount = await Quote.countDocuments();
    if (quoteCount === 0) {
        await Quote.create([
            { name: 'Corporate Move - TechCorp', origin: '10001', dest: '94043', date: '2023-12-01', amount: 15000, status: 'Approved' },
            { name: 'Residential - Smith Family', origin: '60601', dest: '33101', date: '2023-12-05', amount: 4200, status: 'Pending' }
        ]);
        await Inventory.create([
            { item: 'Moving Blankets (Bundle)', category: 'Supplies', volume: 10 },
            { item: 'Hand Truck', category: 'Equipment', volume: 5 }
        ]);
        await Claim.create([
            { name: 'TechCorp', type: 'Delay', amount: 500, status: 'Resolved' }
        ]);

        const truckCount = await Truck.countDocuments();
        if (truckCount === 0) {
            await Truck.create([
                { truckId: 'T-101', type: '26ft Box Truck', capacity: 1600, status: 'Available' },
                { truckId: 'T-102', type: '16ft Box Truck', capacity: 800, status: 'Available' },
                { truckId: 'V-201', type: 'Sprinter Van', capacity: 400, status: 'Available' }
            ]);
        }
        res.json({ message: 'System initialized' });
    } else {
        res.json({ message: 'System data checked' });
    }
});

// Fleet Management API
app.get('/api/trucks', async (req, res) => {
    try {
        const trucks = await Truck.find();
        res.json(trucks);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching trucks' });
    }
});

app.post('/api/trucks', async (req, res) => {
    try {
        const newTruck = new Truck(req.body);
        await newTruck.save();
        await logActivity('Truck Added', `New truck added: ${newTruck.truckId} (${newTruck.type})`, 'Admin');
        res.json(newTruck);
    } catch (err) {
        res.status(500).json({ error: 'Error adding truck' });
    }
});

app.put('/api/trucks/:id', async (req, res) => {
    try {
        const updatedTruck = await Truck.findByIdAndUpdate(req.params.id, req.body, { new: true });
        await logActivity('Truck Updated', `Truck ${updatedTruck.truckId} status: ${updatedTruck.status}`, 'Admin');
        res.json(updatedTruck);
    } catch (err) {
        res.status(500).json({ error: 'Error updating truck' });
    }
});

app.delete('/api/trucks/:id', async (req, res) => {
    try {
        const truck = await Truck.findById(req.params.id);
        await Truck.findByIdAndDelete(req.params.id);
        if (truck) await logActivity('Truck Removed', `Truck ${truck.truckId} was decommissioned`, 'Admin');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting truck' });
    }
});

// SPA Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
