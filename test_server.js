const http = require('http');

console.log('Testing server at http://localhost:3000/api/quotes');

http.get('http://localhost:3000/api/quotes', (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);

        try {
            const quotes = JSON.parse(data);
            console.log(`\nFound ${quotes.length} quotes:`);
            quotes.forEach((q, i) => {
                console.log(`${i + 1}. ${q.name} - ${q.status} - ₹${q.amount}`);
            });
        } catch (e) {
            console.log('Error parsing JSON:', e.message);
        }
        process.exit(0);
    });
}).on('error', (err) => {
    console.error('Connection Error:', err.message);
    process.exit(1);
});
