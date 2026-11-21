"use strict";
const initialProducts=[
['28구 딸기 육묘포트','28穴 イチゴ育苗ポット'],['32구 딸기 육묘포트','32穴 イチゴ育苗ポット'],['24구 딸기 육묘포트','24穴 イチゴ育苗ポット'],['6구 화분','6穴 ポット'],['8구 화분','8穴 ポット'],['대운스마트 점적호스 / 점적테이프','点滴灌水ホース・テープ']
];
const cfg=window.DAEUN_CONFIG||{},configured=Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey);
const base=(cfg.supabaseUrl||'').replace(/\/$/,''),key=cfg.supabaseAnonKey||'';
const $=id=>document.getElementById(id);
let lang='ko',products=[],session=null,isAdmin=false;
function status(msg){$('adminStatus').textContent=msg||''}
function safeText(value){return String(value??'')}
function make(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=safeText(txt);return e}
function getAuthHeaders(auth=false){return {'apikey':key,'Authorization':'Bearer '+(auth&&session?session.access_token:key)}}
async function request(path,opts={}){
 const {auth=false,body,headers={},...rest}=opts;
 const res=await fetch(base+path,{...rest,headers:{...getAuthHeaders(auth),...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...headers},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body)});
 if(!res.ok){let detail='';try{const e=await res.json();detail=e.message||e.error_description||e.msg||e.error||''}catch{}throw Error(detail||'요청 실패 ('+res.status+')')}
 if(res.status===204)return null;
 const txt=await res.text();return txt?JSON.parse(txt):null;
}
async function loadProducts(){
 if(!configured){products=initialProducts.map((p,i)=>({id:i,name_ko:p[0],name_ja:p[1],spec_ko:'',spec_ja:'',description_ko:'',description_ja:'',image_path:null,sort_order:i}));$('siteMessage').hidden=false;$('siteMessage').textContent='현재 초기 미리보기입니다. 관리자가 서버 연결을 완료하면 제품 정보가 자동으로 표시됩니다.';render();return}
 try{products=await request('/rest/v1/products?select=*&order=sort_order.asc,created_at.asc');$('siteMessage').hidden=true;render();if(isAdmin)renderAdmin()}
 catch(e){$('siteMessage').hidden=false;$('siteMessage').textContent='제품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';console.error(e)}
}
function photoPaths(value){
 if(!value)return [];
 if(Array.isArray(value))return value.filter(x=>typeof x==='string'&&x);
 if(typeof value!=='string')return [];
 if(value.trim().startsWith('[')){
  try{const arr=JSON.parse(value);if(Array.isArray(arr))return arr.filter(x=>typeof x==='string'&&x)}catch{}
 }
 return [value];
}
function encodePhotoPaths(paths){return paths.length?paths.length===1?paths[0]:JSON.stringify(paths):null}
function imageUrl(path){if(!path)return '';return base+'/storage/v1/object/public/product-images/'+path.split('/').map(encodeURIComponent).join('/')}
let detailProduct=null,detailIndex=0,editingPhotos=[];
// 익명 방문/조회 집계: 개인식별정보·쿠키를 저장하지 않으며 통계 설치 전에는 조용히 건너뜁니다.
async function trackEvent(eventType,productId=null){
 if(!configured||!['page_view','product_view'].includes(eventType))return;
 try{await request('/rest/v1/rpc/record_site_event',{method:'POST',body:{p_event_type:eventType,p_product_id:productId}})}catch(e){console.debug('통계 미설정 또는 기록 실패:',e.message)}
}
async function loadAnalytics(){
 if(!isAdmin)return;
 const root=$('analyticsSummary'),table=$('analyticsProducts'),message=$('analyticsStatus');
 root.replaceChildren();table.replaceChildren();message.textContent='방문 통계를 불러오는 중입니다...';
 try{
  const since=new Date(Date.now()-30*86400000).toISOString();
  const events=await request('/rest/v1/site_events?select=event_type,product_id,created_at&created_at=gte.'+encodeURIComponent(since)+'&order=created_at.desc&limit=10000',{auth:true});
  const today=new Date();const dayKey=d=>new Date(d).toLocaleDateString('en-CA');
  const todayKey=dayKey(today),todayViews=events.filter(e=>e.event_type==='page_view'&&dayKey(e.created_at)===todayKey).length;
  const pageViews=events.filter(e=>e.event_type==='page_view').length;
  const productViews=events.filter(e=>e.event_type==='product_view');
  for(const [label,count] of [['오늘 페이지 방문',todayViews],['최근 30일 페이지 방문',pageViews],['최근 30일 제품 조회',productViews.length]]){
   const card=make('div','analytics-stat'),strong=make('strong','',count.toLocaleString('ko-KR')),span=make('span','',label);card.append(strong,span);root.append(card);
  }
  const counts=new Map();for(const e of productViews){const k=String(e.product_id);counts.set(k,(counts.get(k)||0)+1)}
  const heading=make('h4','','제품별 상세보기 조회 수 (최근 30일)'),tbl=make('table'),thead=make('thead'),tr=make('tr');
  tr.append(make('th','','제품명'),make('th','','조회 수'));thead.append(tr);tbl.append(thead);
  const tbody=make('tbody');const rows=products.map(p=>({name:p.name_ko||p.name_ja||'제품',count:counts.get(String(p.id))||0})).sort((a,b)=>b.count-a.count);
  for(const item of rows){const row=make('tr');row.append(make('td','',item.name),make('td','',item.count.toLocaleString('ko-KR')+'회'));tbody.append(row)}
  tbl.append(tbody);table.append(heading,tbl);
  message.textContent=events.length===10000?'최근 30일 중 최대 10,000건만 표시됩니다. 더 많은 데이터는 별도 집계가 필요합니다.':'중복 방문 및 자동화된 접근이 포함될 수 있는 참고용 수치입니다.';
 }catch(e){message.textContent='방문 통계 설정이 아직 완료되지 않았습니다. 제공된 supabase-analytics.sql을 Supabase에서 실행해 주세요. ('+e.message+')'}
}

