import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const file=new URL('../extension/diagnostics.js',import.meta.url);
test('page diagnostics exists',()=>assert.ok(existsSync(file),'页面诊断尚未实现'));
if(existsSync(file)){
 const context=vm.createContext({URL});vm.runInContext(readFileSync(file,'utf8'),context);
 test('diagnostics records layout and public note links but excludes secrets and text',()=>{
  const doc=new JSDOM('<title>公开账号</title><input type="password" value="PASSWORDSECRET"><div data-e2e="card"><a href="/note/7365500792104684834?token=TOKENSECRET">公开笔记</a><img src="https://p3.douyinpic.com/photo.png?signature=SIGNSECRET"></div><script>window.token="SCRIPTSECRET"</script>',{url:'https://www.douyin.com/user/public-id?token=URLSECRET'}).window.document;
  doc.cookie='session=COOKIESECRET';const result=context.DouyinDiagnostics.collect(doc);const json=JSON.stringify(result);
  assert.equal(result.url,'https://www.douyin.com/user/public-id');assert.ok(json.includes('/note/7365500792104684834'));assert.ok(json.includes('data-e2e'));assert.ok(json.includes('p3.douyinpic.com'));assert.ok(!json.includes('photo.png'));
  for(const secret of ['PASSWORDSECRET','TOKENSECRET','SIGNSECRET','SCRIPTSECRET','URLSECRET','COOKIESECRET','公开笔记'])assert.ok(!json.includes(secret),secret);
 });
}
if(existsSync(file)){
 const context=vm.createContext({URL});vm.runInContext(readFileSync(file,'utf8'),context);
 test('diagnostics excludes hidden authentication assets, arbitrary IDs and path-carried secrets',()=>{
  const doc=new JSDOM('<div class="login-dialog" style="display:none" data-id="ATTRSECRET"><img src="https://auth.example/qr/SESSIONSECRET"></div><div data-id="TOKENSECRET"><img src="https://p3.douyinpic.com/tos-cn-i-0813/PATHSECRET.png"></div><form><img src="https://p3.douyinpic.com/form/FORMSECRET.png"></form><a href="https://auth.example/passport/AUTHSECRET">登录</a><a href="/note/7365500792104684834">笔记</a>',{url:'https://www.douyin.com/user/public-id'}).window.document;
  const data=context.DouyinDiagnostics.collect(doc),json=JSON.stringify(data);
  for(const secret of ['ATTRSECRET','SESSIONSECRET','TOKENSECRET','PATHSECRET','FORMSECRET','AUTHSECRET','auth.example'])assert.ok(!json.includes(secret),secret);
  assert.ok(json.includes('/note/7365500792104684834'));
 });
}
