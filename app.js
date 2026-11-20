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
function imageUrl(path){if(!path)return '';return base+'/storage/v1/object/public/product-images/'+path.split('/').map(encodeURIComponent).join('/')}
function render(){
 document.documentElement.lang=lang;
 document.querySelectorAll('[data-ko]').forEach(e=>{e.innerHTML=e.dataset[lang]});
 ['ko','ja'].forEach(l=>$(l).classList.toggle('active',l===lang));
 const cards=$('cards');cards.replaceChildren();
 if(!products.length){cards.append(make('p','sub',lang==='ko'?'등록된 제품이 없습니다.':'登録された製品はありません。'));return}
 for(const p of products){const card=make('article','card'),photo=make('div','photo');
 if(p.image_path){const img=make('img');img.src=imageUrl(p.image_path);img.alt=safeText(p['name_'+lang]);img.loading='lazy';img.onerror=()=>{photo.replaceChildren(make('span','',lang==='ko'?'사진 준비 중':'写真準備中'))};photo.append(img)}else photo.textContent=lang==='ko'?'제품 사진 준비 중':'製品写真 準備中';
 const content=make('div','content');content.append(make('h3','',p['name_'+lang]||p.name_ko));
 const spec=p['spec_'+lang];if(spec)content.append(make('p','spec',spec));
 content.append(make('p','desc',p['description_'+lang]||(lang==='ko'?'상세 규격 및 거래 문의':'仕様・お取引のお問い合わせ')));
 card.append(photo,content);cards.append(card)}
}
window.setLang=l=>{lang=l;render()};
function saveSession(s){session=s;try{if(s)localStorage.setItem('daeun_session',JSON.stringify(s));else localStorage.removeItem('daeun_session')}catch{}}
async function refreshSession(){if(!session?.refresh_token)return false;
 try{const s=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});saveSession(s);return true}catch{saveSession(null);return false}}
async function authenticate(){if(!session)return false;
 if(session.expires_at&&Date.now()/1000>session.expires_at-60){if(!await refreshSession()){isAdmin=false;return false}}
 try{const data=await request('/rest/v1/admin_users?select=user_id&limit=1',{auth:true});isAdmin=Array.isArray(data)&&data.length>0;return isAdmin}
 catch(e){if(await refreshSession()){try{const data=await request('/rest/v1/admin_users?select=user_id&limit=1',{auth:true});isAdmin=data.length>0;return isAdmin}catch{}}isAdmin=false;return false}
}
function showManage(){ $('loginArea').hidden=isAdmin;$('manageArea').hidden=!isAdmin;if(isAdmin)renderAdmin() }
async function signIn(email,password){const s=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});saveSession(s);if(!await authenticate()){saveSession(null);throw Error('이 계정은 관리자 권한이 없습니다. Supabase의 admin_users 등록을 확인하세요.')}}
function renderAdmin(){const root=$('adminList');root.replaceChildren();for(const p of products){const row=make('div','admin-row');if(p.image_path){const img=make('img');img.src=imageUrl(p.image_path);img.alt='';row.append(img)}row.append(make('span','row-title',p.name_ko));const edit=make('button','', '수정'),del=make('button','','삭제');edit.type='button';del.type='button';edit.addEventListener('click',()=>editProduct(p));del.addEventListener('click',()=>deleteProduct(p));row.append(edit,del);root.append(row)}}
function editProduct(p){$('productForm').hidden=false;$('formTitle').textContent=p?'제품 수정':'새 제품 등록';for(const [id,field] of Object.entries({productId:'id',nameKo:'name_ko',nameJa:'name_ja',specKo:'spec_ko',specJa:'spec_ja',descKo:'description_ko',descJa:'description_ja',sortOrder:'sort_order'}))$(id).value=p?(p[field]??''):id==='sortOrder'?String(products.length):'';
 $('imageFile').value='';$('imagePreview').hidden=!p?.image_path;if(p?.image_path)$('imagePreview').src=imageUrl(p.image_path);$('productForm').scrollIntoView({behavior:'smooth',block:'start'})}
async function uploadImage(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPG, PNG, WEBP 사진만 업로드할 수 있습니다.');if(file.size>5*1024*1024)throw Error('사진 크기는 5MB 이하로 선택해 주세요.');
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=crypto.randomUUID()+'.'+ext;
 const res=await fetch(base+'/storage/v1/object/product-images/'+path,{method:'POST',headers:{...getAuthHeaders(true),'Content-Type':file.type,'x-upsert':'false'},body:file});
 if(!res.ok){let e={};try{e=await res.json()}catch{}throw Error(e.message||'사진 업로드에 실패했습니다. 저장소 정책을 확인하세요.')};return path}
