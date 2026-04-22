// work-log Google Sheets 연동 v7
// 시트 구조:
//   [운영요원] A:이름 B:급여타입 C:시급/일급 D:전화뒷4 E:은행명 F:계좌번호 G:예금주 H:주민번호
//   [직원]     A:이름 B:급여타입 C:평일시급(or일급) D:주말시급 E:전화뒷4 F:은행명 G:계좌번호 H:예금주 I:주민번호
//   [기록]     A:역할 B:이름 C:날짜 D:출근 E:퇴근 F:행사
//              G:급여타입 H:단가 I:근무시간(h) J:당일급여 K:세금 L:실지급액
//              M:기본급 N:초과수당 O:야간수당
//   [설정]     A:키 B:값 (eventName, eventStart, eventEnd, albaRate, staffWeekday 등)
//
// v6 변경:
// - [기록] 시트에 급여 스냅샷 6개 컬럼 추가 (G-L)
// - ensureRecordHeader()로 기존 시트 헤더 자동 확장
// - addRecord 시 event 비어있으면 [설정]의 eventName 자동 fallback

const RECORD_HEADER = ['역할','이름','날짜','출근','퇴근','행사','급여타입','단가','근무시간(h)','당일급여','세금','실지급액','기본급','초과수당','야간수당'];

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'ping') return ok({status: 'ok'});

  if (action === 'getStaff') {
    const alba = readAlba(ss);
    const staff = readStaff(ss);
    const personal = alba.concat(staff).map(function(p) { return p._pi; }).filter(Boolean);
    alba.forEach(function(p) { delete p._pi; });
    staff.forEach(function(p) { delete p._pi; });
    return ok({alba: alba, staff: staff, settings: readSettings(ss), personal: personal});
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
    sheet.appendRow(RECORD_HEADER);
    body.records.forEach(function(r) {
      sheet.appendRow([
        r.role === 'alba' ? '운영요원' : '직원',
        r.name, r.date,
        r.checkIn || '', r.checkOut || '', r.event || '',
        r.payType === 'daily' ? '일급' : (r.payType ? '시급' : ''),
        r.rate || '',
        r.hours || '',
        r.basePay || '',
        r.tax || '',
        r.net || ''
      ]);
    });
    return ok({status: 'ok'});
  }

  if (body.action === 'syncStaff') {
    const pMap = {};
    (body.personal || []).forEach(function(p) { pMap[p.name] = p; });
    writeAlba(ss, body.alba || [], pMap);
    writeStaff(ss, body.staff || [], pMap);
    return ok({status: 'ok'});
  }

  if (body.action === 'syncSettings') {
    writeSettings(ss, body.settings || {});
    return ok({status: 'ok'});
  }

  if (body.action === 'addRecord') {
    const sheet = getOrCreate(ss, '기록');
    ensureRecordHeader(sheet);
    let eventName = body.event || '';
    if (!eventName) {
      const settings = readSettings(ss);
      if (settings.eventName) eventName = String(settings.eventName);
    }
    sheet.appendRow([
      body.role === 'alba' ? '운영요원' : '직원',
      body.name, body.date,
      body.checkIn || '', '', eventName,
      body.payType === 'daily' ? '일급' : '시급',
      body.rate || '',
      '', '', '', '', '', '', ''
    ]);
    return ok({status: 'ok'});
  }

  if (body.action === 'updateRecord') {
    const sheet = getOrCreate(ss, '기록');
    ensureRecordHeader(sheet);
    const values = sheet.getDataRange().getValues();
    const roleStr = body.role === 'alba' ? '운영요원' : '직원';
    for (let i = 1; i < values.length; i++) {
      const sameRole = values[i][0] === roleStr;
      const sameName = String(values[i][1]).trim() === String(body.name).trim();
      const sameDate = formatSheetDate(values[i][2]) === body.date;
      if (sameRole && sameName && sameDate) {
        if (body.checkOut) sheet.getRange(i + 1, 5).setValue(body.checkOut);
        if (body.checkIn) sheet.getRange(i + 1, 4).setValue(body.checkIn);
        if (body.hours !== undefined && body.hours !== null) sheet.getRange(i + 1, 9).setValue(body.hours);
        if (body.basePay !== undefined && body.basePay !== null) sheet.getRange(i + 1, 10).setValue(body.basePay);
        if (body.tax !== undefined && body.tax !== null) sheet.getRange(i + 1, 11).setValue(body.tax);
        if (body.net !== undefined && body.net !== null) sheet.getRange(i + 1, 12).setValue(body.net);
        if (body.basicPay !== undefined && body.basicPay !== null) sheet.getRange(i + 1, 13).setValue(body.basicPay);
        if (body.overPay !== undefined && body.overPay !== null) sheet.getRange(i + 1, 14).setValue(body.overPay);
        if (body.nightPay !== undefined && body.nightPay !== null) sheet.getRange(i + 1, 15).setValue(body.nightPay);
        return ok({status: 'ok'});
      }
    }
    return ok({status: 'not_found'});
  }

  if (body.action === 'createPayrollSheet') {
    return ok(createPayrollSheet(ss, body));
  }

  return ok({status: 'ok'});
}

