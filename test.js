// Local check of the email parser: `node test.js`
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.runInNewContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), ctx);
const { parseHdfcCredit } = ctx;

const sample = `Dear Customer,

Greetings from HDFC Bank!

We're writing to inform you that Rs.300.00 has been successfully credited to your HDFC Bank account ending in 2130.

Transaction Details:
a. Date: 15-10-26
b. Sender: Nayan Nilesh Manjavkar (VPA: ******2667@fam)
c. UPI Reference No.: 665454534391

Need Help?
India (Toll-Free): 1800 258 6161`;

const cases = [
  ['plain-text alert', sample, { utr: '665454534391', name: 'Nayan Nilesh Manjavkar', amount: 300 }],
  ['HTML alert', '<p>Rs.1,500.50&nbsp;has been successfully credited</p><td>b. Sender: A B (VPA: x@ybl)</td><td>c. UPI Reference No.: 123456789012</td>',
    { utr: '123456789012', name: 'A B', amount: 1500.5 }],
  ['debit alert ignored', 'Rs.300.00 has been debited from account. UPI Reference No.: 665454534391', null],
  ['short ref ignored', 'Rs.5.00 has been successfully credited. UPI Reference No.: 12345', null],
];

for (const [label, input, want] of cases) {
  const got = parseHdfcCredit(input);
  assert.deepStrictEqual(got && { ...got }, want, label);
  console.log('PASS', label, JSON.stringify(got));
}
