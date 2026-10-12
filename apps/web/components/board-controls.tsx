"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
export function BoardControls({projectId,boards,canManage}:{projectId:string;boards:{id:string;title:string}[];canManage:boolean}){
 const router=useRouter();const [title,setTitle]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function request(url:string,method:string,body?:object){
  setBusy(true);setError("");
  try{
   const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
   if(!response.ok)throw new Error((await response.json()).error??"Request failed");
   router.refresh();return true;
  }catch(e){setError(e instanceof Error?e.message:"Request failed");return false;}finally{setBusy(false);}
 }
 async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();if(await request(`/api/projects/${projectId}/boards`,"POST",{title}))setTitle("");}
 return <div className="mt-4 space-y-2">
  {boards.map(board=><div key={board.id} className="flex items-center gap-2">
   <a href={`/boards/${board.id}`} className="min-w-0 flex-1 truncate rounded-md bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700">{board.title}</a>
   {canManage&&<><button disabled={busy} title="Rename board" onClick={()=>{const name=prompt("Board name",board.title);if(name&&name.trim()!==board.title)void request(`/api/boards/${board.id}`,"PATCH",{title:name});}} className="text-xs text-neutral-400">Rename</button><button disabled={busy} title="Delete board" onClick={()=>{if(confirm("Permanently delete this board and its cards?"))void request(`/api/boards/${board.id}`,"DELETE");}} className="text-xs text-red-400">Delete</button></>}
  </div>)}
  {canManage&&<form onSubmit={create} className="flex gap-2 pt-2"><input aria-label="New board title" required minLength={2} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="New board" className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-2 text-xs"/><button disabled={busy} className="rounded bg-blue-700 px-3 text-xs disabled:opacity-50">Add</button></form>}
  {error&&<p role="alert" className="text-xs text-red-400">{error}</p>}
 </div>;
}
