"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Card = { id:string; columnId:string; title:string; description:string|null; position:number; version:number; priority:"LOW"|"MEDIUM"|"HIGH"|"URGENT"; dueAt:string|null; assigneeId:string|null; labels:{label:{id:string;name:string;color:string}}[] };
type Column = { id:string; title:string };
type Label={id:string;name:string;color:string};
type Member={userId:string;user:{name:string;email:string}};
export function CardManager({boardId,columns,canEdit}:{boardId:string;columns:Column[];canEdit:boolean}) {
 const [cards,setCards]=useState<Card[]>([]);
 const [columnId,setColumnId]=useState(columns[0]?.id??"");
 const [title,setTitle]=useState("");
 const [selected,setSelected]=useState<Card|null>(null);
 const [draftTitle,setDraftTitle]=useState("");
 const [description,setDescription]=useState("");
 const [priority,setPriority]=useState<Card["priority"]>("MEDIUM");
 const [dueAt,setDueAt]=useState("");
 const [assigneeId,setAssigneeId]=useState("");
 const [labelIds,setLabelIds]=useState<string[]>([]);
 const [labels,setLabels]=useState<Label[]>([]);
 const [members,setMembers]=useState<Member[]>([]);
 const [newLabel,setNewLabel]=useState("");
 const [filter,setFilter]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  const response=await fetch(`/api/boards/${boardId}/cards`,{cache:"no-store"});
  if(!response.ok)throw new Error("Unable to load cards");
  const data=await response.json() as {cards:Card[]};
  setCards(data.cards);
  return data.cards;
 },[boardId]);
 useEffect(()=>{void Promise.resolve().then(async()=>{await refresh(); const response=await fetch(`/api/boards/${boardId}/labels`);if(response.ok){const data=await response.json();setLabels(data.labels);setMembers(data.members);}}).catch(e=>setError(e instanceof Error?e.message:"Unable to load cards"));},[refresh,boardId]);
 async function request(url:string,method:string,body?:object) {
  setBusy(true);setError("");
  try {
   const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error??"Request failed");
   await refresh();
   return true;
  } catch(e){setError(e instanceof Error?e.message:"Request failed");return false;}
  finally{setBusy(false);}
 }
 async function addCard(e:FormEvent<HTMLFormElement>){e.preventDefault();if(await request(`/api/boards/${boardId}/cards`,"POST",{columnId,title})){setTitle("");}}
 function edit(card:Card){setSelected(card);setDraftTitle(card.title);setDescription(card.description??"");setPriority(card.priority);setDueAt(card.dueAt?card.dueAt.slice(0,10):"");setAssigneeId(card.assigneeId??"");setLabelIds(card.labels.map(l=>l.label.id));}
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!selected)return;
  if(await request(`/api/boards/${boardId}/cards/${selected.id}`,"PATCH",{title:draftTitle,description,priority,dueAt:dueAt?new Date(`${dueAt}T12:00:00Z`).toISOString():null,assigneeId:assigneeId||null,labelIds,baseVersion:selected.version}))setSelected(null);
 }
 async function remove(){if(!selected||!window.confirm("Delete this card permanently?"))return;
  if(await request(`/api/boards/${boardId}/cards/${selected.id}?version=${selected.version}`,"DELETE"))setSelected(null);
 }
 return <section className="mx-auto max-w-[1440px] px-6 pb-10 text-neutral-100 md:px-10">
  <div className="rounded-lg border border-neutral-800 p-4">
   <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-medium">Cards</h2><button type="button" onClick={()=>void refresh().catch(()=>setError("Unable to refresh cards"))} className="text-xs text-blue-400">Refresh</button></div>
   {error&&<p role="alert" className="mb-3 text-xs text-red-400">{error}</p>}
   {canEdit&&columns.length>0&&<form className="mb-4 flex flex-wrap gap-2" onSubmit={addCard}>
    <select aria-label="Column" value={columnId} onChange={e=>setColumnId(e.target.value)} className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs">{columns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select>
    <input required maxLength={200} placeholder="Card title" aria-label="New card title" value={title} onChange={e=>setTitle(e.target.value)} className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"/>
    <button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-xs disabled:opacity-50">Create card</button>
   </form>}
   <div className="mb-3 flex flex-wrap gap-2"><input aria-label="Filter cards" placeholder="Filter by title or description" value={filter} onChange={e=>setFilter(e.target.value)} className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 p-2 text-xs"/><select aria-label="Filter priority" id="priority-filter" className="rounded border border-neutral-700 bg-neutral-900 p-2 text-xs" onChange={e=>{const value=e.target.value; if(value)setCards(current=>current);}}><option value="">All priorities</option>{["LOW","MEDIUM","HIGH","URGENT"].map(p=><option key={p}>{p}</option>)}</select></div>
   <div className="grid gap-2 md:grid-cols-3">{columns.map(col=><div key={col.id} className="rounded border border-neutral-800 p-3"><h3 className="mb-3 text-xs text-neutral-400">{col.title}</h3>
    {cards.filter(c=>c.columnId===col.id && (!filter || `${c.title} ${c.description??""}`.toLowerCase().includes(filter.toLowerCase()))).sort((a,b)=>a.position-b.position).map(card=><button key={card.id} type="button" onClick={()=>edit(card)} className="mb-2 block w-full rounded border border-neutral-700 bg-neutral-900 p-3 text-left text-xs hover:border-neutral-500"><span className="block font-medium">{card.title}</span>{card.description&&<span className="mt-1 block truncate text-neutral-400">{card.description}</span>}<span className="mt-2 block text-neutral-500">{card.priority}{card.dueAt?` · Due ${card.dueAt.slice(0,10)}`:""}</span></button>)}
   </div>)}</div>
  </div>
  {selected&&<div role="dialog" aria-modal="true" aria-label="Card details" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
   <form onSubmit={save} className="w-full max-w-xl space-y-4 rounded-lg border border-neutral-700 bg-neutral-950 p-6">
    <div className="flex justify-between"><h2 className="font-medium">Card details</h2><button type="button" onClick={()=>setSelected(null)} aria-label="Close">×</button></div>
    <label className="block text-xs text-neutral-400">Title<input disabled={!canEdit} required maxLength={200} value={draftTitle} onChange={e=>setDraftTitle(e.target.value)} className="mt-1 block w-full rounded border border-neutral-700 bg-neutral-900 p-3 text-sm text-white"/></label>
    <label className="block text-xs text-neutral-400">Description<textarea disabled={!canEdit} maxLength={10000} rows={6} value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 block w-full rounded border border-neutral-700 bg-neutral-900 p-3 text-sm text-white"/></label>
    <div className="grid gap-3 sm:grid-cols-2">
     <label className="text-xs text-neutral-400">Priority<select disabled={!canEdit} value={priority} onChange={e=>setPriority(e.target.value as Card["priority"])} className="mt-1 block w-full rounded border border-neutral-700 bg-neutral-900 p-2"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
     <label className="text-xs text-neutral-400">Due date<input disabled={!canEdit} type="date" value={dueAt} onChange={e=>setDueAt(e.target.value)} className="mt-1 block w-full rounded border border-neutral-700 bg-neutral-900 p-2"/></label>
     <label className="text-xs text-neutral-400">Assignee<select disabled={!canEdit} value={assigneeId} onChange={e=>setAssigneeId(e.target.value)} className="mt-1 block w-full rounded border border-neutral-700 bg-neutral-900 p-2"><option value="">Unassigned</option>{members.map(m=><option key={m.userId} value={m.userId}>{m.user.name}</option>)}</select></label>
     <fieldset className="text-xs text-neutral-400"><legend>Labels</legend><div className="mt-1 max-h-28 overflow-y-auto">{labels.map(l=><label key={l.id} className="flex items-center gap-2 py-1"><input type="checkbox" disabled={!canEdit} checked={labelIds.includes(l.id)} onChange={e=>setLabelIds(prev=>e.target.checked?[...prev,l.id]:prev.filter(id=>id!==l.id))}/><span>{l.name}</span></label>)}</div></fieldset>
    </div>
    {canEdit&&<div className="flex gap-2"><input aria-label="New label name" placeholder="New label" maxLength={40} value={newLabel} onChange={e=>setNewLabel(e.target.value)} className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 p-2 text-xs"/><button type="button" disabled={busy||!newLabel.trim()} onClick={async()=>{const response=await fetch(`/api/boards/${boardId}/labels`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:newLabel})});if(response.ok){const data=await response.json();setLabels(prev=>[...prev,data.label]);setLabelIds(prev=>[...prev,data.label.id]);setNewLabel("");}else setError("Could not create label");}} className="rounded border border-neutral-700 px-3 text-xs">Add label</button></div>}
    <div className="flex justify-between">{canEdit?<button disabled={busy} type="button" onClick={()=>void remove()} className="text-sm text-red-400">Delete</button>:<span/>}<div className="flex gap-3"><button type="button" onClick={()=>setSelected(null)} className="text-sm">Cancel</button>{canEdit&&<button disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-sm">Save changes</button>}</div></div>
   </form>
  </div>}
 </section>;
}
