import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function DriverEarnings() {
  const { user, profile, updateProfile } = useAuth()
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("week")
  const [expanded, setExpanded] = useState(null)
  const [goalInput, setGoalInput] = useState("")
  const [editingGoal, setEditingGoal] = useState(false)
  const [savingGoal, setSavingGoal] = useState(false)
  const [expenses, setExpenses] = useState([])
  const [expenseForm, setExpenseForm] = useState({ amount:"", expense_date:new Date().toISOString().split("T")[0], odometer:"", notes:"" })
  const [savingExpense, setSavingExpense] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data }, { data: exps }] = await Promise.all([
      supabase.from("bookings")
        .select("*, vehicles(make,model,license_plate)")
        .eq("driver_id", user.id)
        .eq("status", "completed").eq("is_archived", false).order("created_at", { ascending:false }),
      supabase.from("driver_expenses").select("*").eq("driver_id", user.id).order("expense_date",{ascending:false})
    ])
    setBookings(data||[])
    setExpenses(exps||[])
    setLoading(false)
  }
  async function saveExpense(e) {
    e.preventDefault()
    if (!expenseForm.amount || Number(expenseForm.amount)<=0) return toast.error("Enter a valid amount")
    setSavingExpense(true)
    try {
      const { error } = await supabase.from("driver_expenses").insert({
        driver_id: user.id,
        expense_type: "fuel",
        amount: Number(expenseForm.amount),
        expense_date: expenseForm.expense_date,
        odometer: expenseForm.odometer?Number(expenseForm.odometer):null,
        notes: expenseForm.notes,
      })
      if (error) throw error
      toast.success("Fuel expense logged!")
      setExpenseForm({ amount:"", expense_date:new Date().toISOString().split("T")[0], odometer:"", notes:"" })
      setShowExpenseForm(false)
      load()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSavingExpense(false)
    }
  }
  async function deleteExpense(id) {
    if (!confirm("Delete this expense?")) return
    await supabase.from("driver_expenses").delete().eq("id",id)
    toast.success("Expense deleted")
    load()
  }

  function filterByPeriod(bks) {
    const now = new Date()
    if (period==="today") {
      const today = now.toISOString().split("T")[0]
      return bks.filter(b=>b.booking_date===today)
    }
    if (period==="week") {
      const weekAgo = new Date(now-7*24*60*60*1000)
      return bks.filter(b=>new Date(b.booking_date)>=weekAgo)
    }
    if (period==="month") {
      const monthAgo = new Date(now-30*24*60*60*1000)
      return bks.filter(b=>new Date(b.booking_date)>=monthAgo)
    }
    return bks
  }

  const filtered = filterByPeriod(bookings)

  const totalCommission = filtered.reduce((s,b)=>s+Number(b.total_amount||0)*0.15, 0)
  const totalAllowance = filtered.reduce((s,b)=>s+Number(b.transport_allowance||200), 0)
  const totalEarnings = filtered.reduce((s,b)=>s+Number(b.driver_earnings||0), 0)
  const totalJobs = filtered.length
  const avgPerJob = totalJobs ? (totalEarnings/totalJobs).toFixed(0) : 0
  const unpaidCount = filtered.filter(b=>b.payment_status!=="paid").length

  // Monthly goal tracking (independent of period filter)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEarnings = bookings.filter(b=>new Date(b.booking_date)>=monthStart).reduce((s,b)=>s+Number(b.driver_earnings||0), 0)
  const monthlyGoal = Number(profile?.monthly_earnings_goal || 0)
  const monthFuelExpenses = expenses.filter(e=>new Date(e.expense_date)>=monthStart).reduce((s,e)=>s+Number(e.amount||0), 0)
  const netMonthEarnings = monthEarnings - monthFuelExpenses
  const totalFuelExpenses = expenses.reduce((s,e)=>s+Number(e.amount||0), 0)
  const goalProgress = monthlyGoal>0 ? Math.min(100, Math.round((monthEarnings/monthlyGoal)*100)) : 0

  async function saveGoal() {
    const val = Number(goalInput)
    if (!val || val<=0) return toast.error("Enter a valid goal amount")
    setSavingGoal(true)
    try {
      await updateProfile({ monthly_earnings_goal: val })
      toast.success("Goal updated!")
      setEditingGoal(false)
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSavingGoal(false)
    }
  }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#000000", marginBottom:"1.25rem" }}>Earnings & History</div>

      {/* Period filter */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {["today","week","month","all"].map(p=>(
          <button key={p} onClick={()=>setPeriod(p)}
            style={{ padding:"7px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:period===p?"#1d9e75":"#f0f0f0", color:period===p?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:period===p?700:400 }}>
            {p==="today"?"Today":p==="week"?"This week":p==="month"?"This month":"All time"}
          </button>
        ))}
      </div>

      {/* Earnings breakdown */}
      <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#1d9e75", marginBottom:"1rem" }}>💰 Earnings breakdown</div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10, marginBottom:12 }}>
          {[
            { label:"Commission (15%)", value:`KES ${totalCommission.toFixed(0)}`, color:"#378add" },
            { label:"Transport allowance", value:`KES ${totalAllowance.toFixed(0)}`, color:"#e6821e" },
            { label:"Total earned", value:`KES ${totalEarnings.toFixed(0)}`, color:"#1d9e75" },
            { label:"Avg per job", value:`KES ${Number(avgPerJob).toLocaleString()}`, color:"#8b5cf6" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", textAlign:"center" }}>
              <div style={{ fontFamily:"Syne", fontSize:isMobile?13:16, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:9, color:"#888888", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#777777" }}>
          <span>{totalJobs} job{totalJobs!==1?"s":""} completed</span>
          {unpaidCount>0&&<span style={{ color:"#e6821e" }}>⚠️ {unpaidCount} pending payment</span>}
        </div>
      </div>

      {/* Monthly goal tracker */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000000" }}>🎯 Monthly earnings goal</div>
          {!editingGoal&&<button onClick={()=>{ setEditingGoal(true); setGoalInput(monthlyGoal?String(monthlyGoal):"") }} style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#666", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>{monthlyGoal>0?"Edit":"Set goal"}</button>}
        </div>
        {editingGoal?(
          <div style={{ display:"flex", gap:8 }}>
            <input type="number" min="0" value={goalInput} onChange={e=>setGoalInput(e.target.value)} placeholder="e.g. 20000"
              style={{ flex:1, background:"#f8f8f8", border:"1px solid #f0f0f0", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none" }}/>
            <button onClick={saveGoal} disabled={savingGoal} style={{ background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"0 16px", cursor:"pointer" }}>
              {savingGoal?"...":"Save"}
            </button>
            <button onClick={()=>setEditingGoal(false)} style={{ background:"none", border:"1px solid #dddddd", borderRadius:8, color:"#666", fontSize:12, padding:"0 14px", cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        ):monthlyGoal>0?(
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#555555", marginBottom:6 }}>
              <span>KES {monthEarnings.toFixed(0)} earned this month</span>
              <span style={{ fontWeight:700, color:goalProgress>=100?"#1d9e75":"#e6821e" }}>{goalProgress}%</span>
            </div>
            <div style={{ height:8, background:"#f0f0f0", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", background:goalProgress>=100?"#1d9e75":"#e6821e", borderRadius:4, width:(goalProgress+"%"), transition:"width 0.5s" }}/>
            </div>
            <div style={{ fontSize:11, color:"#888888", marginTop:6 }}>
              {goalProgress>=100?"🎉 Goal reached! Great work.":"KES "+(monthlyGoal-monthEarnings).toFixed(0)+" to go — Goal: KES "+monthlyGoal.toLocaleString()}
            </div>
          </div>
        ):(
          <div style={{ fontSize:12, color:"#888888" }}>Set a monthly earnings goal to track your progress.</div>
        )}
      </div>
      {/* Fuel expense tracker */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000000" }}>⛽ Fuel expenses</div>
          <button onClick={()=>setShowExpenseForm(!showExpenseForm)} style={{ background:showExpenseForm?"none":"#e6821e", border:showExpenseForm?"1px solid #dddddd":"none", borderRadius:7, color:showExpenseForm?"#666":"#fff", fontSize:11, fontWeight:700, padding:"5px 12px", cursor:"pointer" }}>
            {showExpenseForm?"Cancel":"+ Log expense"}
          </button>
        </div>

        {showExpenseForm&&(
          <form onSubmit={saveExpense} style={{ background:"#f8f8f8", borderRadius:8, padding:"0.9rem", marginBottom:"1rem" }}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:8, marginBottom:8 }}>
              <div>
                <label style={{ fontSize:10, color:"#666", display:"block", marginBottom:4 }}>Amount (KES)</label>
                <input type="number" min="0" value={expenseForm.amount} onChange={e=>setExpenseForm(f=>({...f,amount:e.target.value}))} placeholder="500" required
                  style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 10px", color:"#000000", fontSize:12, outline:"none" }}/>
              </div>
              <div>
                <label style={{ fontSize:10, color:"#666", display:"block", marginBottom:4 }}>Date</label>
                <input type="date" value={expenseForm.expense_date} onChange={e=>setExpenseForm(f=>({...f,expense_date:e.target.value}))}
                  style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 10px", color:"#000000", fontSize:12, outline:"none" }}/>
              </div>
              <div>
                <label style={{ fontSize:10, color:"#666", display:"block", marginBottom:4 }}>Odometer (km, optional)</label>
                <input type="number" min="0" value={expenseForm.odometer} onChange={e=>setExpenseForm(f=>({...f,odometer:e.target.value}))} placeholder="45000"
                  style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 10px", color:"#000000", fontSize:12, outline:"none" }}/>
              </div>
              <div>
                <label style={{ fontSize:10, color:"#666", display:"block", marginBottom:4 }}>Notes (optional)</label>
                <input value={expenseForm.notes} onChange={e=>setExpenseForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Shell station"
                  style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 10px", color:"#000000", fontSize:12, outline:"none" }}/>
              </div>
            </div>
            <button type="submit" disabled={savingExpense} style={{ background:savingExpense?"#ccc":"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 18px", cursor:savingExpense?"not-allowed":"pointer" }}>
              {savingExpense?"Saving...":"Log fuel expense"}
            </button>
          </form>
        )}

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:10, marginBottom:expenses.length>0?"1rem":0 }}>
          <div style={{ background:"#fff5f5", borderRadius:8, padding:"0.75rem", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?13:16, fontWeight:800, color:"#e24b4a" }}>KES {monthFuelExpenses.toFixed(0)}</div>
            <div style={{ fontSize:9, color:"#888888", marginTop:2 }}>Fuel this month</div>
          </div>
          <div style={{ background:"#f0fdf4", borderRadius:8, padding:"0.75rem", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?13:16, fontWeight:800, color:netMonthEarnings>=0?"#1d9e75":"#e24b4a" }}>KES {netMonthEarnings.toFixed(0)}</div>
            <div style={{ fontSize:9, color:"#888888", marginTop:2 }}>Net this month (after fuel)</div>
          </div>
          <div style={{ background:"#f8f8f8", borderRadius:8, padding:"0.75rem", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?13:16, fontWeight:800, color:"#888" }}>KES {totalFuelExpenses.toFixed(0)}</div>
            <div style={{ fontSize:9, color:"#888888", marginTop:2 }}>Total fuel logged</div>
          </div>
        </div>

        {expenses.slice(0,5).map(exp=>(
          <div key={exp.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f0f0f0", fontSize:12 }}>
            <div>
              <span style={{ color:"#000000", fontWeight:600 }}>KES {Number(exp.amount).toFixed(0)}</span>
              <span style={{ color:"#888888", marginLeft:8 }}>{exp.expense_date}</span>
              {exp.odometer&&<span style={{ color:"#888888", marginLeft:8 }}>· {Number(exp.odometer).toLocaleString()} km</span>}
              {exp.notes&&<span style={{ color:"#888888", marginLeft:8 }}>· {exp.notes}</span>}
            </div>
            <button onClick={()=>deleteExpense(exp.id)} style={{ background:"none", border:"none", color:"#e24b4a", fontSize:11, cursor:"pointer" }}>Delete</button>
          </div>
        ))}
      </div>
      {/* How earnings work */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.9rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#000000", marginBottom:8 }}>How your earnings work</div>
        {[
          { icon:"💵", label:"Commission", desc:"15% of service fee — paid after delivery complete" },
          { icon:"🚌", label:"Transport allowance", desc:"KES 200 per job — covers your travel costs" },
          { icon:"🔒", label:"Payment security", desc:"Both are released only after you complete the delivery and file the dropoff report" },
          { icon:"⚠️", label:"No-show penalty", desc:"If you accept a job and don't show up, you lose both the commission and allowance" },
        ].map(item=>(
          <div key={item.label} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
            <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize:12, color:"#000000", fontWeight:600 }}>{item.label}</div>
              <div style={{ fontSize:11, color:"#777777", lineHeight:1.4 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* History list */}
      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>💰</div>
          No completed jobs for this period
        </div>
      )}

      {filtered.map(b=>{
        const commission = Number(b.driver_earnings||0) - Number(b.transport_allowance||200)
        const allowance = Number(b.transport_allowance||200)
        const total = Number(b.driver_earnings||0)
        return (
          <div key={b.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:2 }}>{b.service_name}</div>
                <div style={{ fontSize:11, color:"#777777", marginBottom:2 }}>#{b.booking_number} · {b.booking_date}</div>
                {b.vehicles&&<div style={{ fontSize:11, color:"#378add" }}>🚗 {b.vehicles.make} {b.vehicles.model} — {b.vehicles.license_plate}</div>}
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#1d9e75" }}>KES {total.toLocaleString()}</div>
                <div style={{ fontSize:10, color:b.payment_status==="paid"?"#1d9e75":"#e6821e", marginTop:2 }}>{b.payment_status}</div>
                <button onClick={()=>setExpanded(expanded===b.id?null:b.id)}
                  style={{ background:"none", border:"none", color:"#777777", fontSize:10, cursor:"pointer", marginTop:2, padding:0 }}>
                  {expanded===b.id?"hide":"details"}
                </button>
              </div>
            </div>

            {expanded===b.id&&(
              <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #eeeeee" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {[
                    { l:"Service fee", v:`KES ${Number(b.total_amount||0).toLocaleString()}` },
                    { l:"Commission (15%)", v:`KES ${commission.toFixed(0)}`, c:"#378add" },
                    { l:"Transport allowance", v:`KES ${allowance.toLocaleString()}`, c:"#e6821e" },
                  ].map(f=>(
                    <div key={f.l} style={{ background:"#ffffff", borderRadius:7, padding:"0.6rem", textAlign:"center" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:f.c||"#000000" }}>{f.v}</div>
                      <div style={{ fontSize:9, color:"#888888", marginTop:2 }}>{f.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#1d9e75", fontWeight:700, marginTop:8, paddingTop:8, borderTop:"1px solid #eeeeee" }}>
                  <span>Total paid to you</span>
                  <span>KES {total.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}



