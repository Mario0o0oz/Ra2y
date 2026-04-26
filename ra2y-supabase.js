<script>
// ════════════════════════════════════════════════════
//  SUPABASE — LIVE KEYS
// ════════════════════════════════════════════════════
const SUPABASE_URL  = 'https://xewlelrkglgsrbcecigv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhld2xlbHJrZ2xnc3JiY2VjaWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjM4ODUsImV4cCI6MjA5MjE5OTg4NX0.3vY6bhwEysJk6-Y36oqqg2xE6m2FHeYnXUrkCdqbjYE';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);
 
// ════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════
function getLang(){ return document.documentElement.getAttribute('data-lang')||'en' }
function setLang(l){
  document.documentElement.setAttribute('data-lang',l);
  document.documentElement.setAttribute('dir',l==='ar'?'rtl':'ltr');
  document.documentElement.setAttribute('lang',l);
  document.querySelectorAll('.lbtn').forEach(b=>{
    b.classList.toggle('on',(l==='ar'&&b.textContent.includes('ع'))||(l==='en'&&b.textContent==='EN'));
  });
  document.querySelectorAll('[placeholder-'+l+']').forEach(el=>{
    el.placeholder=el.getAttribute('placeholder-'+l)||'';
  });
}
setLang('en');
 
function activateTab(t){
  t.closest('.tabs').querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
}
function setS(n){
  document.querySelectorAll('#starPick span').forEach((s,i)=>s.classList.toggle('lit',i<n));
}
function openModal(id){ document.getElementById('modal-'+id).classList.add('open'); document.body.style.overflow='hidden'; if(id==='auth') resetAuth(); }
function closeModal(id){ document.getElementById('modal-'+id).classList.remove('open'); document.body.style.overflow=''; }
function showToast(){ const t=document.getElementById('toast'); t.classList.add('on'); setTimeout(()=>t.classList.remove('on'),4000); }
function fill(q){ const i=document.getElementById('heroWhat'); if(i) i.value=q; }
const avatarColors=['#1db954','#0d9488','#7c3aed','#dc2626','#d97706','#0369a1'];
 
// ════════════════════════════════════════════════════
//  AUTH STATE
// ════════════════════════════════════════════════════
let AUTH = { method:'email', contact:'', timerInterval:null, timerSeconds:120 };
 
function setMethod(m){
  AUTH.method = m;
  document.getElementById('methodEmail').classList.toggle('on', m==='email');
  document.getElementById('methodPhone').classList.toggle('on', m==='phone');
  document.getElementById('emailInputWrap').style.display = m==='email'?'block':'none';
  document.getElementById('phoneInputWrap').style.display = m==='phone'?'block':'none';
  document.getElementById('sendOtpBtn').disabled = true;
  clearErrors();
}
 
function resetAuth(){
  setMethod('email');
  goToStep(1);
  document.getElementById('emailInput').value='';
  document.getElementById('phoneInput').value='';
  clearOtp(); clearErrors();
  stopTimer();
  document.getElementById('authStepsDots').style.display='flex';
  document.getElementById('methodToggle').style.display='flex';
}
 
function goToStep(n){
  document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
  const panel = document.getElementById('auth-step-'+(n===4?'success':n));
  if(panel) panel.classList.add('active');
  for(let i=1;i<=3;i++){
    const dot=document.getElementById('sdot-'+i);
    const line=document.getElementById('sline-'+i);
    if(!dot) continue;
    if(i<n){ dot.className='auth-step-dot done'; dot.textContent='✓'; }
    else if(i===n){ dot.className='auth-step-dot active'; dot.textContent=i; }
    else{ dot.className='auth-step-dot'; dot.textContent=i; }
    if(line) line.className='auth-step-line'+(i<n?' done':'');
  }
  setTimeout(()=>{
    if(n===1) document.getElementById(AUTH.method==='email'?'emailInput':'phoneInput')?.focus();
    if(n===2) document.getElementById('otp0')?.focus();
    if(n===3) document.getElementById('nameInput')?.focus();
  },200);
}
 
