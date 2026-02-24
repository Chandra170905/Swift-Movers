// Using JSON file as simple DB substitute
import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

const JWT_SECRET = "super_secret_key_123";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');

// Simple JSON DB functions
const dbPath = (file) => path.join(__dirname, "data", file);

// Function to read JSON data from the file
const readDB = (file) => {
  const filePath = dbPath(file);
  if (!fs.existsSync(filePath)) return []; // Return empty array if file doesn't exist
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
};

// Function to write JSON data to the file
const writeDB = (file, data) => {
  const filePath = dbPath(file);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
};

export { readDB, writeDB };

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1]; // Bearer TOKEN

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // attach user info
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Admin-only Middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ error: "Admin access only" });
  }
  next();
};

// Activities (Audit Log)
app.get("/api/activities", verifyToken, requireAdmin, (req, res) => {
  try {
    const activities = readDB("activities.json");
    res.json(activities.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: "Error fetching activities" });
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

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password required"
    });
  }

  const users = readDB("users.json");

  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  }

  const token = jwt.sign(
    {
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  res.json({
    success: true,
    token,
    user: {
      name: user.name,
      username: user.username,
      role: user.role
    }
  });
});

// Quotes
app.get("/api/quotes", verifyToken, requireAdmin, (req, res) => {
  const quotes = readDB("quotes.json");
  res.json([...quotes].reverse());
});

app.post("/api/quotes", verifyToken, requireAdmin, (req, res) => {
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

app.put("/api/quotes/:id", verifyToken, requireAdmin, (req, res) => {
  const quotes = readDB("quotes.json");
  const index = quotes.findIndex(q => q.id == req.params.id);

  if (index === -1) return res.sendStatus(404);

  quotes[index] = { ...quotes[index], ...req.body };
  writeDB("quotes.json", quotes);

  res.json(quotes[index]);
});

app.delete("/api/quotes/:id", verifyToken, requireAdmin, (req, res) => {
  let quotes = readDB("quotes.json");
  quotes = quotes.filter(q => q.id != req.params.id);
  writeDB("quotes.json", quotes);
  res.json({ success: true });
});

// Stats Endpoint
app.get("/api/stats", verifyToken, requireAdmin, (req, res) => {
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
app.get("/api/inventory", verifyToken, requireAdmin, (req, res) => {
  res.json(readDB("inventory.json"));
});

app.post("/api/inventory", verifyToken, requireAdmin, (req, res) => {
  const data = readDB("inventory.json");
  const item = { id: Date.now(), ...req.body };
  data.push(item);
  writeDB("inventory.json", data);
  res.json(item);
});

app.delete("/api/inventory/:id", verifyToken, requireAdmin, (req, res) => {
  let data = readDB("inventory.json");
  data = data.filter(i => i.id != req.params.id);
  writeDB("inventory.json", data);
  res.json({ success: true });
});

// Claims
app.get("/api/claims", verifyToken, requireAdmin, (req, res) => {
  res.json(readDB("claims.json"));
});

app.post("/api/claims", verifyToken, requireAdmin, (req, res) => {
  const claims = readDB("claims.json");

  const newClaim = {
    id: Date.now(),
    ...req.body,
    status: req.body.status || "Pending",
    updatedAt: new Date()
  };

  claims.push(newClaim);
  writeDB("claims.json", claims);

  logActivity(
    "Claim Filed",
    `New claim filed: ${newClaim.type} (₹${newClaim.amount})`,
    req.user.username
  );

  res.json(newClaim);
});

app.put("/api/claims/:id", verifyToken, requireAdmin, (req, res) => {
  const claims = readDB("claims.json");
  const index = claims.findIndex(c => c.id == req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Claim not found" });
  }

  claims[index] = {
    ...claims[index],
    ...req.body,
    updatedAt: new Date()
  };

  writeDB("claims.json", claims);
  res.json(claims[index]);
});

app.delete("/api/claims/:id", verifyToken, requireAdmin, (req, res) => {
  let claims = readDB("claims.json");

  const claim = claims.find(c => c.id == req.params.id);
  if (!claim) {
    return res.status(404).json({ error: "Claim not found" });
  }

  claims = claims.filter(c => c.id != req.params.id);
  writeDB("claims.json", claims);

  res.json({ success: true });
});

// Fleet Management API
app.get("/api/trucks", verifyToken, requireAdmin, (req, res) => {
  res.json(readDB("trucks.json"));
});

app.post("/api/trucks", verifyToken, requireAdmin, (req, res) => {
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

  logActivity("Truck Added", `Truck ${truck.truckId} added`, req.user.username);

  res.json(truck);
});

app.put("/api/trucks/:id", verifyToken, requireAdmin, (req, res) => {
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
    req.user.username
  );
  res.json(trucks[index]);
});

app.delete("/api/trucks/:id", verifyToken, requireAdmin, (req, res) => {
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
    req.user.username
  );

  res.json({ success: true });
});

// SPA Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
