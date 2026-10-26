import { chromium } from '@playwright/test';
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await (await browser.newContext()).newPage();
page.on('pageerror',e=>console.log('pageerror',e.message.slice(0,150)));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'commit'});
await page.waitForFunction(()=>!document.querySelector('#boot-shell'),null,{timeout:300000});
const play=page.getByRole('button',{name:'Fly now',exact:true});
const cf=page.locator('[data-action="confirm-pilot-name"]');
await play.or(cf).waitFor({state:'visible',timeout:300000});
if(await cf.isVisible().catch(()=>false)){await page.getByRole('button',{name:'Random name',exact:true}).click();await cf.click();}
await play.waitFor({state:'visible',timeout:300000});
await page.locator('[data-ref="menuCard"] [data-action="open-live"]:not(.onboarding-route-step)').first().dispatchEvent('click');
await page.waitForFunction(()=>document.querySelector('[data-ref="menuCard"] .screen-head h2')?.textContent?.includes('Race Lobby'),null,{timeout:60000});
console.log('in lobby');
const f=page.locator('#race-room-code');
console.log('roomCode inputs found:', await page.locator('#race-room-code').count());
console.log('data-ref=roomCode found:', await page.locator('[data-ref="roomCode"]').count());
console.log('join buttons:', await page.locator('[data-action="join-room"]').count());
await f.fill('TWD6');
console.log('value after fill:', JSON.stringify(await f.inputValue()));
await page.locator('[data-action="join-room"]').first().dispatchEvent('click');
for (let i=0;i<10;i++){
  await page.waitForTimeout(1500);
  const toasts = await page.locator('[data-ref="toastLayer"], .toast, [class*="toast"]').allTextContents().catch(()=>[]);
  const val = await page.locator('[data-ref="roomCode"]').inputValue().catch(()=>'(none)');
  const ws = 'n/a';
  console.log(`t+${(i+1)*1.5}s toasts=${JSON.stringify(toasts.slice(0,4))} fieldValue=${JSON.stringify(val)}`);
}
await browser.close();
