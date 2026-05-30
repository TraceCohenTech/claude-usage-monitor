const DEFAULTS = {
  threshold1: 75,
  threshold2: 90,
  soundEnabled: true,
  rateWarningEnabled: true,
  rateWarningMinutes: 60,
};

const $ = (id) => document.getElementById(id);

function toggleRateDetails() {
  const enabled = $('rateWarningEnabled').checked;
  $('rate-details').classList.toggle('visible', enabled);
}

// Load saved settings
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

  if (t1 >= t2) {
    alert('Warning threshold must be lower than the critical threshold.');
    return;
  }

  chrome.storage.sync.set({
    threshold1: t1,
    threshold2: t2,
    soundEnabled: $('soundEnabled').checked,
    rateWarningEnabled: $('rateWarningEnabled').checked,
    rateWarningMinutes: parseInt($('rateWarningMinutes').value),
  }, () => {
    const msg = $('saved-msg');
    msg.classList.add('visible');
    setTimeout(() => msg.classList.remove('visible'), 2500);
  });
});
