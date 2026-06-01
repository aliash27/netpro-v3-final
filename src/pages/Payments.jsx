import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const MO = ['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران',
            'تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول']

function moLabel(ym) {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return `${MO[parseInt(m)-1]} ${y}`
}
function fmt(n) { return Number(n).toLocaleString('ar-IQ') + ' د.ع' }

const curMo = new Date().toISOString().slice(0, 7)

export default function Payments() {
  const { company } = useAuth()
  const [pays, setPays]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { if (company) load() }, [company])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('payments').select('*')
      .eq('company_id', company.id)
      .order('paid_at', { ascending: false })
    setPays(data || [])
    setLoading(false)
  }

  // Get unique months for filter dropdown
  const months = [...new Set(pays.map(p => p.month))].sort().reverse()

  const list = pays.filter(p => {
    const matchSearch = !search || 
      p.subscriber_name.includes(search) ||
      moLabel(p.month).includes(search)
    const matchMonth = !filterMonth || p.month === filterMonth
    return matchSearch && matchMonth
  })

  const totalFiltered = list.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="page">
      <div className="page-title">📋 سجل الدفعات</div>

      {/* Search */}
      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input className="search-input"
          placeholder="بحث باسم أو شهر..."
          value={search}
          onChange={e => setSearch(e.target.value)} />
        {search && (
          <button className="search-clear"
            onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Filter row */}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <select
          style={{flex:1,minWidth:150,padding:'8px 12px',borderRadius:10,
            border:'1px solid var(--bdr)',background:'var(--sur)',
            color:'var(--ink)',fontSize:13}}
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}>
          <option value="">📅 كل الأشهر</option>
          {months.map(m => (
            <option key={m} value={m}>{moLabel(m)}</option>
          ))}
        </select>
        {filterMonth && (
          <button
            style={{padding:'8px 14px',borderRadius:10,
              border:'1px solid var(--bdr)',background:'var(--bg2)',
              color:'var(--ink3)',fontSize:12,cursor:'pointer'}}
            onClick={() => setFilterMonth('')}>
            ✕ إلغاء الفلتر
          </button>
        )}
      </div>

      {/* Summary */}
      {(filterMonth || search) && list.length > 0 && (
        <div style={{background:'rgba(26,63,219,.06)',border:'1px solid rgba(26,63,219,.15)',
          borderRadius:12,padding:'12px 16px',marginBottom:12,
          display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:13,color:'var(--ink2)'}}>
            {filterMonth ? `💡 ${moLabel(filterMonth)}` : '🔍 نتائج البحث'}
          </div>
          <div style={{fontSize:15,fontWeight:900,
            background:'var(--gP)',WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent'}}>
            {fmt(totalFiltered)}
          </div>
        </div>
      )}

      <div className="sec-header">
        <div className="sec-title">الدفعات المسجلة</div>
        <div className="sec-count">{list.length}</div>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:40,fontSize:24}}>⏳</div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-art">📋</div>
          <div className="empty-title">لا يوجد دفعات</div>
          <div className="empty-sub">
            {search || filterMonth ? 'لا توجد نتائج لهذا الفلتر' : 'ابدأ بتسجيل أول دفعة من صفحة المشتركين'}
          </div>
        </div>
      ) : list.map(p => (
        <div key={p.id} className="card" style={{marginBottom:9}}>
          <div className="card-body" style={{padding:'13px 15px'}}>
            <div style={{display:'flex',justifyContent:'space-between',
              alignItems:'flex-start'}}>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:'var(--ink)'}}>
                  {p.subscriber_name}
                </div>
                <div style={{fontSize:12,color:'var(--ink3)',marginTop:2}}>
                  {moLabel(p.month)} • {p.paid_at}
                </div>
                <div style={{fontSize:11,color:'var(--ink3)',marginTop:1}}>
                  بواسطة: {p.recorded_by || '—'}
                </div>
              </div>
              <div style={{textAlign:'left'}}>
                <div style={{fontSize:17,fontWeight:900,
                  background:'var(--gT)',WebkitBackgroundClip:'text',
                  WebkitTextFillColor:'transparent'}}>
                  {fmt(p.amount)}
                </div>
                <span className="badge badge-ok" style={{marginTop:5}}>
                  ✅ مسجل
                </span>
              </div>
            </div>
            {p.notes && (
              <div style={{marginTop:8,fontSize:12,color:'var(--ink3)',
                background:'var(--bg2)',borderRadius:8,padding:'6px 10px'}}>
                📝 {p.notes}
              </div>
            )}
          </div>
        </div>
      ))}

      <style>{`
        .sec-count { font-size:11px;font-weight:700;color:var(--ink3);
          background:var(--bg2);border:1px solid var(--bdr);
          padding:3px 10px;border-radius:20px; }
      `}</style>
    </div>
  )
}
