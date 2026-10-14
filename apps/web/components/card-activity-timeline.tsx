"use client";
import {useCallback,useEffect,useState} from "react";
type Activity={id:string;cardId:string|null;cardTitle:string;action:string;details:unknown;createdAt:string;actor:{id:string;name:string}|null};
export function CardActivityTimeline({boardId}:{boardId:string}){
 const [items,setItems]=useState<Activity[]>([]);
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const load=useCallback(async(cursor?:string)=>{
  setBusy(true);setError("");
  try{
   const url=new URL(`/api/boards/${boardId}/activity`,window.location.origin);
   if(cursor)url.searchParams.set("cursor",cursor);
   const response=await fetch(url,{cache:"no-store"});
   if(!response.ok)throw new Error("Unable to load activity");
   const result=await response.json() as {activities:Activity[];nextCursor:string|null};
   setItems(previous=>cursor?[...previous,...result.activities]:result.activities);
   setNextCursor(result.nextCursor);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load activity");}
  finally{setBusy(false);}
 },[boardId]);
 useEffect(()=>{void Promise.resolve().then(()=>load());},[load]);
 return <section className="mx-auto max-w-[1440px] px-6 pb-12 text-neutral-100 md:px-10">
  <div className="rounded-lg border border-neutral-800 p-4">
   <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-medium">Activity history</h2><button type="button" disabled={busy} onClick={()=>void load()} className="text-xs text-blue-400 disabled:opacity-50">Refresh</button></div>
   {error&&<p role="alert" className="mb-3 text-xs text-red-400">{error}</p>}
   {!items.length&&!busy&&<p className="text-xs text-neutral-500">No activity recorded yet.</p>}
   <ol className="space-y-3">{items.map(item=><li key={item.id} className="border-l border-neutral-700 pl-3 text-xs">
    <div><span className="font-medium text-neutral-200">{item.actor?.name??"Former member"}</span> <span className="text-neutral-400">{item.action}</span> <span className="text-neutral-200">{item.cardTitle}</span></div>
    <time className="mt-1 block text-neutral-500" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
    {item.action==="updated"&&item.details&&typeof item.details==="object"&&<div className="mt-1 text-neutral-500">Fields changed: {Object.keys(item.details).join(", ")}</div>}
   </li>)}</ol>
   {nextCursor&&<button disabled={busy} type="button" onClick={()=>void load(nextCursor)} className="mt-4 rounded border border-neutral-700 px-3 py-2 text-xs disabled:opacity-50">Load older activity</button>}
  </div>
 </section>;
}