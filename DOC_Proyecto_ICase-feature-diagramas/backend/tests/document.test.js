const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pdf}=require('./fixtures/pdfFixture.cjs');
const extractor=require('../src/services/document/PdfExtractor');
const {extract}=require('../src/services/analysis/documentExtraction');
test('real PDF parser keeps evidence and page boundaries without a private external fixture',async()=>{
 const document=await extractor.extractFromBuffer(pdf([['RF-001 Registrar operaciones.'],['RNF-01 Cifrar datos.']]));
 assert.equal(document.pageCount,2);assert.match(document.extractedText,/P.GINA 2/);
 const result=await extract(document.extractedText,{providerOverride:'local',cache:false});
 assert.deepEqual(result.requirements.map(r=>r.originalCode),['RF-001','RNF-01']);
 assert.deepEqual(result.requirements.map(r=>r.statement),['Registrar operaciones.','Cifrar datos.']);
});
const source=process.env.AUTRON_V6_PDF||path.resolve(__dirname,'../../AUTRON_V6.pdf');
const reference=process.env.AUTRON_V6_REFERENCE;
test('AUTRON V6 complete descriptions match an independently verified reference', {skip:!fs.existsSync(source)?'AUTRON V6 PDF is absent':!reference?'AUTRON V6 verified full-text reference is absent':false},async()=>{
 const document=await extractor.extractFromBuffer(fs.readFileSync(source),path.basename(source));
 const result=await extract(document.extractedText,{providerOverride:'local',cache:false});
 const expected=JSON.parse(fs.readFileSync(reference,'utf8'));
 assert.equal(expected.length,61);assert.deepEqual(result.requirements.map(r=>({code:r.originalCode,statement:r.statement})),expected);
 assert.equal(result.functionalRequirements.length,49);assert.equal(result.nonFunctionalRequirements.length,12);
 assert.equal(new Set(result.requirements.map(r=>r.originalCode)).size,61);
});
