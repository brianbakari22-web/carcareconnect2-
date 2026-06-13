import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"

export default function AdminInventory() {
  const isMobile = useIsMobile()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("all")
  const [providerFilter, setProviderFilter] = useState("all")
  const [providers, setProviders] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from("inventory")
      .select("*, profiles!inventory_provider_id_fkey(id,business_name,first_name,last_name,provider_type,city)")
      .order("created_at", { ascending:false })
    setItems(data||[])
    const unique = [...new Map((data||[]).map(i=>[i.provider_id, i.profiles])).values()]
    setProviders(unique.filter(Boolean))
    setLoading(false)
  }

  const filtered = items.filter(i=>{
    const matchCat = catFilter==="all"||i.category===catFilter
    const matchProvider = providerFilter==="all"||i.provider_id===providerFilter
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())||
      (i.brand||"").toLowerCase().includes(search.toLowerCase())
    return matchCat&&matchProvider&&matchSearch
  })

  const totalItems = items.length
  const activeItems = items.filter(i=>i.is_active).length
  const lowStock = items.filter(i=>i.stock_quantity<=5&&i.is_active).length
  const outOfStock = items.filter(i=>i.stock_quantity===0).length
  const totalValue = items.reduce((s,i)=>s+Number(i.price||0)*Number(i.stock_quantity||0),0)

  const CATS = ["all","parts","accessories","tyres","oils","electrical","body","tools","other"]

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000" }}>Inventory Oversight</div>
        <div style={{ fontSize:12, color:"#888" }}>All provider inventory across platform</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total items", value:totalItems, color:"#000000" },
          { label:"Active", value:activeItems, color:"#1d9e75" },
          { label:"Low stock", value:lowStock, color:lowStock>0?"#e6821e":"#555" },
          { label:"Out of stock", value:outOfStock, color:outOfStock>0?"#e24b4a":"#555" },
          { label:"Total value", value:"KES "+totalValue.toLocaleString(), color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?12:16, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:9, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {lowStock>0&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"0.75rem", marginBottom:"1rem" }}>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>⚠️ {lowStock} item{lowStock>1?"s":""} low on stock · {outOfStock} out of stock</div>
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items..."
          style={{ flex:1, minWidth:150, background:"#f8f8f8", border:"1px solid #f0f0f0", borderRadius:8, padding:"8px 12px", color:"#000000", fontSize:12, outline:"none" }}/>
        <select value={providerFilter} onChange={e=>setProviderFilter(e.target.value)}
          style={{ background:"#f8f8f8", border:"1px solid #f0f0f0", borderRadius:8, padding:"8px 12px", color:"#000000", fontSize:12, outline:"none" }}>
          <option value="all">All providers</option>
          {providers.map(p=><option key={p.id} value={p.id}>{p.business_name||p.first_name}</option>)}
        </select>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {CATS.map(c=>(
          <button key={c} onClick={()=>setCatFilter(c)}
            style={{ padding:"5px 10px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:catFilter===c?"#8b5cf6":"#f8f8f8", color:catFilter===c?"#fff":"#666" }}>
            {c}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No items found</div>}

      {filtered.map(item=>(
        <div key={item.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, opacity:item.is_active?1:0.6 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{item.name}</div>
                {item.brand&&<span style={{ fontSize:10, color:"#888", background:"#f5f5f5", padding:"1px 6px", borderRadius:6 }}>{item.brand}</span>}
                {!item.is_active&&<span style={{ fontSize:10, color:"#888", background:"#f5f5f5", padding:"1px 6px", borderRadius:6 }}>Hidden</span>}
                {item.stock_quantity===0&&<span style={{ fontSize:10, color:"#e24b4a", background:"#fff5f5", padding:"1px 6px", borderRadius:6 }}>Out of stock</span>}
                {item.stock_quantity>0&&item.stock_quantity<=5&&<span style={{ fontSize:10, color:"#e6821e", background:"#fff8f0", padding:"1px 6px", borderRadius:6 }}>⚠️ Low: {item.stock_quantity}</span>}
              </div>
              <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>{item.category} {item.subcategory?`· ${item.subcategory}`:""}</div>
              <div style={{ fontSize:11, color:"#888" }}>
                🏪 {item.profiles?.business_name||item.profiles?.first_name} · {item.profiles?.city||"—"}
                <span style={{ color:"#8b5cf6", marginLeft:6 }}>{item.profiles?.provider_type?.replace(/_/g," ")}</span>
              </div>
              {item.compatible_cars?.length>0&&<div style={{ fontSize:10, color:"#888", marginTop:2 }}>🚗 {item.compatible_cars.join(", ")}</div>}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
              <div style={{ fontSize:11, color:"#888" }}>{item.stock_quantity} {item.unit}s</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
