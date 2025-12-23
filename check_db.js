// const mongoose = require('mongoose');

// const quoteSchema = new mongoose.Schema({
//     name: String,
//     origin: String,
//     dest: String,
//     date: String,
//     time: String,
//     amount: Number,
//     status: String
// });

// const Quote = mongoose.model('Quote', quoteSchema);

// mongoose.connect('mongodb://localhost:27017/swift_movers', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
// }).then(async () => {
//     console.log('=== QUOTE DATABASE CHECK ===');
//     const quotes = await Quote.find({});
//     console.log(`Total Quotes: ${quotes.length}`);
//     console.log('');
//     quotes.forEach((q, i) => {
//         console.log(`${i + 1}. ${q.name}`);
//         console.log(`   Route: ${q.origin} → ${q.dest}`);
//         console.log(`   Date: ${q.date} at ${q.time}`);
//         console.log(`   Amount: ₹${q.amount}`);
//         console.log(`   Status: ${q.status}`);
//         console.log('');
//     });
//     mongoose.disconnect();
//     process.exit(0);
// }).catch(err => {
//     console.error('DB Error:', err);
//     process.exit(1);
// });