function productName(p){return p['name_'+lang]||p.name_ko||''}
function render(){
 document.documentElement.lang=lang;
 document.querySelectorAll('[data-ko]').forEach(e=>{e.innerHTML=e.dataset[lang]});
 ['ko','ja'].forEach(l=>$(l).classList.toggle('active',l===lang));
 const cards=$('cards');cards.replaceChildren();
 if(!products.length){cards.append(make('p','sub',lang==='ko'?'등록된 제품이 없습니다.':'登録された製品はありません。'));return}
 for(const p of products){
  const card=make('article','card'),photo=make('div','photo'),paths=photoPaths(p.image_path);
  if(paths.length){
   const img=make('img');img.src=imageUrl(paths[0]);img.alt=productName(p);img.loading='lazy';
   img.onerror=()=>{photo.replaceChildren(make('span','',lang==='ko'?'사진 준비 중':'写真準備中'))};photo.append(img);
   if(paths.length>1)photo.append(make('span','photo-count',paths.length+(lang==='ko'?'장':'枚')));
  }else photo.textContent=lang==='ko'?'제품 사진 준비 중':'製品写真 準備中';
  const content=make('div','content');content.append(make('h3','',productName(p)));
  const spec=p['spec_'+lang]||p.spec_ko;if(spec)content.append(make('p','spec',spec));
  const desc=p['description_'+lang]||p.description_ko;
  if(desc)content.append(make('p','desc',desc));
  const btn=make('button','detail-trigger',lang==='ko'?'자세히 보기':'詳細を見る');btn.type='button';btn.onclick=()=>openDetail(p);
  content.append(btn);photo.style.cursor='pointer';photo.tabIndex=0;photo.setAttribute('role','button');photo.setAttribute('aria-label',productName(p)+' '+(lang==='ko'?'상세보기':'詳細'));
  photo.onclick=()=>openDetail(p);photo.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(p)}};
  card.append(photo,content);cards.append(card);
 }
}
function openDetail(p){trackEvent('product_view',p.id);detailProduct=p;detailIndex=0;$('detailModal').hidden=false;renderDetail();$('detailClose').focus()}
function renderDetail(){
 if(!detailProduct)return;
 const p=detailProduct,paths=photoPaths(p.image_path),photo=$('detailPhoto');photo.replaceChildren();
 $('detailTitle').textContent=productName(p);
 $('detailSpecLabel').textContent=lang==='ko'?'제품 규격':'製品規格';
 $('detailDescLabel').textContent=lang==='ko'?'제품 설명':'製品説明';
 $('detailSpec').textContent=p['spec_'+lang]||p.spec_ko||(lang==='ko'?'규격은 문의해 주세요.':'規格はお問い合わせください。');
 $('detailDesc').textContent=p['description_'+lang]||p.description_ko||(lang==='ko'?'자세한 제품 정보는 문의해 주세요.':'詳しくはお問い合わせください。');
 $('detailContact').textContent=lang==='ko'?'제품 문의하기':'製品のお問い合わせ';
 if(paths.length){detailIndex=(detailIndex+paths.length)%paths.length;const img=make('img');img.src=imageUrl(paths[detailIndex]);img.alt=productName(p)+' '+(detailIndex+1);img.onerror=()=>{photo.replaceChildren(make('span','',lang==='ko'?'사진을 불러오지 못했습니다.':'写真を読み込めませんでした。'))};photo.classList.remove('empty');photo.append(img);photo.onclick=()=>openZoom(img.src)}
 else{photo.classList.add('empty');photo.textContent=lang==='ko'?'제품 사진 준비 중':'製品写真 準備中';photo.onclick=null}
 $('detailCounter').textContent=paths.length?(detailIndex+1)+' / '+paths.length:'';
 $('detailPrev').disabled=paths.length<2;$('detailNext').disabled=paths.length<2;
}
function openZoom(src){$('zoomImage').src=src;$('zoomModal').hidden=false;$('zoomClose').focus()}
window.setLang=l=>{lang=l;render();if(detailProduct&&!$('detailModal').hidden)renderDetail()};
function saveSession(s){session=s;try{if(s)localStorage.setItem('daeun_session',JSON.stringify(s));else localStorage.removeItem('daeun_session')}catch{}}
async function refreshSession(){if(!session?.refresh_token)return false;
 try{const s=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});saveSession(s);return true}catch{saveSession(null);return false}}
