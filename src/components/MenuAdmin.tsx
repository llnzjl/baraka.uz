"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import OwnerTabs from "./OwnerTabs";
import { apiFetch } from "@/lib/client/api";
type MenuItem = { id:string; name:string; ko:string; category:string; description:string; descriptionKo:string; price:number|null; active:boolean; image:string; updatedAt:string };
const categories = [
  ["mains","Mains & noodles"],["grill","Grill"],["soups","Soups"],
  ["bakery","Bakery"],["salads","Salads"],["drinks","Drinks"],
];
export default function MenuAdmin() {
  const [items,setItems]=useState<MenuItem[]>([]), [files,setFiles]=useState<Record<string,File>>({}),
    [previews,setPreviews]=useState<Record<string,string>>({}), [states,setStates]=useState<Record<string,string>>({}),
    [error,setError]=useState(""), [loaded,setLoaded]=useState(false), [query,setQuery]=useState(""), [focusId,setFocusId]=useState("");
  const dirty=useRef(new Set<string>()), versions=useRef<Record<string,number>>({});
  const load=useCallback(async()=>{
    try {
      const r=await apiFetch("/api/admin/menu",{cache:"no-store"});
      if(!r.ok) throw new Error(r.status===401?"Sign in again to edit the menu.":"The menu could not load.");
      const d=await r.json(); setItems(d.items); setLoaded(true); setError("");
    } catch(e) { setError((e as Error).message); }
  },[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get("item")||"";
    if(id){setFocusId(id);setQuery(id);}
  },[]);
  useEffect(()=>{
    if(!loaded||!focusId)return;
    const timer=setTimeout(()=>document.getElementById(`menu-item-${focusId}`)?.scrollIntoView({behavior:"smooth",block:"center"}),150);
    return ()=>clearTimeout(timer);
  },[loaded,focusId,items]);
  const edit=(id:string, patch:Partial<MenuItem>)=>{
    versions.current[id]=(versions.current[id]||0)+1;
    setItems(old=>old.map(item=>item.id===id?{...item,...patch}:item));
    dirty.current.add(id);
    setStates(old=>({...old,[id]:"Changes pending"}));
  };
  const save=useCallback(async(id:string)=>{
    const item=items.find(x=>x.id===id); if(!item)return;
    const version=versions.current[id]||0, file=files[id];
    setStates(old=>({...old,[id]:"Saving…"}));
    const form=new FormData();
    form.set("item",JSON.stringify({id:item.id,name:item.name,ko:item.ko,category:item.category,description:item.description,descriptionKo:item.descriptionKo,price:item.price,active:item.active}));
    if(file) form.set("image",file,file.name);
    try {
      const r=await apiFetch(`/api/admin/menu/${encodeURIComponent(id)}`,{method:"PATCH",body:form});
      const d=await r.json(); if(!r.ok) throw new Error(d.error==="IMAGE_TOO_LARGE"?"Photo must be at most 100 MB and 100 megapixels.":d.error==="INVALID_IMAGE"?"Use a valid JPEG, PNG or WebP image.":"Could not save this dish. Check the fields and try again.");
      if((versions.current[id]||0)===version){
        setItems(old=>old.map(x=>x.id===id?d.item:x));
        setFiles(old=>{const next={...old}; delete next[id]; return next;});
        setPreviews(old=>{const next={...old}; delete next[id]; return next;});
        dirty.current.delete(id); setStates(old=>({...old,[id]:"Saved"}));
      }
    } catch(e) { dirty.current.delete(id); setStates(old=>({...old,[id]:(e as Error).message})); }
  },[files,items]);
  useEffect(()=>{
    if(!dirty.current.size)return;
    const timer=setTimeout(()=>{for(const id of Array.from(dirty.current)) void save(id);},900);
    return ()=>clearTimeout(timer);
  },[items,files,save]);
  async function addDish(){
    setError("");
    const form=new FormData();
    form.set("item",JSON.stringify({name:"New dish",ko:"새 메뉴",category:"mains",description:"",descriptionKo:"",price:null,active:true}));
    try {
      const r=await apiFetch("/api/admin/menu",{method:"POST",body:form}), d=await r.json();
      if(!r.ok)throw new Error("Could not add the dish. Refresh and try again.");
      setItems(old=>[d.item,...old]); setStates(old=>({...old,[d.item.id]:"Saved"}));
    }catch(e){setError((e as Error).message);}
  }
  const filtered=items.filter(item=>`${item.name} ${item.ko} ${item.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  function chooseImage(id:string,file?:File){
    if(!file)return;
    if(file.size>100*1024*1024){setStates(old=>({...old,[id]:"Photo must be 100 MB or smaller."}));return;}
    setFiles(old=>({...old,[id]:file}));
    const reader=new FileReader(); reader.onload=()=>setPreviews(old=>({...old,[id]:String(reader.result)})); reader.readAsDataURL(file);
    edit(id,{});
  }
  return <main className="admin-shell menu-admin">
    <Link className="text-link" href="/">BARAKA · Return to website</Link>
    <OwnerTabs />
    <p className="eyebrow">RESTAURANT CONTENT</p><h1>Edit the menu</h1>
    <p>Changes save automatically and appear on the customer menu and ordering page within a few seconds. Prices are in KRW.</p>
    <div className="admin-toolbar"><button onClick={()=>void addDish()}>＋ Add a dish</button><button onClick={()=>void load()}>Refresh</button><input aria-label="Search menu" placeholder="Search dishes" value={query} onChange={e=>setQuery(e.target.value)}/><span>{loaded?`${filtered.length} of ${items.length} dishes`:"Loading menu…"}</span></div>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    <div className="menu-editor-grid">{filtered.map(item=><article id={`menu-item-${item.id}`} className={`menu-editor-card ${!item.active?"menu-editor-inactive":""} ${focusId===item.id?"menu-editor-focus":""}`} key={item.id}>
      <div className="menu-editor-image"><img src={previews[item.id]||item.image} alt={item.name}/><label>Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>chooseImage(item.id,e.target.files?.[0])}/></label><small>JPEG, PNG or WebP · up to 100 MP / 100 MB. Large originals are optimized for the website.</small></div>
      <div className="menu-editor-fields">
        <label>Dish name (English)<input value={item.name} maxLength={100} onChange={e=>edit(item.id,{name:e.target.value})}/></label>
        <label>Dish name (Korean)<input value={item.ko} maxLength={100} onChange={e=>edit(item.id,{ko:e.target.value})}/></label>
        <label>Category<select value={item.category} onChange={e=>edit(item.id,{category:e.target.value})}>{categories.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label>Price in KRW<input type="number" min="0" max="5000000" step="1" value={item.price??""} placeholder="Ask staff" onChange={e=>edit(item.id,{price:e.target.value===""?null:Number(e.target.value)})}/></label>
        <label>Description (English)<textarea value={item.description} maxLength={500} rows={2} onChange={e=>edit(item.id,{description:e.target.value})}/></label>
        <label>Description (Korean)<textarea value={item.descriptionKo} maxLength={500} rows={2} onChange={e=>edit(item.id,{descriptionKo:e.target.value})}/></label>
        <label className="menu-editor-active"><input type="checkbox" checked={item.active} onChange={e=>edit(item.id,{active:e.target.checked})}/> Show on customer menu and allow ordering</label>
        <div className="menu-editor-status" aria-live="polite"><span>{states[item.id]||"Saved"}</span>{states[item.id]?.startsWith("Could not save")&&<button onClick={()=>{dirty.current.add(item.id);void save(item.id);}}>Retry</button>}</div>
      </div>
    </article>)}</div>
  </main>;
}
