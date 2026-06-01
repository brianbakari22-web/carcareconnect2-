import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const ROLES = ["customer_service","inspector","accountant","manager","field_driver","mechanic","other"]
const DEPARTMENTS = ["operations","finance","support","field","management"]
const EMPTY = { first_name:"", last_name:"", email:"", phone:"", national_id:"", role:"customer_service", department:"support", salary_type:"fixed", base_salary:"", commission_rate:"", commission_base:"platform_revenue", bank_name:"", bank_account:"", mpesa_number:"", start_date:new Date().toISOString().split("T")[0], notes:"" }

export default function AdminEmployees() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [employees, setEmployees] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("employees")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [payForm, setPayForm] = useState({ period_start:"", period_end:"", bonuses:"0", deductions:"0", payment_method:"mpesa", notes:"" })
  const [paying, setPaying] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: emps }, { data: pays }] = await Promise.all([
      supabase.from("employees").select("*").order("created_at", { ascending:false }),
      supabase.from("employee_payments").select("*, employees(first_name,last_name,role)").order("created_at", { ascending:false })
    ])
    setEmployees(emps||[])
    setPayments(pays||[])
    setLoading(false)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, base_salary:Number(form.base_salary)||0, commission_rate:Number(form.commission_rate)||0, created_by:user.id }
      if (editing) {
        await supabase.from("employees").update(payload).eq("id", editing)
        toast.success("Employee updated")
      } else {
        await supabase.from("employees").insert(payload)
        toast.success("Employee added")
      }
      setShowForm(false); setEditing(null); setForm(EMPTY); load()
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function toggleActive(emp) {
    await supabase.from("employees").update({ is_active:!emp.is_active }).eq("id", emp.id)
    toast.success(emp.is_active?"Employee deactivated":"Employee reactivated")
    load()
  }

  async function processPayment(emp) {
    if (!payForm.period_start || !payForm.period_end) return toast.error("Please select payment period")
    setPaying(true)
    try {
      let commission = 0
      if (emp.salary_type !== "fixed" && emp.commission_rate > 0) {
        if (emp.commission_base === "platform_revenue") {
          const { data: bookings } = await supabase.from("bookings")
            .select("platform_commission")
            .eq("status","completed")
            .gte("created_at", payForm.period_start)
            .lte("created_at", payForm.period_end)
          commission = (bookings||[]).reduce((sum,b)=>sum+Number(b.platform_commission||0),0) * (emp.commission_rate/100)
        } else if (emp.commission_base === "inspections") {
          const { count } = await supabase.from("inspection_requests")
            .select("id",{count:"exact"})
            .eq("status","completed")
            .gte("created_at", payForm.period_start)
            .lte("created_at", payForm.period_end)
          commission = (count||0) * (emp.commission_rate)
        }
      }
      await supabase.from("employee_payments").insert({
        employee_id: emp.id,
        payment_period_start: payForm.period_start,
        payment_period_end: payForm.period_end,
        base_salary: emp.salary_type==="commission"?0:emp.base_salary,
        commission_amount: commission,
        bonuses: Number(payForm.bonuses)||0,
        deductions: Number(payForm.deductions)||0,
        payment_method: payForm.payment_method,
        payment_status: "pending",
        notes: payForm.notes,
        approved_by: user.id
      })
      toast.success("Payment processed — pending approval")
      setSelected(null)
      setPayForm({ period_start:"", period_end:"", bonuses:"0", deductions:"0", payment_method:"mpesa", notes:"" })
      load()
    } catch(e) { toast.error(e.message) }
    finally { setPaying(false) }
  }

  async function markPaid(payId) {
    await supabase.from("employee_payments").update({ payment_status:"paid", payment_date:new Date().toISOString() }).eq("id", payId)
    toast.success("Payment marked as paid")
    load()
  }

  const active = employees.filter(e=>e.is_active)
  const totalPayroll = active.reduce((sum,e)=>sum+Number(e.base_salary||0),0)
  const pendingPays = payments.filter(p=>p.payment_status==="pending")

  const inp = { width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:12, outline:"none", fontFamily:"DM Sans,sans-serif", marginBottom:10 }
  const lbl = { fontSize:11, color:"#666", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#f0ede6" }}>Employee Management</div>
          <div style={{ fontSize:12, color:"#555" }}>Manage staff, salaries and payroll</div>
        </div>
        <button onClick={()=>{ setShowForm(true); setEditing(null); setForm(EMPTY) }}
          style={{ background:"#8b5cf6", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 18px", cursor:"pointer" }}>
          + Add employee
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total staff", value:employees.length, color:"#f0ede6" },
          { label:"Active", value:active.length, color:"#1d9e75" },
          { label:"Monthly payroll", value:"KES "+totalPayroll.toLocaleString(), color:"#e6821e" },
          { label:"Pending payments", value:pendingPays.length, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"0.75rem", border:"1px solid #1e1e1e", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?14:18, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[{k:"employees",l:"Employees"},{k:"payroll",l:"Payroll"},{k:"payments",l:"Payment history"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"DM Sans,sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {showForm&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#f0ede6", marginBottom:"1rem" }}>{editing?"Edit employee":"Add new employee"}</div>
          <form onSubmit={save}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>First name</label><input style={inp} value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} required/></div>
              <div><label style={lbl}>Last name</label><input style={inp} value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} required/></div>
              <div><label style={lbl}>Email</label><input type="email" style={inp} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required/></div>
              <div><label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
              <div><label style={lbl}>National ID</label><input style={inp} value={form.national_id} onChange={e=>setForm(f=>({...f,national_id:e.target.value}))}/></div>
              <div><label style={lbl}>Start date</label><input type="date" style={inp} value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/></div>
              <div>
                <label style={lbl}>Role</label>
                <select style={inp} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {ROLES.map(r=><option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Department</label>
                <select style={inp} value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))}>
                  {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Salary type</label>
                <select style={inp} value={form.salary_type} onChange={e=>setForm(f=>({...f,salary_type:e.target.value}))}>
                  <option value="fixed">Fixed salary</option>
                  <option value="commission">Commission only</option>
                  <option value="mixed">Fixed + Commission</option>
                </select>
              </div>
              {form.salary_type!=="commission"&&<div><label style={lbl}>Base salary (KES/month)</label><input type="number" style={inp} value={form.base_salary} onChange={e=>setForm(f=>({...f,base_salary:e.target.value}))}/></div>}
              {form.salary_type!=="fixed"&&(
                <>
                  <div><label style={lbl}>Commission rate (%)</label><input type="number" style={inp} value={form.commission_rate} onChange={e=>setForm(f=>({...f,commission_rate:e.target.value}))}/></div>
                  <div>
                    <label style={lbl}>Commission based on</label>
                    <select style={inp} value={form.commission_base} onChange={e=>setForm(f=>({...f,commission_base:e.target.value}))}>
                      <option value="platform_revenue">Platform revenue</option>
                      <option value="inspections">Inspections done (KES per inspection)</option>
                      <option value="bookings">Bookings completed</option>
                    </select>
                  </div>
                </>
              )}
              <div><label style={lbl}>M-Pesa number</label><input style={inp} value={form.mpesa_number} onChange={e=>setForm(f=>({...f,mpesa_number:e.target.value}))}/></div>
              <div><label style={lbl}>Bank name</label><input style={inp} value={form.bank_name} onChange={e=>setForm(f=>({...f,bank_name:e.target.value}))}/></div>
              <div><label style={lbl}>Bank account</label><input style={inp} value={form.bank_account} onChange={e=>setForm(f=>({...f,bank_account:e.target.value}))}/></div>
            </div>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, resize:"vertical", minHeight:60 }} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <button type="submit" disabled={saving} style={{ background:saving?"#333":"#8b5cf6", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:saving?"not-allowed":"pointer" }}>
                {saving?"Saving...":editing?"Update":"Add employee"}
              </button>
              <button type="button" onClick={()=>{ setShowForm(false); setEditing(null); setForm(EMPTY) }} style={{ background:"none", border:"1px solid #333", borderRadius:9, color:"#666", fontSize:13, padding:"10px 18px", cursor:"pointer" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {tab==="employees"&&(
        <div>
          {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
          {!loading&&employees.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>No employees yet</div>}
          {employees.map(e=>(
            <div key={e.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem", marginBottom:10, opacity:e.is_active?1:0.6 }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:"#160a2e", border:"1px solid #8b5cf640", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#8b5cf6", flexShrink:0 }}>
                  {e.first_name[0]}{e.last_name[0]}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:4 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:"#f0ede6" }}>{e.first_name} {e.last_name}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:e.is_active?"#071a12":"#1a1a1a", color:e.is_active?"#1d9e75":"#555" }}>{e.is_active?"Active":"Inactive"}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{e.role.replace(/_/g," ")} · {e.department}</div>
                  <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{e.email}{e.phone?" · "+e.phone:""}</div>
                  <div style={{ fontSize:11, color:"#e6821e", marginTop:4 }}>
                    {e.salary_type==="fixed"?"KES "+Number(e.base_salary).toLocaleString()+"/month":
                     e.salary_type==="commission"?e.commission_rate+"% commission on "+e.commission_base.replace(/_/g," "):
                     "KES "+Number(e.base_salary).toLocaleString()+" + "+e.commission_rate+"% commission"}
                  </div>
                  {e.mpesa_number&&<div style={{ fontSize:10, color:"#555", marginTop:2 }}>M-Pesa: {e.mpesa_number}</div>}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:10 }}>
                <button onClick={()=>{ setSelected(e); setTab("payroll") }} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>💰 Process payment</button>
                <button onClick={()=>{ setEditing(e.id); setForm({...e, base_salary:e.base_salary||"", commission_rate:e.commission_rate||""}); setShowForm(true) }} style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>Edit</button>
                <button onClick={()=>toggleActive(e)} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>{e.is_active?"Deactivate":"Activate"}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="payroll"&&(
        <div>
          {selected?(
            <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#f0ede6" }}>Process payment — {selected.first_name} {selected.last_name}</div>
                <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:18 }}>×</button>
              </div>
              <div style={{ background:"#0f0f0f", borderRadius:8, padding:"0.75rem", marginBottom:"1rem" }}>
                <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Salary structure</div>
                <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>
                  {selected.salary_type==="fixed"?"Fixed: KES "+Number(selected.base_salary).toLocaleString()+"/month":
                   selected.salary_type==="commission"?selected.commission_rate+"% of "+selected.commission_base.replace(/_/g," "):
                   "KES "+Number(selected.base_salary).toLocaleString()+" + "+selected.commission_rate+"% of "+selected.commission_base.replace(/_/g," ")}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div><label style={lbl}>Period start</label><input type="date" style={inp} value={payForm.period_start} onChange={e=>setPayForm(f=>({...f,period_start:e.target.value}))}/></div>
                <div><label style={lbl}>Period end</label><input type="date" style={inp} value={payForm.period_end} onChange={e=>setPayForm(f=>({...f,period_end:e.target.value}))}/></div>
                <div><label style={lbl}>Bonuses (KES)</label><input type="number" style={inp} value={payForm.bonuses} onChange={e=>setPayForm(f=>({...f,bonuses:e.target.value}))}/></div>
                <div><label style={lbl}>Deductions (KES)</label><input type="number" style={inp} value={payForm.deductions} onChange={e=>setPayForm(f=>({...f,deductions:e.target.value}))}/></div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={lbl}>Payment method</label>
                <select style={inp} value={payForm.payment_method} onChange={e=>setPayForm(f=>({...f,payment_method:e.target.value}))}>
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank transfer</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={lbl}>Notes</label>
                <textarea style={{ ...inp, resize:"vertical", minHeight:50 }} value={payForm.notes} onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))}/>
              </div>
              <button onClick={()=>processPayment(selected)} disabled={paying} style={{ background:paying?"#333":"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:paying?"not-allowed":"pointer" }}>
                {paying?"Processing...":"Calculate & Process Payment"}
              </button>
            </div>
          ):(
            <div style={{ color:"#555", fontSize:13, textAlign:"center", padding:"2rem" }}>
              Select an employee from the Employees tab to process payment
            </div>
          )}
        </div>
      )}

      {tab==="payments"&&(
        <div>
          {payments.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"3rem" }}>No payment records yet</div>}
          {payments.map(p=>(
            <div key={p.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{p.employees?.first_name} {p.employees?.last_name}</div>
                  <div style={{ fontSize:11, color:"#555" }}>{p.employees?.role?.replace(/_/g," ")} · {p.payment_period_start} to {p.payment_period_end}</div>
                  <div style={{ fontSize:11, color:"#555", marginTop:2 }}>Via {p.payment_method}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(p.net_amount||0).toLocaleString()}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:p.payment_status==="paid"?"#071a12":"#1a1208", color:p.payment_status==="paid"?"#1d9e75":"#e6821e" }}>{p.payment_status}</span>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:8 }}>
                {[
                  { l:"Base", v:"KES "+Number(p.base_salary||0).toLocaleString() },
                  { l:"Commission", v:"KES "+Number(p.commission_amount||0).toLocaleString() },
                  { l:"Bonuses", v:"KES "+Number(p.bonuses||0).toLocaleString() },
                  { l:"Deductions", v:"KES "+Number(p.deductions||0).toLocaleString() },
                ].map(f=>(
                  <div key={f.l}>
                    <div style={{ fontSize:9, color:"#444", textTransform:"uppercase" }}>{f.l}</div>
                    <div style={{ fontSize:11, color:"#f0ede6" }}>{f.v}</div>
                  </div>
                ))}
              </div>
              {p.payment_status==="pending"&&(
                <button onClick={()=>markPaid(p.id)} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>
                  ✓ Mark as paid
                </button>
              )}
              {p.notes&&<div style={{ fontSize:11, color:"#555", marginTop:8, fontStyle:"italic" }}>{p.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
