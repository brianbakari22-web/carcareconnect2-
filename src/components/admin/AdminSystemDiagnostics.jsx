import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const TABLES = ["profiles","bookings","services","inventory","orders","order_items","delivery_zones","notifications","reviews","support_tickets","service_claims","marketplace_listings","employees","commission_rates","error_logs"]

const ROUTES = [
  { path:"/dashboard", role:"customer", desc:"Customer dashboard" },
  { path:"/dashboard/bookings", role:"customer", desc:"Customer bookings" },
  { path:"/dashboard/parts", role:"customer", desc:"Parts marketplace" },
  { path:"/provider-dashboard", role:"provider", desc:"Provider dashboard" },
  { path:"/provider-dashboard/inventory", role:"provider", desc:"Provider inventory" },
  { path:"/provider-dashboard/orders", role:"provider", desc:"Provider orders" },
  { path:"/driver-dashboard", role:"driver", desc:"Driver dashboard" },
  { path:"/driver-dashboard/deliveries", role:"driver", desc:"Driver deliveries" },
]

export default function AdminSystemDiagnostics() {
  const isMobile = useIsMobile()
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)
  const [errorLogs, setErrorLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [tab, setTab] = useState("diagnostics")

  useEffect(() => { loadErrorLogs() }, [])

  async function loadErrorLogs() {
    setLoadingLogs(true)
    const { data } = await supabase.from("error_logs").select("*").order("created_at",{ascending:false}).limit(50)
    setErrorLogs(data||[])
    setLoadingLogs(false)
  }

  async function clearLogs() {
    await supabase.from("error_logs").delete().neq("id","00000000-0000-0000-0000-000000000000")
    setErrorLogs([])
    toast.success("Logs cleared")
  }

  async function runDiagnostics() {
    setRunning(true)
    const r = { tables:{}, policies:{}, queries:{}, users:{}, fixes:[] }

    // 1. Check all tables exist
    for (const table of TABLES) {
      try {
        const { error } = await supabase.from(table).select("id").limit(1)
        r.tables[table] = error ? { ok:false, error:error.message, code:error.code } : { ok:true }
        if (error) r.fixes.push({ severity:"🔴", issue:`Table ${table}: ${error.message}`, fix:`Check if table exists in Supabase dashboard` })
      } catch(e) { r.tables[table] = { ok:false, error:e.message } }
    }

    // 2. Check profiles query (most critical)
    try {
      const { data:{ session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data, error } = await supabase.from("profiles").select("*").eq("id",session.user.id).maybeSingle()
        r.queries.profileFetch = { ok:!error, data:data?{role:data.role,type:data.provider_type}:null, error:error?.message }
        if (error) r.fixes.push({ severity:"🔴", issue:`Profile fetch failed: ${error.message}`, fix:`Check profiles RLS policies` })
        if (!data) r.fixes.push({ severity:"🔴", issue:"Profile not found for current user", fix:`Run: insert into profiles (id,role) values ('${session.user.id}','admin')` })
      } else {
        r.queries.profileFetch = { ok:false, error:"No session" }
      }
    } catch(e) { r.queries.profileFetch = { ok:false, error:e.message } }

    // 3. Check inventory RLS
    try {
      const { error } = await supabase.from("inventory").select("id").limit(1)
      r.queries.inventorySelect = { ok:!error, error:error?.message }
      if (error) r.fixes.push({ severity:"🔴", issue:`Inventory select failed: ${error.message}`, fix:`Run: create policy "inventory_select_all" on public.inventory for select to authenticated using (true)` })
    } catch(e) { r.queries.inventorySelect = { ok:false, error:e.message } }

    // 4. Check orders RLS
    try {
      const { error } = await supabase.from("orders").select("id").limit(1)
      r.queries.ordersSelect = { ok:!error, error:error?.message }
      if (error) r.fixes.push({ severity:"🔴", issue:`Orders select failed: ${error.message}`, fix:`Run: create policy "orders_select_all" on public.orders for select to authenticated using (customer_id=auth.uid() or provider_id=auth.uid() or public.is_admin())` })
    } catch(e) { r.queries.ordersSelect = { ok:false, error:e.message } }

    // 5. Check user counts
    try {
      const [{ count:customers },{ count:providers },{ count:drivers },{ count:admins }] = await Promise.all([
        supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","customer"),
        supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","provider"),
        supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","driver"),
        supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","admin"),
      ])
      r.users = { customers:customers||0, providers:providers||0, drivers:drivers||0, admins:admins||0 }
    } catch(e) { r.users = { error:e.message } }

    // 6. Check provider types
    try {
      const { data } = await supabase.from("profiles").select("provider_type").eq("role","provider")
      const types = (data||[]).reduce((acc,p)=>{ acc[p.provider_type||"garage"]=(acc[p.provider_type||"garage"]||0)+1; return acc },{})
      r.providerTypes = types
    } catch(e) { r.providerTypes = {} }

    // 7. Check storage buckets
    try {
      const { data, error } = await supabase.storage.listBuckets()
      r.storage = { ok:!error, buckets:(data||[]).map(b=>b.name) }
      const requiredBuckets = ["provider-photos","driver-documents","vehicle-images","inventory-photos"]
      requiredBuckets.forEach(b => {
        if (!r.storage.buckets?.includes(b)) {
          r.fixes.push({ severity:"🟡", issue:`Storage bucket missing: ${b}`, fix:`Create bucket "${b}" in Supabase Storage` })
        }
      })
    } catch(e) { r.storage = { ok:false, error:e.message } }

    if (r.fixes.length===0) r.fixes.push({ severity:"✅", issue:"No issues found!", fix:"Platform looks healthy" })

    setResults(r)
    setRunning(false)
  }

  const SC = { "🔴":"#e24b4a", "🟡":"#e6821e", "✅":"#1d9e75" }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>System Diagnostics</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:"1.5rem" }}>Full platform health check and error tracking</div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.5rem" }}>
        {[{k:"diagnostics",l:"Diagnostics"},{k:"errors",l:`Error Log (${errorLogs.length})`},{k:"fixes",l:"Auto-fixes"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#111", color:tab===t.k?"#fff":"#666", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="diagnostics"&&(
        <div>
          <button onClick={runDiagnostics} disabled={running}
            style={{ background:running?"#333":"#8b5cf6", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px 28px", cursor:running?"not-allowed":"pointer", marginBottom:"1.5rem", width:"100%" }}>
            {running?"🔍 Running diagnostics...":"🔍 Run full diagnostics"}
          </button>

          {results&&(
            <div>
              {/* User counts */}
              <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:8 }}>👥 Users</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                  {Object.entries(results.users||{}).filter(([k])=>k!=="error").map(([k,v])=>(
                    <div key={k} style={{ background:"#0f0f0f", borderRadius:8, padding:"0.5rem", textAlign:"center" }}>
                      <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>{v}</div>
                      <div style={{ fontSize:9, color:"#555" }}>{k}</div>
                    </div>
                  ))}
                </div>
                {results.providerTypes&&Object.keys(results.providerTypes).length>0&&(
                  <div style={{ marginTop:8, fontSize:11, color:"#555" }}>
                    Provider types: {Object.entries(results.providerTypes).map(([k,v])=>`${k}(${v})`).join(", ")}
                  </div>
                )}
              </div>

              {/* Table status */}
              <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:8 }}>🗄️ Tables</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:6 }}>
                  {Object.entries(results.tables||{}).map(([table,status])=>(
                    <div key={table} style={{ background:"#0f0f0f", borderRadius:8, padding:"6px 8px", display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:10 }}>{status.ok?"✅":"❌"}</span>
                      <span style={{ fontSize:11, color:status.ok?"#888":"#e24b4a" }}>{table}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Query tests */}
              <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:8 }}>🔌 Query Tests</div>
                {Object.entries(results.queries||{}).map(([query,status])=>(
                  <div key={query} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #1a1a1a" }}>
                    <span style={{ fontSize:12, color:"#888" }}>{query}</span>
                    <div style={{ textAlign:"right" }}>
                      <span style={{ fontSize:10, color:status.ok?"#1d9e75":"#e24b4a", fontWeight:600 }}>{status.ok?"✅ OK":"❌ FAIL"}</span>
                      {!status.ok&&<div style={{ fontSize:10, color:"#e24b4a" }}>{status.error}</div>}
                      {status.data&&<div style={{ fontSize:10, color:"#555" }}>{JSON.stringify(status.data)}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Storage */}
              <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:8 }}>📦 Storage Buckets</div>
                <div style={{ fontSize:12, color:results.storage?.ok?"#1d9e75":"#e24b4a" }}>
                  {results.storage?.buckets?.join(", ")||results.storage?.error}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==="errors"&&(
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
            <div style={{ fontSize:12, color:"#555" }}>{errorLogs.length} errors logged</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={loadErrorLogs} style={{ background:"#111", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>Refresh</button>
              {errorLogs.length>0&&<button onClick={clearLogs} style={{ background:"#1a0808", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 12px", cursor:"pointer" }}>Clear all</button>}
            </div>
          </div>
          {errorLogs.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No errors logged yet</div>}
          {errorLogs.map((e,i)=>(
            <div key={e.id||i} style={{ background:"#111", border:"1px solid #e24b4a20", borderRadius:10, padding:"0.75rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, flexWrap:"wrap", gap:4 }}>
                <span style={{ fontSize:11, color:"#e24b4a", fontWeight:600 }}>
                  {e.user_role||"unknown"} {e.provider_type?"("+e.provider_type+")":""} · {e.page_url}
                </span>
                <span style={{ fontSize:10, color:"#444" }}>{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize:12, color:"#f0ede6", marginBottom:4, fontFamily:"monospace", wordBreak:"break-all" }}>{e.error_message}</div>
              <div style={{ fontSize:10, color:"#555" }}>{e.error_source} · line {e.error_line}:{e.error_col}</div>
            </div>
          ))}
        </div>
      )}

      {tab==="fixes"&&(
        <div>
          <div style={{ fontSize:12, color:"#555", marginBottom:"1rem" }}>
            {results ? `${results.fixes?.length||0} issues found` : "Run diagnostics first to see fixes"}
          </div>
          {!results&&<button onClick={runDiagnostics} style={{ background:"#8b5cf6", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:"pointer" }}>Run diagnostics first</button>}
          {results?.fixes?.map((fix,i)=>(
            <div key={i} style={{ background:"#111", border:`1px solid ${SC[fix.severity]||"#1e1e1e"}30`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:600, color:SC[fix.severity]||"#888", marginBottom:6 }}>{fix.severity} {fix.issue}</div>
              <div style={{ fontSize:12, color:"#555", fontFamily:"monospace", background:"#0f0f0f", padding:"8px", borderRadius:6, wordBreak:"break-all" }}>{fix.fix}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

