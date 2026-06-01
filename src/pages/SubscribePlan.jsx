import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from '../components/Toast'

const PLANS = {
  starter:  { name: '⚡ البداية',    price: 5,  nameAr: 'البداية' },
  pro:      { name: '💎 الاحترافي',  price: 12, nameAr: 'الاحترافي' },
  business: { name: '🏢 الأعمال',   price: 25, nameAr: 'الأعمال' },
}

const ADMIN_PHONE = '+9647707505999'

export default function SubscribePlan() {
  const { plan }     = useParams()
  const navigate     = useNavigate()
  const { company }  = useAuth()
  const planInfo     = PLANS[plan]

  const [image, setImage]     = useState(null)
  const [preview, setPreview] = useState(null)
  const [notes, setNotes]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  if (!planInfo) {
    navigate('/pricing'); return null
  }

  function handleImage(e) {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  async function submit() {
    if (!image) { toast('يرجى رفع صورة إيصال الدفع', 'e'); return }
    setLoading(true)

    try {
      // رفع الصورة
      const ext  = image.name.split('.').pop()
      const path = `${company.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('payment-proofs')
        .upload(path, image)
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(path)

      // حفظ الطلب
      const { error: dbErr } = await supabase
        .from('subscription_requests')
        .insert({
          company_id:        company.id,
          plan_key:          plan,
          plan_name:         planInfo.nameAr,
          amount:            planInfo.price,
          payment_image_url: publicUrl,
          status:            'pending',
          admin_notes:       notes,
        })
      if (dbErr) throw dbErr

      setSent(true)
      toast('تم إرسال طلبك بنجاح ✅', 's')
    } catch (err) {
      toast('حدث خطأ: ' + err.message, 'e')
    } finally {
      setLoading(false)
    }
  }

  if (sent) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#eef1ff,#e6ecff)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{maxWidth:420,width:'100%',textAlign:'center'}}>
        <div style={{fontSize:70,marginBottom:16}}>🎉</div>
        <h2 style={{fontSize:24,fontWeight:900,marginBottom:10,
          background:'var(--gP)',WebkitBackgroundClip:'text',
          WebkitTextFillColor:'transparent'}}>
          تم استلام طلبك!
        </h2>
        <p style={{fontSize:14,color:'var(--ink3)',lineHeight:1.8,marginBottom:20}}>
          سيتم مراجعة طلبك والموافقة عليه خلال <strong>24 ساعة</strong> كحد أقصى.
          ستصلك رسالة تأكيد عند تفعيل الباقة.
        </p>
        <div style={{background:'var(--sur)',border:'1px solid var(--bdr)',
          borderRadius:16,padding:16,marginBottom:20}}>
          <div style={{fontSize:13,color:'var(--ink3)',marginBottom:8}}>
            📋 تفاصيل الطلب
          </div>
          <div style={{display:'flex',justifyContent:'space-between',
            padding:'8px 0',borderBottom:'1px solid var(--bdr)'}}>
            <span style={{fontSize:13,color:'var(--ink3)'}}>الباقة</span>
            <span style={{fontSize:13,fontWeight:800}}>{planInfo.name}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}>
            <span style={{fontSize:13,color:'var(--ink3)'}}>المبلغ</span>
            <span style={{fontSize:13,fontWeight:800}}>${planInfo.price}/شهر</span>
          </div>
        </div>
        <div style={{background:'linear-gradient(135deg,rgba(37,211,102,.1),rgba(7,94,64,.05))',
          border:'1px solid rgba(37,211,102,.2)',borderRadius:14,
          padding:14,marginBottom:20}}>
          <div style={{fontSize:12,color:'var(--ink3)',marginBottom:6}}>
            📞 للاستفسار أو في حالة التأخر أكثر من 24 ساعة
          </div>
          <a href={`tel:${ADMIN_PHONE}`}
            style={{fontSize:18,fontWeight:900,color:'#059669',
              textDecoration:'none',display:'block'}}>
            {ADMIN_PHONE}
          </a>
          <a href={`https://wa.me/${ADMIN_PHONE.replace(/\+/,'')}`}
            target="_blank" rel="noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:6,
              marginTop:8,background:'linear-gradient(135deg,#075e40,#25d366)',
              color:'#fff',padding:'8px 16px',borderRadius:20,
              fontSize:13,fontWeight:700,textDecoration:'none'}}>
            📱 تواصل عبر واتساب
          </a>
        </div>
        <button className="btn btn-primary"
          onClick={() => navigate('/')}>
          العودة للرئيسية
        </button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',
      background:'linear-gradient(145deg,#eef1ff,#e6ecff)',
      padding:'20px 16px'}}>
      <div style={{maxWidth:480,margin:'0 auto'}}>

        {/* Header */}
        <button onClick={() => navigate('/pricing')}
          style={{background:'none',border:'none',color:'var(--blue)',
            fontSize:14,fontWeight:700,cursor:'pointer',
            display:'flex',alignItems:'center',gap:6,
            marginBottom:20,padding:0}}>
          ← رجوع
        </button>

        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:8}}>💳</div>
          <h1 style={{fontSize:22,fontWeight:900,
            background:'var(--gP)',WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent'}}>
            الاشتراك في باقة {planInfo.nameAr}
          </h1>
          <p style={{fontSize:13,color:'var(--ink3)',marginTop:5}}>
            أرسل إيصال الدفع لتفعيل باقتك
          </p>
        </div>

        {/* Plan summary */}
        <div style={{background:'var(--sur)',border:'1px solid var(--bdr)',
          borderRadius:20,padding:20,marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',
            alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:18,fontWeight:900}}>{planInfo.name}</div>
            <div style={{fontSize:24,fontWeight:900,
              background:'var(--gP)',WebkitBackgroundClip:'text',
              WebkitTextFillColor:'transparent'}}>
              ${planInfo.price}
              <span style={{fontSize:13,color:'var(--ink3)',
                WebkitTextFillColor:'var(--ink3)'}}>
                /شهر
              </span>
            </div>
          </div>
          <div style={{background:'rgba(26,63,219,.06)',borderRadius:10,
            padding:12,fontSize:13,color:'var(--ink2)',lineHeight:1.7}}>
            <strong>خطوات الدفع:</strong><br/>
            1. حوّل المبلغ <strong>${planInfo.price}</strong> إلى حسابنا<br/>
            2. التقط صورة لإيصال التحويل<br/>
            3. ارفع الصورة أدناه وأرسل الطلب<br/>
            4. انتظر الموافقة خلال <strong>24 ساعة</strong>
          </div>
        </div>

        {/* Upload image */}
        <div style={{background:'var(--sur)',border:'1px solid var(--bdr)',
          borderRadius:20,padding:20,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:800,color:'var(--ink)',
            marginBottom:12}}>
            📷 صورة إيصال الدفع *
          </div>

          <label style={{display:'block',cursor:'pointer'}}>
            <input type="file" accept="image/*"
              style={{display:'none'}}
              onChange={handleImage}/>
            {preview ? (
              <div style={{position:'relative'}}>
                <img src={preview} alt="إيصال الدفع"
                  style={{width:'100%',borderRadius:12,
                    maxHeight:300,objectFit:'cover'}}/>
                <div style={{position:'absolute',top:8,left:8,
                  background:'rgba(0,0,0,.5)',color:'#fff',
                  borderRadius:8,padding:'4px 10px',fontSize:12}}>
                  اضغط لتغيير الصورة
                </div>
              </div>
            ) : (
              <div style={{border:'2px dashed var(--bdr)',borderRadius:12,
                padding:32,textAlign:'center',
                background:'var(--bg2)',transition:'.18s'}}>
                <div style={{fontSize:36,marginBottom:8}}>📤</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--ink2)'}}>
                  اضغط لرفع صورة الإيصال
                </div>
                <div style={{fontSize:12,color:'var(--ink3)',marginTop:4}}>
                  JPG, PNG, WEBP — حتى 5MB
                </div>
              </div>
            )}
          </label>
        </div>

        {/* Notes */}
        <div style={{background:'var(--sur)',border:'1px solid var(--bdr)',
          borderRadius:20,padding:20,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:800,color:'var(--ink)',
            marginBottom:12}}>
            📝 ملاحظات (اختياري)
          </div>
          <textarea className="field-input" rows={3}
            placeholder="أي ملاحظات إضافية..."
            value={notes}
            onChange={e => setNotes(e.target.value)}/>
        </div>

        {/* Contact info */}
        <div style={{background:'linear-gradient(135deg,rgba(37,211,102,.08),rgba(7,94,64,.04))',
          border:'1px solid rgba(37,211,102,.18)',borderRadius:14,
          padding:14,marginBottom:20,textAlign:'center'}}>
          <div style={{fontSize:12,color:'var(--ink3)',marginBottom:6}}>
            📞 للاستفسار — نرد خلال 24 ساعة
          </div>
          <a href={`tel:${ADMIN_PHONE}`}
            style={{fontSize:18,fontWeight:900,color:'#059669',
              textDecoration:'none',display:'block',marginBottom:8}}>
            {ADMIN_PHONE}
          </a>
          <a href={`https://wa.me/${ADMIN_PHONE.replace(/\+/,'')}`}
            target="_blank" rel="noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:6,
              background:'linear-gradient(135deg,#075e40,#25d366)',
              color:'#fff',padding:'8px 16px',borderRadius:20,
              fontSize:13,fontWeight:700,textDecoration:'none'}}>
            📱 واتساب
          </a>
        </div>

        {/* Submit */}
        <button className="btn btn-primary"
          onClick={submit} disabled={loading || !image}
          style={{marginBottom:8}}>
          {loading ? '⏳ جاري الإرسال...' : '📤 إرسال طلب الاشتراك'}
        </button>
        <button className="btn btn-ghost"
          onClick={() => navigate('/pricing')}>
          إلغاء
        </button>
      </div>
    </div>
  )
}
