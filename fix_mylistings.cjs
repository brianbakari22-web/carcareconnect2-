const fs = require('fs');
let lines = fs.readFileSync('src/components/marketplace/MyListings.jsx', 'utf8').split('\n');

const newCard =           {listings.map(l=>(
            <div key={l.id} style={{ background:"#111", border:"1px solid "+(SC[l.status]||"#1e1e1e")+"30", borderRadius:12, overflow:"hidden", marginBottom:12 }}>
              <div style={{ height:140, background:"#1a1a1a", position:"relative", overflow:"hidden" }}>
                {l.primary_photo
                  ? <img src={l.primary_photo} alt={l.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  : <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>{l.listing_type==="vehicle"?"🚗":l.listing_type==="part"?"🔧":"✨"}</div>
                }
                <div style={{ position:"absolute", top:8, left:8, display:"flex", gap:4 }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:SC[l.status]||"#888", color:"#fff", fontWeight:600 }}>{l.status}</span>
                  {l.is_featured&&<span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#e6821e", color:"#fff" }}>Featured</span>}
                  {l.is_inspected&&<span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"#1d9e75", color:"#fff" }}>Inspected</span>}
                </div>
                <div style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.75)", borderRadius:8, padding:"4px 10px" }}>
                  <span style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e" }}>KES {Number(l.price).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ padding:"0.75rem" }}>
                <div style={{ fontSize:14, fontWeight:600, color:"#f0ede6", marginBottom:3 }}>{l.title}</div>
                {l.listing_type==="vehicle"&&<div style={{ fontSize:11, color:"#888", marginBottom:3 }}>{[l.make,l.model,l.year].filter(Boolean).join(" · ")}</div>}
                <div style={{ fontSize:11, color:"#555", marginBottom:8 }}>📍 {l.city||"—"} · 👁 {l.views||0} views</div>
                {l.status==="pending"&&l.listing_type==="vehicle"&&l.inspection_status!=="passed"&&(
                  <div style={{ background:"#1a1208", border:"1px solid #e6821e30", borderRadius:8, padding:"0.6rem", marginBottom:8 }}>
                    <div style={{ fontSize:11, color:"#e6821e", marginBottom:6 }}>CCC inspection required</div>
                    <button onClick={()=>setShowInspection(showInspection===l.id?null:l.id)} style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:11, padding:"6px 14px", cursor:"pointer", fontWeight:600, width:"100%" }}>
                      {showInspection===l.id?"Close":"Schedule and Pay Inspection (KES 500)"}
                    </button>
                    {showInspection===l.id&&(<div style={{ marginTop:8 }}><InspectionRequest listing={l} onSuccess={()=>{ setShowInspection(null); loadListings() }}/></div>)}
                  </div>
                )}
                {l.status==="pending"&&(l.listing_type!=="vehicle"||l.inspection_status==="passed")&&<div style={{ fontSize:11, color:"#e6821e", marginBottom:8 }}>Under review</div>}
                {l.status==="rejected"&&l.admin_notes&&<div style={{ fontSize:11, color:"#e24b4a", marginBottom:8 }}>{l.admin_notes}</div>}
                {inspectListing===l.id&&(<div style={{ marginBottom:8 }}><InspectionRequest listing={l} onSuccess={()=>{ setInspectListing(null); loadListings() }}/></div>)}
                {featureListing===l.id&&(<div style={{ marginBottom:8 }}><FeaturedListing listingId={l.id} onSuccess={()=>{ setFeatureListing(null); loadListings() }}/></div>)}
                {photoListing===l.id&&(
                  <div style={{ marginBottom:8 }}>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                      {listingPhotos.map((p)=>(<img key={p.id} src={p.photo_url} alt="" style={{ width:64, height:64, objectFit:"cover", borderRadius:8, border:p.is_primary?"2px solid #e6821e":"1px solid #333" }}/>))}
                      {listingPhotos.length===0&&<div style={{ fontSize:11, color:"#555" }}>No photos yet</div>}
                    </div>
                    <PhotoUpload listingId={l.id} onSuccess={()=>openPhotos(l)} existingPhotos={listingPhotos}/>
                  </div>
                )}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <button onClick={()=>navigate("/dashboard/marketplace")} style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>View</button>
                  <button onClick={()=>openPhotos(l)} style={{ background:"#111", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>Photos</button>
                  {l.listing_type==="vehicle"&&<button onClick={()=>setFeatureListing(featureListing===l.id?null:l.id)} style={{ background:"#1a1208", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>Feature</button>}
                  <button onClick={()=>setInspectListing(inspectListing===l.id?null:l.id)} style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>Inspect</button>
                  {l.status!=="sold"&&<button onClick={()=>deleteListing(l.id)} style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"6px 12px", cursor:"pointer" }}>Delete</button>}
                </div>
              </div>
            </div>
          ))};

const start = 222;
const end = 285;
const before = lines.slice(0, start);
const after = lines.slice(end);
const result = before.concat(newCard.split('\n')).concat(after);
fs.writeFileSync('src/components/marketplace/MyListings.jsx', result.join('\n'), 'utf8');
console.log('done - lines: ' + result.length);
