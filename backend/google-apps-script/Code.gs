const SHEET_NAME = "responses";

const HEADERS = [
  "submittedAt",
  "displayName",
  "github",
  "email",
  "skills",
  "pcType",
  "pcDetail",
  "environment",
  "otherAiTools",
  "interests",
  "goal",
  "homeworkExample",
  "buildIdea",
  "presentationWilling",
  "presentationTopic",
  "notes",
  "rawJson"
];

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const data = JSON.parse(body);
    const sheet = getSheet_();
    ensureHeader_(sheet);

    const row = HEADERS.map((key) => {
      if (key === "submittedAt") {
        return (data._meta && data._meta.submittedAt) || new Date().toISOString();
      }
      if (key === "rawJson") {
        return JSON.stringify(data);
      }
      return formatValue_(data[key]);
    });

    LockService.getScriptLock().waitLock(10000);
    sheet.appendRow(row);
    LockService.getScriptLock().releaseLock();

    return json_({ ok: true });
  } catch (err) {
    try {
      LockService.getScriptLock().releaseLock();
    } catch (releaseErr) {}
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: "AI Workshop Form" });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function ensureHeader_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeader = current.some((value) => value);
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function formatValue_(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
