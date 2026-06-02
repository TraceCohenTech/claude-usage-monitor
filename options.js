// Replace with your Formspree form ID — sign up free at formspree.io
const FORMSPREE_URL = 'https://formspree.io/f/xwvzzwwz';

const DEFAULTS = {
  threshold1: 75,
  threshold2: 90,
  soundEnabled: true,
  rateWarningEnabled: true,
  rateWarningMinutes: 60,
};

const $ = (id) => document.getElementById(id);

// ── Welcome banner ────────────────────────────────────────────────────────────

const isWelcome = new URLSearchParams(location.search).get('welcome') === '1';
if (isWelcome) {
  $('welcome').classList.add('visible');
  chrome.storage.local.set({ welcomeSeen: true });
} else {
  chrome.storage.local.get('welcomeSeen', ({ welcomeSeen }) => {
    if (!welcomeSeen) {
      $('welcome').classList.add('visible');
      chrome.storage.local.set({ welcomeSeen: true });
    }
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────

function toggleRateDetails() {
  $('rate-details').classList.toggle('visible', $('rateWarningEnabled').checked);
}

chrome.storage.sync.get(DEFAULTS, (prefs) => {
  $('threshold1').value           = prefs.threshold1;
  $('threshold2').value           = prefs.threshold2;
  $('soundEnabled').checked       = prefs.soundEnabled;
  $('rateWarningEnabled').checked = prefs.rateWarningEnabled;
  $('rateWarningMinutes').value   = prefs.rateWarningMinutes;
  toggleRateDetails();
});

$('rateWarningEnabled').addEventListener('change', toggleRateDetails);

$('save').addEventListener('click', () => {
  const t1 = parseInt($('threshold1').value);
  const t2 = parseInt($('threshold2').value);
  if (t1 >= t2) { alert('Warning threshold must be lower than the critical threshold.'); return; }
  chrome.storage.sync.set({
    threshold1: t1, threshold2: t2,
    soundEnabled: $('soundEnabled').checked,
    rateWarningEnabled: $('rateWarningEnabled').checked,
    rateWarningMinutes: parseInt($('rateWarningMinutes').value),
  }, () => {
    const msg = $('saved-msg');
    msg.classList.add('visible');
    setTimeout(() => msg.classList.remove('visible'), 2500);
  });
});

// ── Signup form ───────────────────────────────────────────────────────────────

// Restore if already submitted
chrome.storage.local.get('signupSubmitted', ({ signupSubmitted }) => {
  if (signupSubmitted) showSuccess();
});

function showSuccess() {
  $('signup-form').style.display = 'none';
  $('form-success').classList.add('visible');
}

$('btn-submit').addEventListener('click', async () => {
  const firstName = $('first-name').value.trim();
  const lastName  = $('last-name').value.trim();
  const email     = $('email').value.trim();
  const zip       = $('zip').value.trim();

  if (!firstName || !email || !email.includes('@')) {
    $('email').focus();
    return;
  }

  $('btn-submit').disabled = true;
  $('btn-submit').textContent = 'Submitting…';
  $('form-error').classList.remove('visible');

  try {
    const res = await fetch(FORMSPREE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        type: 'signup',
        first_name: firstName,
        last_name: lastName,
        email,
        zip,
      }),
    });

    if (!res.ok) throw new Error('bad response');

    chrome.storage.local.set({ signupSubmitted: true });
    showSuccess();
  } catch {
    $('btn-submit').disabled = false;
    $('btn-submit').textContent = 'Subscribe to updates';
    $('form-error').classList.add('visible');
  }
});

// ── Feedback links (must open via chrome.tabs in extension context) ───────────

['link-bug', 'link-feature'].forEach(id => {
  $(id)?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: e.currentTarget.href });
  });
});
