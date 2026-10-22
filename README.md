# GPay → Google Sheets

Reads HDFC Bank UPI credit alert emails from Gmail and adds one row per payment to a Google Sheet:

| UTR ID | Name | Amount | Date & Time |
|---|---|---|---|
| 665454534391 | Nayan Nilesh Manjavkar | ₹300.00 | 15-10-2026 22:10:04 |

It runs as a Google Apps Script inside your own Google account. Your Gmail is never sent to any outside server.

## Setup (5 minutes, one time)

1. Log in with the Gmail account that **receives the HDFC alerts**.
2. Create a new Google Sheet, then open **Extensions → Apps Script**.
3. Delete the starter code. Paste in all of `Code.gs`.
4. Optional: click ⚙ **Project Settings** and turn on *Show "appsscript.json"*. Then paste in `appsscript.json`. This sets the time zone to IST and limits Gmail access to read-only.
5. Choose `setup` from the function dropdown and click **Run**. Google will ask for permission:
   **Advanced → Go to project (unsafe) → Allow**. You see this warning because the script is your own and unverified.
6. The script fills in payments received from **7:00 PM IST on 15 Oct 2026** onward. After that it checks for new emails **every minute**. To pick a different start time, change `START_FROM` at the top of `Code.gs`.

To stop it, run `stopSync`.

## How it works

- It searches Gmail for `"has been successfully credited to your HDFC Bank account"`.
- It skips any email whose sender is not an `@hdfcbank` address, so faked alerts are ignored.
- **Date & Time** comes from when the email arrived. HDFC's email body has only the date, not the time.
- Each UTR is added only once. Running it again, or getting the same alert twice, never creates duplicate rows.
- Debit alerts and other emails are ignored.

## Test the parser locally

```
node test.js
```
