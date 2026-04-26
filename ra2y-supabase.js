// ============================================================
//  Ra2y — Supabase Backend Integration
//  ra2y-supabase.js  |  Paste this into your project
// ============================================================
//
//  STEP 1: Replace these two values with yours from Supabase
//  (Project Settings → API)
// ============================================================

const SUPABASE_URL  = 'https://xewlelrkglgsrbcecigv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhld2xlbHJrZ2xnc3JiY2VjaWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjM4ODUsImV4cCI6MjA5MjE5OTg4NX0.3vY6bhwEysJk6-Y36oqqg2xE6m2FHeYnXUrkCdqbjYE';

// ── Load the Supabase SDK (add this to your HTML <head>) ────
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
//  DATABASE SCHEMA  (run this SQL in Supabase SQL Editor)
// ============================================================
/*

-- 1. USERS TABLE
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique not null,
  name          text,
  name_ar       text,
  avatar_color  text default '#1db954',
  city          text,
  is_verified   boolean default false,
  review_count  int default 0,
  helpful_count int default 0,
  created_at    timestamptz default now()
);

-- 2. BUSINESSES TABLE
create table public.businesses (
  id            uuid primary key default gen_random_uuid(),
  name_en       text not null,
  name_ar       text,
  category      text not null,
  category_ar   text,
  city          text,
  city_ar       text,
  address       text,
  phone         text,
  hours         text,
  image_url     text,
  avg_rating    numeric(3,2) default 0,
  review_count  int default 0,
  is_verified   boolean default false,
  is_claimed    boolean default false,
  created_at    timestamptz default now()
);

-- 3. REVIEWS TABLE
create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references public.businesses(id) on delete cascade,
  user_id         uuid references public.users(id) on delete set null,
  rating          int check (rating between 1 and 5) not null,
  text            text not null,
  text_ar         text,
  visit_confirmed boolean default false,
  visit_method    text,  -- 'gps' | 'receipt' | 'self'
  helpful_count   int default 0,
  ai_score        numeric(3,2) default 1.0,  -- 0=fake, 1=genuine
  status          text default 'pending',    -- 'pending' | 'published' | 'rejected'
  created_at      timestamptz default now()
);

-- 4. HELPFUL VOTES TABLE
create table public.helpful_votes (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid references public.reviews(id) on delete cascade,
  user_id     uuid references public.users(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(review_id, user_id)
);

-- 5. ENABLE ROW LEVEL SECURITY
alter table public.users      enable row level security;
alter table public.businesses enable row level security;
alter table public.reviews    enable row level security;
alter table public.helpful_votes enable row level security;

-- 6. RLS POLICIES (public read, authenticated write)
create policy "Anyone can read businesses"
  on public.businesses for select using (true);

create policy "Anyone can read published reviews"
  on public.reviews for select using (status = 'published');

create policy "Authenticated users can insert reviews"
  on public.reviews for insert
  with check (auth.uid() is not null);

create policy "Users can read their own data"
  on public.users for select
  using (auth.uid() = id);

-- 7. AUTO-UPDATE avg_rating on new review
create or replace function update_business_rating()
returns trigger as $$
begin
  update public.businesses
  set
    avg_rating   = (select round(avg(rating)::numeric, 2) from public.reviews where business_id = new.business_id and status = 'published'),
    review_count = (select count(*) from public.reviews where business_id = new.business_id and status = 'published')
  where id = new.business_id;
  return new;
end;
$$ language plpgsql;

create trigger on_review_published
  after insert or update on public.reviews
  for each row execute procedure update_business_rating();

*/

// ============================================================
//  AUTH — Phone OTP (Supabase handles SMS via Twilio free)
// ============================================================

async function sendOTP(phone) {
  // Normalize: +20 1234 567890
  const formatted = phone.startsWith('+') ? phone : '+' + phone;
  const { error } = await db.auth.signInWithOtp({ phone: formatted });
  if (error) throw error;
  return true;
}

async function verifyOTP(phone, token) {
  const formatted = phone.startsWith('+') ? phone : '+' + phone;
  const { data, error } = await db.auth.verifyOtp({
    phone: formatted,
    token,
    type: 'sms'
  });
  if (error) throw error;

  // Auto-create user profile if first login
  const user = data.user;
  const { data: existing } = await db.from('users').select('id').eq('id', user.id).single();
  if (!existing) {
    await db.from('users').insert({
      id: user.id,
      phone: formatted,
      is_verified: true
    });
  }
  return data;
}

async function signOut() {
  await db.auth.signOut();
}

async function getCurrentUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

// ============================================================
//  BUSINESSES
// ============================================================

