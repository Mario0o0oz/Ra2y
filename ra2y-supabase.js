// ============================================================
// Ra2y — Supabase Backend Integration
// ============================================================

const SUPABASE_URL  = 'https://xewlelrkglgsrbcecigv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhld2xlbHJrZ2xnc3JiY2VjaWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjM4ODUsImV4cCI6MjA5MjE5OTg4NX0.3vY6bhwEysJk6-Y36oqqg2xE6m2FHeYnXUrkCdqbjYE';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// AUTH
// ============================================================

function normalizeEgyptPhone(phone) {
  let p = String(phone || '').trim().replace(/\s+/g, '').replace(/-/g, '');

  if (p.startsWith('+20')) return p;
  if (p.startsWith('20')) return '+' + p;
  if (p.startsWith('0')) return '+20' + p.slice(1);

  return '+20' + p;
}

function isValidEgyptMobile(phone) {
  return /^\+201[0125][0-9]{8}$/.test(phone);
}

async function sendOTP(phone) {
  const formatted = normalizeEgyptPhone(phone);

  if (!isValidEgyptMobile(formatted)) {
    throw new Error('Enter a valid Egyptian mobile number');
  }

  const { error } = await db.auth.signInWithOtp({
    phone: formatted
  });

  if (error) throw error;

  return true;
}

async function verifyOTP(phone, token) {
  const formatted = normalizeEgyptPhone(phone);

  if (!isValidEgyptMobile(formatted)) {
    throw new Error('Enter a valid Egyptian mobile number');
  }

  const { data, error } = await db.auth.verifyOtp({
    phone: formatted,
    token,
    type: 'sms'
  });

  if (error) throw error;

  const user = data.user;

  if (!user) {
    throw new Error('Login failed. No user session created.');
  }

  const { data: existing, error: lookupError } = await db
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupError) {
    console.warn('User lookup warning:', lookupError);
  }

  if (!existing) {
    const { error: insertError } = await db.from('users').insert({
      id: user.id,
      phone: formatted,
      is_verified: true
    });

    if (insertError) {
      console.warn('User profile insert warning:', insertError);
    }
  }

  return data;
}

async function signOut() {
  await db.auth.signOut();
  location.reload();
}

async function getCurrentUser() {
  const { data, error } = await db.auth.getUser();

  if (error) {
    console.warn('getCurrentUser error:', error);
    return null;
  }

  return data?.user || null;
}

async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    if (typeof openModal === 'function') openModal('auth');
    throw new Error('Please sign in first.');
  }

  return user;
}

// ============================================================
// BUSINESSES
// ============================================================