function showErr(id,msg){ const e=document.getElementById(id); if(e){e.textContent=msg;e.style.display=msg?'block':'none'; e.classList.toggle('show',!!msg);} }
function clearErrors(){ ['step1-error','step2-error','step3-error'].forEach(id=>showErr(id,'')); }
function clearOtp(){ for(let i=0;i<6;i++){const b=document.getElementById('otp'+i);if(b){b.value='';b.className='otp-box';}} document.getElementById('verifyBtn').disabled=true; }
function setBtnLoad(id,v){ const b=document.getElementById(id);if(!b)return; b.classList.toggle('loading',v); b.disabled=v; }
 
// ── Validate inputs ──
function onEmailInput(el){
  el.value=el.value.trim();
  const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value);
  document.getElementById('sendOtpBtn').disabled=!ok;
}
function onPhoneInput(el){
  el.value=el.value.replace(/\D/g,'');
  document.getElementById('sendOtpBtn').disabled=el.value.length<10;
}
 
// ── STEP 1: Send OTP ──
async function doSendOTP(){
  clearErrors();
  let contact='';
  if(AUTH.method==='email'){
    contact=document.getElementById('emailInput').value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)){ showErr('step1-error','Please enter a valid email address'); return; }
  } else {
    let raw=document.getElementById('phoneInput').value.replace(/\D/g,'');
    if(raw.length<10){ showErr('step1-error','Please enter a valid phone number'); return; }
    if(raw.startsWith('0')) raw=raw.slice(1);
    contact='+20'+raw;
  }
  AUTH.contact=contact;
  document.getElementById('sentTo').textContent=contact;
  document.getElementById('sentToAr').textContent=contact;
  setBtnLoad('sendOtpBtn',true);
  try {
    if(AUTH.method==='email'){
      const {error}=await db.auth.signInWithOtp({
        email:contact,
        options:{shouldCreateUser:true, emailRedirectTo:window.location.href}
      });
      if(error) throw error;
    } else {
      const {error}=await db.auth.signInWithOtp({phone:contact});
      if(error) throw error;
    }
    goToStep(2);
    startTimer();
  } catch(err){
    showErr('step1-error', err.message||'Failed to send code. Please try again.');
  } finally {
    setBtnLoad('sendOtpBtn',false);
  }
}
 
// ── OTP boxes ──
function otpInput(idx){
  const box=document.getElementById('otp'+idx);
  box.value=box.value.replace(/\D/g,'');
  if(box.value){ box.classList.add('filled'); box.classList.remove('error'); if(idx<5) document.getElementById('otp'+(idx+1)).focus(); }
  else box.classList.remove('filled');
  const allFull=[0,1,2,3,4,5].every(i=>document.getElementById('otp'+i).value!=='');
  document.getElementById('verifyBtn').disabled=!allFull;
  if(allFull) setTimeout(doVerify,300);
}
function otpKey(e,idx){
  if(e.key==='Backspace'){
    const box=document.getElementById('otp'+idx);
    if(!box.value&&idx>0){ const prev=document.getElementById('otp'+(idx-1)); prev.value=''; prev.classList.remove('filled'); prev.focus(); }
  }
}
 