async function authenticate(){if(!session)return false;
 if(session.expires_at&&Date.now()/1000>session.expires_at-60){if(!await refreshSession()){isAdmin=false;return false}}
 try{const data=await request('/rest/v1/admin_users?select=user_id&limit=1',{auth:true});isAdmin=Array.isArray(data)&&data.length>0;return isAdmin}
 catch(e){if(await refreshSession()){try{const data=await request('/rest/v1/admin_users?select=user_id&limit=1',{auth:true});isAdmin=data.length>0;return isAdmin}catch{}}isAdmin=false;return false}
}
function showManage(){ $('loginArea').hidden=isAdmin;$('manageArea').hidden=!isAdmin;if(isAdmin){renderAdmin();loadAnalytics()} }
async function signIn(email,password){const s=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});saveSession(s);if(!await authenticate()){saveSession(null);throw Error('이 계정은 관리자 권한이 없습니다. Supabase의 admin_users 등록을 확인하세요.')}}
function renderAdmin(){
 const root=$('adminList');root.replaceChildren();
 for(const p of products){const row=make('div','admin-row'),paths=photoPaths(p.image_path);
  if(paths.length){const img=make('img');img.src=imageUrl(paths[0]);img.alt='';img.style.objectFit='contain';row.append(img)}
  row.append(make('span','row-title',p.name_ko));const edit=make('button','','수정'),del=make('button','','삭제');edit.type='button';del.type='button';
  edit.addEventListener('click',()=>editProduct(p));del.addEventListener('click',()=>deleteProduct(p));row.append(edit,del);root.append(row)}
}
function renderGalleryEditor(){
 const root=$('galleryList');root.replaceChildren();
 editingPhotos.forEach((path,i)=>{
  const item=make('div','gallery-item'),img=make('img');img.src=imageUrl(path);img.alt='제품 사진 '+(i+1);item.append(img);
  item.append(make('small','',i===0?'대표 사진':'사진 '+(i+1)));
  const actions=make('div','gallery-actions');
  const left=make('button','','←'),right=make('button','','→'),remove=make('button','','삭제');
  left.type=right.type=remove.type='button';left.disabled=i===0;right.disabled=i===editingPhotos.length-1;
  left.onclick=()=>{[editingPhotos[i-1],editingPhotos[i]]=[editingPhotos[i],editingPhotos[i-1]];renderGalleryEditor()};
  right.onclick=()=>{[editingPhotos[i+1],editingPhotos[i]]=[editingPhotos[i],editingPhotos[i+1]];renderGalleryEditor()};
  remove.onclick=()=>{editingPhotos.splice(i,1);renderGalleryEditor()};
  actions.append(left,right);item.append(actions,remove);root.append(item);
 });
}
function editProduct(p){
 $('productForm').hidden=false;$('formTitle').textContent=p?'제품 수정':'새 제품 등록';
 for(const [id,field] of Object.entries({productId:'id',nameKo:'name_ko',nameJa:'name_ja',specKo:'spec_ko',specJa:'spec_ja',descKo:'description_ko',descJa:'description_ja',sortOrder:'sort_order'}))$(id).value=p?(p[field]??''):id==='sortOrder'?String(products.length):'';
 editingPhotos=p?photoPaths(p.image_path).slice():[];renderGalleryEditor();
 $('imageFile').value='';$('imagePreview').hidden=true;
 $('productForm').scrollIntoView({behavior:'smooth',block:'start'});
}
async function uploadImage(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPG, PNG, WEBP 사진만 업로드할 수 있습니다.');if(file.size>5*1024*1024)throw Error('사진 크기는 5MB 이하로 선택해 주세요.');
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=crypto.randomUUID()+'.'+ext;
 const res=await fetch(base+'/storage/v1/object/product-images/'+path,{method:'POST',headers:{...getAuthHeaders(true),'Content-Type':file.type,'x-upsert':'false'},body:file});
 if(!res.ok){let e={};try{e=await res.json()}catch{}throw Error(e.message||'사진 업로드에 실패했습니다. 저장소 정책을 확인하세요.')};return path}
