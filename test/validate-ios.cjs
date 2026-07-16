/* test/validate-ios.cjs — validate the native iOS project so `cap open ios`
   + Archive won't fail on a Mac. Checks pbxproj references, Info.plist,
   Podfile, AppDelegate, storyboards, and that web assets are wired. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const IOS = path.join(ROOT, 'ios', 'App');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + name + (detail ? ' (' + detail + ')' : '')); }
  else { fail++; console.log('  \x1b[31m✗ FAIL:\x1b[0m ' + name + (detail ? ' — ' + detail : '')); }
}
const exists = (rel) => fs.existsSync(path.join(IOS, rel));

console.log('\n[1] project.pbxproj integrity');
{
  const pbx = fs.readFileSync(path.join(IOS, 'App.xcodeproj', 'project.pbxproj'), 'utf8');
  check('pbxproj is non-empty', pbx.length > 1000, pbx.length + ' bytes');
  check('pbxproj has PBXProject section', pbx.includes('isa = PBXProject'));
  check('pbxproj has PBXNativeTarget "App"', pbx.includes('PBXNativeTarget') && pbx.includes('name = App'));
  check('pbxproj references AppDelegate.swift', pbx.includes('AppDelegate.swift'));
  check('pbxproj references Info.plist', pbx.includes('Info.plist'));
  check('pbxproj references capacitor.config.json', pbx.includes('capacitor.config.json'));
  check('pbxproj references Assets.xcassets', pbx.includes('Assets.xcassets'));
  check('pbxproj has Debug build config', pbx.includes('Debug'));
  check('pbxproj has Release build config', pbx.includes('Release'));
  const idCount = (pbx.match(/PRODUCT_BUNDLE_IDENTIFIER = studio\.tumble\.pullpop/g) || []).length;
  check('bundle id in Debug+Release', idCount >= 2, idCount + ' occurrences');
  check('pbxproj objectVersion set', /objectVersion\s*=/.test(pbx));
  const srcRefs = pbx.match(/([\w]+) \/\* (\w+\.swift) /g) || [];
  check('swift source references declared', srcRefs.length > 0, srcRefs.length + ' refs');
}

console.log('\n[2] Every file referenced in build phases exists');
{
  const pbx = fs.readFileSync(path.join(IOS, 'App.xcodeproj', 'project.pbxproj'), 'utf8');
  const nameRefs = new Set();
  const re = /\/\* ([A-Za-z0-9_+.-]+\.(swift|plist|storyboard|json|xcassets|entitlements)) \*\//g;
  let m;
  while ((m = re.exec(pbx)) !== null) nameRefs.add(m[1]);
  let allExist = true;
  const missing = [];
  for (const name of nameRefs) {
    const found = exists('App/' + name) || exists('App/Base.lproj/' + name) || exists('App/Assets.xcassets/' + name);
    if (!found) { allExist = false; missing.push(name); }
  }
  check('all referenced native files exist (' + nameRefs.size + ')', allExist, missing.length ? 'missing: ' + missing.join(', ') : '');
}

console.log('\n[3] Info.plist well-formed + blueprint settings');
{
  const plist = fs.readFileSync(path.join(IOS, 'App', 'Info.plist'), 'utf8');
  check('Info.plist is valid XML plist', plist.includes('<plist version="1.0">') && plist.includes('<dict>'));
  check('CFBundleDisplayName = PULLPOP', plist.includes('<string>PULLPOP</string>'));
  const portrait = (plist.match(/UIInterfaceOrientationPortrait/g) || []).length;
  const landscape = (plist.match(/UIInterfaceOrientationLandscape/g) || []).length;
  check('portrait orientation enabled (§2)', portrait >= 1, portrait + ' entries');
  check('landscape orientation disabled (§2)', landscape === 0, landscape + ' entries');
  check('status bar hidden (§6)', plist.includes('UIStatusBarHidden'));
  check('ProMotion 120Hz enabled (§6)', plist.includes('CADisableMinimumFrameDurationOnPhone'));
  check('no-tracking declaration (§17/§34)', plist.includes('NSUserTrackingUsageDescription'));
  check('background audio capability (§6/§20)', plist.includes('UIBackgroundModes') && plist.includes('<string>audio</string>'));
  check('encryption exempt (§34)', plist.includes('ITSAppUsesNonExemptEncryption'));
}

console.log('\n[4] AppDelegate.swift correctness');
{
  const app = fs.readFileSync(path.join(IOS, 'App', 'AppDelegate.swift'), 'utf8');
  check('imports UIKit + Capacitor', app.includes('import UIKit') && app.includes('import Capacitor'));
  check('hard portrait lock (§2)', app.includes('supportedInterfaceOrientationsFor') && app.includes('.portrait'));
  check('lifecycle bridge (§12)', app.includes('appbackground') && app.includes('appforeground'));
  check('CAPBridgeViewController reference valid', app.includes('CAPBridgeViewController'));
  const open = (app.match(/{/g) || []).length, close = (app.match(/}/g) || []).length;
  check('balanced braces', open === close, open + '/' + close);
}

console.log('\n[5] Podfile + workspace + scheme');
{
  const pod = fs.readFileSync(path.join(IOS, 'Podfile'), 'utf8');
  const platMatch = pod.match(/platform\s+?:ios,\s*['"](\d+(?:\.\d+)?)['"]/);
  const platVer = platMatch ? parseFloat(platMatch[1]) : 0;
  check('Podfile targets iOS 13+', platVer >= 13, platVer ? 'iOS ' + platVer : 'no platform found');
  check('Podfile references Capacitor pod', pod.includes("pod 'Capacitor'"));
  check('Podfile has target App', pod.includes("target 'App'"));
  check('workspace contents.xcworkspacedata exists', exists('App.xcworkspace/contents.xcworkspacedata'));
  check('scheme App.xcscheme exists', exists('App.xcodeproj/xcshareddata/xcschemes/App.xcscheme'));
  const sch = fs.readFileSync(path.join(IOS, 'App.xcodeproj', 'xcshareddata', 'xcschemes', 'App.xcscheme'), 'utf8');
  check('scheme references native target 504EC303...', sch.includes('504EC3031FED79650016851F'));
}

console.log('\n[6] Web assets synced into iOS bundle');
{
  const pub = path.join(IOS, 'App', 'public');
  check('public/index.html exists', fs.existsSync(path.join(pub, 'index.html')));
  const jsFiles = fs.existsSync(path.join(pub, 'js')) ? fs.readdirSync(path.join(pub, 'js')).filter(f => f.endsWith('.js')) : [];
  check('15 web JS files synced (incl. tutorial + analytics)', jsFiles.length === 15, jsFiles.length + ' files');
  check('css synced', fs.existsSync(path.join(pub, 'css', 'style.css')));
  const idx = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  check('index.html references local js/', idx.includes('src="js/'));
  check('index.html references local css/', idx.includes('href="css/'));
}

console.log('\n========================================');
console.log('  iOS PROJECT VALIDATION: ' + pass + ' pass, ' + fail + ' fail');
console.log('========================================');
process.exit(fail > 0 ? 1 : 0);