// ── Timer ──
function startTimer(){
  AUTH.timerSeconds=120; stopTimer();
  document.getElementById('resendBtn').classList.remove('show');
  updateTimer();
  AUTH.timerInterval=setInterval(()=>{
    AUTH.timerSeconds--;
    updateTimer();
    if(AUTH.timerSeconds<=0){ stopTimer(); document.getElementById('resendBtn').classList.add('show'); }
  },1000);
}
function stopTimer(){ if(AUTH.timerInterval) clearInterval(AUTH.timerInterval); }
function updateTimer(){ const m=Math.floor(AUTH.timerSeconds/60),s=AUTH.timerSeconds%60; document.getElementById('timerDisplay').textContent=m+':'+(s<10?'0':'')+s; }
async function doResend(){
  document.getElementById('resendBtn').classList.remove('show');
  clearOtp(); clearErrors();
  try {
    if(AUTH.method==='email'){ await db.auth.signInWithOtp({email:AUTH.contact,options:{shouldCreateUser:true}}); }
    else { await db.auth.signInWithOtp({phone:AUTH.contact}); }
    startTimer();
  } catch(err){ showErr('step2-error',err.message||'Resend failed.'); }
}
 
// ── STEP 2: Verify OTP ──
async function doVerify(){
  clearErrors();
  const code=[0,1,2,3,4,5].map(i=>document.getElementById('otp'+i).value).join('');
  if(code.length<6) return;
  setBtnLoad('verifyBtn',true);
  try {
    let result;
    if(AUTH.method==='email'){
      result=await db.auth.verifyOtp({email:AUTH.contact,token:code,type:'email'});
    } else {
      result=await db.auth.verifyOtp({phone:AUTH.contact,token:code,type:'sms'});
    }
    if(result.error) throw result.error;
    const user=result.data.user;
    if(!user) throw new Error('Login failed. Try again.');
    stopTimer();
    // Check if profile exists
    const {data:existing}=await db.from('users').select('id,name').eq('id',user.id).maybeSingle();
    if(existing?.name){
      // Already has profile — go to success
      finishLogin(existing.name||AUTH.contact);
    } else {
      goToStep(3);
    }
  } catch(err){
    document.querySelectorAll('.otp-box').forEach(b=>{b.classList.add('error');setTimeout(()=>b.classList.remove('error'),400);});
    showErr('step2-error',err.message||'Incorrect code. Please try again.');
    setBtnLoad('verifyBtn',false);
  }
}
 
// ── STEP 3: Name input live preview ──
function onNameType(el){
  const av=document.getElementById('nameAvatar');
  if(el.value.trim().length>0){
    av.textContent=el.value.trim()[0].toUpperCase();
    av.style.background=avatarColors[el.value.charCodeAt(0)%avatarColors.length];
  } else { av.textContent='😊'; av.style.background='var(--green)'; }
}
 
// ── STEP 3: Create account ──
async function doCreate(){
  clearErrors();
  const name=document.getElementById('nameInput').value.trim();
  const city=document.getElementById('citySelect').value;
  if(!name){ showErr('step3-error','Please enter your name'); return; }
  setBtnLoad('createBtn',true);
  try {
    const {data:{user}}=await db.auth.getUser();
    if(!user) throw new Error('Session expired. Please start again.');
    await db.from('users').upsert({
      id:user.id,
      phone:AUTH.method==='phone'?AUTH.contact:null,
      name:name,
      city:city||null,
      is_verified:true
    });
    finishLogin(name);
  } catch(err){
    showErr('step3-error',err.message||'Something went wrong.');
    setBtnLoad('createBtn',false);
  }
}
 
function finishLogin(name){
  document.getElementById('welcomeName').textContent=name;
  document.getElementById('welcomeNameAr').textContent=name;
  document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('auth-step-success').classList.add('active');
  document.getElementById('authStepsDots').style.display='none';
  document.getElementById('methodToggle').style.display='none';
  updateNavForUser(name);
}
 
function updateNavForUser(name){
  document.querySelectorAll('.btn-signin').forEach(b=>{
    b.innerHTML='👤 '+name.split(' ')[0];
    b.style.background='var(--green)';
    b.style.color='#000';
    b.onclick=signOut;
  });
}
 
async function signOut(){ await db.auth.signOut(); location.reload(); }
 
