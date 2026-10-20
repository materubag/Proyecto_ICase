// Opt-in integration. DATABASE_URL from the user's application is never used.
require('./fixtures/offline.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const base=process.env.ICASE_TEST_DATABASE_URL;
test('isolated PostgreSQL: migrations, reanalysis, promotion, relations, rollback and history',{skip:!base?'Set ICASE_TEST_DATABASE_URL for a local isolated test database':false},async()=>{
  const url=new URL(base);
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname),'Only a local test database is allowed');
  assert.equal(url.pathname,'/icase_phase2_test','Only the dedicated test database is allowed');
  const schema='icase_phase2_'+crypto.randomBytes(8).toString('hex');url.searchParams.set('schema',schema);
  process.env.DATABASE_URL=url.toString();
  const legacy=fs.readFileSync(path.resolve(__dirname,'../prisma/schema.prisma'),'utf8')
    .replace(/^\s*canonicalKey\s+String\?\s*$/gm,'')
    .replace(/^\s*@@unique\(\[projectId, canonicalKey\]\)\s*$/gm,'')
    .replace('@@index([promotedRequirementId])','@@unique([promotedRequirementId])')
    .replace(/priority(\s+)RequirementPriority\?/g,'priority$1RequirementPriority @default(MEDIUM)');
  const dir=path.resolve(__dirname,'../.cache/phase2-postgres');fs.mkdirSync(dir,{recursive:true});
  const schemaFile=path.join(dir,schema+'.prisma');fs.writeFileSync(schemaFile,legacy);
  const push=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'db','push','--schema',schemaFile,'--skip-generate'],{env:process.env,encoding:'utf8'});
  assert.equal(push.status,0,push.stdout+push.stderr);
  const {PrismaClient}=require('@prisma/client');const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
  const prisma=require('../src/config/prisma');
  try{
    // Seed an actual row before migrations to prove data and priority survive.
    const project=await db.project.create({data:{name:'Isolated phase 2 fixture'}});
    const before=await db.$queryRawUnsafe('INSERT INTO requirements (id,"projectId",code,name,description,type,priority,status,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,\'FUNCTIONAL\',\'HIGH\',\'APPROVED\',now(),now()) RETURNING id',crypto.randomUUID(),project.id,'RF-900','Reviewed fixture','Human approved wording.');
    for(const migration of ['202610040001_requirement_identity','20261016000000_unknown_requirement_priority']){
      const sql=fs.readFileSync(path.resolve(__dirname,'../prisma/migrations',migration,'migration.sql'),'utf8');
      await db.$transaction(async tx=>{for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);});
    }
    const approved=await db.requirement.findUnique({where:{id:before[0].id}});
    assert.equal(approved.priority,'HIGH');assert.equal(approved.description,'Human approved wording.');
    const pdfBuffer=require('./fixtures/pdfFixture.cjs').pdf([['RF-001 Operador registra solicitudes.','RF-002 Confirmar solicitudes; requiere previamente RF-001.','RF-003 Archivar solicitudes; requiere previamente RF-004.','RF-004 Cerrar solicitudes.','RN-01 Solo se confirman solicitudes registradas.']]);
    const extracted=await require('../src/services/document/PdfExtractor').extractFromBuffer(pdfBuffer,'integration.pdf');
    const fileHash=crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const source=await db.source.create({data:{projectId:project.id,name:'integration.pdf',type:'PDF',fileHash}});
    const version=await db.sourceVersion.create({data:{sourceId:source.id,version:1,fileHash,extractedText:extracted.extractedText}});
    await db.source.update({where:{id:source.id},data:{currentVersionId:version.id}});
    const actor=await db.actor.create({data:{projectId:project.id,name:'Operador',status:'APPROVED',reviewStatus:'APPROVED'}});
    const providerInstance={async extractDocumentBatch({segments}){return {data:segments?{coveredSegmentIds:segments.map(s=>s.id),actors:[],requirements:[],other:[]}:{relationships:[]}};}};
    const pipeline=require('../src/services/analysis/analysisPipeline');
    const options={sourceId:source.id,providerOverride:'openai',modelOverride:'offline-fixture',providerInstance,cache:false};
    const first=await pipeline.run(options),again=await pipeline.run(options);
    assert.equal(first.extraction.requirements.length,4);assert.equal(again.cached,true);assert.equal(again.metrics.requestsUsed,0);
    assert.equal(await db.requirementCandidate.count({where:{projectId:project.id}}),4);
    const candidates=await db.requirementCandidate.findMany({where:{projectId:project.id},orderBy:{temporaryCode:'asc'}});
    const store=require('../src/services/analysis/extractionStore');
    const a=await db.$transaction(tx=>store.promote(tx,candidates[0]));
    const b=await db.$transaction(tx=>store.promote(tx,candidates[1]));
    assert.equal(a.promotedItem.priority,null);assert.equal(a.promotedItem.preconditions,null);
    assert.deepEqual(a.promotedItem.actorIds,[actor.id]);assert.deepEqual(b.promotedItem.dependencies,['RF-001']);
    assert.equal(a.promotedItem.sources.associations[0].role,'EXECUTOR');
    const late=await db.$transaction(tx=>store.promote(tx,candidates[2]));
    assert.equal(late.promotedItem.sources.dependencyStatus,'UNRESOLVED');
    await assert.rejects(require('../src/services/analysis/catalogIntegrity').assertProject(db,project.id),{code:'EXTRACTION_NEEDS_REVIEW'});
    await db.$transaction(tx=>store.promote(tx,candidates[3]));
    assert.deepEqual((await db.requirement.findUnique({where:{id:late.promotedItem.id}})).dependencies,['RF-004']);
    await Promise.all([pipeline.run(options),pipeline.run(options)]);
    assert.equal(await db.requirementCandidate.count({where:{projectId:project.id}}),4);
    const snapshot=JSON.stringify(await db.requirement.findUnique({where:{id:a.promotedItem.id}}));
    await assert.rejects(db.$transaction(async tx=>{await tx.requirement.update({where:{id:a.promotedItem.id},data:{description:'Must roll back'}});throw Error('forced rollback');}),/forced rollback/);
    assert.equal(JSON.stringify(await db.requirement.findUnique({where:{id:a.promotedItem.id}})),snapshot);
    await db.requirement.update({where:{id:a.promotedItem.id},data:{description:'Human-approved edited statement.'}});
    await pipeline.run({...options,force:true});
    assert.equal((await db.requirement.findUnique({where:{id:a.promotedItem.id}})).description,'Human-approved edited statement.');
    assert.equal(await db.requirement.count({where:{projectId:project.id}}),5);
    assert.ok(await db.requirementVersion.count({where:{requirementId:a.promotedItem.id}}));
    assert.ok(await db.artifactRelation.count({where:{projectId:project.id,fromType:'SourceVersion'}}));
    assert.ok(await db.modelCandidate.count({where:{projectId:project.id,kind:'BUSINESS_RULE'}}));
    await assert.rejects(db.requirementCandidate.create({data:{...Object.fromEntries(Object.entries(candidates[0]).filter(([key])=>!['id','createdAt','updatedAt'].includes(key))),id:crypto.randomUUID()}}),error=>error.code==='P2002');
    const file={originalname:'integration.pdf',mimetype:'application/pdf',size:pdfBuffer.length,buffer:pdfBuffer};
    const files=require('../src/services/file.service');
    const upload=await files.uploadFiles(project.id,[file]);
    const repeat=await files.uploadFiles(project.id,[file]);
    assert.equal(upload[0].id,repeat[0].id);
    assert.equal(await db.source.count({where:{projectId:project.id}}),1);
    assert.equal(await db.sourceVersion.count({where:{sourceId:source.id}}),2,'An older extraction is preserved and upgraded as a new version');
    assert.equal((await db.sourceVersion.findUnique({where:{id:version.id}})).extractedText,extracted.extractedText);
    const aggregate=await require('../src/services/ai/AIService').AIService.analyzeProject({projectId:project.id,description:'Se necesita una capacidad que no consta en el PDF.',providerOverride:'openai',modelOverride:'offline-fixture',providerInstance,cache:false});
    assert.equal(aggregate.requirements.length,4);assert.equal(aggregate.additionalCandidates.length,0);
    const semantic=JSON.parse(JSON.stringify(aggregate));
    const activeVersionId=(await db.source.findUnique({where:{id:source.id}})).currentVersionId;
    const relation={targetId:semantic.requirements[1].id,kind:'FUNCTIONAL',reason:'Documented relationship proposed for explicit human review.',evidence:semantic.requirements[1].evidence,status:'UNRESOLVED'};
    semantic.requirements[0].proposedRelations=[relation,{...relation,kind:'PREREQUISITE'},{...relation,targetId:semantic.requirements[3].id,kind:'PREREQUISITE'}];
    await store.persist(project.id,semantic,{sourceId:source.id,sourceVersionId:activeVersionId,snapshotKey:'semantic-review-fixture'});
    await assert.rejects(require('../src/services/analysis/catalogIntegrity').assertProject(db,project.id),{code:'EXTRACTION_NEEDS_REVIEW'});
    const proposals=await db.modelCandidate.findMany({where:{projectId:project.id,kind:'REQUIREMENT_RELATION'}});
    assert.equal(proposals.length,3);
    const reviewer=require('../src/services/analysis/candidate.service');
    const cyclic=proposals.find(p=>p.content.kind==='PREREQUISITE'&&p.content.targetId===semantic.requirements[1].id);
    await assert.rejects(reviewer.approve(cyclic.id),{code:'RELATION_REVIEW_INVALID'});
    assert.equal((await db.modelCandidate.findUnique({where:{id:cyclic.id}})).status,'PENDING_REVIEW');
    await reviewer.reject(cyclic.id,'Would create a prerequisite cycle.');
    const approvedRelation=await reviewer.approve(proposals.find(p=>p.content.kind==='FUNCTIONAL').id);
    assert.equal(approvedRelation.candidate.status,'APPROVED');
    assert.ok(approvedRelation.promotedItem.sources.relations.some(r=>r.status==='APPROVED'));
    const prerequisite=await reviewer.approve(proposals.find(p=>p.content.kind==='PREREQUISITE'&&p.content.targetId===semantic.requirements[3].id).id);
    assert.deepEqual(prerequisite.promotedItem.dependencies,['RF-004']);
    await require('../src/services/analysis/catalogIntegrity').assertProject(db,project.id);
    await db.requirement.update({where:{id:a.promotedItem.id},data:{description:'Changed after relation approval.'}});
    await assert.rejects(require('../src/services/analysis/catalogIntegrity').assertProject(db,project.id),{code:'EXTRACTION_NEEDS_REVIEW'});
    console.log(JSON.stringify({schema,preservedApproved:true,idempotent:true,migrations:2,firstRequests:first.metrics.requestsUsed,cachedRequests:again.metrics.requestsUsed,paidModelRequests:0,inputTokens:null,outputTokens:null}));
  }finally{await db.$disconnect();await prisma.$disconnect();}
});