async function getBusinesses({ category, city, sort = 'avg_rating', limit = 12, offset = 0 } = {}) {
  let query = db
    .from('businesses')
    .select('*')
    .order(sort, { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);
  if (city) query = query.ilike('city', `%${city}%`);

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}

async function searchBusinesses(term) {
  const clean = term?.trim();

  if (!clean) {
    return getBusinesses({ limit: 12 });
  }

  const { data, error } = await db
    .from('businesses')
    .select('*')
    .or(`name_en.ilike.%${clean}%,name_ar.ilike.%${clean}%,category.ilike.%${clean}%,category_ar.ilike.%${clean}%,city.ilike.%${clean}%,city_ar.ilike.%${clean}%`)
    .order('avg_rating', { ascending: false })
    .limit(20);

  if (error) throw error;

  return data || [];
}

async function getBusinessById(id) {
  const { data, error } = await db
    .from('businesses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data;
}

async function addBusiness(payload) {
  const user = await requireUser();

  const { data, error } = await db
    .from('businesses')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}

// ============================================================
// REVIEWS
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

  return data || [];
}

async function getLatestReviews(limit = 10) {
  const { data, error } = await db
    .from('reviews')
    .select(`
      *,
      businesses ( name_en, name_ar, category, category_ar ),
      users ( name, name_ar, avatar_color, city, is_verified )
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data || [];
}

async function submitReview({
  business_id,
  rating,
  text,
  text_ar = null,
  visit_confirmed = false,
  visit_method = 'self'
}) {
  const user = await requireUser();

  const cleanText = text?.trim();

  if (!business_id) {
    throw new Error('Missing business.');
  }

  if (!rating || Number(rating) < 1 || Number(rating) > 5) {
    throw new Error('Please choose a rating from 1 to 5.');
  }

  if (!cleanText || cleanText.length < 10) {
    throw new Error('Please write a more detailed review.');
  }

  const { data, error } = await db
    .from('reviews')
    .insert({
      business_id,
      user_id: user.id,
      reviewer_name: user.phone || 'Verified user',
      rating: Number(rating),
      body_en: cleanText,
      body_ar: text_ar,
      language: 'en',
      is_verified_visit: Boolean(visit_confirmed),
      visit_confirmed: Boolean(visit_confirmed),
      visit_method,
      helpful_count: 0,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error('submitReview error:', error);
    throw error;
  }

  return data;
}

async function markHelpful(reviewId) {
  const user = await requireUser();

  const { error } = await db
    .from('helpful_votes')
    .upsert({
      review_id: reviewId,
      user_id: user.id
    });

  if (error) {
    console.error('markHelpful error:', error);
    throw error;
  }

  return true;
}

// ============================================================
// RENDER HELPERS
// ============================================================

function getLang() {
  return document.documentElement.getAttribute('data-lang') || 'en';
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function renderStars(rating) {
  const value = Math.round(safeNumber(rating));
  return Array.from({ length: 5 }, (_, i) => {
    const empty = i >= value ? ' e' : '';
    return `<span class="star${empty}">★</span>`;
  }).join('');
}

function renderBusinessCard(biz, rank) {
  const lang = getLang();

  const name = lang === 'ar'
    ? (biz.name_ar || biz.name_en)
    : (biz.name_en || biz.name_ar);

  const cat = lang === 'ar'
    ? (biz.category_ar || biz.category)
    : (biz.category || biz.category_ar);

  const city = lang === 'ar'
    ? (biz.city_ar || biz.city)
    : (biz.city || biz.city_ar);

  const rating = safeNumber(biz.avg_rating).toFixed(1);
  const count = biz.review_count || 0;

  return `
    <a class="biz-card" href="#" onclick="openBusinessModal('${biz.id}'); return false;">
      <div class="biz-img">
        <img src="${biz.image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=700&q=80'}" alt="${name || 'Business'}" loading="lazy">
        ${rank ? `<div class="biz-rank">#${rank}</div>` : ''}
        <div class="biz-badge ${biz.is_verified ? 'bb-verified' : 'bb-new'}">
          ${biz.is_verified ? '✓ Verified' : '✦ New'}
        </div>
      </div>

      <div class="biz-body">
        <div class="biz-top">
          <div class="biz-logo">🏢</div>
          <div class="biz-info">
            <div class="biz-name">${name || 'Unnamed business'}</div>
            <div class="biz-cat">${cat || ''}</div>
          </div>
          <span class="r-num">${rating}</span>
        </div>

        <div class="biz-rating">
          <div class="stars">${renderStars(biz.avg_rating)}</div>
          <span class="r-count">(${count} ${lang === 'ar' ? 'رأي' : 'reviews'})</span>
        </div>

        <div class="biz-footer">
          <span class="biz-loc">📍 ${city || ''}</span>
          <span class="biz-honest">✓ ${lang === 'ar' ? 'آراء حقيقية' : 'Real reviews'}</span>
        </div>
      </div>
    </a>
  `;
}

function renderReviewCard(review) {
  const lang = getLang();
  const user = review.users || {};
  const biz = review.businesses || {};

  const userName = lang === 'ar'
    ? (user.name_ar || user.name || review.reviewer_name || 'مستخدم موثّق')
    : (user.name || user.name_ar || review.reviewer_name || 'Verified user');

  const bizName = lang === 'ar'
    ? (biz.name_ar || biz.name_en || '')
    : (biz.name_en || biz.name_ar || '');

  const text = lang === 'ar'
    ? (review.body_ar || review.body_en || '')
    : (review.body_en || review.body_ar || '');

  return `
    <div class="review-card">
      <div class="rv-top">
        <div class="rv-av" style="background:${user.avatar_color || '#1db954'};color:#fff">
          ${userName.charAt(0)}
        </div>

        <div class="rv-meta">
          <div class="rv-name">${userName}</div>
          <div class="rv-info">
            <span>${user.city || ''}</span>
            ${user.is_verified || review.is_verified_visit ? `<span class="rv-ver">✓ ${lang === 'ar' ? 'موثّق' : 'Verified'}</span>` : ''}
          </div>
        </div>

        <div class="stars">${renderStars(review.rating)}</div>
      </div>

      <div class="rv-biz-tag">🏢 ${bizName}</div>
      <p class="rv-text">${text}</p>

      <div class="rv-actions">
        <button class="rv-btn" onclick="markHelpful('${review.id}')">👍 ${lang === 'ar' ? 'مفيد' : 'Helpful'} (${review.helpful_count || 0})</button>
      </div>
    </div>
  `;
}

// ============================================================
// UI LOADERS
// ============================================================

async function loadBusinesses() {
  const section = document.getElementById('businesses');
  if (!section) return;

  const grid = section.querySelector('.biz-grid');
  if (!grid) return;

  grid.innerHTML = '<p>Loading businesses...</p>';

  try {
    const businesses = await getBusinesses({ limit: 6 });

    grid.innerHTML = businesses.length
      ? businesses.map((b, i) => renderBusinessCard(b, i + 1)).join('')
      : '<p>No businesses found.</p>';

  } catch (err) {
    console.error('loadBusinesses error:', err);
    grid.innerHTML = '<p>Failed to load businesses.</p>';
  }
}

async function loadLatestReviews() {
  const section = document.getElementById('reviews');
  if (!section) return;

  const col = section.querySelector('.reviews-col');
  if (!col) return;

  col.innerHTML = '<p>Loading reviews...</p>';

  try {
    const reviews = await getLatestReviews(5);

    col.innerHTML = reviews.length
      ? reviews.map(renderReviewCard).join('')
      : '<p>No published reviews yet.</p>';

  } catch (err) {
    console.error('loadLatestReviews error:', err);
    col.innerHTML = '<p>Failed to load reviews.</p>';
  }
}

async function handleSearch() {
  const input = document.getElementById('heroWhat') || document.querySelector('.nav-search input');
  const term = input?.value || '';

  const section = document.getElementById('businesses');
  const grid = section?.querySelector('.biz-grid');
  if (!grid) return;

  grid.innerHTML = '<p>Searching...</p>';

  try {
    const results = await searchBusinesses(term);
    grid.innerHTML = results.length
      ? results.map((b, i) => renderBusinessCard(b, i + 1)).join('')
      : '<p>No results found.</p>';

    section.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error('Search error:', err);
    grid.innerHTML = '<p>Search failed.</p>';
  }
}

// ============================================================
// REVIEW MODAL HELPERS
// ============================================================

async function openWriteReview() {
  const user = await getCurrentUser();

  if (!user) {
    if (typeof openModal === 'function') openModal('auth');
    return;
  }

  if (typeof openModal === 'function') openModal('write');
}

async function openBusinessModal(businessId) {
  window.CURRENT_BUSINESS_ID = businessId;

  const user = await getCurrentUser();

  if (!user) {
    if (typeof openModal === 'function') openModal('auth');
    return;
  }

  if (typeof openModal === 'function') openModal('write');

  setTimeout(() => {
    const select = document.getElementById('reviewBusinessSelect');
    if (select) select.value = businessId;
  }, 300);
}

// ============================================================
// INIT
// ============================================================

async function initRa2y() {
  await loadBusinesses();
  await loadLatestReviews();

  db.auth.onAuthStateChange((event, session) => {
    const signInBtn = document.querySelector('.btn-signin');

    if (!signInBtn) return;

    if (session?.user) {
      signInBtn.innerHTML = '👤 My Account';
      signInBtn.onclick = signOut;
    } else {
      signInBtn.innerHTML = '👤 Sign In';
      signInBtn.onclick = () => {
        if (typeof openModal === 'function') openModal('auth');
      };
    }
  });

  const initialUser = await getCurrentUser();
  const signInBtn = document.querySelector('.btn-signin');

  if (signInBtn) {
    if (initialUser) {
      signInBtn.innerHTML = '👤 My Account';
      signInBtn.onclick = signOut;
    } else {
      signInBtn.innerHTML = '👤 Sign In';
      signInBtn.onclick = () => {
        if (typeof openModal === 'function') openModal('auth');
      };
    }
  }
}

document.addEventListener('DOMContentLoaded', initRa2y);
