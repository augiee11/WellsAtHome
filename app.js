const $=id=>document.getElementById(id), ids=Array.from({length:96},(_,i)=>'ABCDEFGH'[Math.floor(i/12)]+(i%12+1)), colors=['#6836ac','#a25c28','#2658a7','#8c4375','#3b7e9c'];
let run,selected=[],table=false;
const fmt=x=>Number(x.toPrecision(5)).toLocaleString('en-US',{maximumFractionDigits:6});
function csv(text){
 const rows=text.trim().replace(/^\uFEFF/,'').split(/\r?\n/),head=rows.shift().toLowerCase().split(',').map(x=>x.trim()),w=head.indexOf('well'),t=head.indexOf('time_s'),v=head.indexOf('value'),wells={};
 if(w<0||v<0)throw Error('CSV needs well,value or well,time_s,value columns.');
 for(const [i,row] of rows.entries()){if(!row.trim())continue;const a=row.split(',').map(s=>s.trim()),id=(a[w]||'').toUpperCase(),x=t<0?0:Number(a[t]),y=Number(a[v]);if(!ids.includes(id)||!a[v]||(t>=0&&!a[t])||!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid measurement on CSV line '+(i+2));let series=wells[id]??=[];if(series.some(p=>p[0]===x))throw Error('Duplicate well and time on CSV line '+(i+2));series.push([x,y])}
 if(!Object.keys(wells).length)throw Error('CSV has no measurements.');Object.values(wells).forEach(p=>p.sort((a,b)=>a[0]-b[0]));return {wells,unit:'Signal',channel:'CSV'};
}
function bounds(series){let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(const a of series)for(const [x,y] of a){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}return [x0,x1,y0,y1]}
function coords(p,b,w,h,l=0,top=0){return p.map(([x,y])=>[l+w*(b[1]===b[0]?.5:(x-b[0])/(b[1]-b[0])),top+h*(b[3]===b[2]?.5:1-(y-b[2])/(b[3]-b[2]))])}
function path(a,color,width){return a.length===1?'<circle cx="'+a[0][0]+'" cy="'+a[0][1]+'" r="4" fill="'+color+'"/>':'<polyline points="'+a.map(p=>p.map(x=>x.toFixed(2)).join(',')).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" vector-effect="non-scaling-stroke"/>'}
let fits = {};
function calculateFits() {
  const start = $('start').valueAsNumber, end = $('end').valueAsNumber;
  const valid = Number.isFinite(start) && Number.isFinite(end) && start < end;
  fits = {};
  if (valid) for (const [id, points] of Object.entries(run.wells)) {
    fits[id] = initialVelocity(points, [start, end]);
  }
  $('exportVelocities').disabled = !valid;
  $('copyVelocities').disabled = !valid;
  $('saveStatus').textContent = '';
  $('pasteResults').hidden = true;
  $('fitNote').textContent = valid ? 'Linear fit · ' + run.unit + '/min' : (!Number.isFinite(start) || !Number.isFinite(end) ? 'Enter a time range to calculate the slope.' : 'Start must be earlier than end.');
}
function describeFit(id) {
  const fit = fits[id];
  if (!fit) return '—';
  if (fit.slope === null) return 'Unavailable (' + fit.count + ' reads in window)';
  return fmt(fit.slope) + ' ' + run.unit + '/min · ' + fit.count + ' reads · ' + fmt(fit.first) + '–' + fmt(fit.last) + ' min';
}
function draw(){const g=$('grid'),b=bounds(Object.values(run.wells));g.replaceChildren();for(const h of ['',...Array.from({length:12},(_,i)=>i+1)])g.append(Object.assign(document.createElement('b'),{textContent:h}));
 for(const id of ids){if(id.slice(1)==='1')g.append(Object.assign(document.createElement('b'),{textContent:id[0]}));const btn=document.createElement('button'),p=run.wells[id]||[];btn.className='well';btn.title=id+' · '+p.length+' readings';btn.setAttribute('aria-label',btn.title);btn.setAttribute('aria-pressed',selected.includes(id));if ($('mode').value === 'velocity') {
 const fit = fits[id]; btn.textContent = fit?.slope != null ? fmt(fit.slope) : '—';
 btn.title = id + ' · Initial velocity ' + describeFit(id); btn.setAttribute('aria-label',btn.title);
 } else if(p.length>1&&$('mode').selectedIndex===0)btn.innerHTML='<svg viewBox="0 0 100 32" preserveAspectRatio="none">'+path(coords(p,b,96,28,2,2),'#7145ad',1.6)+'</svg>';else btn.textContent=p.length?fmt(p.at(-1)[1]):'—';
 btn.onclick=()=>{if(!$('compare').checked)selected=[id];else if(selected.includes(id))selected=selected.filter(k=>k!==id);else selected.push(id);draw();g.querySelector('[aria-label^="'+id+' ·"]').focus()};g.append(btn)}
 $('selectAll').disabled = selected.length === ids.length;
 $('deselectAll').disabled = selected.length === 0;
 inspect()}
function inspect(){const sets=selected.map(id=>run.wells[id]||[]),any=sets.some(a=>a.length);$('title').textContent=selected.length===1?'Well '+selected[0]:selected.length+' wells selected';$('legend').replaceChildren();selected.forEach((id,i)=>{let el=document.createElement('b');el.style.color=colors[i%colors.length];el.textContent='● '+id+' · '+sets[i].length+' reads | Initial velocity '+describeFit(id);$('legend').append(el)});$('switch').textContent=table?'Show plot':'Show readings';$('export').disabled=!any;const d=$('detail');if(!any){d.textContent=selected.length?'No readings in this selection.':'Select a well on the plate.';return}
 if(table){d.innerHTML='<table><thead><tr><th>Well</th><th>Time (s)</th><th>Reading ('+run.unit+')</th></tr></thead><tbody>'+sets.map((s,i)=>s.map(([x,y])=>'<tr><td>'+selected[i]+'</td><td>'+x+'</td><td>'+y+'</td></tr>').join('')).join('')+'</tbody></table>';return}
 const b=bounds(sets),w=810,h=145,l=77,top=25;let svg='<svg viewBox="0 0 920 220" role="img" aria-label="Selected well readings over time"><g font-family="system-ui" font-size="11" fill="#64576f"><text x="8" y="13">'+run.unit+'</text>';
 const first=b[0]/60, last=b[1]/60, span=last-first;
 const xAt=minute=>span ? l+(minute-first)*w/span : l+w/2;
 const from=Math.max(first,$('start').valueAsNumber), to=Math.min(last,$('end').valueAsNumber);
 if(to>from) svg+='<rect x="'+xAt(from)+'" y="'+top+'" width="'+(xAt(to)-xAt(from))+'" height="'+h+'" fill="#ebdffa"/>';
 for(let i=0;i<=4;i++){
   const y=top+h*i/4;
   svg+='<path d="M'+l+' '+y+'h'+w+'" stroke="#e8e4ed"/><text x="65" text-anchor="end" y="'+(y+4)+'">'+fmt(b[3]-(b[3]-b[2])*i/4)+'</text>';
 }
 const step=span<5 ? span/4 : 5*Math.max(1,Math.ceil(span/120));
 const ticks=[];
 if(span===0) ticks.push(first);
 else if(span<5) for(let i=0;i<=4;i++) ticks.push(first+step*i);
 else for(let i=Math.ceil(first/step);i<=Math.floor(last/step);i++) ticks.push(i*step);
 for(const minute of ticks){
   const x=xAt(minute);
   svg+='<path d="M'+x+' '+top+'v'+h+'" stroke="#d9d2e3" stroke-dasharray="2 3"/><text x="'+x+'" y="190" text-anchor="middle">'+fmt(minute)+'</text>';
 }
 d.innerHTML=svg+'<text x="480" y="213" text-anchor="middle">Elapsed time (min)</text></g>'+sets.map((s,i)=>path(coords(s,b,w,h,l,top),colors[i%colors.length],2)).join('')+'</svg>'}
function load(r,name){run=r;selected=[Object.keys(r.wells)[0]];table=false;$('start').value='';$('end').value='';
 $('analysisPanels').hidden=false;$('loadHeading').textContent='Current experiment';$('name').textContent=name;calculateFits();$('meta').textContent=Object.keys(r.wells).length+' / 96 wells   ·   '+r.channel+'   ·   '+r.unit+'   ·   Shared plate axes';$('error').textContent='';draw()}
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{load(/\.csv$/i.test(f.name)?csv(await f.text()):decodeXpt(await f.arrayBuffer()),f.name)}catch(err){$('error').textContent=err.message}e.target.value=''};
$('mode').onchange=()=>run&&draw();$('compare').onchange=()=>{if(run&&!$('compare').checked){selected=selected.slice(-1);draw()}};$('switch').onclick=()=>{if(run){table=!table;inspect()}};$('export').onclick=()=>{const data=['well,time_s,value',...selected.flatMap(id=>(run.wells[id]||[]).map(p=>[id,...p].join(',')))].join('\n');saveResult('selected-wells.csv','text/csv','.csv',()=>new Blob([data],{type:'text/csv'}))};

function changeFit() {
  if (!run) return;
  calculateFits();
  draw();
}
$('start').oninput = changeFit;
$('end').oninput = changeFit;

async function saveResult(filename, mime, extension, makeFile) {
  const status = $('saveStatus');
  status.textContent = 'Preparing ' + filename;
  try {
    let handle;
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        handle = await window.showSaveFilePicker({suggestedName: filename,
          types: [{description: extension === '.xlsx' ? 'Excel workbook' : 'CSV file', accept: {[mime]: [extension]}}]});
      } catch (error) {
        if (!['SecurityError', 'NotAllowedError'].includes(error.name)) throw error;
      }
    }
    const file = await makeFile();
    if (handle) {
      const writer = await handle.createWritable();
      await writer.write(file);
      await writer.close();
      status.textContent = 'Saved ' + handle.name;
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = filename;
    link.textContent = 'Download ' + filename;
    status.replaceChildren('Download requested. If needed, use this link: ', link);
    link.click();
    const oldUrl = link.href;
    const observer = new MutationObserver(() => {
      if (!link.isConnected) {
        observer.disconnect();
        setTimeout(() => URL.revokeObjectURL(oldUrl), 60000);
      }
    });
    observer.observe(status, {childList:true});
  } catch (error) {
    status.textContent = error.name === 'AbortError' ? 'Save canceled.' : 'Could not save the file. ' + error.message;
  }
}

$('exportVelocities').onclick = () => {
  const name = $('name').textContent;
  const start = $('start').valueAsNumber, end = $('end').valueAsNumber;
  const data = fits, unit = run.unit;
  const filename = name.replace(/\.[^.]+$/, '') + '_velocities_' + start + '-' + end + 'min.xlsx';
  saveResult(filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx',
    () => velocityWorkbook(name, unit, start, end, ids, data));
};

$('copyVelocities').onclick = async () => {
  const rows = velocityRows(run.unit, $('start').valueAsNumber, $('end').valueAsNumber, ids, fits);
  const text = rows.map(row => row.join('\t')).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    $('saveStatus').textContent = 'Copied 96 wells. Paste into Excel.';
  } catch {
    const area = $('pasteResults');
    area.value = text;
    area.hidden = false;
    area.focus();
    area.select();
    $('saveStatus').textContent = 'Results selected. Press Ctrl+C or ⌘C, then paste into Excel.';
  }
};
$('selectAll').onclick = () => {
  $('compare').checked = true;
  selected = [...ids];
  draw();
};
$('deselectAll').onclick = () => {
  selected = [];
  draw();
};
