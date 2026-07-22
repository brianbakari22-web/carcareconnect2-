import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import { generateInvoice } from "../../lib/invoice"

// Kenya statutory rates 2024/2025
const PAYE_BANDS = [
  { max: 24000, rate: 0.10 },
  { max: 32333, rate: 0.25 },
  { max: 500000, rate: 0.30 },
  { max: 800000, rate: 0.325 },
  { max: Infinity, rate: 0.35 },
]
const NSSF_EMPLOYEE = 2160
const NSSF_EMPLOYER = 2160
const SHIF_RATE = 0.0275
const SHIF_MIN = 300
const HOUSING_LEVY_RATE = 0.015

function calcPAYE(gross) {
  let tax = 0; let prev = 0
  for(const band of PAYE_BANDS) {
    const taxable = Math.min(gross, band.max) - prev
    if(taxable <= 0) break
    tax += taxable * band.rate
    prev = band.max
  }
  // Personal relief KES 2,400/month
  return Math.max(0, tax - 2400)
}

function calcStatutory(gross) {
  const paye = calcPAYE(gross)
  const nssf_emp = Math.min(NSSF_EMPLOYEE, gross * 0.06)
  const shif = Math.max(SHIF_MIN, gross * SHIF_RATE)
  const housing = gross * HOUSING_LEVY_RATE
  const total_deductions = paye + nssf_emp + shif + housing
  const net = gross + 0 - total_deductions // bonuses/deductions added later
  return { paye, nssf_employee: nssf_emp, nssf_employer: NSSF_EMPLOYER, shif, housing_levy: housing, total_deductions, net }
}

const ROLES = ["customer_service","inspector","accountant","manager","field_driver","mechanic","other"]
const DEPARTMENTS = ["operations","finance","support","field","management"]
const EMPLOYMENT_TYPES = ["full_time","part_time","contract","intern"]
const EMPTY = { 
  first_name:"", last_name:"", email:"", phone:"", national_id:"", 
  kra_pin:"", nssf_number:"", shif_number:"",
  role:"customer_service", department:"support", 
  employment_type:"full_time",
  salary_type:"fixed", base_salary:"", commission_rate:"", commission_base:"platform_revenue",
  bank_name:"", bank_account:"", mpesa_number:"",
  start_date:new Date().toISOString().split("T")[0],
  annual_leave_days:21, sick_leave_days:7,
  emergency_contact_name:"", emergency_contact_phone:"",
  notes:"",
  housing_levy: true
}