// ════════════════════════════════════════════════════
//  SUPABASE DATA FUNCTIONS
// ════════════════════════════════════════════════════
async function getBusinesses({category,city,sort='avg_rating',limit=6,offset=0}={}){
  let q=db.from('businesses').select('*').order(sort,{ascending:false}).range(offset,offset+limit-1);
  if(category) q=q.eq('category',category);
  if(city) q=q.ilike('city',`%${city}%`);
  const {data,error}=await q;
  if(error) throw error;
  return data||[];
}
 
async function searchBusinesses(term){
  if(!term?.trim()) return getBusinesses({limit:6});
  const {data,error}=await db.from('businesses').select('*')
    .or(`name_en.ilike.%${term}%,name_ar.ilike.%${term}%,category.ilike.%${term}%,city.ilike.%${term}%`)
    .order('avg_rating',{ascending:false}).limit(20);
  if(error) throw error;
  return data||[];
}
 
async function getLatestReviews(limit=5){
  const {data,error}=await db.from('reviews')
    .select('*,businesses(name_en,name_ar,category),users(name,name_ar,avatar_color,city,is_verified)')
    .eq('status','published').order('created_at',{ascending:false}).limit(limit);
  if(error) throw error;
  return data||[];
}
 
async function getCurrentUser(){
  const {data,error}=await db.auth.getUser();
  if(error) return null;
  return data?.user||null;
}
 
async function requireUser(){
  const user=await getCurrentUser();
  if(!user){ openModal('auth'); throw new Error('Please sign in first.'); }
  return user;
}
 
// ════════════════════════════════════════════════════
//  RENDER HELPERS
// ════════════════════════════════════════════════════
function renderStars(r){
  const v=Math.round(Number(r)||0);
  return Array.from({length:5},(_,i)=>`<span class="star${i>=v?' e':''}" >★</span>`).join('');
}
 