async function removeImage(path){if(!path)return;try{await request('/storage/v1/object/product-images',{method:'DELETE',auth:true,body:{prefixes:[path]}})}catch(e){console.warn('이전 사진 정리 실패:',e)}}
async function saveProduct(ev){
 ev.preventDefault();if(!isAdmin)return;const btn=$('saveProduct');btn.disabled=true;status('저장 중입니다...');const uploaded=[];
 try{
  if(session?.expires_at&&Date.now()/1000>session.expires_at-60&&!await refreshSession())throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  const id=$('productId').value,old=products.find(p=>String(p.id)===id),files=Array.from($('imageFile').files);
  if(!['nameKo','nameJa'].every(field=>$(field).value.trim()))throw Error('한국어·일본어 제품명을 모두 입력해 주세요.');
  if(editingPhotos.length+files.length>20)throw Error('사진은 제품당 최대 20장까지 등록할 수 있습니다.');
  for(const file of files){uploaded.push(await uploadImage(file))}
  const nextPaths=[...editingPhotos,...uploaded];
  const obj={name_ko:$('nameKo').value.trim(),name_ja:$('nameJa').value.trim(),spec_ko:$('specKo').value.trim(),spec_ja:$('specJa').value.trim(),description_ko:$('descKo').value.trim(),description_ja:$('descJa').value.trim(),sort_order:Number($('sortOrder').value),image_path:encodePhotoPaths(nextPaths)};
  await request('/rest/v1/products'+(id?'?id=eq.'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',auth:true,body:id?obj:[obj],headers:{Prefer:'return=minimal'}});
  const oldPaths=old?photoPaths(old.image_path):[];
  for(const path of oldPaths){if(!nextPaths.includes(path))await removeImage(path)}
  $('productForm').hidden=true;status('제품 정보가 저장되었습니다.');await loadProducts();
 }catch(e){for(const path of uploaded)await removeImage(path);status('저장 실패: '+e.message)}finally{btn.disabled=false}
}
async function deleteProduct(p){
 if(!confirm('정말 "'+p.name_ko+'" 제품을 삭제할까요?'))return;
 try{
  if(session?.expires_at&&Date.now()/1000>session.expires_at-60&&!await refreshSession())throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  await request('/rest/v1/products?id=eq.'+encodeURIComponent(p.id),{method:'DELETE',auth:true});
  for(const path of photoPaths(p.image_path))await removeImage(path);
  status('제품이 삭제되었습니다.');await loadProducts();
 }catch(e){status('삭제 실패: '+e.message)}
}
function init(){ $('ko').onclick=()=>setLang('ko');$('ja').onclick=()=>setLang('ja');
 $('adminOpen').onclick=async()=>{$('adminModal').hidden=false;status(configured?'':'config.js에 Supabase 연결 정보를 먼저 입력해 주세요.');if(session){await authenticate();showManage()}};
 $('adminClose').onclick=()=>{$('adminModal').hidden=true};
 $('adminModal').addEventListener('click',e=>{if(e.target===$('adminModal'))$('adminModal').hidden=true});
 $('detailClose').onclick=()=>{$('detailModal').hidden=true;detailProduct=null};
 $('detailModal').onclick=e=>{if(e.target===$('detailModal')){$('detailModal').hidden=true;detailProduct=null}};
 $('detailPrev').onclick=()=>{detailIndex--;renderDetail()};
 $('detailNext').onclick=()=>{detailIndex++;renderDetail()};
 $('zoomClose').onclick=()=>{$('zoomModal').hidden=true};
 $('zoomModal').onclick=e=>{if(e.target===$('zoomModal'))$('zoomModal').hidden=true};
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(!$('zoomModal').hidden)$('zoomModal').hidden=true;else if(!$('detailModal').hidden){$('detailModal').hidden=true;detailProduct=null}}
  if(!$('detailModal').hidden&&$('zoomModal').hidden&&e.key==='ArrowLeft'){$('detailPrev').click()}
  if(!$('detailModal').hidden&&$('zoomModal').hidden&&e.key==='ArrowRight'){$('detailNext').click()}
 });
 $('loginForm').onsubmit=async e=>{e.preventDefault();if(!configured)return status('서버 연결 설정을 먼저 완료해 주세요.');status('로그인 확인 중...');try{await signIn($('email').value.trim(),$('password').value);$('password').value='';status('관리자로 로그인했습니다.');showManage()}catch(err){status('로그인 실패: '+err.message)}};
 $('logout').onclick=async()=>{try{if(session)await request('/auth/v1/logout',{method:'POST',auth:true})}catch{}saveSession(null);isAdmin=false;showManage();status('로그아웃했습니다.')};
 $('refreshAnalytics').onclick=loadAnalytics;
 $('newProduct').onclick=()=>editProduct(null);$('cancelEdit').onclick=()=>{$('productForm').hidden=true};$('productForm').onsubmit=saveProduct;
 $('imageFile').onchange=()=>{const files=Array.from($('imageFile').files);status(files.length?files.length+'장의 사진을 선택했습니다. 저장하면 기존 사진 뒤에 추가됩니다.':'');$('imagePreview').hidden=true};
 $('resetPassword').onclick=async()=>{const email=$('email').value.trim();if(!email)return status('먼저 관리자 이메일을 입력해 주세요.');try{await request('/auth/v1/recover',{method:'POST',body:{email}});status('등록된 이메일이라면 비밀번호 재설정 메일이 발송됩니다.')}catch(e){status('재설정 요청 실패: '+e.message)}};
 $('changePassword').onclick=async()=>{const password=prompt('새 비밀번호를 입력하세요 (12자 이상 권장).');if(password===null)return;if(password.length<12)return status('12자 이상의 비밀번호를 입력해 주세요.');try{if(session?.expires_at&&Date.now()/1000>session.expires_at-60&&!await refreshSession())throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');await request('/auth/v1/user',{method:'PUT',auth:true,body:{password}});status('비밀번호가 변경되었습니다.')}catch(e){status('비밀번호 변경 실패: '+e.message)}};
 try{session=JSON.parse(localStorage.getItem('daeun_session')||'null')}catch{};
 loadProducts();
 trackEvent('page_view');
}
init();
