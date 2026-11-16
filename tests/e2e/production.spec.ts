import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const out = process.env.ARTIFACT_RUN_DIR || 'artifacts/browser-checks/local';
if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });
function safeWrite(file: string, content: string) {
  for (let i = 0; i < 5; i++) {
    try {
      fs.writeFileSync(file, content);
      return;
    } catch (e) {
      if (i === 4) throw e;
      const waitTill = new Date(new Date().getTime() + 100);
      while (waitTill > new Date()) {}
    }
  }
}
test.beforeEach(async({page})=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));(page as any).__runtimeErrors=errors;});
test.afterEach(async({page},info)=>{expect((page as any).__runtimeErrors,'Không có lỗi runtime/hydration').toEqual([]);if(!page.isClosed()){const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));expect(width.scroll,'Không tràn ngang toàn trang').toBeLessThanOrEqual(width.client+1);}await info.attach('runtime-errors',{body:JSON.stringify((page as any).__runtimeErrors),contentType:'application/json'});});
test('danh mục, tìm Kayle, URL và hồ sơ',async({page},info)=>{
 await page.goto('/champions');await page.waitForLoadState('networkidle');await expect(page.getByRole('heading',{name:'Danh mục tướng Mùa 18'})).toBeVisible();
 expect(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe('rgb(255, 255, 255)');
 const search=page.getByPlaceholder('Tìm theo tên tướng...');await search.fill('Kayle');await page.waitForTimeout(300);await expect(page).toHaveURL(/q=Kayle/);
 const card=page.locator('a[href^="/champions/"]').filter({hasText:/Kayle/}).first();await expect(card).toBeVisible();await card.click();await expect(page.locator('main h1')).toContainText('Kayle');
 await page.screenshot({path:`${out}/${info.project.name}-champion.png`});await page.goBack();await expect(search).toHaveValue('Kayle');
});
test('trang chủ mainmenu hiển thị tổng quan và top đội hình meta',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:/Hiểu thay đổi/i})).toBeVisible();await expect(page.locator('body')).toContainText('nguồn đã xác minh');
});
test('compare notes-only giữa hai bản nhỏ, đảo chiều và refresh',async({page},info)=>{
 await page.goto('/compare');await page.getByLabel('Bản A (Trước)',{exact:true}).selectOption('event_live_18_1_mid_aug27');await page.getByLabel('Bản B (Sau)',{exact:true}).selectOption('event_live_18_1_mid_aug28');
 await expect(page).toHaveURL(/fromRelease=event_live_18_1_mid_aug27/);await expect(page.locator('body')).toContainText(/Theo ghi chú|Mốc này chỉ có mục sửa lỗi/);
 const response=await page.request.get('/api/v1/compare?dataset=real&fromRelease=event_live_18_1_mid_aug27&toRelease=event_live_18_1_mid_aug28');expect(response.ok()).toBe(true);const payload=await response.json();safeWrite(`${out}/${info.project.name}-compare-api.json`,JSON.stringify(payload,null,2));
 await page.screenshot({path:`${out}/${info.project.name}-compare.png`});await page.reload();await expect(page.getByLabel('Bản A (Trước)',{exact:true})).toHaveValue('event_live_18_1_mid_aug27');
 const swap=page.getByRole('button',{name:/Đổi chiều/});await swap.click();await expect(page.getByLabel('Bản A (Trước)',{exact:true})).toHaveValue('event_live_18_1_mid_aug28');
});
test('tìm kiếm bàn phím, focus trap và trang vật phẩm',async({page},info)=>{
 await page.goto('/champions');await page.waitForLoadState('networkidle');const dialog=page.getByRole('dialog',{name:'Tìm kiếm nhanh'});for(let i=0;i<3;i++){await page.keyboard.press('Control+k');if(await dialog.isVisible())break;await page.waitForTimeout(300);}await expect(dialog).toBeVisible();const input=dialog.getByRole('combobox');await expect(input).toBeFocused();await input.fill('Vô Cực');await expect(dialog.getByRole('option').first()).toContainText('Vô Cực');await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/items\/infinityedge/);await expect(page.locator('main h1')).toHaveText('Vô Cực Kiếm');
 await page.screenshot({path:`${out}/${info.project.name}-item.png`});for(let i=0;i<3;i++){await page.keyboard.press('Control+k');if(await dialog.isVisible())break;await page.waitForTimeout(300);}await expect(dialog).toBeVisible();await expect(dialog.getByRole('combobox')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button').last()).toBeFocused();await page.keyboard.press('Tab');await expect(dialog.getByRole('combobox')).toBeFocused();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
});
test('Real/demo isolation, coverage và lịch sử chính',async({page})=>{
 for(const url of ['/api/v1/champions?mode=demo','/api/v1/meta/catalogue?mode=demo','/api/v1/meta/rankings?mode=demo'])expect((await page.request.get(url)).status()).toBe(403);
 const releases=await (await page.request.get('/api/v1/releases?dataset=real')).json();expect(JSON.stringify(releases)).not.toContain('rel_pbe_18_3');
 await page.goto('/meta/websites');await expect(page.locator('body')).toContainText('nguồn đã xác minh');await expect(page.locator('body')).not.toContainText('DEMO MODE');
});
test('bàn cờ nội bộ: lục giác, kéo-thả, khôi phục, đổi nguồn và giữ đồ',async({page},info)=>{
 const bundle=fs.readFileSync('.cache/browser/board-harness.js','utf8');
 await page.goto('/champions');const css=await page.locator('link[rel="stylesheet"]').evaluateAll(es=>es.map(e=>(e as HTMLLinkElement).href));
 await page.setContent(`<html><head>${css.map(h=>`<link rel="stylesheet" href="${h}">`).join('')}</head><body class="bg-slate-950 text-slate-100"><div id="root"></div></body></html>`);await page.addScriptTag({content:bundle});
 const cells=page.locator('[data-cell-shape="hex"]');await expect(cells).toHaveCount(28);
 const from=page.locator('[data-row="3"][data-col="0"]'),to=page.locator('[data-row="2"][data-col="1"]');await from.dragTo(to);await expect(page.getByText('Bản sắp xếp cá nhân',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.stringify((window as any).__source))).toContain('"row":3,"col":0');expect(await page.evaluate(()=>(window as any).__source[0].items[0])).toBe('tft_item_infinityedge');
 await page.screenshot({path:`${out}/${info.project.name}-board-internal.png`});await page.getByRole('button',{name:'Khôi phục bàn cờ gốc'}).click();await expect(from).toHaveAttribute('draggable','true');
 await from.dragTo(to);await page.getByRole('button',{name:'Đổi nguồn kiểm thử'}).click();await expect(page.getByText('Bản sắp xếp cá nhân',{exact:true})).not.toBeVisible();await expect(page.locator('[data-row="2"][data-col="3"]')).toHaveAttribute('draggable','true');
});
test('compare range có thay đổi thật, counts unique và không dựng snapshot notes-only',async({page},info)=>{
 await page.goto('/compare?fromRelease=event_live_18_1_mid_aug27&toRelease=rel_live_18_2&mode=real');
 const res=await page.request.get('/api/v1/compare?dataset=real&fromRelease=event_live_18_1_mid_aug27&toRelease=rel_live_18_2');expect(res.ok()).toBe(true);const payload=await res.json(),data=payload.data;
 safeWrite(`${out}/${info.project.name}-compare-range-api.json`,JSON.stringify(payload,null,2));
 expect(data.changes.length).toBeGreaterThan(0);const ids=new Set(data.changes.filter((c:any)=>c.entityKind==='champion'&&c.entityId&&!(c.before?.state==='known'&&c.after?.state==='known'&&JSON.stringify(c.before.value)===JSON.stringify(c.after.value))).map((c:any)=>c.entityId));
 expect(data.summary.changedChampions).toBe(ids.size);expect(data.summary.totalChampions).toBeNull();await expect(page.locator('article').first()).toBeVisible();await expect(page.locator('body')).toContainText('Theo ghi chú cập nhật');await page.screenshot({path:`${out}/${info.project.name}-compare-range.png`});
 const more=page.getByRole('button',{name:/Xem toàn bộ/}).first();if(await more.count()){await more.click();await expect(page.getByRole('button',{name:/Thu gọn danh sách/}).first()).toBeVisible();}
});

