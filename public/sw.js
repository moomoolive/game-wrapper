"use strict";(()=>{var g="app-v1";var e=globalThis.self,c=e.location.origin+"/",a=c+"__sw-config__.json",o={log:!0,savedAt:-1},l=caches.open(g).then(async t=>{let s=await t.match(a);if(!s)return f(Promise.resolve(t)),t;let n=await s.json();return o.log=n.log??!0,o.savedAt=n.savedAt||-1,t}),f=async t=>(o.savedAt=Date.now(),(await t).put(a,new Response(JSON.stringify(o),{status:200,statusText:"OK"}))),d=async(t,s,n="all")=>{let p=n==="all"||!n?await e.clients.matchAll({}):(r=>r?[r]:[])(await e.clients.get(n));for(let r of p)r.postMessage({type:t,contents:s})},i=(t,s="all",n=!1)=>{if(!o.log||n)return d("info",t,s)},h=(t,s="all")=>d("error",t,s);e.oninstall=t=>t.waitUntil(e.skipWaiting());e.onactivate=t=>{t.waitUntil((async()=>{await e.clients.claim(),i("{\u{1F4E5} install} new script installed","all",!0),i(`{\u{1F525} activate} new script in control, started with args: silent_log=${o.log}`,"all",!0)})())};var w=t=>new Response("",{status:500,statusText:"Internal Server Error",headers:{"Sw-Net-Err":String(t)||"1"}}),y=async t=>{try{return await fetch(t.request)}catch(s){let n=await(await l).match(t.request);return!n||!n.ok?w(s):n}},A=async t=>{let s=await(await l).match(t.request);if(s&&s.ok)return s;try{return await fetch(t.request)}catch(n){return w(n)}};e.onfetch=t=>{t.request.url===c?t.respondWith(y(t)):t.respondWith(A(t))};var u={"config:silent_logs":()=>{o.log=!0},"config:verbose_logs":()=>{o.log=!1},"list:consts":t=>{i(`listed constants: config_file_url=${a}, ROOT_DOC=${c}`,t,!0)},"list:connected_clients":async t=>{let s=await e.clients.matchAll();i(`connected clients (${s.length}): ${s.map(n=>`(id=${n.id||"unknown"}, url=${n.url}, type=${n.type})
`).join(",")}`,t,!0)},"list:config":t=>{i(`config: ${JSON.stringify(o)}`,t,!0)}};e.onmessage=async t=>{let s=t.data,n=t.source.id;if(!u[s?.action]){h(`received incorrectly encoded message ${t.data}`,n);return}await u[s.action](n),s.action.startsWith("config:")&&(f(l),i(`persisted new config @ ${a}`))};})();
