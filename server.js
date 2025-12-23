const express = require('express');
const path = require('path');
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";

// Using JSON file as simple DB substitute
import fs from "fs";

const dbPath = (file) => path.join(process.cwd(), "db", file);

const readDB = (file) =>
  JSON.parse(fs.readFileSync(dbPath(file), "utf-8"));

const writeDB = (file, data) =>
  fs.writeFileSync(dbPath(file), JSON.stringify(data, null, 2));

// Middleware
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// MongoDB Connection
// mongoose.connect("mongodb://127.0.0.1:27017/swift-movers")
//   .then(() => console.log("MongoDB Connected Successfully"))
//   .catch((err) => console.error("MongoDB Connection Error:", err));


// Schemas & Models

// const userSchema = new mongoose.Schema({
//     username: { type: String, required: true, unique: true },
//     password: { type: String, required: true },
//     name: String,
//     email: String,
//     role: { type: String, default: 'Client' }
// });
// const User = mongoose.model('User', userSchema);

// const quoteSchema = new mongoose.Schema({
//     name: String,
//     origin: String,
//     dest: String,
//     date: String,
//     time: { type: String, default: '09:00 AM' },
//     amount: Number,
//     status: { type: String, default: 'Pending' },
//     truckId: { type: String, default: null }
// });
// const Quote = mongoose.model('Quote', quoteSchema);

// const inventorySchema = new mongoose.Schema({
//     item: String,
//     category: String,
//     volume: Number
// });
// const Inventory = mongoose.model('Inventory', inventorySchema);

// const claimSchema = new mongoose.Schema({
//     name: String,
//     type: String,
//     amount: Number,
//     status: { type: String, default: 'Pending' },
//     settledAmount: { type: Number, default: 0 },
//     adminNotes: { type: String, default: '' },
//     updatedAt: { type: Date, default: Date.now }
// });
// const Claim = mongoose.model('Claim', claimSchema);

// const truckSchema = new mongoose.Schema({
//     truckId: { type: String, required: true, unique: true },
//     type: String,
//     capacity: Number,
//     status: { type: String, default: 'Available' }
// });
// const Truck = mongoose.model('Truck', truckSchema);

// API Endpoints

// Register
// Models

// const activitySchema = new mongoose.Schema({
//     action: String,
//     details: String,
//     user: String,
//     timestamp: { type: Date, default: Date.now }
// });
// const Activity = mongoose.model('Activity', activitySchema);

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

// Logs an activity to the activities collection
const logActivity = (action, details, user = "Admin") => {
  const activities = readDB("activities.json");
  activities.unshift({
    id: Date.now(),
    action,
    details,
    user,
    time: new Date()
  });
  writeDB("activities.json", activities);
};

// Login (Admin/Staff Only)
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const users = readDB("users.json");

  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  res.json({
    success: true,
    user: {
      name: user.name,
      role: user.role,
      username: user.username
    }
  });
});

// Quotes
app.get("/api/quotes", (req, res) => {
  const quotes = readDB("quotes.json");
  res.json(quotes.reverse());
});

app.post("/api/quotes", (req, res) => {
  const quotes = readDB("quotes.json");

  const newQuote = {
    id: Date.now(),
    ...req.body,
    status: "Pending"
  };

  quotes.push(newQuote);
  writeDB("quotes.json", quotes);

  res.json(newQuote);
});


app.put("/api/quotes/:id", (req, res) => {
  const quotes = readDB("quotes.json");
  const index = quotes.findIndex(q => q.id == req.params.id);

  if (index === -1) return res.sendStatus(404);

  quotes[index] = { ...quotes[index], ...req.body };
  writeDB("quotes.json", quotes);

  res.json(quotes[index]);
});

app.delete("/api/quotes/:id", (req, res) => {
  let quotes = readDB("quotes.json");
  quotes = quotes.filter(q => q.id != req.params.id);
  writeDB("quotes.json", quotes);
  res.json({ success: true });
});


// Stats Endpoint
app.get("/api/stats", (req, res) => {
  const quotes = readDB("quotes.json");
  const claims = readDB("claims.json");

  const approved = quotes.filter(q => q.status === "Approved");
  const revenue = approved.reduce((a, b) => a + (b.amount || 0), 0);

  res.json({
    quotes: quotes.length,
    moves: approved.length,
    revenue,
    claims: claims.length
  });
});


// Inventory
app.get("/api/inventory", (req, res) => {
  res.json(readDB("inventory.json"));
});

app.post("/api/inventory", (req, res) => {
  const data = readDB("inventory.json");
  const item = { id: Date.now(), ...req.body };
  data.push(item);
  writeDB("inventory.json", data);
  res.json(item);
});

