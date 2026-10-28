const STORAGE = 'ghostlight.notes.v1';
const $ = id => document.getElementById(id);
const examples = [
  {id:'example-1',title:'The desk lamp',body:'The first winter in our shared studio, the heating broke. We worked late under one warm desk lamp and passed a thermos of tea between us. The window turned dark long before our work was finished.'},
  {id:'example-2',title:'A tiny bicycle',body:'I was afraid of falling until my older cousin ran beside me down the empty street. I did not notice when they let go. At the corner I stopped, laughing and shaking, proud to be moving on my own.'},
  {id:'example-3',title:'The library note',body:'A folded paper slipped out of a secondhand book. Someone had written: “If you get lost, start with the part you can see.” I kept it above my desk through a difficult project.'},
  {id:'example-4',title:'The rain shelter',body:'We missed the last bus in the rain. A stranger made room under their umbrella while we looked up another route. They stayed until we knew which train to catch.'},
  {id:'example-5',title:'Midnight debugging',body:'The deadline was close and the program kept crashing. A teammate sat with me after dinner, asked one patient question, and helped me trace the error. We fixed it and celebrated with convenience-store ice cream.'},
  {id:'example-6',title:'The kitchen recipe',body:'A handwritten recipe card came with a box of mismatched cups. It said to add orange peel to the cake batter. Every time the kitchen smelled of citrus, everyone wandered in before it was ready.'}
];
let notes = loadNotes();
let worker = null;
let requestNumber = 0;
let busy = false;

