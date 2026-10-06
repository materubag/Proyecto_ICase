const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const rules = require('../document/RuleBasedExtractor');
const sectionsDetector = require('../document/SectionDetector');
const contract = require('./extractionContract');
const identity = require('./requirementIdentity');
const { locate } = require('./extractionEvidence');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stableId = (prefix, value) => `${prefix}-${hash(value).substring(0,20)}`;
const cacheDir = path.resolve(__dirname, '../../../.cache/document-extraction');

function segmentText(text, supplied = [], maxChars = 3000, cuts = []) {
  const sections = sectionsDetector.detectSections(text), segments = [];
  const offsets = new Set([0, text.length, ...cuts]);
  for (const s of sections) if (Number.isInteger(s.start)) offsets.add(s.start);
  for (const m of text.matchAll(/\n(?=\s*(?:(?:RF|RNF)[\s_-]*\d+\b|\n|[-*•]\s|\[PÁGINA\s+\d+\]))/gi)) offsets.add(m.index+1);
  let begin = 0;
  for (const boundary of [...offsets].sort((a,b)=>a-b)) {
    for (let start = begin; start < boundary;) {
      let end = Math.min(start+maxChars, boundary);
      if (end < boundary) { const newline = text.lastIndexOf('\n',end); if (newline > start+maxChars/2) end=newline+1; }
      const original = text.substring(start,end);
      if (original.trim()) {
        const pages=[...text.substring(0,start+1).matchAll(/\[PÁGINA\s+(\d+)\]/gi)];
        const src=supplied.find(s=>s.text?.includes(original.trim()));
        segments.push({ id:stableId('SEG',[hash(text),start,end]),text:original,originalText:original,start,end,
          page:src?.page??(pages.length?Number(pages.at(-1)[1]):null),
          section:sections.find(s=>start>=s.start&&start<s.end)?.title||'General',
          ...(src?{sourceSegmentId:src.id,startTime:src.startTime,endTime:src.endTime,speaker:src.speaker}:{}) });
      }
      start=end;
    }
    begin=boundary;
  }
  return segments;
}
function configuration(options={}) {
  const env=require('../../config/env');
  const provider=(options.providerOverride||options.provider||env.AI_PROVIDER||'gemini').toLowerCase();
  const model=options.modelOverride||options.model||(provider==='openai'?(env.OPENAI_MODEL||'gpt-5.4-nano'):(env.GEMINI_MODEL||'gemini-3.1-flash-lite'));
  return {provider,model,promptVersion:contract.PROMPT_VERSION};
}
function createProvider(name) {
  if(name==='openai') return new(require('../ai/OpenAIProvider'))();
  if(name==='gemini') return new(require('../ai/GeminiProvider'))();
  throw new Error(`El proveedor ${name} no implementa extracción documental.`);
}
async function extract(text,options={}) {
  const config=configuration(options);
  const sections=sectionsDetector.detectSections(text);
  const classifier=require('./statementClassifier');
  const objectives=classifier.objectives(text,sections);
  const local=[...rules.extractFunctionalRequirements(text,sections),...rules.extractNonFunctionalRequirements(text,sections)];
  const segments=segmentText(text,options.segments||[],3000,local.flatMap(r=>[r.start,r.end]));
  const documentHash=hash(text);
  const evidence = (item, extra=[]) => locate(item,[...segments,...extra]).map(s=>({...s,
    sourceFile:s.sourceFile||options.fileName, sourceId:s.sourceId||options.sourceId,
    sourceVersionId:s.sourceVersionId||options.sourceVersionId, documentHash:s.documentHash||documentHash }));
  let requirements=identity.consolidate(local.map(r=>{
    const parts=segments.filter(s=>s.start<r.end&&s.end>r.start);
    return {id:stableId('REQ',[r.type,r.text]),code:r.originalCode,originalCode:r.originalCode,
      name:r.text,description:r.text,statement:r.text,type:r.type,source:'explicit',extractionMethod:'LOCAL',section:r.section,context:{section:r.section,start:r.start,end:r.end},
      evidence:evidence({segmentIds:parts.map(s=>s.id),quote:r.sourceText}),segmentIds:parts.map(s=>s.id),
      associations:[],actorIds:[],pending:[],confidence:null,status:'PENDING_REVIEW'};
  }));
  for(const objective of objectives)for(const c of objective.capabilities){
    const ev=evidence({segmentIds:segments.filter(s=>s.start<c.end&&s.end>c.start).map(s=>s.id),quote:c.quote});
    const behavior=v=>identity.normalize(v).replace(/^(?:el sistema|la aplicaci[o\u00f3]n|la plataforma) (?:debe(?:r[a\u00e1])? permitir|permitir[a\u00e1]|permite|debe(?:r[a\u00e1])?)\s+/,'');
    const match=requirements.find(r=>behavior(r.statement)===behavior(c.statement)) || (options.knownRequirements||[]).find(r=>behavior(r.statement)===behavior(c.statement));
    if(match){let target=requirements.find(r=>r.id===match.id);if(!target){target={...match};requirements.push(target);}target.evidence=identity.unique([...(target.evidence||[]),...ev]);}
    else requirements.push({statement:c.statement,name:c.statement,description:c.statement,type:'FUNCTIONAL',originalCode:null,source:'explicit',extractionMethod:'LOCAL',evidence:ev,segmentIds:ev.map(s=>s.id),associations:[],actorIds:[],pending:['Capacidad mencionada en objetivo: revisar alcance'],status:'PENDING_REVIEW'});
  }
  requirements=identity.consolidate(requirements);
  const localRequirementCount=requirements.length;
  const previous=options.previousResult;
  if(previous)requirements=identity.consolidate([...requirements,...previous.requirements.filter(r=>classifier.classify(r.statement,r)!=='OBJECTIVE')]);
  const inherited=(options.knownRequirements||[]).filter(r=>classifier.classify(r.statement,r)!=='OBJECTIVE');
  const known=identity.consolidate([...requirements,...inherited]);
  for(const s of segments) s.mode=local.some(r=>s.start>=r.start&&s.end<=r.end)?'RELATIONSHIPS_ONLY':'UNRESOLVED';
  const actors=previous?JSON.parse(JSON.stringify(previous.actors)).filter(a=>require('./actorEvidence').classify(a)!=='PROJECT_CONTEXT'):[],other=previous?[...previous.other]:[],failures=[];
  for (const objective of objectives) other.push({...objective,type:'OBJECTIVE',source:'explicit',extractionMethod:'LOCAL',evidence:segments.filter(s=>s.start<objective.end&&s.end>objective.start).map(s=>({...s,quote:text.substring(Math.max(s.start,objective.start),Math.min(s.end,objective.end)),quoteStart:Math.max(s.start,objective.start),quoteEnd:Math.min(s.end,objective.end),sourceId:options.sourceId,sourceVersionId:options.sourceVersionId,documentHash}))});
  for(const profile of require('./actorEvidence').profiles(text,segments)){
    const id=stableId('ACT',[profile.name.trim().toLowerCase(),profile.kind]);
    const ev=evidence({segmentIds:[profile.segmentId],quote:profile.quote});
    const existing=actors.find(a=>a.id===id);
    if(existing){existing.evidence=identity.unique([...existing.evidence,...ev]);existing.classification='ROLE';existing.description=profile.description;delete existing.reviewStatus;delete existing.pending;}
    else actors.push({id,name:profile.name,description:profile.description,kind:profile.kind,source:'explicit',evidence:ev,classification:'ROLE'});
  }
  const coverage=segments.map(s=>({segmentId:s.id,requirementsStatus:s.mode==='RELATIONSHIPS_ONLY'?'LOCAL_RESOLVED':'PENDING',relationshipsStatus:'PENDING',status:'PENDING'}));
  const metrics={...config,requestsUsed:0,cacheHits:0,reusedSemanticBatches:0,localRequirements:localRequirementCount,usage:[]};
  let provider=options.providerInstance;
  try {
    if (config.provider === 'local' || options.mode === 'local') throw new Error('Modo local: relaciones pendientes; IA deshabilitada');
    provider=provider||createProvider(config.provider);
    if(typeof provider.extractDocumentBatch!=='function')throw new Error('Proveedor sin contrato de extracción');
  } catch(error) { provider={async extractDocumentBatch(){throw error;}}; }
  const globalContext=identity.unique([...(options.contextSegments||[]),...segments.filter(s=>/PERFILES|ACTORES|ROLES|FUERA DEL ALCANCE/i.test(s.section))]);
  const batches=[];let batch=[],chars=0;
  for(const s of segments) {
    if(batch.length&&(chars+s.text.length>12000||batch.length>=8)){batches.push(batch);batch=[];chars=0;}
    batch.push(s);chars+=s.text.length;
  }
  if(batch.length)batches.push(batch);
  for(const items of batches) {
    if(previous&&items.every(s=>previous.coverage.some(c=>c.segmentId===s.id&&c.status==='ANALYZED'))){
      metrics.reusedSemanticBatches++;
      for(const s of items){const c=coverage.find(c=>c.segmentId===s.id);c.status='ANALYZED';c.relationshipsStatus='ANALYZED';if(c.requirementsStatus==='PENDING')c.requirementsStatus='SEMANTIC_RESOLVED';}
      continue;
    }
    const first=segments.indexOf(items[0]),last=segments.indexOf(items.at(-1));
    const context=identity.unique([...globalContext,segments[first-1],segments[last+1]].filter(s=>s&&!items.some(i=>i.id===s.id)));
    // Summaries/objectives can repeat a requirement from any earlier section.
    const visibleKnown=known;
    const input={segments:items.map(s=>({id:s.id,text:s.text,section:s.section,mode:s.mode})),
      context:context.map(s=>({id:s.id,text:s.text,start:s.start,end:s.end})),
      knownActors:(options.knownActors || []).filter(a=>!a.isDeleted).map(a=>({id:a.id,name:a.name,aliases:a.aliases || [],description:a.description || ''})),
      knownRequirements:visibleKnown.map(r=>({id:r.id,code:r.originalCode,type:r.type,statement:r.statement,segmentIds:r.segmentIds}))};
    const cacheFile=path.join(options.cacheDir||cacheDir,`${hash([config,input])}.json`);
    try {
      let response;
      if(options.cache!==false){try{response=JSON.parse(await fs.readFile(cacheFile,'utf8'));contract.validate(response.data,items,context,visibleKnown);metrics.cacheHits++;}catch{response=null;}}
      if(!response){
        if(config.provider!=='local'&&options.mode!=='local')metrics.requestsUsed++;
        response=await provider.extractDocumentBatch(input,{model:config.model,batchIndex:batches.indexOf(items)+1});
        if(response?.usage)metrics.usage.push(response.usage);
        contract.validate(response?.data,items,context,visibleKnown);
        if(options.cache!==false)await fs.mkdir(path.dirname(cacheFile),{recursive:true}).then(()=>fs.writeFile(cacheFile,JSON.stringify({data:response.data}),'utf8')).catch(()=>{});
      }
      const actorMap=new Map();
      for(const a of response.data.actors){
        const id=stableId('ACT',[a.name.trim().toLowerCase(),a.kind]);
        const ev=evidence(a,context);
        const classification=require('./actorEvidence').classify({...a,evidence:ev});
        if(classification==='PROJECT_CONTEXT'){other.push({type:'CONTEXT',statement:a.name,reason:'Proveedor o participante del proyecto sin interaccion del sistema',evidence:ev});continue;}
        const existing=actors.find(x=>x.id===id);
        if(classification==='ROLE'||existing?.classification==='ROLE')actorMap.set(a.key,id);
        if(existing)existing.evidence=identity.unique([...existing.evidence,...ev]);
        else actors.push({id,name:a.name.trim(),kind:a.kind,classification,...(classification==='NEEDS_REVIEW'?{reviewStatus:'NEEDS_REVIEW',pending:['Menci?n gen?rica: confirmar responsabilidades y alcance del rol']}:{ }),source:a.explicit?'explicit':'inferred',evidence:ev});
      }
      const associations=list=>(list||[]).flatMap(a=>{
        const ev=evidence(a,context);
        if(!actorMap.has(a.actorKey)){other.push({type:'UNCERTAIN',reason:'Relación pendiente: actor sin evidencia de rol del sistema',actorKey:a.actorKey,evidence:ev});return [];}
        return [{actorId:actorMap.get(a.actorKey),role:a.role,evidence:ev}];
      });
      for(const link of response.data.links||[]){
        let target=requirements.find(r=>r.id===link.requirementId);
        if(!target){const inheritedReq=known.find(r=>r.id===link.requirementId);target={...inheritedReq};requirements.push(target);}
        target.associations=identity.unique([...target.associations,...associations([link])]);
        target.actorIds=[...new Set(target.associations.map(a=>a.actorId))];
      }
      for(const r of response.data.requirements){
        const ev=evidence(r,context), assoc=associations(r.associations);
        if (classifier.classify(r.statement, {section:ev[0]?.section}) === 'OBJECTIVE') { other.push({type:'OBJECTIVE',statement:r.statement,evidence:ev,source:'explicit'}); continue; }
        const exact=known.find(k=>identity.same(k,r));
        const matches=(r.matches||[]).map(id=>known.find(k=>k.id===id));
        // Returned coded proposals are reviews/links to the locally resolved item, not new requirements.
        const normalizeCode=code=>String(code||'').toUpperCase().replace(/[\s_–-]+/g,'');
        const coded=r.code?visibleKnown.filter(k=>normalizeCode(k.originalCode)===normalizeCode(r.code)):[];
        if(!exact&&!matches.length&&coded.length>1){
          other.push({type:'UNCERTAIN',reason:'Código compartido por varios requisitos: identificar el requisito antes de fusionar',
            statement:r.statement,proposedType:r.type,evidence:ev,possibleMatches:coded.map(k=>k.id)});continue;
        }
        const targets=exact?[exact]:matches.length?matches:coded;
        if(targets.length&&(r.relationship!=='INDEPENDENT'||exact||coded.length)){
          for(const match of targets){
            let target=requirements.find(k=>k.id===match.id);
            if(!target){target={...match};requirements.push(target);}
            target.evidence=identity.unique([...target.evidence,...ev]);
            target.associations=identity.unique([...target.associations,...assoc]);
            target.actorIds=[...new Set([...target.actorIds,...assoc.map(a=>a.actorId)])];
            if(r.relationship==='REFINEMENT'||(!exact&&!matches.length)){
              target.refinements=identity.unique([...(target.refinements||[]),{statement:r.statement,proposedType:r.type,explicit:r.explicit,evidence:ev}]);
              target.pending=identity.unique([...target.pending,'Revisar refinamiento o clasificación semántica sin reemplazar el original']);
            }
          }
          continue;
        }
        if(r.segmentIds.every(id=>segments.find(s=>s.id===id)?.mode==='RELATIONSHIPS_ONLY')){
          other.push({type:'UNCERTAIN',reason:'La IA propuso otro requisito en un bloque ya resuelto; revisar sin insertarlo',statement:r.statement,evidence:ev});continue;
        }
        requirements.push({statement:r.statement.trim().replace(/\s+/g,' '),name:r.statement.trim(),description:r.statement.trim(),type:r.type,
          originalCode:null,source:r.explicit?'explicit':'inferred',extractionMethod:'SEMANTIC',
          evidence:ev,segmentIds:ev.map(s=>s.id),associations:assoc,actorIds:assoc.map(a=>a.actorId),
          pending:r.pending,confidence:null,status:'PENDING_REVIEW'});
      }
      other.push(...response.data.other.map(r=>({...r,evidence:evidence(r,context)})));
      for(const s of items){const c=coverage.find(c=>c.segmentId===s.id);c.status='ANALYZED';c.relationshipsStatus='ANALYZED';if(c.requirementsStatus==='PENDING')c.requirementsStatus='SEMANTIC_RESOLVED';}
    }catch(error){
      if(error.usage)metrics.usage.push(error.usage);
      failures.push({segmentIds:items.map(s=>s.id),message:error.message});
      for(const s of items){const c=coverage.find(c=>c.segmentId===s.id);c.status='FAILED';c.relationshipsStatus='FAILED';if(c.requirementsStatus==='PENDING')c.requirementsStatus='FAILED';}
    }
  }
  requirements=identity.consolidate(requirements).map(r=>({...r,code:r.originalCode||r.id,
    pending:identity.unique([...r.pending,...(r.type==='FUNCTIONAL'&&!r.associations.length?['Responsable pendiente de revisión']:[])])}));
  const partial=failures.length>0;
  return {extractionVersion:contract.PROMPT_VERSION,architecture:{},project:{name:options.fileName||'Documento',description:''},rawText:text,
    objectives:identity.unique(other.filter(r=>r.type==='OBJECTIVE')),requirements,actors,other,businessRules:other.filter(r=>r.type==='BUSINESS_RULE'),segments,coverage,failures,partial,metrics,
    functionalRequirements:requirements.filter(r=>r.type==='FUNCTIONAL'),nonFunctionalRequirements:requirements.filter(r=>r.type==='NON_FUNCTIONAL'),
    entities:[],relationships:[],screens:[],navigation:[],statistics:{totalFragments:segments.length,aiFragments:coverage.filter(c=>c.status==='ANALYZED').length},
    documentAnalysis:{sourceFile:options.fileName,totalRequirements:requirements.length,totalActors:actors.length,aiAnalysisStatus:partial?'partial':'complete',...config}};
}
module.exports={extract,segmentText,configuration,createProvider};
