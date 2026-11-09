// Shared helpers used by every page.
// NOTE: checks here only decide what the screen shows. Real protection is
// the database (Row Level Security + secure functions) from Phases 1-3.
const cfg = window.APP_CONFIG || {};
const configOk = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
  !cfg.SUPABASE_URL.includes('PASTE') && !cfg.SUPABASE_ANON_KEY.includes('PASTE');
const sb = supabase.createClient(
  configOk ? cfg.SUPABASE_URL : 'https://invalid.supabase.co',
  configOk ? cfg.SUPABASE_ANON_KEY : 'not-set',
  { auth: { persistSession: true, autoRefreshToken: true } }
);
if (!configOk) {
  document.addEventListener('DOMContentLoaded', () =>
    document.body.insertAdjacentHTML('afterbegin',
      '<p class="err">Setup incomplete: open config.js and paste your Project URL and public key.</p>'));
}

// Escape text before putting it into HTML (stops script injection)
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, bad) {
  const t = document.getElementById('toast');
  if (!t) return alert(msg);
  t.textContent = msg;
  t.className = bad ? 'show bad' : 'show';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = ''; }, 4500);
}

function niceError(e) {
  const m = (e && e.message) || String(e);
  if (e && e.code === '23505') return 'That value already exists. Use a different one.';
  if (e && e.code === '23503') return 'It is still in use by other records, so it cannot be removed.';
  if (e && (e.code === '42501' || /permission denied|row-level security/i.test(m))) return 'You do not have permission to do that.';
  return m;
}

async function getProfile() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb.from('user_profiles')
    .select('id,full_name,role,is_active').eq('id', session.user.id).maybeSingle();
  return error ? null : data;
}

// Call at the top of a protected page. root = path back to the site root.
// roles = list of roles allowed on this page, e.g. ['teacher','admin'].
async function requireRole(root, roles) {
  const p = await getProfile();
  if (!p || !p.is_active || !roles.includes(p.role)) {
    location.href = root + 'index.html';
    return null;
  }
  const who = document.getElementById('who');
  if (who) who.textContent = p.full_name;
  const out = document.getElementById('logoutBtn');
  if (out) out.onclick = async () => { await sb.auth.signOut(); location.href = root + 'index.html'; };
  return p;
}
const requireAdmin = root => requireRole(root, ['admin']);