function validNotes(value) {
  if (!Array.isArray(value) || value.length > 60) return null;
  const result=[];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || typeof entry.body !== 'string' || !entry.body.trim() || entry.body.length > 5000 || typeof entry.title !== 'string' || entry.title.length > 80) return null;
    result.push({id: crypto.randomUUID(), title: entry.title.trim(), body: entry.body.trim()});
  }
  return result;
}
function loadNotes() {
  try {
    const data=localStorage.getItem(STORAGE);
    if (data !== null) {
      const parsed=validNotes(JSON.parse(data));
      if (parsed) return parsed;
    }
  } catch (_) {}
  return examples.map(x=>({...x}));
}
function save() {
  try { localStorage.setItem(STORAGE,JSON.stringify(notes)); return true; }
  catch (_) { message('Could not save in this browser. Export a backup.'); return false; }
}
function message(value) { $('status-text').textContent=value; }
function clearResults() {
  const area=$('results'); area.replaceChildren();
  const empty=document.createElement('div'); empty.className='empty';
  const star=document.createElement('span'); star.textContent='✦';
  const p=document.createElement('p'); p.append('Your closest fragments',document.createElement('br'),'will appear here.');
  empty.append(star,p); area.append(empty);
}
function invalidateSearch() {
  if(busy){worker?.terminate();worker=null;busy=false;$('search-button').disabled=false;requestNumber++;}
  clearResults();
}
function render() {
  $('count').textContent=`${notes.length} ${notes.length===1?'note':'notes'}`;
  const list=$('notes'); list.replaceChildren();
  if (!notes.length) { const li=document.createElement('li'); li.className='note-body'; li.textContent='No fragments yet. Add one above.'; list.append(li); return; }
  notes.forEach((note,index)=>{
    const li=document.createElement('li'); li.className='note';
    const symbol=document.createElement('span'); symbol.className='note-symbol'; symbol.textContent='✧';
    const copy=document.createElement('div'); copy.className='note-copy';
    const title=document.createElement('div'); title.className='note-title'; title.textContent=note.title || 'Untitled fragment';
    const body=document.createElement('div'); body.className='note-body'; body.textContent=note.body;
    const remove=document.createElement('button'); remove.type='button'; remove.className='remove'; remove.textContent='×'; remove.setAttribute('aria-label',`Remove ${note.title || 'fragment '+(index+1)}`);
    remove.addEventListener('click',()=>{ notes=notes.filter(n=>n.id!==note.id);save();render();invalidateSearch(); });
    copy.append(title,body); li.append(symbol,copy,remove); list.append(li);
  });
}
function chunk(note) {
  const words=note.body.trim().split(/\s+/);
  const passages=[];
  for(let start=0;start<words.length;start+=90) {
    const part=words.slice(start,start+120).join(' ');
    passages.push({noteId:note.id,text:`${note.title ? note.title+'. ' : ''}${part}`,excerpt:part});
    if(start+120>=words.length) break;
  }
  return passages;
}
function displayResults(matches) {
  const area=$('results'); area.replaceChildren();
  for (const match of matches) {
    const note=notes.find(n=>n.id===match.noteId); if(!note) continue;
    const card=document.createElement('article'); card.className='result';
    const top=document.createElement('div'); top.className='result-top';
    const title=document.createElement('strong'); title.textContent=note.title || 'Untitled fragment';
    const score=document.createElement('small'); score.textContent=`similarity ${match.score.toFixed(2)}`;
    const excerpt=document.createElement('p'); excerpt.textContent=match.excerpt;
    top.append(title,score); card.append(top,excerpt); area.append(card);
  }
  if(!matches.length) message('No matches to show. Add a fragment first.');
}
function createWorker() {
  const w=new Worker('./worker.js',{type:'module'});
  w.addEventListener('message',event=>{
    const data=event.data;
    if(data.type==='progress') { message(data.message); return; }
    if(data.id!==requestNumber) return;
    if(data.type==='result') { displayResults(data.matches); message('Showing the closest passages. Similarity is not certainty.'); }
    if(data.type==='error') { message('Could not load or run the model. Check your connection and try again.'); console.error(data.message); w.terminate(); worker=null; }
    busy=false; $('search-button').disabled=false;
  });
  w.addEventListener('error',()=>{ message('Could not load the model. Check your connection and try again.');w.terminate();worker=null;busy=false;$('search-button').disabled=false; });
  return w;
}
$('note-form').addEventListener('submit',event=>{
  event.preventDefault(); const title=$('note-title').value.trim(), body=$('note-body').value.trim();
  if(!body)return;
  if(notes.length>=60){message('This small archive holds up to 60 notes. Export or remove one first.');return;}
  notes.unshift({id:crypto.randomUUID(),title,body}); const saved=save();render();invalidateSearch();$('note-form').reset();message(saved?'Fragment added.':'Fragment added for this session only. Export a backup.');
});
$('search-form').addEventListener('submit',event=>{
  event.preventDefault();const query=$('query').value.trim();if(!query||busy)return;
  if(!notes.length){message('Add a fragment before searching.');return;}
  busy=true;$('search-button').disabled=true;message('Preparing local AI search…');
  if(!worker) worker=createWorker();
  worker.postMessage({id:++requestNumber,query,passages:notes.flatMap(chunk)});
});
$('reset').addEventListener('click',()=>{
  if(!confirm('Replace the current archive with the fictional examples? Export your notes first if you want a backup.'))return;
  notes=examples.map(x=>({...x}));const saved=save();render();invalidateSearch();message(saved?'Fictional examples restored.':'Examples restored for this session only.');
});
$('export').addEventListener('click',()=>{
  const file=new Blob([JSON.stringify({format:'ghostlight-v1',notes},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='ghostlight-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('import').addEventListener('change',async event=>{
  const file=event.target.files[0]; if(!file)return;
  try{
    if(file.size>400000)throw new Error('File too large');
    const parsed=JSON.parse(await file.text());
    const imported=parsed?.format==='ghostlight-v1' ? validNotes(parsed.notes) : null;
    if(!imported)throw new Error('Invalid file');
    if(!confirm('Replace this archive with the imported notes? Export a backup first if needed.'))return;
    notes=imported;const saved=save();render();invalidateSearch();message(saved?'Archive imported.':'Imported for this session only. Export a backup.');
  }catch(_){message('Import failed. Choose a valid Ghostlight JSON export under 400 KB.');}
  finally{event.target.value='';}
});
render();