async function removeImage(path){if(!path)return;try{await request('/storage/v1/object/product-images',{method:'DELETE',auth:true,body:{prefixes:[path]}})}catch(e){console.warn('이전 사진 정리 실패:',e)}}
async function saveProduct(ev){ev.preventDefault();if(!isAdmin)return;const btn=$('saveProduct');btn.disabled=true;status('저장 중입니다...');let uploaded=null;
 try{if(session.expires_at&&Date.now()/1000>session.expires_at-60&&!await refreshSession())throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
 const id=$('productId').value,old=products.find(p=>String(p.id)===id),file=$('imageFile').files[0];
 if(file)uploaded=await uploadImage(file);
 const obj={name_ko:$('nameKo').value.trim(),name_ja:$('nameJa').value.trim(),spec_ko:$('specKo').value.trim(),spec_ja:$('specJa').value.trim(),description_ko:$('descKo').value.trim(),description_ja:$('descJa').value.trim(),sort_order:Number($('sortOrder').value),image_path:uploaded||(old?.image_path||null)};
 if(!obj.name_ko||!obj.name_ja)throw Error('한국어·일본어 제품명을 모두 입력해 주세요.');
 await request('/rest/v1/products'+(id?'?id=eq.'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',auth:true,body:id?obj:[obj],headers:{Prefer:'return=minimal'}});
 if(uploaded&&old?.image_path)await removeImage(old.image_path);
 $('productForm').hidden=true;status('제품 정보가 저장되었습니다.');await loadProducts();
 }catch(e){if(uploaded)await removeImage(uploaded);status('저장 실패: '+e.message)}finally{btn.disabled=false}}
async function deleteProduct(p){if(!confirm('정말 "'+p.name_ko+'" 제품을 삭제할까요?'))return;
 try{if(session?.expires_at&&Date.now()/1000>session.expires_at-60&&!await refreshSession())throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');await request('/rest/v1/products?id=eq.'+encodeURIComponent(p.id),{method:'DELETE',auth:true});await removeImage(p.image_path);status('제품이 삭제되었습니다.');await loadProducts()}catch(e){status('삭제 실패: '+e.message)}}
function init(){ $('ko').onclick=()=>setLang('ko');$('ja').onclick=()=>setLang('ja');
 $('adminOpen').onclick=async()=>{$('adminModal').hidden=false;status(configured?'':'config.js에 Supabase 연결 정보를 먼저 입력해 주세요.');if(session){await authenticate();showManage()}};
 $('adminClose').onclick=()=>{$('adminModal').hidden=true};
 $('adminModal').addEventListener('click',e=>{if(e.target===$('adminModal'))$('adminModal').hidden=true});
 $('loginForm').onsubmit=async e=>{e.preventDefault();if(!configured)return status('서버 연결 설정을 먼저 완료해 주세요.');status('로그인 확인 중...');try{await signIn($('email').value.trim(),$('password').value);$('password').value='';status('관리자로 로그인했습니다.');showManage()}catch(err){status('로그인 실패: '+err.message)}};
 $('logout').onclick=async()=>{try{if(session)await request('/auth/v1/logout',{method:'POST',auth:true})}catch{}saveSession(null);isAdmin=false;showManage();status('로그아웃했습니다.')};
 $('newProduct').onclick=()=>editProduct(null);$('cancelEdit').onclick=()=>{$('productForm').hidden=true};$('productForm').onsubmit=saveProduct;
 $('imageFile').onchange=()=>{const f=$('imageFile').files[0];if(f){$('imagePreview').src=URL.createObjectURL(f);$('imagePreview').hidden=false}};
 $('resetPassword').onclick=async()=>{const email=$('email').value.trim();if(!email)return status('먼저 관리자 이메일을 입력해 주세요.');try{await request('/auth/v1/recover',{method:'POST',body:{email}});status('등록된 이메일이라면 비밀번호 재설정 메일이 발송됩니다.')}catch(e){status('재설정 요청 실패: '+e.message)}};
 $('changePassword').onclick=async()=>{const password=prompt('새 비밀번호를 입력하세요 (12자 이상 권장).');if(password===null)return;if(password.length<12)return status('12자 이상의 비밀번호를 입력해 주세요.');try{if(session?.expires_at&&Date.now()/1000>session.expires_at-60&&!await refreshSession())throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');await request('/auth/v1/user',{method:'PUT',auth:true,body:{password}});status('비밀번호가 변경되었습니다.')}catch(e){status('비밀번호 변경 실패: '+e.message)}};
 try{session=JSON.parse(localStorage.getItem('daeun_session')||'null')}catch{};
 loadProducts();
}
init();