test('giải mã ảnh tướng và trang bị thật trong trình duyệt',async({page})=>{
 await page.goto('/champions?q=Kayle');const champion=page.locator('a[href^="/champions/"] img').first();await expect(champion).toBeVisible();await champion.scrollIntoViewIfNeeded();await expect.poll(()=>champion.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0),{timeout:15000}).toBe(true);
 await page.goto('/items/infinityedge');const item=page.getByAltText('Vô Cực Kiếm').first();await expect(item).toBeVisible();await expect.poll(()=>item.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0),{timeout:15000}).toBe(true);
});

test('luồng danh sách -> chi tiết -> quay lại với snapshot lưu trữ', async({page}, info) => {
 const expectedSnapshotId = 'rank_websites_epoch_18_2_1789304905604';
 const expectedBuildId = 'build_tftacademy_set-18-moo-nara_primary';
 const archiveUrl = `/meta/websites?patch=epoch_18_2&snapshotId=${expectedSnapshotId}&archive=true`;
 await page.goto(archiveUrl);
 await expect(page.locator('body')).toBeVisible();

 // Kiểm tra context ban đầu của snapshot lưu trữ trên trang danh sách
 await expect(page.getByText(expectedSnapshotId).first()).toBeVisible();

 // R6-02: Định vị link comp cụ thể mang snapshotId và build đã biết độc lập từ danh sách
 const detailLink = page.locator(`a[href*="/meta/comps/comp_teemo_yordle"][href*="snapshotId=${expectedSnapshotId}"][href*="buildId=${expectedBuildId}"]`).first();
 await expect(detailLink).toBeVisible();
 const targetHref = await detailLink.getAttribute('href');
 expect(targetHref).toBeTruthy();
 expect(targetHref).toContain(`snapshotId=${expectedSnapshotId}`);
 expect(targetHref).toContain(`buildId=${expectedBuildId}`);
 expect(targetHref).toContain('archive=true');

 // Click thực tế tới trang chi tiết (không dùng goto bypass)
 await detailLink.scrollIntoViewIfNeeded();
 await page.waitForTimeout(500);
 const detailUrlRegex = new RegExp(`/meta/comps/comp_teemo_yordle\\?.*buildId=${expectedBuildId}`);
 for (let attempt = 0; attempt < 3; attempt++) {
   await detailLink.click();
   try {
     await page.waitForURL(detailUrlRegex, { timeout: 4000 });
     break;
   } catch {
     if (attempt < 2) {
       await detailLink.scrollIntoViewIfNeeded();
       await page.waitForTimeout(500);
     }
   }
 }

 // R6-02: Assert độc lập URL trang chi tiết phải chứa đúng buildId và snapshotId kỳ vọng
 await expect(page).toHaveURL(new RegExp(`/meta/comps/comp_teemo_yordle\\?.*buildId=${expectedBuildId}`), { timeout: 30000 });
 await expect(page).toHaveURL(new RegExp(`snapshotId=${expectedSnapshotId}`), { timeout: 30000 });
 await expect(page).toHaveURL(/archive=true/, { timeout: 30000 });

 // R5-03: Kiểm tra tiêu đề đội hình, tướng chủ lực/chống chịu, bàn cờ hex, trang bị và URL nguồn
 const heading = page.getByRole('heading', { level: 1 }).last();
 await expect(heading).toBeVisible({ timeout: 30000 });
 await expect(heading).toContainText('Yunara');

 // Kiểm tra tướng cốt lõi và vai trò
 await expect(page.getByRole('link', { name: /yunara.*Chủ lực/i }).first()).toBeVisible();
 await expect(page.getByRole('link', { name: /alistar.*Chống chịu/i }).first()).toBeVisible();

 // Kiểm tra bàn cờ 28 ô hex và các tướng/đồ trên sân
 const board = page.locator('[data-board-shape="hex-grid-4x7"]');
 await expect(board).toBeVisible();
 const cells = page.locator('[data-cell-shape="hex"]');
 await expect(cells).toHaveCount(28);

 // Kiểm tra tướng chủ lực xuất hiện trên bàn cờ
 await expect(board.getByAltText(/yunara/i).first()).toBeVisible();
 await expect(board.getByAltText(/alistar/i).first()).toBeVisible();

 // R6-02: Định vị nhóm trang bị riêng của từng tướng để assert đúng chủ sở hữu đồ (Yunara ↔ Kiếm Tử Thần, Alistar ↔ Thú Tượng)
 const itemHeading = page.getByRole('heading', { name: /Trang bị tối ưu cho tướng/i });
 await expect(itemHeading).toBeVisible();

 const yunaraEquipCard = page
   .locator('div.rounded-xl.bg-slate-950\\/90')
   .filter({ hasText: 'Yunara' })
   .filter({ hasText: 'Chủ lực' })
   .first();
 await expect(yunaraEquipCard).toBeVisible();
 await expect(yunaraEquipCard.getByText('Kiếm Tử Thần')).toBeVisible();
 await expect(yunaraEquipCard.getByText('Chùy Xích')).toBeVisible();
 await expect(yunaraEquipCard.getByText('Thú Tượng')).not.toBeVisible(); // Không được gán nhầm đồ tank cho carry

 const alistarEquipCard = page
   .locator('div.rounded-xl.bg-slate-950\\/90')
   .filter({ hasText: 'Alistar' })
   .filter({ hasText: 'Chống chịu' })
   .first();
 await expect(alistarEquipCard).toBeVisible();
 await expect(alistarEquipCard.getByText('Thú Tượng')).toBeVisible();
 await expect(alistarEquipCard.getByText('Giáp Máu')).toBeVisible();
 await expect(alistarEquipCard.getByText('Kiếm Tử Thần')).not.toBeVisible(); // Không được gán nhầm đồ carry cho tank

 // Kiểm tra link nguồn đã được xác minh của snapshot/build
 const sourceProofLink = page.locator('a[href*="tftacademy.com/tierlist/comps/set-18-moo-nara"]').first();
 await expect(sourceProofLink).toBeVisible();

 const backLink = page.getByRole('link', { name: 'Quay lại Bảng xếp hạng Đội hình' });
 await expect(backLink).toBeVisible();
 await expect(backLink).toHaveAttribute('href', /\/meta\/websites\?mode=real.*snapshotId=rank_websites_epoch_18_2_1789304905604.*archive=true/);

 await page.screenshot({ path: `${out}/${info.project.name}-archive-traversal.png` });

 await backLink.scrollIntoViewIfNeeded();
 await page.waitForTimeout(500);
 await expect(backLink).toBeVisible();

 // Click thực nút quay lại, kiểm tra bảo tồn context snapshot
 const backUrlRegex = /\/meta\/websites\?mode=real.*snapshotId=rank_websites_epoch_18_2_1789304905604.*archive=true/;
 for (let attempt = 0; attempt < 3; attempt++) {
   await backLink.click();
   try {
     await page.waitForURL(backUrlRegex, { timeout: 4000 });
     break;
   } catch {
     if (attempt < 2) {
       await backLink.scrollIntoViewIfNeeded();
       await page.waitForTimeout(500);
     }
   }
 }
 await expect(page).toHaveURL(backUrlRegex, { timeout: 30000 });
 await expect(page.getByText('rank_websites_epoch_18_2_1789304905604').first()).toBeVisible();
});