app.delete("/api/inventory/:id", (req, res) => {
  let data = readDB("inventory.json");
  data = data.filter(i => i.id != req.params.id);
  writeDB("inventory.json", data);
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
// app.get('/api/init', async (req, res) => {
//     try {
//         console.log('--- Initializing System Data ---');

//         // 1. Force update Admin name
//         await User.findOneAndUpdate({ username: 'admin' }, { name: 'Dilpreet Rekhi' }, { upsert: true });

//         // 2. Clear and Seed Claims (Force re-seed for demo visibility)
//         await Claim.deleteMany({});
//         const seededClaims = await Claim.create([
//             { name: 'Arjun Mehta', type: 'Electronic Damage', amount: 45000, status: 'Under Review' },
//             { name: 'Dr. Ananya Iyer', type: 'Furniture Scratch', amount: 2500, status: 'Settled', settledAmount: 2000, adminNotes: 'Agreed on partial refund.' },
//             { name: 'Vikram Singh', type: 'Lost Item', amount: 15000, status: 'Pending' },
//             { name: 'Sneha Rao', type: 'Wall Damage', amount: 8000, status: 'Approved' },
//             { name: 'Rajesh Khosla', type: 'Glassware Breakage', amount: 3500, status: 'Denied', adminNotes: 'Items were not packed by movers.' },
//             { name: 'Priya Verma', type: 'Delay Compensation', amount: 12000, status: 'Settled', settledAmount: 11000 },
//             { name: 'Amitabh Jaiswal', type: 'Water Damage', amount: 6500, status: 'Pending' }
//         ]);

//         // 3. Clear and Seed Quotes & Inventory (Force re-seed for demo)
//         await Quote.deleteMany({});
//         await Quote.create([
//             { name: 'Sharma Residence', origin: '110001', dest: '560001', date: '2026-01-08', time: '09:00 AM', amount: 0, status: 'Pending' },
//             { name: 'Tech Solutions Pvt Ltd', origin: '600001', dest: '700001', date: '2026-01-12', time: '02:00 PM', amount: 0, status: 'Pending' },
//             { name: 'Patel Family', origin: '380001', dest: '411001', date: '2026-01-15', time: '11:00 AM', amount: 0, status: 'Pending' },
//             { name: 'Reddy Enterprises', origin: '500001', dest: '400001', date: '2026-01-20', time: '08:30 AM', amount: 0, status: 'Pending' },
//             { name: 'Kumar & Associates', origin: '226001', dest: '302001', date: '2026-01-25', time: '10:00 AM', amount: 0, status: 'Pending' }
//         ]);

//         await Inventory.deleteMany({});
//         await Inventory.create([
//             { item: 'Moving Blankets (Bundle)', category: 'Supplies', volume: 10 },
//             { item: 'Hand Truck', category: 'Equipment', volume: 5 }
//         ]);

//         const truckCount = await Truck.countDocuments();
//         if (truckCount === 0) {
//             await Truck.create([
//                 { truckId: 'T-101', type: '26ft Box Truck', capacity: 1600, status: 'Available' },
//                 { truckId: 'T-102', type: '16ft Box Truck', capacity: 800, status: 'Available' },
//                 { truckId: 'V-201', type: 'Sprinter Van', capacity: 400, status: 'Available' }
//             ]);
//         }

//         console.log('Seeded Claims:', seededClaims.length);
//         res.json({ success: true, message: 'System localized and re-seeded', claimsCount: seededClaims.length });
//     } catch (err) {
//         console.error('Init Error:', err);
//         res.status(500).json({ success: false, error: err.message });
//     }
// });

// Fleet Management API
app.get("/api/trucks", (req, res) => {
  res.json(readDB("trucks.json"));
});

app.post("/api/trucks", (req, res) => {
  const trucks = readDB("trucks.json");

  const truck = {
    id: Date.now(),
    truckId: req.body.truckId,
    type: req.body.type,
    capacity: req.body.capacity,
    status: req.body.status || "Available"
  };

  trucks.push(truck);
  writeDB("trucks.json", trucks);

  logActivity("Truck Added", `Truck ${truck.truckId} added`, "Admin");

  res.json(truck);
});

app.put("/api/trucks/:id", (req, res) => {
  const trucks = readDB("trucks.json");
  const index = trucks.findIndex(t => t.id == req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Truck not found" });
  }

  trucks[index] = {
    ...trucks[index],
    ...req.body
  };

  writeDB("trucks.json", trucks);

  logActivity(
    "Truck Updated",
    `Truck ${trucks[index].truckId} status updated`,
    "Admin"
  );

  res.json(trucks[index]);
});

app.delete("/api/trucks/:id", (req, res) => {
  let trucks = readDB("trucks.json");

  const truck = trucks.find(t => t.id == req.params.id);
  if (!truck) {
    return res.status(404).json({ error: "Truck not found" });
  }

  trucks = trucks.filter(t => t.id != req.params.id);
  writeDB("trucks.json", trucks);

  logActivity(
    "Truck Removed",
    `Truck ${truck.truckId} removed`,
    "Admin"
  );

  res.json({ success: true });
});

// SPA Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
