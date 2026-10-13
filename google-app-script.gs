function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = buildSheetName_(payload);
    const sheet = spreadsheet.insertSheet(sheetName, 0);

    renderReport_(sheet, payload);

    return jsonResponse_({
      success: true,
      sheetName: sheet.getName()
    });
  } catch (error) {
    return jsonResponse_({
      success: false,
      error: String(error)
    });
  }
}

function buildSheetName_(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const preferredName = payload && payload.reportName ? String(payload.reportName).trim() : "";

  if (preferredName) {
    let name = preferredName;
    let counter = 1;

    while (spreadsheet.getSheetByName(name)) {
      counter += 1;
      name = preferredName + " (" + counter + ")";
    }

    return name;
  }

  const base = "Report " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  let name = base;
  let counter = 1;

  while (spreadsheet.getSheetByName(name)) {
    counter += 1;
    name = base + " (" + counter + ")";
  }

  return name;
}

function renderReport_(sheet, payload) {
  const dateLabel = payload.dateRange && payload.dateRange.label ? payload.dateRange.label : "";
  const totals = payload.totals || {};
  const accounts = payload.accounts || [];
  const transactions = payload.transactions || [];

  sheet.clear();

  sheet.setColumnWidths(1, 6, 190);
  sheet.setColumnWidth(4, 140);
  sheet.setColumnWidth(5, 140);
  sheet.setColumnWidth(6, 140);

  sheet.getRange("A1:F1").merge();
  sheet.getRange("A1")
    .setValue("PocketLedger Financial Report")
    .setFontSize(18)
    .setFontWeight("bold");

  sheet.getRange("A2:F2").merge();
  sheet.getRange("A2")
    .setValue("Date Range: " + dateLabel)
    .setFontStyle("italic")
    .setFontColor("#666666")
    .setFontSize(12);

  sheet.getRange("A4:D4").setValues([[
    "Total Balance (Closing)",
    "Total Income",
    "Total Expense",
    "Net Flow"
  ]]);

  sheet.getRange("A5:D5").setValues([[
    numberOrZero_(totals.closingBalance),
    numberOrZero_(totals.income),
    numberOrZero_(totals.expense),
    numberOrZero_(totals.net)
  ]]);

  styleMetricBlock_(sheet.getRange("A4:A5"), "#1F4E79", "#FFFFFF");
  styleMetricBlock_(sheet.getRange("B4:B5"), "#70AD47", "#FFFFFF");
  styleMetricBlock_(sheet.getRange("C4:C5"), "#D00000", "#FFFFFF");
  styleMetricBlock_(sheet.getRange("D4:D5"), "#D9D9D9", "#000000");

  sheet.getRange("A5:D5").setNumberFormat('₹#,##0.00;[Red]-₹#,##0.00');
  sheet.getRange("A4:D5").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.getRange("A4:D5").setFontWeight("bold");

  const accountTitleRow = 8;
  sheet.getRange(accountTitleRow, 1, 1, 3).merge();
  sheet.getRange(accountTitleRow, 1)
    .setValue("Account Balances")
    .setFontWeight("bold")
    .setBackground("#D9E1F2")
    .setBorder(true, true, true, true, true, true);

  sheet.getRange(accountTitleRow + 1, 1, 1, 3).setValues([[
    "Account Name",
    "Opening Balance",
    "Closing Balance"
  ]]);
  sheet.getRange(accountTitleRow + 1, 1, 1, 3)
    .setFontWeight("bold")
    .setBackground("#F2F2F2")
    .setBorder(true, true, true, true, true, true);

  if (accounts.length > 0) {
    const accountRows = accounts.map(function (account) {
      return [
        account.name || "",
        numberOrZero_(account.openingBalance),
        numberOrZero_(account.closingBalance)
      ];
    });

    const accountStartRow = accountTitleRow + 2;
    const accountRange = sheet.getRange(accountStartRow, 1, accountRows.length, 3);
    accountRange.setValues(accountRows);
    accountRange.setBorder(true, true, true, true, true, true);

    sheet.getRange(accountStartRow, 2, accountRows.length, 1)
      .setNumberFormat('₹#,##0.00;[Red]-₹#,##0.00');

    sheet.getRange(accountStartRow, 3, accountRows.length, 1)
      .setNumberFormat('₹#,##0.00;[Red]-₹#,##0.00');
  }

  const transactionsTitleRow = accountTitleRow + 4 + Math.max(accounts.length, 1);
  sheet.getRange(transactionsTitleRow, 1, 1, 6).merge();
  sheet.getRange(transactionsTitleRow, 1)
    .setValue("Transactions Log")
    .setFontWeight("bold")
    .setFontColor("#FFFFFF")
    .setBackground("#2F75B5")
    .setBorder(true, true, true, true, true, true);

  sheet.getRange(transactionsTitleRow + 1, 1, 1, 6).setValues([[
    "Date",
    "Description",
    "Account",
    "Category",
    "Type",
    "Amount"
  ]]);
  sheet.getRange(transactionsTitleRow + 1, 1, 1, 6)
    .setFontWeight("bold")
    .setBackground("#D9E1F2")
    .setBorder(true, true, true, true, true, true);

  if (transactions.length > 0) {
    const txRows = transactions.map(function (tx) {
      return [
        formatTimestamp_(tx.timestamp),
        tx.title || "",
        tx.type === "Transfer" ? ((tx.source || "") + " -> " + (tx.toSource || "")) : (tx.source || ""),
        tx.category || "-",
        tx.type || "",
        numberOrZero_(tx.amount)
      ];
    });

    const txRange = sheet.getRange(transactionsTitleRow + 2, 1, txRows.length, 6);
    txRange.setValues(txRows);
    txRange.setBorder(true, true, true, true, true, true);
    sheet.getRange(transactionsTitleRow + 2, 6, txRows.length, 1)
      .setNumberFormat('₹#,##0.00;[Red]-₹#,##0.00');

    for (var i = 0; i < txRows.length; i++) {
      if (i % 2 === 1) {
        sheet.getRange(transactionsTitleRow + 2 + i, 1, 1, 6).setBackground("#F9F9F9");
      }
    }
  }

  sheet.setFrozenRows(0);
}

function styleMetricBlock_(range, background, fontColor) {
  range
    .setBackground(background)
    .setFontColor(fontColor)
    .setBorder(false, false, false, false, false, false);
}

function formatTimestamp_(isoString) {
  if (!isoString) return "";
  return Utilities.formatDate(new Date(isoString), Session.getScriptTimeZone(), "MMM d, yyyy, h:mm a");
}

function numberOrZero_(value) {
  return typeof value === "number" ? value : 0;
}

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";

  if (action === "test") {
    return jsonResponse_({
      success: true,
      message: "PocketLedger Google Sheets endpoint is reachable",
      timestamp: new Date().toISOString()
    });
  }

  return jsonResponse_({
    success: false,
    error: "Unsupported GET request"
  });
}


function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}