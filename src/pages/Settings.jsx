import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from '../components/Toast'

export default function Settings() {
  const { user, company, refreshCompany, signOut } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '', phone: '', email: '', whatsapp_template: ''
  })
  const [pwForm, setPwForm] = useState({
    current: '', newPw: '', confirm: ''
  })
  const [dark, setDark]         = useState(false)
  const [saving, setSaving]     = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [subCount, setSubCount] = useState(0)

  useEffect(() => {
    setDark(document.documentElement.hasAttribute('data-dark'))
    if (company) {
      setForm({
        name: company.name || '',
        phone: company.phone || '',
        email: user?.email || '',
        whatsapp_template: company.whatsapp_template ||
          'عزيزي {name}، لديك {months} شهر متأخر بمبلغ {amount} د.ع. نرجو السداد. شكراً — {company}'
      })
      loadSubCount()
    }
  }, [company])

  async function loadSubCount() {
    const { count } = await supabase
      .from('subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .eq('is_active', true)
    setSubCount(count || 0)
  }

  async function saveCompany() {
    if (!company) return
    setSaving(true)
    const { error } = await supabase
      .from('companies')
      .update({
        name: form.name,
        phone: form.phone,
        whatsapp_template: form.whatsapp_template
      })
      .eq('id', company.id)
    if (error) { toast('خطأ في الحفظ', 'e'); setSaving(false); return }
    await refreshCompany()
    toast('تم حفظ الإعدادات ✅', 's')
    setSaving(false)
  }

  async function changePassword() {
    if (!pwForm.newPw) { toast('يرجى إدخال كلمة المرور الجديدة', 'e'); return }
    if (pwForm.newPw !== pwForm.confirm) {
      toast('كلمتا المرور غير متطابقتين', 'e'); return
    }
    if (pwForm.newPw.length < 6) {
      toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'e'); return
    }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    setSavingPw(false)
    if (error) { toast('خطأ: ' + error.message, 'e'); return }
    toast('تم تحديث كلمة المرور ✅', 's')
    setPwForm({ current: '', newPw: '', confirm: '' })
  }

  function toggleTheme() {
    const newDark = !dark
    setDark(newDark)
    if (newDark) {
      document.documentElement.setAttribute('data-dark', '')
      localStorage.setItem('np_theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-dark')
      localStorage.setItem('np_theme', 'light')
    }
  }

  const planNames = {
    trial: '⭐ تجريبي', starter: '⚡ البداية',
    pro: '💎 الاحترافي', business: '🏢 الأعمال'
  }

  return (
    <div className="page">
      <div className="page-title">⚙️ الإعدادات</div>

      {/* Company info */}
      <div className="settings-card">
        <div className="settings-header">
          <div className="settings-icon"
            style={{background:'rgba(26,63,219,.08)'}}>🏢</div>
          <div className="settings-title">بيانات الشركة</div>
        </div>
        <div className="settings-body">
          {[
            { label:'اسم الشركة', key:'name', type:'text', ph:'اسم الشركة', icon:'🏢' },
            { label:'رقم الهاتف', key:'phone', type:'tel', ph:'07XXXXXXXXX', icon:'📞' },
            { label:'البريد الإلكتروني', key:'email', type:'email', ph:'', icon:'📧', disabled:true },
          ].map(f => (
            <div className="field" key={f.key}>
              <label className="field-label">{f.label}</label>
              <div className="field-wrap">
                <span className="field-icon">{f.icon}</span>
                <input className="field-input" type={f.type}
                  placeholder={f.ph} value={form[f.key]}
                  disabled={f.disabled}
                  onChange={e => setForm({...form,[f.key]:e.target.value})}
                  style={f.disabled ? {opacity:.6} : {}}/>
              </div>
            </div>
          ))}
          <button className="btn btn-primary"
            onClick={saveCompany} disabled={saving}>
            {saving ? '⏳ جاري الحفظ...' : '💾 حفظ البيانات'}
          </button>
        </div>
      </div>

      {/* WhatsApp template */}
      <div className="settings-card">
        <div className="settings-header">
          <div className="settings-icon"
            style={{background:'rgba(37,211,102,.08)'}}>📱</div>
          <div className="settings-title">قالب رسالة واتساب</div>
        </div>
        <div className="settings-body">
          <div style={{fontSize:11,color:'var(--ink3)',
            background:'var(--bg2)',borderRadius:7,
            padding:'8px 11px',marginBottom:10,fontFamily:'monospace'}}>
            المتغيرات: &#123;name&#125; &#123;months&#125; &#123;amount&#125; &#123;company&#125;
          </div>
          <textarea className="field-input" rows={5}
            value={form.whatsapp_template}
            onChange={e => setForm({...form,whatsapp_template:e.target.value})}/>
          <button className="btn btn-whatsapp" style={{marginTop:10}}
            onClick={saveCompany} disabled={saving}>
            💾 حفظ القالب
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="settings-card">
        <div className="settings-header">
          <div className="settings-icon"
            style={{background:'rgba(124,58,237,.08)'}}>🔐</div>
          <div className="settings-title">تغيير كلمة المرور</div>
        </div>
        <div className="settings-body">
          {[
            { label:'كلمة المرور الجديدة', key:'newPw', ph:'6 أحرف على الأقل' },
            { label:'تأكيد كلمة المرور', key:'confirm', ph:'أعد كتابة كلمة المرور' },
          ].map(f => (
            <div className="field" key={f.key}>
              <div className="field-wrap">
                <span className="field-icon">🔒</span>
                <input className="field-input" type="password"
                  placeholder={f.ph} value={pwForm[f.key]}
                  onChange={e => setPwForm({...pwForm,[f.key]:e.target.value})}/>
              </div>
            </div>
          ))}
          <button className="btn btn-ghost"
            onClick={changePassword} disabled={savingPw}>
            {savingPw ? '⏳ جاري التحديث...' : 'تحديث كلمة المرور'}
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="settings-card">
        <div className="settings-header">
          <div className="settings-icon"
            style={{background:'rgba(212,160,23,.08)'}}>🎨</div>
          <div className="settings-title">المظهر</div>
        </div>
        <div className="settings-body">
          <div className="toggle-row">
            <span className="toggle-label">الوضع الليلي</span>
            <label className="toggle">
              <input type="checkbox" checked={dark}
                onChange={toggleTheme}/>
              <span className="toggle-track"/>
              <span className="toggle-thumb"/>
            </label>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="settings-card">
        <div className="settings-header">
          <div className="settings-icon"
            style={{background:'var(--bg2)'}}>ℹ️</div>
          <div className="settings-title">حول المنصة</div>
        </div>
        <div className="settings-body">
          <div style={{display:'flex',flexDirection:'column'}}>
            {[
              ['الإصدار', 'v1.0.0'],
              ['خطتك الحالية', planNames[company?.plan] || '⭐ تجريبي'],
              ['عدد المشتركين', subCount],
              ['البريد الإلكتروني', user?.email || '—'],
            ].map(([label, value], i, arr) => (
              <div key={label} style={{
                display:'flex',justifyContent:'space-between',
                padding:'9px 0',
                borderBottom: i < arr.length-1
                  ? '1px solid var(--bdr)' : 'none'}}>
                <span style={{fontSize:13,color:'var(--ink3)'}}>{label}</span>
                <span style={{fontSize:13,fontWeight:800}}>{value}</span>
              </div>
            ))}
          </div>

          <button className="btn btn-whatsapp" style={{marginTop:14}}
            onClick={() => window.open('https://wa.me/9647707505999','_blank')}>
            📱 الدعم الفني
          </button>
          <button className="btn btn-gold" style={{marginTop:9}}
            onClick={() => navigate('/pricing')}>
            💎 ترقية الخطة
          </button>
          <button className="btn btn-ghost" style={{marginTop:9,color:'var(--rose)'}}
            onClick={async () => { await signOut(); navigate('/login') }}>
            🚪 تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  )
}
