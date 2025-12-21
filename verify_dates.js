const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
    name: String,
    date: String,
    status: String
});

const Quote = mongoose.model('Quote', quoteSchema);

mongoose.connect('mongodb://localhost:27017/swift_movers', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('--- DATE VERIFICATION START ---');
    const quotes = await Quote.find({});
    quotes.forEach(q => {
        console.log(`- ${q.name}: ${q.date}`);
    });
    console.log('--- DATE VERIFICATION END ---');
    mongoose.disconnect();
    process.exit(0);
}).catch(err => {
    console.error('DB Error:', err);
    process.exit(1);
});
