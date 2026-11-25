/* UNITEKE Connect — galeria vertical, imagens comprimidas antes do envio. */
function connectImages(record){return Array.isArray(record.images)&&record.images.length?record.images.slice(0,5):record.banner?[record.banner]:[];}
function storyCarousel(record){
  const images=connectImages(record), root=document.createElement('div'); root.className='story-carousel';root.setAttribute('role','region');root.setAttribute('aria-label','Fotos de '+record.name);
  const img=document.createElement('img');img.className='story-image';img.loading='lazy';img.decoding='async';
  const fallback=document.createElement('div');fallback.className='story-fallback';fallback.textContent='Imagem indisponível. Atualize a página para tentar novamente.';fallback.hidden=true;
  const progress=document.createElement('div');progress.className='story-progress';const count=document.createElement('span');count.className='story-counter';count.setAttribute('aria-live','polite');
  const makeButton=(text,label,cls)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.setAttribute('aria-label',label);return b;};
  const prev=makeButton('‹','Foto anterior','story-arrow story-prev'),next=makeButton('›','Próxima foto','story-arrow story-next');
  let index=0;const dots=images.map((_,i)=>{const b=makeButton('','Foto '+(i+1),'');b.addEventListener('click',()=>show(i));progress.append(b);return b;});
  function show(i){if(!images.length){fallback.hidden=false;img.hidden=true;return;}index=Math.max(0,Math.min(images.length-1,i));fallback.hidden=!!images[index];img.hidden=!images[index];if(images[index]){img.alt=record.name+' — foto '+(index+1)+' de '+images.length;img.src=images[index];}else img.removeAttribute('src');dots.forEach((d,j)=>{d.classList.toggle('current',j===index);d.setAttribute('aria-current',j===index?'true':'false')});prev.disabled=index===0;next.disabled=index===images.length-1;count.textContent=(index+1)+' / '+images.length;}
  img.addEventListener('error',()=>{fallback.hidden=false;});img.addEventListener('load',()=>{fallback.hidden=true;});prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);
  root.append(img,fallback);if(images.length>1)root.append(progress,prev,next,count);
  let startX=0,startY=0;root.addEventListener('touchstart',e=>{if(e.touches.length===1){startX=e.touches[0].clientX;startY=e.touches[0].clientY;}},{passive:true});root.addEventListener('touchend',e=>{const t=e.changedTouches[0];if(!t)return;const dx=t.clientX-startX,dy=t.clientY-startY;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.4)show(index+(dx<0?1:-1));},{passive:true});
  root.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show(index+(e.key==='ArrowRight'?1:-1));}});if(images.length>1)root.tabIndex=0;show(0);return root;
}
async function connectPrepareImage(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Cada foto deve ser JPG, PNG ou WebP de até 5 MB.');
  const url=URL.createObjectURL(file);let img=new Image();try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível abrir uma das imagens.'));img.src=url;});
    if(!img.naturalWidth||!img.naturalHeight)throw Error('Imagem inválida.');
    let scale=Math.min(1,1920/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');if(!ctx)throw Error('Não foi possível preparar a imagem.');
    for(let attempt=0;attempt<7;attempt++){canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);for(const quality of [.88,.75,.6,.45]){const data=canvas.toDataURL('image/jpeg',quality);if(data.startsWith('data:image/jpeg;')&&data.length<=1150000)return data;}scale*=.75;}
    throw Error('Não foi possível reduzir uma das imagens.');
  }finally{URL.revokeObjectURL(url);}
}
function connectGalleryPicker(input,preview,status){
  let items=[],busy=false,revision=0;
  const msg=(s,error=false)=>{status.textContent=s;status.dataset.error=String(error);};
  function render(){preview.replaceChildren();items.forEach((item,i)=>{const div=document.createElement('div');div.className='gallery-thumb';const img=document.createElement('img');img.src=item.src;img.alt='Foto '+(i+1);const label=document.createElement('small');label.textContent=i===0?'1 · Capa':String(i+1);const controls=document.createElement('div');controls.className='gallery-tools';const button=(text,aria,disabled,handler)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',aria);b.disabled=busy||disabled;b.onclick=handler;return b;};const swap=(j)=>{[items[i],items[j]]=[items[j],items[i]];render();};controls.append(button('‹','Mover foto '+(i+1)+' para trás',i===0,()=>swap(i-1)),button('›','Mover foto '+(i+1)+' para frente',i===items.length-1,()=>swap(i+1)),button('×','Remover foto '+(i+1),false,()=>{items.splice(i,1);render();}));div.append(img,label,controls);preview.append(div);});input.disabled=busy||items.length>=5;if(!busy)msg(items.length+' de 5 fotos. A primeira será a capa.');}
  input.onchange=async()=>{const files=Array.from(input.files||[]);input.value='';if(!files.length||busy)return;if(items.length+files.length>5){msg('Escolha no máximo 5 imagens no total.',true);return;}const current=++revision;busy=true;render();msg('Preparando imagens…');try{const added=[];for(const file of files){const data=await connectPrepareImage(file);added.push({src:data,value:data});}if(current===revision)items.push(...added);}catch(e){if(current===revision){busy=false;render();msg(e.message,true);return;}}finally{if(current===revision&&busy){busy=false;render();}}};
  render();return {reset(existing=[]){revision++;busy=false;items=existing.map((src,i)=>({src,value:i}));input.value='';render();},values(allowEmpty=false){if(busy)throw Error('Aguarde o processamento das fotos.');if(!allowEmpty&&!items.length)throw Error('Adicione pelo menos uma foto.');return items.map(x=>x.value);}};
}

function bindListingForm(form){
 const type=form.elements.listing_type,cat=form.elements.category,service=form.elements.service_type,vehicle=form.elements.vehicle;
 function sync(){const independent=type.value==='service',transport=independent&&cat.value==='Transporte';form.querySelector('[data-service-fields]').classList.toggle('hidden',!independent);form.querySelector('[data-vehicle-field]').classList.toggle('hidden',!transport);service.required=independent;service.disabled=!independent;vehicle.disabled=!transport;form.querySelector('[data-name-label]').textContent=independent?'Nome de divulgação':'Nome da empresa ou negócio';form.elements.name.placeholder=independent?'Ex.: João Silva ou João Motorista':'Ex.: Minha empresa';form.querySelector('[data-name-hint]').textContent=independent?'Use seu nome ou nome profissional. Não precisa ter empresa.':'Este será o nome exibido na vitrine.';form.querySelector('[data-gallery-label]').textContent=independent?'Fotos de divulgação (opcional, até 5)':'Fotos de divulgação (até 5)';if(independent&&transport)service.placeholder='Ex.: Motorista de aplicativo, traslados, viagens';else service.placeholder='Ex.: Eletricista, fotógrafo, designer';}
 type.addEventListener('change',()=>{if(type.value==='service'&&!cat.value)cat.value='Serviços profissionais';sync();});cat.addEventListener('change',sync);sync();return {sync};
}
function listingVisual(record){
 if(record.listing_type!=='service'||connectImages(record).length)return storyCarousel(record);
 const cover=document.createElement('div');cover.className='service-cover';const label=document.createElement('span');label.className='service-kicker';label.textContent='KERIGMA CONNECT';const icon=document.createElement('span');icon.className='service-monogram';icon.textContent=record.category==='Transporte'?'↗':(record.name||'S').trim().charAt(0).toUpperCase();icon.setAttribute('aria-hidden','true');const title=document.createElement('strong');title.textContent=record.name;const desc=document.createElement('span');desc.textContent=record.service_type||record.category;const region=document.createElement('small');region.textContent=record.service_area||'Profissional autônomo';cover.append(label,icon,title,desc,region);return cover;
}
function appendServiceDetails(parent,record){
 const rows=[];if(record.listing_type==='service'&&record.service_type)rows.push(['Serviço',record.service_type]);if(record.service_area)rows.push(['Atendimento',record.service_area]);if(record.listing_type==='service'&&record.vehicle)rows.push(['Veículo',record.vehicle]);if(!rows.length)return;const info=document.createElement('div');info.className='service-details';for(const [name,value] of rows){const row=document.createElement('div');const label=document.createElement('small');label.textContent=name;const content=document.createElement('span');content.textContent=value;row.append(label,content);info.append(row);}parent.append(info);
}