function createPayrollSheet(ss, body) {
  var role = body.role;
  var sheetName = role === 'alba' ? '지급표_운영요원' : '지급표_직원';
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    sheet.clearContents();
    sheet.clearFormats();
  } else {
    sheet = ss.insertSheet(sheetName);
  }

  var eventName = body.eventName || '행사';
  var today = body.today || '';
  var header = body.header || [];
  var rows = body.rows || [];
  var sumRow = body.sumRow || [];

  // 제목행
  sheet.appendRow([eventName + ' ' + (role === 'alba' ? '운영요원' : '직원') + ' 급여 지급표']);
  sheet.appendRow(['추출일: ' + today]);
  sheet.appendRow([]);

  // 헤더
  sheet.appendRow(header);
  var headerRow = 4;

  // 합계행
  sheet.appendRow(sumRow);

  // 데이터행
  rows.forEach(function(r) { sheet.appendRow(r); });

  var totalRows = 3 + 1 + 1 + rows.length;

  // 서식
  var titleRange = sheet.getRange(1, 1, 1, header.length);
  titleRange.merge();
  titleRange.setFontWeight('bold').setFontSize(13);

  var headerRange = sheet.getRange(headerRow, 1, 1, header.length);
  headerRange.setFontWeight('bold')
    .setBackground('#e8eaf6')
    .setHorizontalAlignment('center');

  var sumRange = sheet.getRange(5, 1, 1, header.length);
  sumRange.setFontWeight('bold').setBackground('#fce4ec');

  // 숫자 컬럼 포맷 (기본급여 이후)
  var numStart = 9 + (body.header.length - 20); // allDates 동적 오프셋
  if (rows.length > 0) {
    var lastRow = 5 + rows.length;
    var numCols = ['총 근무시간(h)','기본급여','추가수당','총급여','소득세(3%)','지방소득세','공제계','차인지급액'];
    numCols.forEach(function(col) {
      var idx = header.indexOf(col);
      if (idx >= 0) {
        sheet.getRange(5, idx + 1, lastRow - 4, 1).setNumberFormat('#,##0');
      }
    });
  }

  // 열 너비 자동 조절
  sheet.autoResizeColumns(1, header.length);

  return { status: 'ok', sheetUrl: ss.getUrl() };
}

function ensureRecordHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(RECORD_HEADER);
    return;
  }
  // 기존 헤더를 v6 스펙으로 확장/덮어쓰기
  sheet.getRange(1, 1, 1, RECORD_HEADER.length).setValues([RECORD_HEADER]);
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
  return values.slice(1).filter(function(r){return r[0] && String(r[0]).trim() !== '이름';}).map(function(r){
    const name = String(r[0]).trim();
    const obj = {
      name: name,
      payType: String(r[1]||'시급').indexOf('일')>=0 ? 'daily' : 'hourly',
      rate: parseInt(r[2]) || 0
    };
    const p4 = String(r[3]||'').replace(/[^0-9]/g,'').slice(-4);
    if (p4.length === 4) obj.phone4 = p4;
    obj._pi = {name: name, bank: String(r[4]||''), account: String(r[5]||''), holder: String(r[6]||''), ssn: String(r[7]||'')};
    return obj;
  });
}

