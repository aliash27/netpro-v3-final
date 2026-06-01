/**
 * NotificationEngine — يعمل تلقائياً في الخلفية
 * يتحقق يومياً عند فتح التطبيق من:
 * 1. اشتراكات على وشك الانتهاء (7 أيام أو أقل)
 * 2. متأخرون جدد لم يُرسل لهم إشعار اليوم
 */
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { toast } from './Toast'

const MO = ['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران',
            'تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول']

function calcDebt(sub, paidMonths = []) {
  if (!sub?.start_date) return []
  const now    = new Date()
  const startD = new Date(sub.start_date)
  const paidSet = new Set(paidMonths)
  const months  = []
  let y = startD.getFullYear(), m = startD.getMonth() + 1
  while (new Date(y, m - 1) <= now) {
    const key = `${y}-${String(m).padStart(2,'0')}`
    if (!paidSet.has(key)) months.push(key)
    m++; if (m > 12) { m = 1; y++ }
  }
  return months
}

export default function NotificationEngine() {
  const { company, user, trialDaysLeft, isTrialActive } = useAuth()

  useEffect(() => {
    if (!company) return
    const lastCheck = sessionStorage.getItem('np_notif_check')
    const today     = new Date().toISOString().split('T')[0]
    if (lastCheck === today) return // run once per session
    sessionStorage.setItem('np_notif_check', today)
    runChecks()
  }, [company])

  async function runChecks() {
    if (!company) return
    await checkDebtors()
    checkPlanExpiry()
    checkTrialExpiry()
  }

  async function checkDebtors() {
    const { data: subs } = await supabase
      .from('subscribers').select('*')
      .eq('company_id', company.id).eq('is_active', true)
    const { data: pays } = await supabase
      .from('payments').select('subscriber_id, month')
      .eq('company_id', company.id)

    const pm = {}
    for (const p of (pays||[])) {
      if (!pm[p.subscriber_id]) pm[p.subscriber_id] = []
      pm[p.subscriber_id].push(p.month)
    }

    const late    = (subs||[]).filter(s => calcDebt(s, pm[s.id]||[]).length > 0)
    const newLate = late.filter(s => calcDebt(s, pm[s.id]||[]).length >= 2) // 2+ months late
    const urgentLate = late.filter(s => calcDebt(s, pm[s.id]||[]).length >= 3) // 3+ months

    if (urgentLate.length > 0) {
      setTimeout(() => toast(
        `🚨 ${urgentLate.length} مشترك متأخر 3 أشهر أو أكثر — بحاجة لمتابعة عاجلة`,
        'e', 7000
      ), 2500)
    } else if (late.length > 0) {
      setTimeout(() => toast(
        `⚠️ ${late.length} مشترك متأخر عن الدفع هذا الشهر`,
        'w', 5000
      ), 2500)
    }
  }

  function checkPlanExpiry() {
    if (!company?.trial_end || company?.plan === 'trial') return
    const end   = new Date(company.trial_end)
    const now   = new Date()
    const days  = Math.ceil((end - now) / 86400000)
    if (days > 0 && days <= 7) {
      setTimeout(() => toast(
        `⏳ اشتراكك ينتهي خلال ${days} أيام — جدد الآن لتجنب الانقطاع`,
        'w', 8000
      ), 4000)
    } else if (days <= 0) {
      setTimeout(() => toast(
        `🔴 انتهى اشتراكك — تواصل: wa.me/9647707505999`,
        'e', 0
      ), 4000)
    }
  }

  function checkTrialExpiry() {
    if (!isTrialActive) return
    if (trialDaysLeft <= 3 && trialDaysLeft > 0) {
      setTimeout(() => toast(
        `⏰ متبقي ${trialDaysLeft} أيام فقط من التجربة المجانية`,
        'w', 6000
      ), 3000)
    }
  }

  return null // no UI
}
