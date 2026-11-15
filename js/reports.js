// Shared by admin/reports.html and management/index.html.
// Needs js/app.js (sb, esc, toast, niceError) to be loaded first.
const RTZ = 'Africa/Lagos';
const lagosToday = () => new Date().toLocaleDateString('en-CA', { timeZone: RTZ });
const monthStart = () => lagosToday().slice(0, 8) + '01';
const tFmt = iso => iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: RTZ, hour: '2-digit', minute: '2-digit', hour12: true }) : '';
const STATE_LABEL = {
  present: 'Present', late: 'Late', incomplete: 'Incomplete', 'at school': 'At school',
  'no arrival': 'No arrival', absent: 'Absent', excused: 'Excused'
};

// Read every page of a result (the API returns at most 1000 rows at a time)
async function pageAll(make) {
  let out = [], from = 0;
  for (;;) {
    const { data, error } = await make(from, from + 999);
    if (error) throw error;
    out = out.concat(data);
    if (data.length < 1000) return out;
    from += 1000;
  }
}

// f = { from, to, cls, q, status, session }
function fetchReport(f) {
  return pageAll((a, b) => sb.rpc('attendance_report', {
    p_from: f.from, p_to: f.to, p_class: f.cls || null, p_search: f.q || null,
    p_status: f.status || null, p_session: f.session || null
  }).range(a, b));
}

const REPORT_HEAD = ['Student', 'ID number', 'Class', 'Date', 'Clock-in', 'Clock-out', 'Status', 'Recorded by'];
const reportRows = data => data.map(r => [
  r.student_name, r.student_number, r.class_name, r.school_date, tFmt(r.arrival_at), tFmt(r.departure_at),
  STATE_LABEL[r.state] || r.state, (r.recorded_by || '') + (r.is_manual ? ' (manual)' : '')
]);

// Show the report as a list. opts.fix = true adds a Correct button (administrators).
function renderReport(el, data, opts) {
  const fix = opts && opts.fix;
  el.innerHTML = data.slice(0, 500).map((r, i) => `<div class="row">
    <div class="grow"><b>${esc(r.student_name)}</b><br><small>${esc(r.student_number)} | ${esc(r.class_name)} | ${esc(r.school_date)}</small><br>
    <small>In ${esc(tFmt(r.arrival_at) || '-')} | Out ${esc(tFmt(r.departure_at) || '-')} | <b>${esc(STATE_LABEL[r.state] || r.state)}</b>${r.recorded_by ? ' | ' + esc(r.recorded_by) : ''}${r.is_manual ? ' | manual' : ''}</small>${r.note ? `<br><small>Reason: ${esc(r.note)}</small>` : ''}</div>
    ${fix ? `<button class="btn sm" data-fix="${i}">Correct</button>` : ''}</div>`).join('')
    || '<p class="muted">No records match these filters.</p>';
  if (data.length > 500) el.insertAdjacentHTML('beforeend', '<p class="muted">Showing the first 500 rows. Exports contain every row.</p>');
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function exportCSV(data, name) {
  // a leading apostrophe stops spreadsheet programs treating text as a formula
  const q = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const lines = [REPORT_HEAD, ...reportRows(data)].map(r => r.map(q).join(','));
  downloadBlob(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), name + '.csv');
}

function exportXLSX(data, name) {
  if (!window.XLSX) return toast('The Excel tool did not load. Check your internet and refresh.', true);
  const ws = XLSX.utils.aoa_to_sheet([REPORT_HEAD, ...reportRows(data)]);
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, name + '.xlsx');
}

function exportPDF(data, name, title, subtitle) {
  if (!window.jspdf) return toast('The PDF tool did not load. Check your internet and refresh.', true);
  const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14); doc.text(title, 14, 14);
  doc.setFontSize(9); doc.text(subtitle, 14, 20);
  doc.autoTable({
    head: [REPORT_HEAD], body: reportRows(data), startY: 24,
    styles: { fontSize: 8 }, headStyles: { fillColor: [15, 107, 79] }
  });
  doc.save(name + '.pdf');
}

function classLabel(c) { return c.class_name + (c.arm ? ' ' + c.arm : ''); }
