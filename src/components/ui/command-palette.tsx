"use client";
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Search,X} from 'lucide-react';
import {normalizeSearchString} from '@/domain/identity';
import {ITEM_REGISTRY} from '@/domain/meta/item-registry';
import type {ChampionRecord} from '@/domain/types';
type Category='all'|'champion'|'comp'|'item';
type Result={id:string;category:string;title:string;subtitle:string;url:string};
export function CommandPalette({isOpen,onClose}:{isOpen:boolean;onClose:()=>void}){
 const router=useRouter(),input=useRef<HTMLInputElement>(null),dialog=useRef<HTMLDivElement>(null);
 const [query,setQuery]=useState(''),[category,setCategory]=useState<Category>('all'),[selected,setSelected]=useState(0);
 const [champions,setChampions]=useState<ChampionRecord[]>([]),[comps,setComps]=useState<any[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{if(!isOpen)return;const previous=document.activeElement as HTMLElement|null;const controller=new AbortController();setQuery('');setSelected(0);setCategory('all');setLoading(true);setError(false);setChampions([]);setComps([]);
  const timer=setTimeout(()=>input.current?.focus(),0);
  Promise.all([fetch('/api/v1/champions?dataset=real',{signal:controller.signal}),fetch('/api/v1/meta/catalogue?mode=real',{signal:controller.signal})]).then(async responses=>{
   const [a,b]=await Promise.all(responses.map(r=>r.json()));if(controller.signal.aborted)return;
   if(responses[0].ok)setChampions(a.data||[]);else setError(true);
   if(responses[1].ok)setComps((b.data||[]).filter((r:any)=>r.verificationStatus==='verified'));else setError(true);
  }).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){
   const elements=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), input, a[href]')||[]);const first=elements[0],last=elements.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }};document.addEventListener('keydown',key);return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('keydown',key);previous?.focus();};
 },[isOpen,onClose]);
 const results=useMemo(()=>{const q=normalizeSearchString(query);if(!q)return [
  {id:'nav-champions',category:'nav',title:'Danh mục tướng',subtitle:'Chỉ số, kỹ năng và trang bị có nguồn',url:'/champions'},
  {id:'nav-compare',category:'nav',title:'So sánh bản cập nhật',subtitle:'Thay đổi qua từng mốc chính thức và PBE trước ra mắt',url:'/compare'},
  {id:'nav-meta',category:'nav',title:'Đội hình theo nguồn',subtitle:'Đội hình đã được kiểm chứng hoặc trạng thái thiếu dữ liệu',url:'/meta/websites'}];
  const rows:Result[]=[];
  if(category==='all'||category==='champion')for(const c of champions){const vi=c.name.vi.state==='known'?c.name.vi.value:c.championId,en=c.name.en.state==='known'?c.name.en.value:'';
   if([vi,en,c.championId,...c.aliases].some(x=>normalizeSearchString(x).includes(q)))rows.push({id:c.championId,category:'Tướng',title:vi,subtitle:en,url:`/champions/${encodeURIComponent(c.championId)}`});}
  if(category==='all'||category==='comp')for(const c of comps){if([c.archetypeNameVi,c.archetypeNameEn].filter(Boolean).some(x=>normalizeSearchString(x).includes(q)))rows.push({id:c.archetypeId,category:'Đội hình',title:c.archetypeNameVi,subtitle:'Đội hình có nguồn đã kiểm chứng',url:`/meta/comps/${encodeURIComponent(c.archetypeId)}`});}
  if(category==='all'||category==='item')for(const i of Object.values(ITEM_REGISTRY)){if([i.nameVi,i.nameEn,i.abbr].some(x=>normalizeSearchString(x).includes(q)))rows.push({id:i.key,category:'Trang bị',title:i.nameVi,subtitle:i.nameEn,url:`/items/${encodeURIComponent(i.key)}`});}
  return rows.slice(0,15);
 },[query,category,champions,comps]);
 if(!isOpen)return null;
 const choose=(r:Result)=>{onClose();router.push(r.url);};
 return <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm px-3 pt-12 sm:pt-24" onClick={onClose}>
  <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="search-title" className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={e=>e.stopPropagation()}>
   <h2 id="search-title" className="sr-only">Tìm kiếm nhanh</h2>
   <div className="flex items-center gap-3 border-b border-slate-700 p-4"><Search className="h-5 w-5 text-emerald-400"/>
    <input ref={input} value={query} aria-label="Tìm tướng, đội hình, trang bị" role="combobox" aria-expanded="true" aria-controls="search-results" aria-activedescendant={results[selected]?`result-${results[selected].id}`:undefined} className="min-w-0 flex-1 bg-transparent text-slate-100 outline-none" placeholder="Tìm tướng, đội hình, trang bị..." onChange={e=>{setQuery(e.target.value);setSelected(0);}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setSelected(v=>(v+1)%Math.max(results.length,1));}if(e.key==='ArrowUp'){e.preventDefault();setSelected(v=>(v-1+results.length)%Math.max(results.length,1));}if(e.key==='Enter'&&results[selected]){e.preventDefault();choose(results[selected]);}}}/>
    <button aria-label="Đóng tìm kiếm" onClick={onClose}><X className="h-5 w-5"/></button>
   </div>
   <div className="flex gap-2 overflow-x-auto p-3">{([{id:'all',label:'Tất cả'},{id:'champion',label:'Tướng'},{id:'comp',label:'Đội hình'},{id:'item',label:'Trang bị'}] as const).map(c=><button key={c.id} aria-pressed={category===c.id} className={`rounded px-3 py-1 text-sm ${category===c.id?'bg-emerald-700 text-white':'bg-slate-800 text-slate-300'}`} onClick={()=>{setCategory(c.id);setSelected(0);}}>{c.label}</button>)}</div>
   {loading&&<p className="px-4 text-xs text-slate-400">Đang tải dữ liệu thật…</p>}{error&&<p className="px-4 text-xs text-amber-300">Một phần dữ liệu chưa sẵn sàng; chỉ hiển thị nội dung đã tải được.</p>}
   <div id="search-results" role="listbox" className="max-h-[55vh] overflow-y-auto p-3">{results.length?results.map((r,i)=><div key={r.id} id={`result-${r.id}`} role="option" aria-selected={selected===i} onMouseEnter={()=>setSelected(i)} onClick={()=>choose(r)} className={`cursor-pointer rounded-xl p-3 ${selected===i?'bg-emerald-950 text-emerald-100':'text-slate-200 hover:bg-slate-800'}`}><div className="font-semibold">{r.title}</div><div className="text-xs text-slate-400">{r.subtitle}</div></div>):<p className="p-5 text-sm text-slate-400">Không tìm thấy nội dung phù hợp có dữ liệu kiểm chứng.</p>}</div>
   <p className="border-t border-slate-700 px-4 py-3 text-xs text-slate-400">↑ ↓ để chọn · Enter để mở · Escape để đóng</p>
  </div>
 </div>;
}