async function getBusinesses({ category, city, sort = 'avg_rating', limit = 12, offset = 0 } = {}) {
  let query = db
    .from('businesses')
    .select('*')
    .order(sort, { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);
  if (city)     query = query.ilike('city', `%${city}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function searchBusinesses(term) {
  const { data, error } = await db
    .from('businesses')
    .select('*')
    .or(`name_en.ilike.%${term}%,name_ar.ilike.%${term}%,category.ilike.%${term}%`)
    .order('avg_rating', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

async function getBusinessById(id) {
  const { data, error } = await db
    .from('businesses')
    .select('*, reviews(count)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function addBusiness({ name_en, name_ar, category, category_ar, city, city_ar, address, phone, hours, image_url }) {
  const { data, error } = await db
    .from('businesses')
    .insert({ name_en, name_ar, category, category_ar, city, city_ar, address, phone, hours, image_url })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
//  REVIEWS
// ============================================================

async function getReviewsForBusiness(businessId, { limit = 10, offset = 0 } = {}) {
  const { data, error } = await db
    .from('reviews')
    .select(`
      *,
      users ( name, name_ar, avatar_color, city, is_verified )
    `)
    .eq('business_id', businessId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

async function getLatestReviews(limit = 10) {
  const { data, error } = await db
    .from('reviews')
    .select(`
      *,
      businesses ( name_en, name_ar, category ),
      users      ( name, name_ar, avatar_color, city, is_verified )
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function submitReview({ business_id, rating, text, text_ar, visit_confirmed, visit_method }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Must be signed in to submit a review');

  // Insert as 'pending' — AI screening happens in Edge Function
  const { data, error } = await db
    .from('reviews')
    .insert({
      business_id,
      user_id: user.id,
      rating,
      text,
      text_ar,
      visit_confirmed,
      visit_method,
      status: 'pending'
    })
    .select()
    .single();
  if (error) throw error;

  // Trigger AI screening Edge Function (non-blocking)
  db.functions.invoke('screen-review', { body: { review_id: data.id } })
    .catch(console.warn);

  return data;
}

async function markHelpful(reviewId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Must be signed in');

  // Upsert = click once only
  const { error } = await db
    .from('helpful_votes')
    .upsert({ review_id: reviewId, user_id: user.id });
  if (error) throw error;

  // Increment count
  await db.rpc('increment_helpful', { review_id: reviewId });
}

// ============================================================
//  AI SCREENING  (Supabase Edge Function — deploy separately)
//  File: supabase/functions/screen-review/index.ts
// ============================================================
/*

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { review_id } = await req.json()

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch the review
  const { data: review } = await db
    .from('reviews')
    .select('text, rating, user_id')
    .eq('id', review_id)
    .single()

  // Call Claude API to screen the review
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `You are a review authenticity screener. Analyze this review and respond with ONLY a JSON object: {"score": 0.0-1.0, "status": "published"|"rejected", "reason": "brief reason"}.

Score 1.0 = completely genuine. Score 0.0 = clearly fake/paid.
Reject if: generic praise with no specifics, promotional language, all caps, copy-paste patterns, no real details.

Review text: "${review.text}"
Rating: ${review.rating}/5`
      }]
    })
  })

  const result = await response.json()
  const text = result.content[0].text
  const screening = JSON.parse(text.replace(/```json|```/g, '').trim())

  // Update review status
  await db.from('reviews').update({
    ai_score: screening.score,
    status: screening.status
  }).eq('id', review_id)

  return new Response(JSON.stringify(screening), {
    headers: { 'Content-Type': 'application/json' }
  })
})

*/

// ============================================================
//  HELPER: Render business card HTML
// ============================================================

function renderBusinessCard(biz, rank) {
  const lang = document.documentElement.getAttribute('data-lang') || 'en';
  const name    = lang === 'ar' ? (biz.name_ar || biz.name_en) : biz.name_en;
  const cat     = lang === 'ar' ? (biz.category_ar || biz.category) : biz.category;
  const city    = lang === 'ar' ? (biz.city_ar || biz.city) : biz.city;
  const stars   = '★'.repeat(Math.round(biz.avg_rating)) + '☆'.repeat(5 - Math.round(biz.avg_rating));

  return `
    <a class="biz-card" href="#" onclick="openBusinessModal('${biz.id}'); return false;">
      <div class="biz-img">
        <img src="${biz.image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=700&q=80'}" alt="${name}" loading="lazy">
        ${rank ? `<div class="biz-rank">#${rank}</div>` : ''}
        <div class="biz-badge bb-${biz.is_verified ? 'verified' : 'new'}">${biz.is_verified ? '✓ Verified' : '✦ New'}</div>
      </div>
      <div class="biz-body">
        <div class="biz-top">
          <div class="biz-logo">🏢</div>
          <div class="biz-info">
            <div class="biz-name">${name}</div>
            <div class="biz-cat">${cat}</div>
          </div>
          <span class="r-num">${biz.avg_rating?.toFixed(1) || '–'}</span>
        </div>
        <div class="biz-rating">
          <div class="stars">${stars.split('').map(s =>
            `<span class="star${s==='☆'?' e':''}">${s==='★'?'★':'★'}</span>`).join('')}
          </div>
          <span class="r-count">(${biz.review_count} ${lang==='ar'?'رأي':'reviews'})</span>
        </div>
        <div class="biz-footer">
          <span class="biz-loc">📍 ${city || ''}</span>
          <span class="biz-honest">✓ ${lang==='ar'?'آراء أصلية':'Real reviews'}</span>
        </div>
      </div>
    </a>`;
}

// ============================================================
//  INITIALIZE — call this on page load
// ============================================================

async function initRa2y() {
  try {
    // Load businesses into grid
    const bizGrid = document.getElementById('businesses');
    if (bizGrid) {
      const businesses = await getBusinesses({ limit: 6 });
      const grid = bizGrid.querySelector('.biz-grid');
      if (grid && businesses.length) {
        grid.innerHTML = businesses.map((b, i) => renderBusinessCard(b, i + 1)).join('');
      }
    }

    // Load latest reviews
    const reviewsSection = document.getElementById('reviews');
    if (reviewsSection) {
      const reviews = await getLatestReviews(3);
      // Render reviews... (extend as needed)
    }

    // Auth state listener
    db.auth.onAuthStateChange((event, session) => {
      const signInBtn = document.querySelector('.btn-signin');
      if (session?.user && signInBtn) {
        signInBtn.textContent = '👤 My Account';
      }
    });

  } catch (err) {
    console.error('Ra2y init error:', err);
  }
}

// Run on load
document.addEventListener('DOMContentLoaded', initRa2y);
