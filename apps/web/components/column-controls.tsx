"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
type Column={id:string;title:string;position:number;cardCount:number};
export function ColumnControls({boardId,initialColumns,canEdit,version}:{boardId:string;initialColumns:Column[];canEdit:boolean;version:number}){
 const router=useRouter();const [columns,setColumns]=useState(initialColumns);
 const [boardVersion,setBoardVersion]=useState(version);const [title,setTitle]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function send(url:string,method:string,data?:object){
  setBusy(true);setError("");
  try{
   const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},...(data?{body:JSON.stringify(data)}:{})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error??"Request failed");
   router.refresh();return result;
  }catch(e){setError(e instanceof Error?e.message:"Request failed");return null;}
  finally{setBusy(false);}
 }
 async function refreshColumns(){
  const response=await fetch(`/api/boards/${boardId}`,{cache:"no-store"});
  if(response.ok){const result=await response.json();setBoardVersion(result.board.version);setColumns(result.board.columns.map((c:{id:string;title:string;position:number;_count:{cards:number}})=>({id:c.id,title:c.title,position:c.position,cardCount:c._count.cards})));}
 }
 async function move(index:number,delta:number){
  const next=[...columns],target=index+delta;if(target<0||target>=next.length)return;
  [next[index],next[target]]=[next[target],next[index]];
  const result=await send(`/api/boards/${boardId}/columns/reorder`,"PUT",{columnIds:next.map(c=>c.id),baseVersion:boardVersion});
  if(result){setColumns(next);setBoardVersion(result.version);}else await refreshColumns();
 }
 if(!canEdit)return null;
 return <section className="mx-auto max-w-[1440px] px-6 pb-5 md:px-10">
  <div className="rounded-lg border border-neutral-800 p-4">
   <h2 className="mb-3 text-sm font-medium">Manage columns</h2>
   <div className="flex flex-wrap gap-2">{columns.map((column,i)=><div key={column.id} className="flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-xs">
    <span>{column.title} ({column.cardCount})</span>
    <button disabled={busy||i===0} aria-label={`Move ${column.title} left`} onClick={()=>void move(i,-1)}>←</button>
    <button disabled={busy||i===columns.length-1} aria-label={`Move ${column.title} right`} onClick={()=>void move(i,1)}>→</button>
    <button disabled={busy} onClick={async()=>{const name=prompt("Column title",column.title);if(name&&await send(`/api/boards/${boardId}/columns/${column.id}`,"PATCH",{title:name}))await refreshColumns();}}>Rename</button>
    <button disabled={busy||column.cardCount>0} className="text-red-400 disabled:opacity-30" title={column.cardCount>0?"Move cards first":"Delete column"} onClick={async()=>{if(confirm("Delete this empty column?")&&await send(`/api/boards/${boardId}/columns/${column.id}`,"DELETE"))await refreshColumns();}}>Delete</button>
   </div>)}</div>
   <form className="mt-3 flex max-w-sm gap-2" onSubmit={async e=>{e.preventDefault();if(await send(`/api/boards/${boardId}/columns`,"POST",{title})){setTitle("");await refreshColumns();}}}>
    <input required aria-label="New column title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="New column" className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"/>
    <button disabled={busy} className="rounded bg-blue-700 px-3 py-2 text-xs">Add column</button>
   </form>
   {error&&<p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
  </div>
 </section>;
}
