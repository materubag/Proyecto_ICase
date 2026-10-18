import test from 'node:test';
import assert from 'node:assert/strict';
import {isPdf} from '../src/utils/pdfFilePolicy.js';
test('PDF selection requires a PDF extension and compatible browser MIME',()=>{
  assert.equal(isPdf({name:'requisitos.PDF',type:'application/pdf'}),true);
  assert.equal(isPdf({name:'requisitos.pdf',type:''}),true);
  assert.equal(isPdf({name:'requisitos.pdf',type:'audio/mpeg'}),false);
  for(const name of ['a.doc','a.docx','a.odt','a.txt','a.mp3','a.pdf.exe'])assert.equal(isPdf({name,type:'application/pdf'}),false);
});