function readStaff(ss) {
  const sheet = ss.getSheetByName('직원');
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function(r){return r[0] && String(r[0]).trim() !== '이름';}).map(function(r){
    const name = String(r[0]).trim();
    const obj = {
      name: name,
      payType: String(r[1]||'시급').indexOf('일')>=0 ? 'daily' : 'hourly',
      rate: parseInt(r[2]) || 0
    };
    if (r[3]) obj.weekendRate = parseInt(r[3]);
    const p4 = String(r[4]||'').replace(/[^0-9]/g,'').slice(-4);
    if (p4.length === 4) obj.phone4 = p4;
    obj._pi = {name: name, bank: String(r[5]||''), account: String(r[6]||''), holder: String(r[7]||''), ssn: String(r[8]||'')};
    return obj;
  });
}

function readRecords(ss) {
  const sheet = ss.getSheetByName('기록');
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function(r){return r[1];}).map(function(r){
    const obj = {
      role: r[0] === '운영요원' ? 'alba' : 'staff',
      name: String(r[1]).trim(),
      date: formatSheetDate(r[2]),
      checkIn: formatSheetTime(r[3]),
      checkOut: formatSheetTime(r[4]),
      event: String(r[5] || '')
    };
    if (r[6]) obj.payType = String(r[6]).indexOf('일') >= 0 ? 'daily' : 'hourly';
    if (r[7]) obj.rate = parseInt(r[7]) || 0;
    if (r[8] !== '' && r[8] != null) obj.hours = parseFloat(r[8]) || 0;
    if (r[9] !== '' && r[9] != null) obj.basePay = parseInt(r[9]) || 0;
    if (r[10] !== '' && r[10] != null) obj.tax = parseInt(r[10]) || 0;
    if (r[11] !== '' && r[11] != null) obj.net = parseInt(r[11]) || 0;
    return obj;
  });
}

function writeAlba(ss, list, pMap) {
  const sheet = getOrCreate(ss, '운영요원');
  sheet.clearContents();
  sheet.appendRow(['이름', '급여타입', '시급/일급', '전화뒷4', '은행명', '계좌번호', '예금주', '주민번호']);
  list.forEach(function(p) {
    const pi = (pMap && pMap[p.name]) || {};
    sheet.appendRow([
      p.name,
      p.payType === 'daily' ? '일급' : '시급',
      p.rate || '',
      p.phone4 || '',
      pi.bank || '',
      pi.account || '',
      pi.holder || '',
      pi.ssn || ''
    ]);
  });
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 4, sheet.getLastRow() - 1, 1).setNumberFormat('@');
    sheet.getRange(2, 8, sheet.getLastRow() - 1, 1).setNumberFormat('@');
  }
}

function writeStaff(ss, list, pMap) {
  const sheet = getOrCreate(ss, '직원');
  sheet.clearContents();
  sheet.appendRow(['이름', '급여타입', '평일시급/일급', '주말시급', '전화뒷4', '은행명', '계좌번호', '예금주', '주민번호']);
  list.forEach(function(p) {
    const pi = (pMap && pMap[p.name]) || {};
    sheet.appendRow([
      p.name,
      p.payType === 'daily' ? '일급' : '시급',
      p.rate || '',
      p.weekendRate || '',
      p.phone4 || '',
      pi.bank || '',
      pi.account || '',
      pi.holder || '',
      pi.ssn || ''
    ]);
  });
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 5, sheet.getLastRow() - 1, 1).setNumberFormat('@');
    sheet.getRange(2, 9, sheet.getLastRow() - 1, 1).setNumberFormat('@');
  }
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
