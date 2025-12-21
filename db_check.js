const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
    name: String,
    type: String,
    amount: Number,
    status: String
});

const Claim = mongoose.model('Claim', claimSchema);

mongoose.connect('mongodb://localhost:27017/swift_movers', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('Connected for diagnostics');
    const claims = await Claim.find({});
    console.log('Found', claims.length, 'claims');
    claims.forEach(c => {
        console.log(`ID: ${c._id}, Name: ${c.name}, Status: ${c.status}`);
    });
    mongoose.disconnect();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
