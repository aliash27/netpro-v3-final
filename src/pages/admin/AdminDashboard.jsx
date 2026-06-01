import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from '../../components/Toast'

const PLAN_COLORS = { trial:'#d97706', starter:'#6144f5', pro:'#1a3fdb', business:'#059669' }
const PLAN_NAMES  = { trial:'⭐ تجريبي', starter:'⚡ البداية', pro:'💎 الاحترافي', business:'🏢 الأعمال' }
const PLAN_PRICES = { trial:0, starter:5, pro:12, business:25 }
const fmt = n => Number(n||0).toLocaleString('ar-IQ')

export default function AdminDashboard() {
  const { user, signOut } = useAuth()
  const navigate          = useNavigate()

  const [tab,         setTab]         = useState('overview')
  const [companies,   setCompanies]   = useState([])
  const [requests,    setRequests]    = useState([])
  const [stats,       setStats]       = useState({})
  const [loading,     setLoading]     = useState(true)
  const [dark,        setDark]        = useState(false)
  const [search,      setSearch]      = useState('')

  // Company edit modal
  const [editCo,      setEditCo]      = useState(null)
  const [editForm,    setEditForm]    = useState({})
  const [editSaving,  setEditSaving]  = useState(false)

  // Create company modal
  const [showCreate,  setShowCreate]  = useState(false)
  const [createForm,  setCreateForm]  = useState({
    email:'', password:'', name:'', phone:'', plan:'trial'
  })
  const [createSaving, setCreateSaving] = useState(false)

  // Delete confirm
  const [delCo,       setDelCo]       = useState(null)

  useEffect(() => {
    loadAll()
    setDark(document.documentElement.hasAttribute('data-dark'))
  }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: co }, { data: req }] = await Promise.all([
      supabase.from('companies').select('*').order('created_at',{ascending:false}),
      supabase.from('subscription_requests')
        .select('*, companies(name,email,id)')
        .order('requested_at',{ascending:false}),
    ])
    const coList = co || []
    setCompanies(coList)
    setRequests(req || [])

    // Monthly revenue
    const monthlyRev = coList.reduce((s,c) => s + (PLAN_PRICES[c.plan]||0), 0)

    // Subscribers count
    const { count: subCount } = await supabase
      .from('subscribers').select('*',{count:'exact',head:true}).eq('is_active',true)
    const { count: payCount } = await supabase
      .from('payments').select('*',{count:'exact',head:true})

    setStats({
      totalCompanies:   coList.length,
      activeCompanies:  coList.filter(c => c.plan !== 'trial').length,
      trialCompanies:   coList.filter(c => c.plan === 'trial').length,
      pendingRequests:  (req||[]).filter(r => r.status === 'pending').length,
      totalSubscribers: subCount || 0,
      totalPayments:    payCount || 0,
      monthlyRev,
    })
    setLoading(false)
  }

  /* ── Request actions ── */
  async function approveRequest(id, companyId, planKey) {
    const trialEnd = new Date()
    trialEnd.setFullYear(trialEnd.getFullYear() + 1)
    await supabase.from('subscription_requests').update({
      status:'approved', reviewed_at:new Date().toISOString(), reviewed_by:user?.email
    }).eq('id', id)
    await supabase.from('companies').update({
      plan: planKey,
      trial_end: trialEnd.toISOString()
    }).eq('id', companyId)
    toast('✅ تمت الموافقة وتفعيل الباقة', 's')
    loadAll()
  }

  async function rejectRequest(id) {
    await supabase.from('subscription_requests').update({
      status:'rejected', reviewed_at:new Date().toISOString(), reviewed_by:user?.email
    }).eq('id', id)
    toast('تم رفض الطلب', 'w')
    loadAll()
  }

  /* ── Company actions ── */
  async function updatePlan(companyId, plan) {
    const trialEnd = new Date()
    trialEnd.setFullYear(trialEnd.getFullYear() + 1)
    await supabase.from('companies').update({
      plan,
      trial_end: plan !== 'trial' ? trialEnd.toISOString() : undefined
    }).eq('id', companyId)
    toast('تم تحديث الباقة ✅', 's')
    loadAll()
  }

  async function toggleActive(id, current) {
    await supabase.from('companies').update({ is_active: !current }).eq('id', id)
    toast(current ? '⏸ تم تعطيل الحساب' : '✅ تم تفعيل الحساب', 's')
    loadAll()
  }

  function openEdit(co) {
    setEditCo(co)
    setEditForm({
      name:  co.name  || '',
      phone: co.phone || '',
      plan:  co.plan  || 'trial',
      trial_end: co.trial_end ? co.trial_end.split('T')[0] : '',
      is_active: co.is_active ?? true
    })
  }

  async function saveEdit() {
    if (!editForm.name) { toast('يرجى إدخال اسم الشركة','e'); return }
    setEditSaving(true)
    const { error } = await supabase.from('companies').update({
      name:      editForm.name.trim(),
      phone:     editForm.phone.trim(),
      plan:      editForm.plan,
      trial_end: editForm.trial_end || null,
      is_active: editForm.is_active
    }).eq('id', editCo.id)
    setEditSaving(false)
    if (error) { toast('خطأ: ' + error.message, 'e'); return }
    toast('تم تحديث بيانات الشركة ✅', 's')
    setEditCo(null)
    loadAll()
  }

  async function resetPassword(coEmail) {
    const { error } = await supabase.auth.resetPasswordForEmail(coEmail, {
      redirectTo: window.location.origin + '/login'
    })
    if (error) { toast('خطأ: ' + error.message, 'e'); return }
    toast(`✅ تم إرسال رابط تعيين كلمة المرور إلى ${coEmail}`, 's')
  }

  async function deleteCo() {
    if (!delCo) return
    // Soft delete — set is_active=false OR hard delete
    await supabase.from('companies').update({ is_active: false }).eq('id', delCo.id)
    toast('تم حذف الشركة (إيقاف)', 's')
    setDelCo(null)
    loadAll()
  }

  async function createCompany() {
    const { email, password, name, phone, plan } = createForm
    if (!email || !password || !name) {
      toast('يرجى ملء البريد وكلمة المرور واسم الشركة','e'); return
    }
    if (password.length < 6) {
      toast('كلمة المرور 6 أحرف على الأقل','e'); return
    }
    setCreateSaving(true)
    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { company_name: name } }
    })
    if (authErr) { toast('خطأ Auth: ' + authErr.message,'e'); setCreateSaving(false); return }

    // Update company record that was auto-created by trigger
    if (authData?.user?.id) {
      await supabase.from('companies').update({
        name: name.trim(), phone: phone.trim(), plan
      }).eq('owner_id', authData.user.id)
    }
    setCreateSaving(false)
    toast('✅ تم إنشاء الحساب بنجاح', 's')
    setShowCreate(false)
    setCreateForm({ email:'', password:'', name:'', phone:'', plan:'trial' })
    setTimeout(loadAll, 1500) // give trigger time to run
  }

  function toggleTheme() {
    const newDark = !dark
    setDark(newDark)
    if (newDark) {
      document.documentElement.setAttribute('data-dark','')
      localStorage.setItem('np_theme','dark')
    } else {
      document.documentElement.removeAttribute('data-dark')
      localStorage.setItem('np_theme','light')
    }
  }

  const filteredCos = search
    ? companies.filter(c =>
        c.name?.includes(search) ||
        c.email?.includes(search) ||
        c.phone?.includes(search))
    : companies

  // Monthly revenue by month (last 6)
  const revenueByMonth = (() => {
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const label = d.toLocaleString('ar', {month:'short', year:'2-digit'})
      months.push({ key, label })
    }
    return months
  })()

  // Chart bar max
  const maxRev = stats.monthlyRev || 1

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',fontFamily:'Tajawal,sans-serif',direction:'rtl'}}>

      {/* ── Top bar ── */}
      <div style={{
        height:62, padding:'0 16px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'linear-gradient(135deg,#0a0f1e,#1a3fdb)',
        position:'sticky', top:0, zIndex:200,
        boxShadow:'0 4px 20px rgba(26,63,219,.35)'
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{
            width:36,height:36,borderRadius:10,
            background:'rgba(255,255,255,.15)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:18
          }}>🛡️</div>
          <div>
            <div style={{fontSize:14,fontWeight:900,color:'#fff'}}>لوحة تحكم المدير</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,.6)',letterSpacing:'.04em'}}>
              NETPRO ADMIN — {user?.email}
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={toggleTheme} style={{
            width:36,height:36,borderRadius:9,
            border:'1px solid rgba(255,255,255,.2)',
            background:'rgba(255,255,255,.1)',
            color:'#fff',cursor:'pointer',fontSize:16
          }}>{dark?'☀️':'🌙'}</button>
          <button onClick={() => navigate('/')} style={{
            width:36,height:36,borderRadius:9,
            border:'1px solid rgba(255,255,255,.2)',
            background:'rgba(255,255,255,.1)',
            color:'#fff',cursor:'pointer',fontSize:14,fontWeight:700
          }}>🏠</button>
          <button onClick={async () => { await signOut(); navigate('/login') }} style={{
            padding:'8px 14px',borderRadius:9,
            border:'1px solid rgba(225,29,72,.4)',
            background:'rgba(225,29,72,.15)',
            color:'#ff6b6b',cursor:'pointer',fontSize:12,fontWeight:700
          }}>🚪</button>
        </div>
      </div>

      <div style={{maxWidth:860,margin:'0 auto',padding:'20px 16px 50px'}}>
        {loading ? (
          <div style={{textAlign:'center',padding:80,fontSize:40}}>⏳</div>
        ) : (<>

          {/* ── KPI Cards ── */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:16}}>
            {[
              { icon:'🏢', label:'إجمالي الشركات',    value:stats.totalCompanies,   color:'#1a3fdb' },
              { icon:'💰', label:'الإيراد الشهري',    value:`$${stats.monthlyRev}`,  color:'#059669' },
              { icon:'⏳', label:'طلبات معلّقة',      value:stats.pendingRequests,   color:'#d97706' },
              { icon:'👥', label:'إجمالي المشتركين',  value:stats.totalSubscribers,  color:'#6144f5' },
              { icon:'⭐', label:'حسابات تجريبية',    value:stats.trialCompanies,    color:'#d97706' },
              { icon:'✅', label:'حسابات مدفوعة',     value:stats.activeCompanies,   color:'#059669' },
            ].map(s => (
              <div key={s.label} style={{
                background:'var(--sur)',border:'1px solid var(--bdr)',
                borderRadius:16,padding:'14px',boxShadow:'var(--shC)'
              }}>
                <div style={{fontSize:24,marginBottom:4}}>{s.icon}</div>
                <div style={{fontSize:11,color:'var(--ink3)',fontWeight:700,marginBottom:2}}>{s.label}</div>
                <div style={{fontSize:26,fontWeight:900,color:s.color}}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div style={{display:'flex',background:'var(--bg2)',borderRadius:10,padding:4,gap:4,marginBottom:16,overflowX:'auto'}}>
            {[
              {key:'overview',  label:'📊 الإحصائيات'},
              {key:'requests',  label:`⏳ الطلبات${stats.pendingRequests>0?` (${stats.pendingRequests})`:''}`},
              {key:'companies', label:'🏢 الشركات'},
              {key:'create',    label:'➕ حساب جديد'},
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex:'0 0 auto',padding:'9px 14px',borderRadius:7,border:'none',
                fontSize:12,fontWeight:700,cursor:'pointer',transition:'.18s',whiteSpace:'nowrap',
                background: tab===t.key
                  ? 'linear-gradient(135deg,#1a3fdb,#6144f5,#9c27b0)' : 'transparent',
                color: tab===t.key ? '#fff' : 'var(--ink3)',
                boxShadow: tab===t.key ? '0 3px 12px rgba(26,63,219,.22)' : 'none'
              }}>{t.label}</button>
            ))}
          </div>

          {/* ════════ TAB: Overview ════════ */}
          {tab==='overview' && (
            <div>
              {/* Plans distribution */}
              <div style={{background:'var(--sur)',border:'1px solid var(--bdr)',borderRadius:16,padding:18,marginBottom:14}}>
                <div style={{fontSize:15,fontWeight:800,color:'var(--ink)',marginBottom:16}}>📈 توزيع الباقات</div>
                {Object.entries(PLAN_NAMES).map(([key, name]) => {
                  const count = companies.filter(c => c.plan===key).length
                  const pct   = companies.length ? Math.round(count/companies.length*100) : 0
                  return (
                    <div key={key} style={{marginBottom:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                        <span style={{fontSize:13,fontWeight:600}}>{name}</span>
                        <span style={{fontSize:13,fontWeight:800,color:PLAN_COLORS[key]}}>
                          {count} شركة ({pct}%)
                        </span>
                      </div>
                      <div style={{height:8,background:'var(--bdr)',borderRadius:8,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:PLAN_COLORS[key],borderRadius:8,transition:'width .8s'}}/>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Revenue card */}
              <div style={{
                background:'linear-gradient(135deg,#1a3fdb,#6144f5,#9c27b0)',
                borderRadius:16,padding:20,marginBottom:14
              }}>
                <div style={{fontSize:13,color:'rgba(255,255,255,.7)',marginBottom:4}}>
                  💰 الإيراد الشهري المتوقع
                </div>
                <div style={{fontSize:34,fontWeight:900,color:'#fff'}}>
                  ${stats.monthlyRev}
                  <span style={{fontSize:14,color:'rgba(255,255,255,.7)'}}>/شهر</span>
                </div>
                <div style={{fontSize:12,color:'rgba(255,255,255,.6)',marginTop:4}}>
                  سنوياً: ${stats.monthlyRev * 12} | {stats.activeCompanies} شركة مدفوعة
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:14}}>
                  {['starter','pro','business'].map(k => (
                    <div key={k} style={{background:'rgba(255,255,255,.12)',borderRadius:10,padding:10,textAlign:'center'}}>
                      <div style={{fontSize:11,color:'rgba(255,255,255,.7)',marginBottom:2}}>{PLAN_NAMES[k]}</div>
                      <div style={{fontSize:18,fontWeight:900,color:'#fff'}}>
                        {companies.filter(c=>c.plan===k).length}
                      </div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,.6)'}}>
                        ${companies.filter(c=>c.plan===k).length * PLAN_PRICES[k]}/شهر
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent signups */}
              <div style={{background:'var(--sur)',border:'1px solid var(--bdr)',borderRadius:16,padding:18}}>
                <div style={{fontSize:15,fontWeight:800,color:'var(--ink)',marginBottom:14}}>🆕 آخر التسجيلات</div>
                {companies.slice(0,8).map((co,i,arr) => (
                  <div key={co.id} style={{
                    display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'10px 0',
                    borderBottom: i<arr.length-1 ? '1px solid var(--bdr)' : 'none'
                  }}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--ink)'}}>{co.name}</div>
                      <div style={{fontSize:11,color:'var(--ink3)'}}>{co.email}</div>
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{
                        fontSize:11,fontWeight:800,padding:'3px 9px',borderRadius:20,
                        background:`${PLAN_COLORS[co.plan]}22`,color:PLAN_COLORS[co.plan]
                      }}>{PLAN_NAMES[co.plan]}</span>
                      {!co.is_active && (
                        <span style={{fontSize:10,background:'rgba(225,29,72,.1)',color:'#e11d48',padding:'2px 7px',borderRadius:20}}>موقف</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════ TAB: Requests ════════ */}
          {tab==='requests' && (
            <div>
              {requests.length === 0 ? (
                <div style={{textAlign:'center',padding:60,color:'var(--ink3)'}}>
                  <div style={{fontSize:48,marginBottom:10}}>📭</div>
                  <div style={{fontWeight:700,fontSize:16}}>لا يوجد طلبات حالياً</div>
                </div>
              ) : requests.map(req => (
                <div key={req.id} style={{
                  background:'var(--sur)',
                  border:`1px solid ${req.status==='pending'?'rgba(217,119,6,.3)':req.status==='approved'?'rgba(5,150,105,.3)':'rgba(225,29,72,.2)'}`,
                  borderRadius:16,padding:16,marginBottom:12
                }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:'var(--ink)'}}>{req.companies?.name||'—'}</div>
                      <div style={{fontSize:12,color:'var(--ink3)',marginTop:2}}>📧 {req.companies?.email}</div>
                      <div style={{fontSize:11,color:'var(--ink3)',marginTop:2}}>
                        📅 {new Date(req.requested_at).toLocaleString('ar')}
                      </div>
                    </div>
                    <div style={{textAlign:'left'}}>
                      <div style={{
                        fontSize:20,fontWeight:900,
                        background:'linear-gradient(135deg,#1a3fdb,#6144f5)',
                        WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'
                      }}>${req.amount}/شهر</div>
                      <span style={{
                        fontSize:11,fontWeight:800,padding:'3px 10px',borderRadius:20,
                        marginTop:4,display:'inline-block',
                        background:req.status==='pending'?'rgba(217,119,6,.12)':req.status==='approved'?'rgba(5,150,105,.12)':'rgba(225,29,72,.12)',
                        color:req.status==='pending'?'#d97706':req.status==='approved'?'#059669':'#e11d48'
                      }}>
                        {req.status==='pending'?'⏳ معلّق':req.status==='approved'?'✅ مقبول':'❌ مرفوض'}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:20,
                    background:`${PLAN_COLORS[req.plan_key]}22`,color:PLAN_COLORS[req.plan_key],
                    display:'inline-block',marginBottom:12
                  }}>{PLAN_NAMES[req.plan_key]}</span>
                  {req.payment_image_url && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:12,color:'var(--ink3)',marginBottom:6,fontWeight:700}}>📷 إيصال الدفع:</div>
                      <img src={req.payment_image_url} alt="إيصال" onClick={() => window.open(req.payment_image_url,'_blank')}
                        style={{width:'100%',maxHeight:220,objectFit:'cover',borderRadius:10,cursor:'pointer',border:'1px solid var(--bdr)'}}/>
                    </div>
                  )}
                  {req.status==='pending' && (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <button onClick={() => approveRequest(req.id, req.companies?.id, req.plan_key)}
                        style={{padding:12,borderRadius:10,border:'none',background:'linear-gradient(135deg,#065f46,#059669)',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer'}}>
                        ✅ موافقة وتفعيل
                      </button>
                      <button onClick={() => rejectRequest(req.id)}
                        style={{padding:12,borderRadius:10,border:'none',background:'linear-gradient(135deg,#7f1d1d,#dc2626)',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer'}}>
                        ❌ رفض الطلب
                      </button>
                    </div>
                  )}
                  {req.status!=='pending' && (
                    <div style={{fontSize:12,color:'var(--ink3)',textAlign:'center',padding:'8px 0'}}>
                      تمت المراجعة بواسطة: {req.reviewed_by||'—'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ════════ TAB: Companies ════════ */}
          {tab==='companies' && (
            <div>
              {/* Search */}
              <div style={{position:'relative',marginBottom:12}}>
                <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',fontSize:16}}>🔍</span>
                <input placeholder="بحث بالاسم أو البريد..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{width:'100%',padding:'10px 38px 10px 12px',borderRadius:10,
                    border:'1px solid var(--bdr)',background:'var(--sur)',color:'var(--ink)',
                    fontFamily:'Tajawal,sans-serif',fontSize:13,boxSizing:'border-box'}}/>
              </div>
              <div style={{fontSize:13,color:'var(--ink3)',marginBottom:12}}>
                {filteredCos.length} / {companies.length} شركة
              </div>

              {filteredCos.map(co => (
                <div key={co.id} style={{
                  background:'var(--sur)',border:'1px solid var(--bdr)',
                  borderRadius:16,padding:16,marginBottom:10
                }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:800,color:'var(--ink)'}}>{co.name}</div>
                      <div style={{fontSize:12,color:'var(--ink3)',marginTop:2}}>📧 {co.email}</div>
                      {co.phone && <div style={{fontSize:12,color:'var(--ink3)',marginTop:2}}>📞 {co.phone}</div>}
                      <div style={{fontSize:11,color:'var(--ink3)',marginTop:4}}>
                        📅 {new Date(co.created_at).toLocaleDateString('ar')}
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
                      <span style={{
                        fontSize:11,fontWeight:800,padding:'3px 9px',borderRadius:20,
                        background:`${PLAN_COLORS[co.plan]}22`,color:PLAN_COLORS[co.plan]
                      }}>{PLAN_NAMES[co.plan]}</span>
                      <span style={{
                        fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,
                        background:co.is_active?'rgba(5,150,105,.1)':'rgba(225,29,72,.1)',
                        color:co.is_active?'#059669':'#e11d48'
                      }}>{co.is_active?'● نشط':'● موقف'}</span>
                    </div>
                  </div>

                  {/* 4-action grid */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <button onClick={() => openEdit(co)}
                      style={{padding:9,borderRadius:9,border:'none',background:'rgba(26,63,219,.1)',color:'#1a3fdb',fontWeight:700,fontSize:12,cursor:'pointer'}}>
                      ✏️ تعديل الحساب
                    </button>
                    <button onClick={() => toggleActive(co.id, co.is_active)}
                      style={{padding:9,borderRadius:9,border:'none',
                        background:co.is_active?'rgba(225,29,72,.1)':'rgba(5,150,105,.1)',
                        color:co.is_active?'#e11d48':'#059669',fontWeight:700,fontSize:12,cursor:'pointer'}}>
                      {co.is_active?'⏸ تعطيل':'▶ تفعيل'}
                    </button>
                    <button onClick={() => co.email && resetPassword(co.email)}
                      style={{padding:9,borderRadius:9,border:'none',background:'rgba(124,58,237,.1)',color:'#7c3aed',fontWeight:700,fontSize:12,cursor:'pointer'}}>
                      🔑 إعادة كلمة المرور
                    </button>
                    <button onClick={() => setDelCo(co)}
                      style={{padding:9,borderRadius:9,border:'none',background:'rgba(225,29,72,.08)',color:'var(--rose)',fontWeight:700,fontSize:12,cursor:'pointer'}}>
                      🗑 حذف
                    </button>
                  </div>

                  {/* Quick plan change */}
                  <div style={{marginTop:8}}>
                    <select value={co.plan} onChange={e => updatePlan(co.id, e.target.value)}
                      style={{width:'100%',padding:'9px 12px',borderRadius:9,
                        border:'1px solid var(--bdr)',background:'var(--bg2)',
                        color:'var(--ink)',fontFamily:'Tajawal,sans-serif',
                        fontSize:12,fontWeight:700,cursor:'pointer'}}>
                      {Object.entries(PLAN_NAMES).map(([k,v]) => (
                        <option key={k} value={k}>{v} — ${PLAN_PRICES[k]}/شهر</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ════════ TAB: Create ════════ */}
          {tab==='create' && (
            <div style={{background:'var(--sur)',border:'1px solid var(--bdr)',borderRadius:16,padding:20}}>
              <div style={{fontSize:17,fontWeight:800,color:'var(--ink)',marginBottom:20,display:'flex',alignItems:'center',gap:8}}>
                ➕ إنشاء حساب شركة جديد
              </div>
              <div style={{background:'rgba(26,63,219,.06)',borderRadius:10,padding:'10px 14px',marginBottom:18,fontSize:13,color:'var(--ink2)'}}>
                🔐 سيتم إنشاء حساب Supabase Auth حقيقي وتعيين بيانات الشركة تلقائياً
              </div>

              {[
                {label:'البريد الإلكتروني *', key:'email', type:'email', ph:'owner@company.com', icon:'📧'},
                {label:'كلمة المرور *', key:'password', type:'password', ph:'6 أحرف على الأقل', icon:'🔒'},
                {label:'اسم الشركة *', key:'name', type:'text', ph:'شركة الرافدين للإنترنت', icon:'🏢'},
                {label:'رقم الهاتف', key:'phone', type:'tel', ph:'07XXXXXXXXX', icon:'📞'},
              ].map(f => (
                <div key={f.key} style={{marginBottom:14}}>
                  <label style={{fontSize:13,fontWeight:700,color:'var(--ink2)',display:'block',marginBottom:6}}>{f.label}</label>
                  <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--bg2)',borderRadius:10,padding:'0 12px',border:'1px solid var(--bdr)'}}>
                    <span>{f.icon}</span>
                    <input type={f.type} placeholder={f.ph} value={createForm[f.key]}
                      onChange={e => setCreateForm({...createForm,[f.key]:e.target.value})}
                      style={{flex:1,padding:'12px 0',border:'none',background:'transparent',
                        color:'var(--ink)',fontFamily:'Tajawal,sans-serif',fontSize:14,outline:'none'}}/>
                  </div>
                </div>
              ))}

              <div style={{marginBottom:18}}>
                <label style={{fontSize:13,fontWeight:700,color:'var(--ink2)',display:'block',marginBottom:6}}>الباقة الابتدائية</label>
                <select value={createForm.plan} onChange={e => setCreateForm({...createForm,plan:e.target.value})}
                  style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--bdr)',
                    background:'var(--bg2)',color:'var(--ink)',fontFamily:'Tajawal,sans-serif',fontSize:13,fontWeight:700}}>
                  {Object.entries(PLAN_NAMES).map(([k,v]) => (
                    <option key={k} value={k}>{v} — ${PLAN_PRICES[k]}/شهر</option>
                  ))}
                </select>
              </div>

              <button onClick={createCompany} disabled={createSaving}
                style={{width:'100%',padding:14,borderRadius:12,border:'none',
                  background:'linear-gradient(135deg,#1a3fdb,#6144f5)',
                  color:'#fff',fontWeight:800,fontSize:15,cursor:'pointer'}}>
                {createSaving ? '⏳ جاري الإنشاء...' : '✅ إنشاء الحساب'}
              </button>
            </div>
          )}

        </>)}
      </div>

      {/* ════ Edit Company Modal ════ */}
      {editCo && (
        <div style={{position:'fixed',inset:0,zIndex:600,background:'rgba(4,8,22,.72)',backdropFilter:'blur(10px)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}
          onClick={e => { if(e.target===e.currentTarget) setEditCo(null) }}>
          <div style={{width:'100%',maxWidth:560,background:'var(--sur)',borderRadius:'26px 26px 0 0',
            padding:'10px 20px 36px',borderTop:'1px solid var(--bdr)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{width:38,height:4,background:'var(--bdr)',borderRadius:4,margin:'8px auto 18px'}}/>
            <div style={{fontSize:17,fontWeight:800,color:'var(--ink)',marginBottom:20,display:'flex',alignItems:'center',gap:10}}>
              ✏️ تعديل: {editCo.name}
              <button onClick={() => setEditCo(null)}
                style={{marginRight:'auto',width:32,height:32,borderRadius:'50%',
                  background:'var(--bg2)',border:'none',cursor:'pointer',color:'var(--ink3)',fontSize:15}}>✕</button>
            </div>

            {[
              {label:'اسم الشركة *', key:'name', type:'text', icon:'🏢'},
              {label:'رقم الهاتف', key:'phone', type:'tel', icon:'📞'},
              {label:'تاريخ انتهاء الاشتراك', key:'trial_end', type:'date', icon:'📅'},
            ].map(f => (
              <div key={f.key} style={{marginBottom:14}}>
                <label style={{fontSize:13,fontWeight:700,color:'var(--ink2)',display:'block',marginBottom:6}}>{f.label}</label>
                <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--bg2)',borderRadius:10,padding:'0 12px',border:'1px solid var(--bdr)'}}>
                  <span>{f.icon}</span>
                  <input type={f.type} value={editForm[f.key]||''}
                    onChange={e => setEditForm({...editForm,[f.key]:e.target.value})}
                    style={{flex:1,padding:'12px 0',border:'none',background:'transparent',
                      color:'var(--ink)',fontFamily:'Tajawal,sans-serif',fontSize:14,outline:'none'}}/>
                </div>
              </div>
            ))}

            <div style={{marginBottom:14}}>
              <label style={{fontSize:13,fontWeight:700,color:'var(--ink2)',display:'block',marginBottom:6}}>الباقة</label>
              <select value={editForm.plan} onChange={e => setEditForm({...editForm,plan:e.target.value})}
                style={{width:'100%',padding:'12px',borderRadius:10,border:'1px solid var(--bdr)',
                  background:'var(--bg2)',color:'var(--ink)',fontFamily:'Tajawal,sans-serif',fontSize:13,fontWeight:700}}>
                {Object.entries(PLAN_NAMES).map(([k,v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div style={{marginBottom:18,display:'flex',alignItems:'center',justifyContent:'space-between',
              background:'var(--bg2)',borderRadius:10,padding:'12px 14px',border:'1px solid var(--bdr)'}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--ink2)'}}>الحساب نشط</span>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input type="checkbox" checked={editForm.is_active}
                  onChange={e => setEditForm({...editForm,is_active:e.target.checked})}
                  style={{width:18,height:18,cursor:'pointer'}}/>
                <span style={{fontSize:13,fontWeight:700,color:editForm.is_active?'#059669':'#e11d48'}}>
                  {editForm.is_active?'نشط':'موقف'}
                </span>
              </label>
            </div>

            <button onClick={saveEdit} disabled={editSaving}
              style={{width:'100%',padding:14,borderRadius:12,border:'none',
                background:'linear-gradient(135deg,#1a3fdb,#6144f5)',
                color:'#fff',fontWeight:800,fontSize:15,cursor:'pointer',marginBottom:10}}>
              {editSaving ? '⏳ جاري الحفظ...' : '💾 حفظ التعديلات'}
            </button>
            <button onClick={() => setEditCo(null)}
              style={{width:'100%',padding:12,borderRadius:12,border:'1px solid var(--bdr)',
                background:'transparent',color:'var(--ink3)',fontWeight:700,fontSize:14,cursor:'pointer'}}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ════ Delete Confirm Modal ════ */}
      {delCo && (
        <div style={{position:'fixed',inset:0,zIndex:700,background:'rgba(4,8,22,.8)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e => { if(e.target===e.currentTarget) setDelCo(null) }}>
          <div style={{background:'var(--sur)',borderRadius:20,padding:28,maxWidth:380,width:'100%',border:'1px solid rgba(225,29,72,.3)'}}>
            <div style={{fontSize:40,textAlign:'center',marginBottom:12}}>⚠️</div>
            <div style={{fontSize:16,fontWeight:800,color:'var(--ink)',textAlign:'center',marginBottom:8}}>
              تأكيد الحذف
            </div>
            <div style={{fontSize:13,color:'var(--ink3)',textAlign:'center',marginBottom:20,lineHeight:1.7}}>
              هل أنت متأكد من إيقاف حساب <strong style={{color:'var(--ink)'}}>{delCo.name}</strong>؟<br/>
              سيتم تعطيل وصولهم للمنصة.
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <button onClick={() => setDelCo(null)}
                style={{padding:12,borderRadius:10,border:'1px solid var(--bdr)',background:'transparent',color:'var(--ink3)',fontWeight:700,cursor:'pointer'}}>
                إلغاء
              </button>
              <button onClick={deleteCo}
                style={{padding:12,borderRadius:10,border:'none',background:'linear-gradient(135deg,#7f1d1d,#dc2626)',color:'#fff',fontWeight:800,cursor:'pointer'}}>
                🗑 تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
