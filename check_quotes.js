const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
    name: String,
    date: String,
    time: String,
    status: String
});

const Quote = mongoose.model('Quote', quoteSchema);

mongoose.connect('mongodb://localhost:27017/swift_movers', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
}).then(async () => {
    console.log('--- DB DIAGNOSTIC START ---');
    const quotes = await Quote.find({ status: 'Approved' });
    console.log(`Found ${quotes.length} Approved Moves:`);
    quotes.forEach(q => {
        console.log(`- ${q.name}: ${q.date} at ${q.time || 'MISSING'}`);
    });
    console.log('--- DB DIAGNOSTIC END ---');
    mongoose.disconnect();
    process.exit(0);
}).catch(err => {
    console.error('DB Connection Error:', err.message);
    process.exit(1);
});
