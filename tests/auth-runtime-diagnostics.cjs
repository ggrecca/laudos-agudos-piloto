// Disposable CI stack only. Keep SQL/Auth error codes; redact credentials.
const fs=require('node:fs');
const {execFileSync,spawnSync}=require('node:child_process');
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321/.test(process.env.API_URL||''))process.exit(0);
let lines=[];
try{
 const names=execFileSync('docker',['ps','--filter','name=supabase_auth_','--format','{{.Names}}'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 for(const name of names){
  const processResult=spawnSync('docker',['logs',name],{encoding:'utf8'});
  const result=(processResult.stdout||'')+'\n'+(processResult.stderr||'');
  for(const line of result.split('\n')){try{const entry=JSON.parse(line);if(entry.error)lines.push(String(entry.error));}catch{}}
 }
}catch{}
const redact=text=>text.replace(/\$2[abxy]?\$[^\s"',)]+/g,'[redacted-auth-hash]').replace(/(?:Local-ci-only|New-local-test|Changed-local|Locked-local|Another-local|Bypass-local|Unlocked-local)[^\s"',)]+/gi,'[redacted-test-password]').replace(/[a-f0-9]{64}/gi,'[redacted-nonce]');
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/auth-error-codes.log',lines.map(redact).join('\n'));