function renderBizCard(biz,rank){
  const l=getLang();
  const name=l==='ar'?(biz.name_ar||biz.name_en):(biz.name_en||biz.name_ar)||'Business';
  const cat=l==='ar'?(biz.category_ar||biz.category):(biz.category||biz.category_ar)||'';
  const city=l==='ar'?(biz.city_ar||biz.city):(biz.city||biz.city_ar)||'';
  const rating=(Number(biz.avg_rating)||0).toFixed(1);
  const count=biz.review_count||0;
  return`<a class="biz-card" href="#" onclick="openBizModal('${biz.id}');return false">
    <div class="biz-img">
      <img src="${biz.image_url||'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=700&q=80'}" alt="${name}" loading="lazy">
      ${rank?`<div class="biz-rank">#${rank}</div>`:''}
      <div class="biz-badge ${biz.is_verified?'bb-verified':'bb-new'}">${biz.is_verified?'✓ Verified':'✦ New'}</div>
    </div>
    <div class="biz-body">
      <div class="biz-top">
        <div class="biz-logo">🏢</div>
        <div class="biz-info"><div class="biz-name">${name}</div><div class="biz-cat">${cat}</div></div>
        <span class="r-num">${rating}</span>
      </div>
      <div class="biz-rating"><div class="stars">${renderStars(biz.avg_rating)}</div><span class="r-count">(${count} ${l==='ar'?'رأي':'reviews'})</span></div>
      <div class="biz-footer"><span class="biz-loc">📍 ${city}</span><span class="biz-honest">✓ ${l==='ar'?'آراء حقيقية':'Real reviews'}</span></div>
    </div></a>`;
}
 
function renderReviewCard(rv){
  const l=getLang();
  const u=rv.users||{};
  const b=rv.businesses||{};
  const uName=l==='ar'?(u.name_ar||u.name||rv.reviewer_name||'مستخدم موثّق'):(u.name||rv.reviewer_name||'Verified user');
  const bName=l==='ar'?(b.name_ar||b.name_en||''):(b.name_en||b.name_ar||'');
  const text=l==='ar'?(rv.body_ar||rv.body_en||''):(rv.body_en||rv.body_ar||'');
  const color=u.avatar_color||avatarColors[uName.charCodeAt(0)%avatarColors.length];
  return`<div class="review-card">
    <div class="rv-top">
      <div class="rv-av" style="background:${color};color:#fff">${uName.charAt(0).toUpperCase()}</div>
      <div class="rv-meta">
        <div class="rv-name">${uName}</div>
        <div class="rv-info"><span>${u.city||''}</span>${(u.is_verified||rv.is_verified_visit)?`<span class="rv-ver">✓ ${l==='ar'?'موثّق':'Verified'}</span>`:''}</div>
      </div>
      <div class="stars">${renderStars(rv.rating)}</div>
    </div>
    ${bName?`<div class="rv-biz-tag">🏢 ${bName}</div>`:''}
    <p class="rv-text">${text}</p>
    <div class="rv-actions">
      <button class="rv-btn" onclick="doMarkHelpful('${rv.id}',this)">👍 ${l==='ar'?'مفيد':'Helpful'} (${rv.helpful_count||0})</button>
    </div>
  </div>`;
}
 
// ════════════════════════════════════════════════════
//  DATA LOADERS
// ════════════════════════════════════════════════════
async function loadBusinesses(){
  const grid=document.getElementById('biz-grid'); if(!grid) return;
  try {
    const data=await getBusinesses({limit:6});
    grid.innerHTML=data.length?data.map((b,i)=>renderBizCard(b,i+1)).join(''):'<p style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No businesses yet — be the first to add one!</p>';
    // Update stats
    const {count}=await db.from('businesses').select('*',{count:'exact',head:true});
    const el=document.getElementById('statBiz');
    if(el) el.textContent=(count||0).toLocaleString()+'+';
  } catch(err){ grid.innerHTML=`<p style="grid-column:1/-1;text-align:center;padding:40px;color:#dc2626">Failed to load businesses: ${err.message}</p>`; }
}
 
async function loadReviews(){
  const col=document.getElementById('reviews-col'); if(!col) return;
  try {
    const data=await getLatestReviews(5);
    col.innerHTML=data.length?data.map(renderReviewCard).join(''):'<p style="text-align:center;padding:40px;color:var(--muted)">No reviews yet — write the first one!</p>';
    const {count}=await db.from('reviews').select('*',{count:'exact',head:true}).eq('status','published');
    const el=document.getElementById('statReviews');
    if(el) el.textContent=(count||0).toLocaleString()+'+';
  } catch(err){ col.innerHTML=`<p style="text-align:center;padding:40px;color:#dc2626">Failed to load reviews: ${err.message}</p>`; }
}
 
async function handleSearch(){
  const term=(document.getElementById('heroWhat')||document.getElementById('navSearch'))?.value||'';
  const grid=document.getElementById('biz-grid'); if(!grid) return;
  grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">Searching…</div>';
  try {
    const data=await searchBusinesses(term);
    grid.innerHTML=data.length?data.map((b,i)=>renderBizCard(b,i+1)).join(''):'<p style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No results found. Try a different keyword.</p>';
    document.getElementById('businesses').scrollIntoView({behavior:'smooth'});
  } catch(err){ grid.innerHTML=`<p style="grid-column:1/-1;text-align:center;padding:40px;color:#dc2626">Search error: ${err.message}</p>`; }
}
 
// ════════════════════════════════════════════════════
//  WRITE REVIEW
// ════════════════════════════════════════════════════
let CURRENT_BIZ_ID=null;
 
async function openWriteReview(){
  const user=await getCurrentUser();
  if(!user){ openModal('auth'); return; }
  openModal('write');
}
 
async function openBizModal(bizId){
  CURRENT_BIZ_ID=bizId;
  const user=await getCurrentUser();
  if(!user){ openModal('auth'); return; }
  openModal('write');
}
 
async function doSubmitReview(){
  const errBox=document.getElementById('review-submit-error');
  errBox.style.display='none';
  const rating=[...document.querySelectorAll('#starPick span')].filter(s=>s.classList.contains('lit')).length;
  const text=document.getElementById('reviewText').value.trim();
  const bizName=document.getElementById('reviewBizName').value.trim();
  const category=document.getElementById('reviewCategory').value;
  const visit=document.getElementById('reviewVisit').value;
  if(!bizName){ errBox.textContent='Please enter the business name'; errBox.style.display='block'; return; }
  if(!rating){ errBox.textContent='Please select a rating (1-5 stars)'; errBox.style.display='block'; return; }
  if(!text||text.length<10){ errBox.textContent='Please write a more detailed review (at least 10 characters)'; errBox.style.display='block'; return; }
  const btn=document.getElementById('reviewSubmitBtn');
  btn.disabled=true; btn.textContent='Submitting…';
  try {
    const user=await requireUser();
    let bizId=CURRENT_BIZ_ID;
    if(!bizId){
      // Create business on the fly
      const {data:biz,error:bizErr}=await db.from('businesses').insert({
        name_en:bizName, category:category||'Other',
        avg_rating:0, review_count:0, is_verified:false
      }).select().single();
      if(bizErr) throw bizErr;
      bizId=biz.id;
    }
    const uName=(user.email?.split('@')[0]||user.phone||'User');
    const {error:rvErr}=await db.from('reviews').insert({
      business_id:bizId, user_id:user.id,
      reviewer_name:uName, rating:Number(rating),
      body_en:text, language:'en',
      is_verified_visit:visit!=='self'?false:true,
      visit_confirmed:true, visit_method:visit,
      helpful_count:0, status:'pending'
    });
    if(rvErr) throw rvErr;
    closeModal('write'); showToast();
    CURRENT_BIZ_ID=null;
  } catch(err){
    errBox.textContent=err.message||'Something went wrong. Please try again.';
    errBox.style.display='block';
  } finally {
    btn.disabled=false;
    btn.innerHTML='<span class="en">Publish My Honest Review →</span><span class="ar">نشر رأيي الصادق ←</span>';
  }
}
 
async function doMarkHelpful(reviewId,btn){
  if(btn._done) return;
  try {
    const user=await requireUser();
    await db.from('helpful_votes').upsert({review_id:reviewId,user_id:user.id});
    btn._done=true;
    const m=btn.textContent.match(/\d+/);
    if(m) btn.textContent=btn.textContent.replace(m[0],parseInt(m[0])+1);
    btn.style.background='var(--green-light)';
    btn.style.color='var(--green-dark)';
  } catch(err){ /* user not logged in — auth modal shown */ }
}
 
// ════════════════════════════════════════════════════
//  SCROLL REVEAL
// ════════════════════════════════════════════════════
const revealObs=new IntersectionObserver(entries=>{
  entries.forEach((e,i)=>{ if(e.isIntersecting) setTimeout(()=>e.target.classList.add('visible'),i*60); });
},{threshold:.08});
document.querySelectorAll('.reveal').forEach(el=>revealObs.observe(el));
 
// ════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════
async function initRa2y(){
  await Promise.all([loadBusinesses(), loadReviews()]);
  db.auth.onAuthStateChange(async(event,session)=>{
    if(session?.user){
      const {data:profile}=await db.from('users').select('name').eq('id',session.user.id).maybeSingle();
      const name=profile?.name||session.user.email?.split('@')[0]||'User';
      updateNavForUser(name);
    } else {
      document.querySelectorAll('.btn-signin').forEach(b=>{
        b.innerHTML='👤 <span class="en">Sign In</span><span class="ar">دخول</span>';
        b.style.background=''; b.style.color='';
        b.onclick=()=>openModal('auth');
      });
    }
  });
}
document.addEventListener('DOMContentLoaded',initRa2y);
</script>
</body>
</html>
