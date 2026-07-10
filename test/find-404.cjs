const path=require('path'),fs=require('fs');
const npxCache=path.join(process.env.HOME||process.env.USERPROFILE,'AppData','Local','npm-cache','_npx');
let puppeteer=null;
for(const dir of fs.readdirSync(npxCache)){const c=path.join(npxCache,dir,'node_modules','puppeteer-core');if(fs.existsSync(path.join(c,'package.json'))){puppeteer=require(c);break;}}
(async()=>{
  const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--no-sandbox']});
  const p=await b.newPage();
  const failed=[];
  p.on('requestfailed',r=>failed.push('FAIL '+r.url()));
  p.on('response',r=>{if(r.status()===404)failed.push('404 '+r.url());});
  await p.goto('https://closebug.github.io/pullpop-pocket-beasts/',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,1000));
  console.log('404/failed resources:');failed.forEach(f=>console.log(' ',f));
  await b.close();
})();
