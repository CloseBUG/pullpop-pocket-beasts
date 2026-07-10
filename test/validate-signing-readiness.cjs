#!/usr/bin/env node
/* scripts/check-signing-readiness.cjs
   Self-check: verifies the repo has everything needed for signed TestFlight builds
   BEFORE you push. Run after `scripts/set-signing-secrets.sh`.
   Run: node scripts/check-signing-readiness.cjs */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let ok = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { ok++; console.log(`  \x1b[32m✓\x1b[0m ${name}${detail ? ' (' + detail + ')' : ''}`); }
  else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ' — ' + detail : ''}`); }
};

console.log('PULLPOP — TestFlight Signing Readiness Check\n');

// [1] Workflow file integrity
console.log('[1] Workflow integrity');
{
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ios-build.yml'), 'utf8');
  check('runs on macos-14', wf.includes('runs-on: macos-14'));
  check('has signed build step', wf.includes('Build app archive (signed)'));
  check('uses CODE_SIGN_IDENTITY iPhone Distribution', wf.includes('iPhone Distribution'));
  check('uses PROVISIONING_PROFILE_SPECIFIER', wf.includes('PROVISIONING_PROFILE_SPECIFIER'));
  check('has exportArchive step', wf.includes('exportArchive'));
  check('has upload to TestFlight step', wf.includes('altool'));
  check('secrets referenced at job-level env', wf.includes('secrets.BUILD_CERTIFICATE_BASE64'));
  check('detects signing mode step', wf.includes('Detect signing mode'));
}

// [2] Helper scripts
console.log('\n[2] Helper scripts');
{
  check('scripts/setup-signing.sh exists', fs.existsSync(path.join(ROOT, 'scripts', 'setup-signing.sh')));
  check('scripts/set-signing-secrets.sh exists', fs.existsSync(path.join(ROOT, 'scripts', 'set-signing-secrets.sh')));
  check('scripts/build-ios.sh exists', fs.existsSync(path.join(ROOT, 'scripts', 'build-ios.sh')));
  check('build/ExportOptions.plist.example exists', fs.existsSync(path.join(ROOT, 'build', 'ExportOptions.plist.example')));
}

// [3] GitHub secrets (requires gh CLI + network)
console.log('\n[3] GitHub secrets (if authenticated)');
{
  const REPO = 'CloseBUG/pullpop-pocket-beasts';
  const ghAvailable = (() => { try { execSync('gh --version', { stdio: 'pipe' }); return true; } catch { return false; } })();
  if (!ghAvailable) {
    console.log('  (gh CLI not available — skipping secret checks)');
  } else {
    // gh secret list works if authenticated
    try {
      const out = execSync(`gh secret list --repo ${REPO}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const secretNames = out.split('\n').map(l => l.split(/\s/)[0]).filter(Boolean);
      const needed = ['BUILD_CERTIFICATE_BASE64', 'P12_PASSWORD', 'BUILD_PROVISION_PROFILE_BASE64', 'KEYCHAIN_PASSWORD', 'EXPORT_OPTIONS_PLIST'];
      for (const s of needed) {
        check(`secret ${s}`, secretNames.includes(s), secretNames.includes(s) ? 'set' : 'NOT SET');
      }
      const allSet = needed.every(s => secretNames.includes(s));
      check('\nREADY FOR SIGNED BUILD', allSet, allSet ? 'all 5 secrets present — git push will produce a signed .ipa' : 'some secrets missing');
    } catch (e) {
      console.log('  (not authenticated to GitHub — run `gh auth login`)');
    }
  }
}

// [4] Bundle ID consistency
console.log('\n[4] Bundle ID consistency');
{
  const cap = JSON.parse(fs.readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8'));
  check(`capacitor.config appId = ${cap.appId}`, cap.appId === 'studio.tumble.pullpop');
  const pbx = fs.readFileSync(path.join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');
  check('pbxproj matches appId', pbx.includes(cap.appId));
  const plist = fs.readFileSync(path.join(ROOT, 'ios', 'App', 'App', 'Info.plist'), 'utf8');
  check('ExportOptions example uses appId', fs.readFileSync(path.join(ROOT, 'build', 'ExportOptions.plist.example'), 'utf8').includes(cap.appId));
}

console.log(`\n${'='.repeat(50)}`);
console.log(`  Readiness: ${ok} pass, ${fail} fail`);
console.log(`${'='.repeat(50)}`);
process.exit(fail > 0 ? 1 : 0);
