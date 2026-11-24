import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
const url = Deno.env.get('SUPABASE_URL')!;
const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const secret = keys.default || Object.values(keys)[0] || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const db = createClient(url, String(secret), {auth:{persistSession:false,autoRefreshToken:false}});
const bucket = db.storage.from('connect-banners');
const cats = ['Alimentação','Beleza e estética','Comércio','Construção e reformas','Educação','Eventos','Moda e acessórios','Saúde e bem-estar','Serviços profissionais','Tecnologia','Transporte','Outros'];
const origins = new Set((Deno.env.get('CONNECT_ORIGINS') || 'https://universidadekerigma.com.br,https://www.universidadekerigma.com.br,https://connect.universidadekerigma.com.br,https://uniteke2026.github.io,http://localhost:8000,http://127.0.0.1:8000').split(',').map(s=>s.trim()));
class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
function fail(status:number,msg:string):never {throw new HttpError(status,msg)}
function checked<T>(r:{data:T,error:any}):T {if(r.error){console.error('Connect backend:',r.error.code||r.error.message); if(r.error.code==='23505')fail(409,'Já existe um negócio com esse nome e WhatsApp.'); fail(500,'Não foi possível concluir a operação.');}return r.data;}
function str(v:unknown,min:number,max:number,label:string){if(typeof v!=='string')fail(400,'Informe '+label+'.'); const s=v.trim(); if(s.length<min||s.length>max)fail(400,'Confira '+label+'.'); return s;}
function id(v:unknown){const s=str(v,36,36,'o identificador');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))fail(400,'Identificador inválido.');return s;}
function fields(d:any){const category=str(d.category,1,60,'a categoria');if(!cats.includes(category))fail(400,'Categoria inválida.'); const whatsapp=str(d.whatsapp,12,13,'o WhatsApp');if(!/^55[1-9][0-9]{9,10}$/.test(whatsapp))fail(400,'WhatsApp inválido.');const instagram=str(d.instagram??'',0,30,'o Instagram');if(!/^[A-Za-z0-9_.]*$/.test(instagram))fail(400,'Instagram inválido.');return {student:str(d.student,2,120,'o nome do aluno'),name:str(d.name,2,100,'o nome comercial'),category,description:str(d.description??'',0,280,'a descrição'),whatsapp,instagram};}
function parseBanner(s:unknown){if(typeof s!=='string'||s.length>7_000_100)fail(400,'Banner inválido ou maior que 5 MB.');const m=s.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);if(!m)fail(400,'Formato de banner inválido.');let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0))}catch{fail(400,'Imagem inválida.')}if(bytes.length>5242880||bytes.length<12)fail(400,'Tamanho de imagem inválido.');const a=bytes;const png=a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71&&a[4]===13&&a[5]===10&&a[6]===26&&a[7]===10;const jpg=a[0]===255&&a[1]===216&&a[2]===255&&a[a.length-2]===255&&a[a.length-1]===217;const webp=String.fromCharCode(...a.slice(0,4))==='RIFF'&&String.fromCharCode(...a.slice(8,12))==='WEBP';if(!(m[1]==='image/png'&&png||m[1]==='image/jpeg'&&jpg||m[1]==='image/webp'&&webp))fail(400,'O conteúdo não corresponde ao formato da imagem.');return {bytes,mime:m[1],ext:m[1].split('/')[1]};}
async function upload(b:ReturnType<typeof parseBanner>){const path=crypto.randomUUID()+'.'+b.ext;checked(await bucket.upload(path,b.bytes,{contentType:b.mime,upsert:false,cacheControl:'60'}));return path;}
async function remove(path:string){const r=await bucket.remove([path]);if(r.error)console.error('Falha de limpeza de banner',path);}
async function limit(scope:string,period:string,max:number){if(!checked(await db.rpc('connect_take_limit',{p_scope:scope,p_period:period,p_max:max})))fail(429,'Limite temporário atingido. Tente mais tarde.');}
async function admin(req:Request){const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token)fail(401,'Faça login novamente.');const {data,error}=await db.auth.getUser(token);if(error||!data.user)fail(401,'Sessão inválida ou expirada.');const user=data.user;const row=checked(await db.from('connect_admins').select('user_id').eq('user_id',user.id).maybeSingle());if(!row)fail(403,'Este usuário não tem acesso administrativo.');return user;}
async function banners(rows:any[],priv=false){if(!rows.length)return [];const signed=checked(await bucket.createSignedUrls(rows.map(x=>x.banner_path),300));const map=new Map((signed||[]).map((x:any)=>[x.path,x.signedUrl]));return rows.map(x=>{const {banner_path,student,consent_at,consent_version,active,created_at,...rest}=x;const base={...rest,banner:map.get(banner_path)||'',created:Date.parse(created_at)/1000};return priv?{...base,student,consent_at,consent_version,active}:base;});}
async function businessById(bid:string){const x=checked(await db.from('connect_businesses').select('*').eq('id',bid).maybeSingle());if(!x)fail(404,'Negócio não encontrado.');return x;}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');const cors:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'apikey, authorization, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};if(origin&&origins.has(origin))cors['Access-Control-Allow-Origin']=origin;
 const send=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
 if(origin&&!origins.has(origin))return send({error:'Origem não autorizada.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return send({error:'Método inválido.'},405);
 try{
   if(Number(req.headers.get('content-length')||0)>7_100_000)fail(413,'Envio muito grande.');const raw=await req.text();if(raw.length>7_100_000)fail(413,'Envio muito grande.');let d:any;try{d=JSON.parse(raw)}catch{fail(400,'JSON inválido.');}if(!d||typeof d!=='object'||Array.isArray(d))fail(400,'Dados inválidos.');const action=d.action;
   if(action==='businesses'){
    const rows=checked(await db.from('connect_businesses').select('id,name,category,description,whatsapp,instagram,banner_path,created_at').eq('active',true).order('created_at',{ascending:false}).limit(500));return send(await banners(rows));
   }
   if(action==='create'){
    if(d.consent!==true||d.website)fail(400,'Confira as regras e o consentimento.'); const code=Deno.env.get('CONNECT_STUDENT_CODE');if(code&&d.student_code!==code)fail(403,'Código de aluno inválido.'); const f=fields(d),img=parseBanner(d.banner);
    await limit('create-global-hour','hour',30);await limit('create-global-day','day',100);await limit('create-phone:'+f.whatsapp,'day',3);
    const path=await upload(img);const active=Deno.env.get('CONNECT_REQUIRE_APPROVAL')!=='true';try{const row=checked(await db.from('connect_businesses').insert({...f,banner_path:path,active}).select('id').single());return send({id:row.id,pending:!active},201);}catch(e){await remove(path);throw e;}
   }
   if(action==='report'){
    const bid=id(d.id),reason=str(d.reason,3,500,'o motivo');const b=await businessById(bid);if(!b.active)fail(404,'Negócio não encontrado.');await limit('report-global-hour','hour',60);await limit('report-business:'+bid,'hour',8);checked(await db.from('connect_reports').insert({business_id:bid,reason}));return send({ok:true});
   }
   const user=await admin(req);
   if(action==='admin'){
    const rows=checked(await db.from('connect_businesses').select('*').order('created_at',{ascending:false}).limit(1000));const reports=checked(await db.from('connect_reports').select('*,connect_businesses(name)').order('created_at',{ascending:false}).limit(1000));return send({username:user.email,businesses:await banners(rows,true),reports:reports.map((r:any)=>({id:r.id,reason:r.reason,resolved:r.resolved,created:Date.parse(r.created_at)/1000,business_name:r.connect_businesses?.name||'Negócio'}))});
   }
   if(action==='admin/status'){if(typeof d.active!=='boolean')fail(400,'Status inválido.');const bid=id(d.id);await businessById(bid);checked(await db.from('connect_businesses').update({active:d.active}).eq('id',bid));return send({ok:true});}
   if(action==='admin/report'){checked(await db.from('connect_reports').update({resolved:true}).eq('id',id(d.id)));return send({ok:true});}
   if(action==='admin/delete'){const bid=id(d.id),old=await businessById(bid);checked(await db.from('connect_businesses').delete().eq('id',bid));await remove(old.banner_path);return send({ok:true});}
   if(action==='admin/edit'){const bid=id(d.id),old=await businessById(bid),f=fields(d);const path=d.banner?await upload(parseBanner(d.banner)):old.banner_path;try{checked(await db.from('connect_businesses').update({...f,banner_path:path}).eq('id',bid));}catch(e){if(path!==old.banner_path)await remove(path);throw e;}if(path!==old.banner_path)await remove(old.banner_path);return send({ok:true});}
   fail(404,'Operação inexistente.');
 }catch(e){if(e instanceof HttpError)return send({error:e.message},e.status);console.error('Connect error',e instanceof Error?e.message:'unknown');return send({error:'Erro interno. Tente novamente.'},500);}
});
