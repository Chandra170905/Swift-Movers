const fs = require('fs');

const CODE_TO_INJECT = `    async handleReschedule(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const quoteId = formData.get('quoteId');
        const dateInput = formData.get('date');
        const timeInput = formData.get('time');

        console.log('Handle Reschedule:', { quoteId, dateInput, timeInput });

        try {
            if (!quoteId) throw new Error('Missing Quote ID');
            if (!dateInput) throw new Error('Please select a date');
            if (!timeInput) throw new Error('Please select a time');

            // Convert 24h time to 12h AM/PM for display consistency
            let [hours, minutes] = timeInput.split(':');
            const h = parseInt(hours, 10);
            const modifier = h >= 12 ? 'PM' : 'AM';
            const displayHour = h % 12 || 12;
            const formattedTime = \`\${displayHour.toString().padStart(2, '0')}:\${minutes} \${modifier}\`;

            const update = {
                date: dateInput,
                time: formattedTime
            };

            const res = await fetch(\`/api/quotes/\${quoteId}\`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update)
            });

            if (res.ok) {
                const updatedQuote = await res.json();
                console.log('Update Success:', updatedQuote);
                
                const idx = this.data.quotes.findIndex(q => q._id === quoteId);
                if (idx !== -1) {
                    this.data.quotes[idx] = updatedQuote;
                }
                
                this.addNotification('Schedule Updated', \`Move rescheduled\`, 'success');
                this.closeRescheduleModal();
                this.initSchedule();
            } else {
                const errText = await res.text();
                throw new Error('Server update failed');
            }
        } catch (err) {
            console.error('Error rescheduling:', err);
            alert(\`Error: \${err.message}\`);
        }
    },`;

const appJs = fs.readFileSync('app.js', 'utf8');

// Find start
const startIndex = appJs.indexOf('async handleReschedule(e) {');
if (startIndex === -1) {
    console.error('Could not find function start');
    process.exit(1);
}

// Find end (simple brace counting)
let braceCount = 0;
let endIndex = -1;
let foundStartBrace = false;

for (let i = startIndex; i < appJs.length; i++) {
    if (appJs[i] === '{') {
        braceCount++;
        foundStartBrace = true;
    } else if (appJs[i] === '}') {
        braceCount--;
    }

    if (foundStartBrace && braceCount === 0) {
        endIndex = i + 1; // Include the closing brace
        break;
    }
}

if (endIndex === -1) {
    console.error('Could not find function end');
    process.exit(1);
}

// Replace
const newAppJs = appJs.substring(0, startIndex) + CODE_TO_INJECT + appJs.substring(endIndex);

fs.writeFileSync('app.js', newAppJs);
console.log('Successfully patched app.js');
