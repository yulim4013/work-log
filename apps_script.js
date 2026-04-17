// work-log Google Sheets 연동 v3
// 시트 구조:
//   [운영요원] A:이름 B:급여타입(시급/일급) C:시급/일급 D:전화뒷4
//   [직원]     A:이름 B:급여타입 C:평일시급(or일급) D:주말시급 E:전화뒷4
//   [기록]     A:역할 B:이름 C:날짜 D:출근 E:퇴근 F:행사

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'ping') return ok({status: 'ok'});

  if (action === 'getStaff') {
    return ok({
      alba: readAlba(ss),
      staff: readStaff(ss)
    });
  }

  return ok({status: 'ok'});
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (body.action === 'syncRecords') {
    const sheet = getOrCreate(ss, '기록');
    sheet.clearContents();
    sheet.appendRow(['역할', '이름', '날짜', '출근', '퇴근', '행사']);
    body.records.forEach(function(r) {
      sheet.appendRow([
        r.role === 'alba' ? '운영요원' : '직원',
        r.name, r.date,
        r.checkIn || '', r.checkOut || '', r.event || ''
      ]);
    });
    return ok({status: 'ok'});
  }

  if (body.action === 'syncStaff') {
    writeAlba(ss, body.alba || []);
    writeStaff(ss, body.staff || []);
    return ok({status: 'ok'});
  }

  if (body.action === 'addRecord') {
    const sheet = getOrCreate(ss, '기록');
    if (sheet.getLastRow() === 0) sheet.appendRow(['역할','이름','날짜','출근','퇴근','행사']);
    sheet.appendRow([
      body.role === 'alba' ? '운영요원' : '직원',
      body.name, body.date,
      body.checkIn || '', '', body.event || ''
    ]);
    return ok({status: 'ok'});
  }

  return ok({status: 'ok'});
}

function getOrCreate(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function readAlba(ss) {
  const sheet = ss.getSheetByName('운영요원');
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function(r){return r[0];}).map(function(r){
    const obj = {
      name: String(r[0]).trim(),
      payType: String(r[1]||'시급').indexOf('일')>=0 ? 'daily' : 'hourly',
      rate: parseInt(r[2]) || 0
    };
    const p4 = String(r[3]||'').replace(/[^0-9]/g,'').slice(-4);
    if (p4.length === 4) obj.phone4 = p4;
    return obj;
  });
}

function readStaff(ss) {
  const sheet = ss.getSheetByName('직원');
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function(r){return r[0];}).map(function(r){
    const obj = {
      name: String(r[0]).trim(),
      payType: String(r[1]||'시급').indexOf('일')>=0 ? 'daily' : 'hourly',
      rate: parseInt(r[2]) || 0
    };
    if (r[3]) obj.weekendRate = parseInt(r[3]);
    const p4 = String(r[4]||'').replace(/[^0-9]/g,'').slice(-4);
    if (p4.length === 4) obj.phone4 = p4;
    return obj;
  });
}

function writeAlba(ss, list) {
  const sheet = getOrCreate(ss, '운영요원');
  sheet.clearContents();
  sheet.appendRow(['이름', '급여타입', '시급/일급', '전화뒷4']);
  list.forEach(function(p) {
    sheet.appendRow([
      p.name,
      p.payType === 'daily' ? '일급' : '시급',
      p.rate || '',
      p.phone4 || ''
    ]);
  });
}

function writeStaff(ss, list) {
  const sheet = getOrCreate(ss, '직원');
  sheet.clearContents();
  sheet.appendRow(['이름', '급여타입', '평일시급/일급', '주말시급', '전화뒷4']);
  list.forEach(function(p) {
    sheet.appendRow([
      p.name,
      p.payType === 'daily' ? '일급' : '시급',
      p.rate || '',
      p.weekendRate || '',
      p.phone4 || ''
    ]);
  });
}

function ok(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
