import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
env.allowLocalModels = false;
let extractorPromise;
let cachedKey = null;
let cachedVectors = null;
function status(message){ self.postMessage({type:'progress',message}); }
async function getExtractor(){
  if(!extractorPromise){
    extractorPromise=pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{
      dtype:'q8',
      progress_callback: info => {
        if(info.status==='progress' && info.file?.includes('onnx') && Number.isFinite(info.progress)) status(`Downloading the model… ${Math.round(info.progress)}%`);
        else if(info.status==='initiate') status('Downloading the model and runtime…');
      }
    });
  }
  return extractorPromise;
}
function dot(a,b){if(!a||!b||a.length!==b.length)throw new Error('Embedding dimensions do not match');let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*b[i];return sum;}
self.addEventListener('message',async event=>{
  const {id,query,passages}=event.data||{};
  try{
    if(typeof query!=='string'||!Array.isArray(passages)||passages.some(p=>!p||typeof p.noteId!=='string'||typeof p.text!=='string'||typeof p.excerpt!=='string')) throw new TypeError('Invalid search request');
    if(!passages.length){self.postMessage({type:'result',id,matches:[]});return;}
    const extractor=await getExtractor();
    const key=JSON.stringify(passages.map(p=>[p.noteId,p.text]));
    let vectors;
    if(key!==cachedKey){
      vectors=[];
      for(let start=0;start<passages.length;start+=8){
        status(`Reading passages locally… ${Math.min(start+8,passages.length)} / ${passages.length}`);
        const output=await extractor(passages.slice(start,start+8).map(p=>p.text),{pooling:'mean',normalize:true});
        vectors.push(...output.tolist());
      }
      cachedVectors=vectors;cachedKey=key;
    }else vectors=cachedVectors;
    status('Finding the closest fragments…');
    const result=await extractor([query],{pooling:'mean',normalize:true});
    const q=result.tolist()[0];
    const best=new Map();
    passages.forEach((p,i)=>{
      const score=dot(q,vectors[i]);
      if(!best.has(p.noteId)||score>best.get(p.noteId).score) best.set(p.noteId,{noteId:p.noteId,excerpt:p.excerpt,score});
    });
    self.postMessage({type:'result',id,matches:[...best.values()].sort((a,b)=>b.score-a.score).slice(0,3)});
  }catch(error){extractorPromise=null;cachedKey=null;cachedVectors=null;self.postMessage({type:'error',id,message:error instanceof Error?error.message:String(error)});}
});
