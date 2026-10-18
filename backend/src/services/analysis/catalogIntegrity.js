// Conservative document checks. Unknown information remains explicitly unresolved.
const normalizeCode = value => String(value || '').toUpperCase().replace(/[\s_–-]+/g, '');
function analyze(result) {
  const requirements = result.requirements || [], issues = [];
  if(result.partial)issues.push({code:'INCOMPLETE_ANALYSIS'});
  const actors = new Set((result.actors || []).map(a => a.id));
  const codes = new Map();
  for (const r of requirements) {
    if((r.originalCodes||[]).length>1)issues.push({code:'DUPLICATE_STATEMENT_CODES',requirementId:r.id,codes:r.originalCodes});
    for (const code of new Set([r.originalCode, ...(r.originalCodes || [])].filter(Boolean).map(normalizeCode))) {
      const entries = codes.get(code) || []; entries.push(r); codes.set(code, entries);
    }
  }
  for (const [code, rows] of codes) if (rows.length > 1) {
    issues.push({ code: 'CONFLICTING_CODE', originalCode: code, requirementIds: rows.map(r => r.id) });
    for (const r of rows) r.reviewStatus = 'NEEDS_REVIEW';
  }
  for (const r of requirements) {
    const statement = r.statement || r.description || '';
    r.businessRuleRefs=[];
    for(const ref of (r.declared?.businessRules||'').matchAll(/RN[ _-]*\d+/gi)){
      const rule=(result.businessRules||[]).find(b=>normalizeCode(b.code)===normalizeCode(ref[0]));
      if(rule)r.businessRuleRefs.push({code:rule.code,evidence:rule.evidence});
      else issues.push({code:'INVALID_BUSINESS_RULE_REFERENCE',requirementId:r.id,reference:ref[0]});
    }
    if(!r.evidence?.length||r.evidence.some(e=>!e.quote?.trim()))issues.push({code:'MISSING_EVIDENCE',requirementId:r.id});
    r.preconditions ??= null; r.postconditions ??= null; r.priority ??= null;
    r.behavior = /^(?:el sistema|la aplicaci[oó]n|la plataforma)\s+.*autom[aá]tic/i.test(statement) ? 'SYSTEM_BEHAVIOR' : null;
    if (!statement.trim() || /(?:[,;:]|\b(?:de|con|para|y|o|mediante))\s*$/i.test(statement) || r.extractionIssues?.length) {
      r.reviewStatus = 'NEEDS_REVIEW';
      issues.push({ code: 'INCOMPLETE_EXTRACTION', requirementId: r.id });
    }
    if (!['FUNCTIONAL', 'NON_FUNCTIONAL'].includes(r.type)) issues.push({ code: 'INVALID_TYPE', requirementId: r.id });
    if(r.originalCode&&(/^RNF/i.test(r.originalCode)?r.type!=='NON_FUNCTIONAL':/^RF/i.test(r.originalCode)&&r.type!=='FUNCTIONAL'))issues.push({code:'ORIGINAL_TYPE_CONFLICT',requirementId:r.id});
    for (const a of r.associations || []) if (!actors.has(a.actorId) || !['EXECUTOR','PARTICIPANT','RECIPIENT','VIEWER'].includes(a.role)||!a.evidence?.length||a.evidence.some(e=>!e.quote?.trim())) issues.push({ code: 'INVALID_ASSOCIATION', requirementId: r.id, actorId: a.actorId });
    r.actorAnalysisStatus = (r.associations || []).length || r.behavior ? 'ANALYZED' : 'UNRESOLVED';
  }
  require('./dependencyResolver').resolve(requirements,codes,issues);
  result.validation = { status: issues.length ? 'NEEDS_REVIEW' : 'ANALYZED', canGenerate: !issues.length, issues };
  return result;
}
function assertValid(result) {
  const report = analyze(result).validation;
  if (!report.canGenerate) throw Object.assign(new Error('Resuelve los errores de extracción antes de generar modelos.'), { statusCode: 422, code: 'EXTRACTION_NEEDS_REVIEW', details: report.issues });
}
async function assertProject(tx, projectId) {
  // Snapshots are immutable audit records; the latest analysis per source supersedes older reports.
  const snapshots = await tx.modelCandidate.findMany({ where: { projectId, kind: 'DOCUMENT_ANALYSIS' }, orderBy: { updatedAt: 'desc' } });
  const sourceCatalog=tx.source?.findMany?await tx.source.findMany({where:{projectId},select:{id:true,type:true,currentVersionId:true}}):null;
  const officialRows=tx.requirement?.findMany?await tx.requirement.findMany({where:{projectId,isDeleted:false,status:{not:'REMOVED'}}}):[];
  const seen = new Set(),current=[];
  for (const snapshot of snapshots) {
    const result = snapshot.content?.result;
    if (!result) continue;
    if(sourceCatalog&&snapshot.content.sourceId&&!sourceCatalog.some(s=>s.id===snapshot.content.sourceId&&s.type==='PDF'))continue;
    if(sourceCatalog&&snapshot.content.sourceVersionId&&!sourceCatalog.some(s=>s.currentVersionId===snapshot.content.sourceVersionId&&s.type==='PDF'))continue;
    if(sourceCatalog&&!snapshot.content.sourceId&&!snapshot.content.sourceVersionId&&(result.requirements||[]).some(r=>(r.evidence||[]).some(e=>e.sourceVersionId&&!sourceCatalog.some(s=>s.type==='PDF'&&s.currentVersionId===e.sourceVersionId))))continue;
    const source = snapshot.content.sourceId || snapshot.content.sourceVersionId || result.documentAnalysis?.sourceFile || 'PROJECT_AGGREGATE';
    if (seen.has(source)) continue; seen.add(source);
    current.push(result);
  }
  if(current.length){
    const aggregate={requirements:require('./requirementIdentity').consolidate(current.flatMap(r=>r.requirements||[])),actors:current.flatMap(r=>r.actors||[]),businessRules:current.flatMap(r=>r.businessRules||[]),partial:current.some(r=>r.partial)};
    const reviews=await tx.modelCandidate.findMany({where:{projectId,kind:'REQUIREMENT_RELATION',status:{in:['APPROVED','REJECTED']}}});
    const resolver=require('./dependencyResolver');
    for(const r of aggregate.requirements)for(const p of r.proposedRelations||[]){
      delete p.review;
      const review=reviews.find(c=>c.kind==='REQUIREMENT_RELATION'&&c.fingerprint===resolver.proposalKey(r.id,p));
      const source=officialRows.find(o=>o.sources?.internalId===r.id),target=officialRows.find(o=>o.sources?.internalId===p.targetId);
      if(review?.status==='REJECTED')p.review={status:'REJECTED',candidateId:review.id};
      if(review?.status==='APPROVED'&&source&&target&&review.content.review?.sourceHash===resolver.rowHash(source)&&review.content.review?.targetHash===resolver.rowHash(target))p.review={status:'APPROVED',candidateId:review.id};
    }
    assertValid(aggregate);
  }
  if(tx.requirement?.findMany&&tx.actor?.findMany){
    const rows=officialRows;
    const actors=await tx.actor.findMany({where:{projectId,isDeleted:false}});
    const issues=require('./dependencyResolver').storedIssues(rows);
    for(const row of rows){
      if((row.actorIds||[]).some(id=>!actors.some(a=>a.id===id)))issues.push({code:'INVALID_PERSISTED_ACTOR',requirementId:row.id});
      if((row.dependencies||[]).some(ref=>!rows.some(r=>r.id===ref||normalizeCode(r.code)===normalizeCode(ref)))||row.sources?.pendingDependencyReferences?.length)issues.push({code:'INVALID_PERSISTED_DEPENDENCY',requirementId:row.id});
    }
    if(issues.length)throw Object.assign(new Error('Corrige las referencias persistidas antes de generar.'),{statusCode:422,code:'EXTRACTION_NEEDS_REVIEW',details:issues});
  }
}
module.exports = { analyze, assertValid, assertProject, normalizeCode };
