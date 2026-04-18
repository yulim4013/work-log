// work-log Google Sheets 연동 v4
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
      staff: readStaff(ss),
      settings: readSettings(ss)
    });
  }

  if (action === 'getSettings') {
    return ok({settings: readSettings(ss)});
  }

  if (action === 'getRecords') {
    return ok({records: readRecords(ss)});
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

  if (body.action === 'syncSettings') {
    writeSettings(ss, body.settings || {});
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

  if (body.action === 'updateRecord') {
    const sheet = getOrCreate(ss, '기록');
    const values = sheet.getDataRange().getValues();
    const roleStr = body.role === 'alba' ? '운영요원' : '직원';
    for (let i = 1; i < values.length; i++) {
      const sameRole = values[i][0] === roleStr;
      const sameName = String(values[i][1]).trim() === String(body.name).trim();
      const sameDate = formatSheetDate(values[i][2]) === body.date;
      if (sameRole && sameName && sameDate) {
        if (body.checkOut) sheet.getRange(i + 1, 5).setValue(body.checkOut);
        if (body.checkIn) sheet.getRange(i + 1, 4).setValue(body.checkIn);
        return ok({status: 'ok'});
      }
    }
    return ok({status: 'not_found'});
  }

  return ok({status: 'ok'});
}

function getOrCreate(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function formatSheetDate(v) {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  return String(v);
}

function formatSheetTime(v) {
  if (!v) return '';
  if (v instanceof Date) {
    const h = v.getHours();
    const m = v.getMinutes();
    const ampm = h >= 12 ? '오후' : '오전';
    const h12 = h % 12 || 12;
    return ampm + ' ' + h12 + ':' + String(m).padStart(2, '0');
  }
  return String(v);
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

function readRecords(ss) {
  const sheet = ss.getSheetByName('기록');
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function(r){return r[1];}).map(function(r){
    return {
      role: r[0] === '운영요원' ? 'alba' : 'staff',
      name: String(r[1]).trim(),
      date: formatSheetDate(r[2]),
      checkIn: formatSheetTime(r[3]),
      checkOut: formatSheetTime(r[4]),
      event: String(r[5] || '')
    };
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

function readSettings(ss) {
  const sheet = ss.getSheetByName('설정');
  if (!sheet) return {};
  const values = sheet.getDataRange().getValues();
  const obj = {};
  values.slice(1).forEach(function(r) {
    if (r[0]) {
      let v = r[1];
      if (v instanceof Date) v = formatSheetDate(v);
      obj[String(r[0]).trim()] = v;
    }
  });
  return obj;
}

function writeSettings(ss, settings) {
  const sheet = getOrCreate(ss, '설정');
  sheet.clearContents();
  sheet.appendRow(['키', '값']);
  Object.keys(settings).forEach(function(k) {
    sheet.appendRow([k, settings[k] == null ? '' : settings[k]]);
  });
}

function ok(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
