/**
 * GPay -> Google Sheets
 *
 * Reads HDFC Bank "Rs.X has been successfully credited" UPI alert emails from
 * your Gmail and appends one row per payment to a Google Sheet:
 *
 *   UTR ID | Name | Amount | Date & Time
 *
 * Runs inside YOUR Google account only. Nothing leaves Google.
 *
 * First time: select `setup` in the toolbar and press Run. It creates the
 * sheet (if needed), backfills from START_FROM, and turns on a 1-minute timer.
 */

const CONFIG = {
  SHEET_NAME: 'Payments',
  // Only the last few days are scanned on each timer run; dedupe is by UTR.
  SEARCH_WINDOW: 'newer_than:3d',
  // Payments received before this moment are ignored (7:00 PM IST, 15 Oct 2026).
  START_FROM: new Date('2026-10-15T19:00:00+05:30'),
  // Phrase that appears only in HDFC credit alerts.
  SEARCH_PHRASE: '"has been successfully credited to your HDFC Bank account"',
  // Reject anything not actually sent by HDFC (basic anti-spoof check).
  ALLOWED_SENDER: /@(hdfcbank\.net|hdfcbank\.com|hdfcbank\.bank\.in)>?$/i,
  HEADERS: ['UTR ID', 'Name', 'Amount', 'Date & Time'],
};

/** One-time: create sheet, backfill, install the timer. */
function setup() {
  const sheet = getSheet_();
  syncPayments_('after:' + Math.floor(CONFIG.START_FROM.getTime() / 1000));

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncPayments')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncPayments').timeBased().everyMinutes(1).create();

  Logger.log('Ready. Sheet: ' + sheet.getParent().getUrl());
}

/** Timer entry point. */
function syncPayments() {
  syncPayments_(CONFIG.SEARCH_WINDOW);
}

/** Stop the automatic sync. */
function stopSync() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncPayments')
    .forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('Automatic sync stopped.');
}

function syncPayments_(window) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) return; // a previous run is still going

  try {
    const sheet = getSheet_();
    const seen = new Set(
      sheet.getLastRow() > 1
        ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(r => String(r[0]))
        : []
    );

    const threads = GmailApp.search(CONFIG.SEARCH_PHRASE + ' ' + window, 0, 500);
    const rows = [];

    threads.forEach(thread => {
      thread.getMessages().forEach(msg => {
        if (msg.getDate() < CONFIG.START_FROM) return;
        if (!CONFIG.ALLOWED_SENDER.test(msg.getFrom().trim())) return;
        const p = parseHdfcCredit(msg.getPlainBody() || msg.getBody());
        if (!p || seen.has(p.utr)) return;
        seen.add(p.utr);
        rows.push([p.utr, p.name, p.amount, msg.getDate()]);
      });
    });

    if (!rows.length) return;
    rows.sort((a, b) => a[3] - b[3]); // oldest first
    const start = sheet.getLastRow() + 1;
    sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
    Logger.log('Added ' + rows.length + ' payment(s).');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Pulls UTR, name, amount out of an HDFC credit alert. Returns null if the
 * text is not a credit alert. Pure function - tested locally by test.js.
 */
function parseHdfcCredit(text) {
  const t = String(text)
    .replace(/<[^>]+>/g, ' ')   // strip HTML if we only got the HTML body
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');

  const amount = t.match(/Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+has been successfully credited/i);
  const utr = t.match(/UPI Reference No\.?\s*:?\s*(\d{12})/i);
  const sender = t.match(/Sender\s*:\s*(.+?)\s*\(VPA/i);
  if (!amount || !utr) return null;

  return {
    utr: utr[1],
    name: sender ? sender[1].trim() : '',
    amount: Number(amount[1].replace(/,/g, '')),
  };
}

function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  let ss = SpreadsheetApp.getActiveSpreadsheet(); // set when script is attached to a sheet
  if (!ss) {
    const id = props.getProperty('SHEET_ID');
    ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('GPay Payments');
    props.setProperty('SHEET_ID', ss.getId());
  }

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONFIG.HEADERS);
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('@');                 // keep UTR as text
    sheet.getRange('C:C').setNumberFormat('₹#,##0.00');
    sheet.getRange('D:D').setNumberFormat('dd-mm-yyyy hh:mm:ss');
    const extra = ss.getSheetByName('Sheet1');
    if (extra && ss.getSheets().length > 1 && extra.getLastRow() === 0) ss.deleteSheet(extra);
  }
  return sheet;
}
