const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 5000;


// Middleware
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/swift-movers")
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.error("MongoDB Connection Error:", err));


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
    time: { type: String, default: '09:00 AM' },
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
    status: { type: String, default: 'Pending' },
    settledAmount: { type: Number, default: 0 },
    adminNotes: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
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
        console.log(`Updating Quote ${req.params.id}:`, req.body);
        const updatedQuote = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedQuote) return res.status(404).json({ error: 'Quote not found' });

        console.log('Updated Quote Result:', updatedQuote);
        await logActivity('Job Updated', `Job ${updatedQuote.name} updated (Status: ${updatedQuote.status}, Truck: ${updatedQuote.truckId || 'None'})`, 'Admin');
        res.json(updatedQuote);
    } catch (err) {
        console.error('Update Error:', err);
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
    await logActivity('Claim Filed', `New claim filed: ${newClaim.type} (₹${newClaim.amount})`, 'Admin');
    res.json(newClaim);
});

app.put('/api/claims/:id', async (req, res) => {
    try {
        const body = { ...req.body, updatedAt: Date.now() };
        const updatedClaim = await Claim.findByIdAndUpdate(req.params.id, body, { new: true });
        await logActivity('Claim Processed', `Claim for ${updatedClaim.name} status: ${updatedClaim.status}`, 'Admin');
        res.json(updatedClaim);
    } catch (err) {
        res.status(500).json({ error: 'Error updating claim' });
    }
});

app.delete('/api/claims/:id', async (req, res) => {
    try {
        const claim = await Claim.findById(req.params.id);
        await Claim.findByIdAndDelete(req.params.id);
        if (claim) await logActivity('Claim Deleted', `Claim for ${claim.name || 'Unknown'} removed`, 'Admin');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting claim' });
    }
});

// Initialization
app.get('/api/init', async (req, res) => {
    try {
        console.log('--- Initializing System Data ---');

        // 1. Force update Admin name
        await User.findOneAndUpdate({ username: 'admin' }, { name: 'Dilpreet Rekhi' }, { upsert: true });

        // 2. Clear and Seed Claims (Force re-seed for demo visibility)
        await Claim.deleteMany({});
        const seededClaims = await Claim.create([
            { name: 'Arjun Mehta', type: 'Electronic Damage', amount: 45000, status: 'Under Review' },
            { name: 'Dr. Ananya Iyer', type: 'Furniture Scratch', amount: 2500, status: 'Settled', settledAmount: 2000, adminNotes: 'Agreed on partial refund.' },
            { name: 'Vikram Singh', type: 'Lost Item', amount: 15000, status: 'Pending' },
            { name: 'Sneha Rao', type: 'Wall Damage', amount: 8000, status: 'Approved' },
            { name: 'Rajesh Khosla', type: 'Glassware Breakage', amount: 3500, status: 'Denied', adminNotes: 'Items were not packed by movers.' },
            { name: 'Priya Verma', type: 'Delay Compensation', amount: 12000, status: 'Settled', settledAmount: 11000 },
            { name: 'Amitabh Jaiswal', type: 'Water Damage', amount: 6500, status: 'Pending' }
        ]);

        // 3. Clear and Seed Quotes & Inventory (Force re-seed for demo)
        await Quote.deleteMany({});
        await Quote.create([
            { name: 'Sharma Residence', origin: '110001', dest: '560001', date: '2026-01-08', time: '09:00 AM', amount: 0, status: 'Pending' },
            { name: 'Tech Solutions Pvt Ltd', origin: '600001', dest: '700001', date: '2026-01-12', time: '02:00 PM', amount: 0, status: 'Pending' },
            { name: 'Patel Family', origin: '380001', dest: '411001', date: '2026-01-15', time: '11:00 AM', amount: 0, status: 'Pending' },
            { name: 'Reddy Enterprises', origin: '500001', dest: '400001', date: '2026-01-20', time: '08:30 AM', amount: 0, status: 'Pending' },
            { name: 'Kumar & Associates', origin: '226001', dest: '302001', date: '2026-01-25', time: '10:00 AM', amount: 0, status: 'Pending' }
        ]);

        await Inventory.deleteMany({});
        await Inventory.create([
            { item: 'Moving Blankets (Bundle)', category: 'Supplies', volume: 10 },
            { item: 'Hand Truck', category: 'Equipment', volume: 5 }
        ]);

        const truckCount = await Truck.countDocuments();
        if (truckCount === 0) {
            await Truck.create([
                { truckId: 'T-101', type: '26ft Box Truck', capacity: 1600, status: 'Available' },
                { truckId: 'T-102', type: '16ft Box Truck', capacity: 800, status: 'Available' },
                { truckId: 'V-201', type: 'Sprinter Van', capacity: 400, status: 'Available' }
            ]);
        }

        console.log('Seeded Claims:', seededClaims.length);
        res.json({ success: true, message: 'System localized and re-seeded', claimsCount: seededClaims.length });
    } catch (err) {
        console.error('Init Error:', err);
        res.status(500).json({ success: false, error: err.message });
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