export default function AdminEmployees() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [employees, setEmployees] = useState([])
  const [payments, setPayments] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("employees")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [payForm, setPayForm] = useState({ period_start:"", period_end:"", bonuses:"0", deductions:"0", payment_method:"mpesa", notes:"" })
  const [paying, setPaying] = useState(false)
  const [payPreview, setPayPreview] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: emps }, { data: pays }, { data: leaves }] = await Promise.all([
      supabase.from("employees").select("*").order("created_at", { ascending:false }),
      supabase.from("employee_payments").select("*, employees(first_name,last_name,role)").order("created_at", { ascending:false }),
      supabase.from("employee_leave_requests").select("*, employees(first_name,last_name)").order("created_at", { ascending:false })
    ])
    setEmployees(emps||[])
    setPayments(pays||[])
    setLeaveRequests(leaves||[])
    setLoading(false)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { 
        ...form, 
        base_salary: Number(form.base_salary)||0,
        commission_rate: Number(form.commission_rate)||0,
        annual_leave_days: Number(form.annual_leave_days)||21,
        sick_leave_days: Number(form.sick_leave_days)||7,
        created_by: user.id 
      }
      if(editing) {
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

  function previewPayslip(emp) {
    const gross = Number(emp.base_salary||0) + (Number(payForm.bonuses)||0)
    const stat = calcStatutory(gross)
    const net = gross - stat.total_deductions - (Number(payForm.deductions)||0) + (Number(payForm.bonuses)||0)
    setPayPreview({ ...stat, gross, net, emp })
  }

  async function processPayment(emp) {
    if(!payForm.period_start || !payForm.period_end) return toast.error("Please select payment period")
    setPaying(true)
    try {
      const gross = Number(emp.base_salary||0)
      const stat = calcStatutory(gross)
      const bonuses = Number(payForm.bonuses)||0
      const deductions = Number(payForm.deductions)||0
      const net = gross - stat.total_deductions + bonuses - deductions

      await supabase.from("employee_payments").insert({
        employee_id: emp.id,
        payment_period_start: payForm.period_start,
        payment_period_end: payForm.period_end,
        gross_salary: gross,
        base_salary: emp.salary_type==="commission"?0:emp.base_salary,
        paye: stat.paye,
        nssf_employee: stat.nssf_employee,
        nssf_employer: stat.nssf_employer,
        shif: stat.shif,
        housing_levy: emp.housing_levy ? stat.housing_levy : 0,
        total_deductions: stat.total_deductions + deductions,
        commission_amount: 0,
        bonuses,
        deductions,
        net_amount: net,
        payment_method: payForm.payment_method,
        payment_status: "pending",
        notes: payForm.notes,
        approved_by: user.id
      })
      toast.success("Payroll processed — pending payment")
      setSelected(null); setPayPreview(null)
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

  async function approveLeave(id, approved) {
    await supabase.from("employee_leave_requests").update({ 
      status: approved?"approved":"rejected", 
      approved_by: user.id 
    }).eq("id", id)
    toast.success(approved?"Leave approved":"Leave rejected")
    load()
  }

  const active = employees.filter(e=>e.is_active)
  const totalPayroll = active.reduce((sum,e)=>sum+Number(e.base_salary||0),0)
  const totalNSSFEmployer = active.length * NSSF_EMPLOYER
  const pendingPays = payments.filter(p=>p.payment_status==="pending")
  const pendingLeaves = leaveRequests.filter(l=>l.status==="pending")

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #f0f0f0", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", fontFamily:"DM Sans,sans-serif", marginBottom:10, boxSizing:"border-box" }
  const lbl = { fontSize:11, color:"#888", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }
  const SC = { pending:"#e6821e", approved:"#1d9e75", rejected:"#e24b4a", paid:"#1d9e75" }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, marginBottom:4 }}>Employee Management</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.25rem" }}>Manage CCC internal staff with Kenya-compliant payroll</div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:"1.25rem" }}>
        {[
          { label:"Total staff", value:employees.length, color:"#000" },
          { label:"Active", value:active.length, color:"#1d9e75" },
          { label:"Monthly payroll", value:"KES "+totalPayroll.toLocaleString(), color:"#e6821e" },
          { label:"NSSF employer", value:"KES "+totalNSSFEmployer.toLocaleString(), color:"#378add" },
          { label:"Pending payment", value:pendingPays.length, color:"#e24b4a" },
          { label:"Pending leave", value:pendingLeaves.length, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Statutory notice */}
      <div style={{ background:"#eff6ff", border:"1px solid #378add30", borderRadius:10, padding:"0.75rem 1rem", marginBottom:"1.25rem", fontSize:12, color:"#378add" }}>
        📋 Kenya statutory rates: PAYE (10-35% graduated) · NSSF KES 2,160/employee · SHIF 2.75% of gross · Housing Levy 1.5% of gross. Due by 9th of each month.
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", overflowX:"auto", paddingBottom:4 }}>
        {[
          {k:"employees",l:"Staff ("+employees.length+")"},
          {k:"payroll",l:"Payroll ("+payments.length+")"},
          {k:"leave",l:"Leave ("+pendingLeaves.length+" pending)"},
          {k:"statutory",l:"Statutory Guide"},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontWeight:tab===t.k?700:400, whiteSpace:"nowrap" }}>{t.l}</button>
        ))}
        <button onClick={()=>{ setShowForm(true); setEditing(null); setForm(EMPTY) }} style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:"#1d9e75", color:"#fff", fontWeight:700, whiteSpace:"nowrap", marginLeft:"auto" }}>+ Add Employee</button>
      </div>

      {/* Add/Edit Form */}
      {showForm&&(
        <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1.25rem", marginBottom:"1.25rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem" }}>{editing?"Edit Employee":"Add New Employee"}</div>
          <form onSubmit={save}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
              <div><label style={lbl}>First name *</label><input style={inp} required value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))}/></div>
              <div><label style={lbl}>Last name *</label><input style={inp} required value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))}/></div>
              <div><label style={lbl}>Email</label><input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div><label style={lbl}>Phone *</label><input style={inp} required value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
              <div><label style={lbl}>National ID</label><input style={inp} value={form.national_id} onChange={e=>setForm(f=>({...f,national_id:e.target.value}))}/></div>
              <div><label style={lbl}>KRA PIN</label><input style={inp} value={form.kra_pin} onChange={e=>setForm(f=>({...f,kra_pin:e.target.value}))}/></div>
              <div><label style={lbl}>NSSF Number</label><input style={inp} value={form.nssf_number} onChange={e=>setForm(f=>({...f,nssf_number:e.target.value}))}/></div>
              <div><label style={lbl}>SHIF Number</label><input style={inp} value={form.shif_number} onChange={e=>setForm(f=>({...f,shif_number:e.target.value}))}/></div>
              <div><label style={lbl}>Role *</label><select style={inp} required value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>{ROLES.map(r=><option key={r} value={r}>{r.replace(/_/g," ")}</option>)}</select></div>
              <div><label style={lbl}>Department</label><select style={inp} value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))}>{DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
              <div><label style={lbl}>Employment type</label><select style={inp} value={form.employment_type} onChange={e=>setForm(f=>({...f,employment_type:e.target.value}))}>{EMPLOYMENT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g," ")}</option>)}</select></div>
              <div><label style={lbl}>Start date</label><input style={inp} type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/></div>
              <div><label style={lbl}>Base salary (KES) *</label><input style={inp} type="number" required value={form.base_salary} onChange={e=>setForm(f=>({...f,base_salary:e.target.value}))}/></div>
              <div><label style={lbl}>Salary type</label><select style={inp} value={form.salary_type} onChange={e=>setForm(f=>({...f,salary_type:e.target.value}))}><option value="fixed">Fixed</option><option value="commission">Commission only</option><option value="mixed">Fixed + Commission</option></select></div>
              {form.base_salary&&(
                <div style={{ gridColumn:"1/-1", background:"#f0fdf4", borderRadius:8, padding:"0.75rem", fontSize:12 }}>
                  {(()=>{ const s = calcStatutory(Number(form.base_salary)); return (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:8 }}>
                      <div>Gross: <strong>KES {Number(form.base_salary).toLocaleString()}</strong></div>
                      <div>PAYE: <strong style={{ color:"#e24b4a" }}>KES {s.paye.toFixed(0)}</strong></div>
                      <div>NSSF (emp): <strong style={{ color:"#e24b4a" }}>KES {s.nssf_employee.toFixed(0)}</strong></div>
                      <div>SHIF: <strong style={{ color:"#e24b4a" }}>KES {s.shif.toFixed(0)}</strong></div>
                      <div>Housing Levy: <strong style={{ color:"#e24b4a" }}>KES {s.housing_levy.toFixed(0)}</strong></div>
                      <div>Net Pay: <strong style={{ color:"#1d9e75" }}>KES {(Number(form.base_salary)-s.total_deductions).toFixed(0)}</strong></div>
                    </div>
                  )})()}
                </div>
              )}
              <div><label style={lbl}>M-Pesa number</label><input style={inp} value={form.mpesa_number} onChange={e=>setForm(f=>({...f,mpesa_number:e.target.value}))}/></div>
              <div><label style={lbl}>Bank name</label><input style={inp} value={form.bank_name} onChange={e=>setForm(f=>({...f,bank_name:e.target.value}))}/></div>
              <div><label style={lbl}>Bank account</label><input style={inp} value={form.bank_account} onChange={e=>setForm(f=>({...f,bank_account:e.target.value}))}/></div>
              <div><label style={lbl}>Emergency contact name</label><input style={inp} value={form.emergency_contact_name} onChange={e=>setForm(f=>({...f,emergency_contact_name:e.target.value}))}/></div>
              <div><label style={lbl}>Emergency contact phone</label><input style={inp} value={form.emergency_contact_phone} onChange={e=>setForm(f=>({...f,emergency_contact_phone:e.target.value}))}/></div>
              <div><label style={lbl}>Annual leave days</label><input style={inp} type="number" value={form.annual_leave_days} onChange={e=>setForm(f=>({...f,annual_leave_days:e.target.value}))}/></div>
              <div><label style={lbl}>Sick leave days</label><input style={inp} type="number" value={form.sick_leave_days} onChange={e=>setForm(f=>({...f,sick_leave_days:e.target.value}))}/></div>
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, marginBottom:10, cursor:"pointer" }}>
              <input type="checkbox" checked={form.housing_levy} onChange={e=>setForm(f=>({...f,housing_levy:e.target.checked}))}/>
              Apply Housing Levy (1.5% of gross)
            </label>
            <textarea style={{ ...inp, resize:"vertical", minHeight:60 }} placeholder="Notes..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
            <div style={{ display:"flex", gap:8 }}>
              <button type="submit" disabled={saving} style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>{saving?"Saving...":editing?"Update":"Add Employee"}</button>
              <button type="button" onClick={()=>{ setShowForm(false); setEditing(null); setForm(EMPTY) }} style={{ background:"#f0f0f0", border:"none", borderRadius:8, color:"#555", fontSize:13, padding:"10px 16px", cursor:"pointer" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Employees Tab */}
      {tab==="employees"&&!loading&&(
        <div>
          {employees.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem" }}>No employees yet. Add your first staff member.</div>}
          {employees.map(emp=>(
            <div key={emp.id} style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem", marginBottom:10, opacity:emp.is_active?1:0.6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700 }}>{emp.first_name} {emp.last_name}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:emp.is_active?"#f0fdf4":"#f5f5f5", color:emp.is_active?"#1d9e75":"#888" }}>{emp.is_active?"Active":"Inactive"}</span>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#eff6ff", color:"#378add" }}>{emp.employment_type?.replace(/_/g," ")}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#555" }}>{emp.role?.replace(/_/g," ")} · {emp.department}</div>
                  <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{emp.phone} · {emp.email}</div>
                  {emp.kra_pin&&<div style={{ fontSize:10, color:"#888", marginTop:2 }}>KRA: {emp.kra_pin} · NSSF: {emp.nssf_number||"N/A"} · SHIF: {emp.shif_number||"N/A"}</div>}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>KES {Number(emp.base_salary||0).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#888" }}>gross/month</div>
                  {(()=>{ const s = calcStatutory(Number(emp.base_salary||0)); return (
                    <div style={{ fontSize:10, color:"#1d9e75", marginTop:2 }}>Net: KES {(Number(emp.base_salary||0)-s.total_deductions).toFixed(0)}</div>
                  )})()}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <button onClick={()=>{ setEditing(emp.id); setForm({...emp}); setShowForm(true) }} style={{ background:"#eff6ff", border:"1px solid #378add30", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>✏️ Edit</button>
                <button onClick={()=>{ setSelected(emp); setPayPreview(null) }} style={{ background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>💰 Process Pay</button>
                <button onClick={()=>toggleActive(emp)} style={{ background:emp.is_active?"#fff5f5":"#f0fdf4", border:"1px solid "+(emp.is_active?"#e24b4a":"#1d9e75")+"30", borderRadius:7, color:emp.is_active?"#e24b4a":"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>{emp.is_active?"Deactivate":"Activate"}</button>
              </div>
              {selected?.id===emp.id&&(
                <div onClick={e=>e.stopPropagation()} style={{ marginTop:12, borderTop:"1px solid #eee", paddingTop:12 }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:8 }}>Process Payroll — {emp.first_name} {emp.last_name}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                    <div><label style={lbl}>Period start</label><input type="date" style={inp} value={payForm.period_start} onChange={e=>{ setPayForm(f=>({...f,period_start:e.target.value})); }}/></div>
                    <div><label style={lbl}>Period end</label><input type="date" style={inp} value={payForm.period_end} onChange={e=>setPayForm(f=>({...f,period_end:e.target.value}))}/></div>
                    <div><label style={lbl}>Bonuses (KES)</label><input type="number" style={inp} value={payForm.bonuses} onChange={e=>{ setPayForm(f=>({...f,bonuses:e.target.value})); previewPayslip(emp) }}/></div>
                    <div><label style={lbl}>Deductions (KES)</label><input type="number" style={inp} value={payForm.deductions} onChange={e=>setPayForm(f=>({...f,deductions:e.target.value}))}/></div>
                    <div><label style={lbl}>Payment method</label><select style={inp} value={payForm.payment_method} onChange={e=>setPayForm(f=>({...f,payment_method:e.target.value}))}><option value="mpesa">M-Pesa</option><option value="bank">Bank transfer</option><option value="cash">Cash</option></select></div>
                    <div><label style={lbl}>Notes</label><input style={inp} value={payForm.notes} onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))}/></div>
                  </div>
                  {/* Payslip preview */}
                  <button onClick={()=>previewPayslip(emp)} style={{ background:"#f0f0f0", border:"none", borderRadius:7, color:"#555", fontSize:12, padding:"6px 14px", cursor:"pointer", marginBottom:10 }}>👁️ Preview payslip</button>
                  {payPreview&&(
                    <div style={{ background:"#f8f8f8", border:"1px solid #eee", borderRadius:10, padding:"1rem", marginBottom:10 }}>
                      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:8 }}>Payslip Preview</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontSize:12 }}>
                        <div style={{ color:"#555" }}>Gross salary</div><div style={{ fontWeight:700 }}>KES {payPreview.gross.toLocaleString()}</div>
                        <div style={{ color:"#e24b4a" }}>PAYE</div><div style={{ color:"#e24b4a" }}>- KES {payPreview.paye.toFixed(0)}</div>
                        <div style={{ color:"#e24b4a" }}>NSSF (employee)</div><div style={{ color:"#e24b4a" }}>- KES {payPreview.nssf_employee.toFixed(0)}</div>
                        <div style={{ color:"#e24b4a" }}>SHIF</div><div style={{ color:"#e24b4a" }}>- KES {payPreview.shif.toFixed(0)}</div>
                        <div style={{ color:"#e24b4a" }}>Housing Levy</div><div style={{ color:"#e24b4a" }}>- KES {payPreview.housing_levy.toFixed(0)}</div>
                        <div style={{ color:"#888", borderTop:"1px solid #eee", paddingTop:6 }}>Total deductions</div><div style={{ color:"#e24b4a", borderTop:"1px solid #eee", paddingTop:6, fontWeight:700 }}>- KES {payPreview.total_deductions.toFixed(0)}</div>
                        <div style={{ fontFamily:"Syne", fontWeight:800 }}>NET PAY</div><div style={{ fontFamily:"Syne", fontWeight:800, color:"#1d9e75", fontSize:16 }}>KES {payPreview.net.toFixed(0)}</div>
                        <div style={{ color:"#378add", marginTop:4 }}>NSSF (employer)</div><div style={{ color:"#378add" }}>KES {payPreview.nssf_employer.toFixed(0)}</div>
                      </div>
                    </div>
                  )}
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>processPayment(emp)} disabled={paying} style={{ background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>{paying?"Processing...":"✅ Process Payroll"}</button>
                    <button onClick={()=>{ setSelected(null); setPayPreview(null) }} style={{ background:"#f0f0f0", border:"none", borderRadius:8, color:"#555", fontSize:13, padding:"10px 16px", cursor:"pointer" }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payroll Tab */}
      {tab==="payroll"&&(
        <div>
          {payments.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem" }}>No payroll records yet</div>}
          {payments.map(p=>(
            <div key={p.id} style={{ background:"#fff", border:"1px solid #eee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700 }}>{p.employees?.first_name} {p.employees?.last_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>{p.payment_period_start} → {p.payment_period_end}</div>
                  <div style={{ fontSize:11, color:"#888", marginTop:2 }}>
                    PAYE: KES {Number(p.paye||0).toFixed(0)} · NSSF: KES {Number(p.nssf_employee||0).toFixed(0)} · SHIF: KES {Number(p.shif||0).toFixed(0)}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#1d9e75" }}>KES {Number(p.net_amount||0).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#888" }}>net pay</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:(SC[p.payment_status]||"#888")+"20", color:SC[p.payment_status]||"#888" }}>{p.payment_status}</span>
                </div>
              </div>
              {p.payment_status==="pending"&&(
                <button onClick={()=>markPaid(p.id)} style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"5px 12px", cursor:"pointer" }}>✅ Mark as Paid</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Leave Tab */}
      {tab==="leave"&&(
        <div>
          {leaveRequests.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem" }}>No leave requests yet</div>}
          {leaveRequests.map(l=>(
            <div key={l.id} style={{ background:"#fff", border:"1px solid #eee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700 }}>{l.employees?.first_name} {l.employees?.last_name}</div>
                  <div style={{ fontSize:12, color:"#555" }}>{l.leave_type?.replace(/_/g," ")} · {l.days} days</div>
                  <div style={{ fontSize:11, color:"#888" }}>{l.start_date} → {l.end_date}</div>
                  {l.reason&&<div style={{ fontSize:11, color:"#666", fontStyle:"italic", marginTop:4 }}>{l.reason}</div>}
                </div>
                <span style={{ fontSize:11, padding:"3px 10px", borderRadius:10, background:(SC[l.status]||"#888")+"20", color:SC[l.status]||"#888", fontWeight:600 }}>{l.status}</span>
              </div>
              {l.status==="pending"&&(
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>approveLeave(l.id, true)} style={{ background:"#1d9e75", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"5px 12px", cursor:"pointer" }}>✅ Approve</button>
                  <button onClick={()=>approveLeave(l.id, false)} style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>❌ Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Statutory Guide Tab */}
      {tab==="statutory"&&(
        <div>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem" }}>Kenya Statutory Compliance Guide</div>
          {[
            { title:"PAYE (Pay As You Earn)", color:"#e24b4a", desc:"Income tax deducted from employee salary. Graduated rates: 10% (up to KES 24,000), 25% (up to KES 32,333), 30% (up to KES 500,000), 32.5% (up to KES 800,000), 35% (above KES 800,000). Personal relief: KES 2,400/month.", deadline:"Due: 9th of following month. File via KRA iTax.", ref:"itax.kra.go.ke" },
            { title:"NSSF (National Social Security Fund)", color:"#378add", desc:"Pension contribution. Employee: KES 2,160/month. Employer: KES 2,160/month (matched). Both remitted together.", deadline:"Due: 9th of following month. File via NSSF portal.", ref:"nssf.or.ke" },
            { title:"SHIF (Social Health Insurance Fund)", color:"#1d9e75", desc:"Replaced NHIF in October 2024. Rate: 2.75% of gross salary. Minimum: KES 300/month. No upper limit. Employee deduction only — employer does not top up.", deadline:"Due: 9th of following month.", ref:"sha.go.ke" },
            { title:"Housing Levy (AHL)", color:"#8b5cf6", desc:"Affordable Housing Levy. Rate: 1.5% of gross salary. Employee contributes 1.5%, employer matches 1.5%.", deadline:"Due: 9th of following month.", ref:"kra.go.ke" },
          ].map(s=>(
            <div key={s.title} style={{ background:"#fff", border:"1px solid "+s.color+"20", borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:s.color, marginBottom:6 }}>{s.title}</div>
              <div style={{ fontSize:12, color:"#555", lineHeight:1.6, marginBottom:6 }}>{s.desc}</div>
              <div style={{ fontSize:11, color:"#888", background:"#f8f8f8", borderRadius:6, padding:"6px 10px", marginBottom:4 }}>⏰ {s.deadline}</div>
              <div style={{ fontSize:11, color:"#378add" }}>🔗 {s.ref}</div>
            </div>
          ))}
          <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:12, padding:"1rem", marginTop:8 }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginBottom:6 }}>⚠️ Before Hiring</div>
            <div style={{ fontSize:12, color:"#555", lineHeight:1.8 }}>
              1. Register business as limited company (if not done)<br/>
              2. Register with KRA as employer (get employer PIN)<br/>
              3. Register with NSSF as employer<br/>
              4. Register with SHIF/SHA as employer<br/>
              5. Open business bank account<br/>
              6. Prepare employment contracts<br/>
              7. File monthly returns by 9th of each month
            </div>
          </div>
        </div>
      )}
    </div>
  )
}