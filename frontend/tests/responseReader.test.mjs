import test from 'node:test';
import assert from 'node:assert/strict';
import {readApiResponse} from '../src/api/responseReader.js';
test('HTML gateway response produces useful error without retry',async()=>{await assert.rejects(()=>readApiResponse({status:502,text:async()=>'<html>Bad Gateway</html>'}),/backend no esta disponible/);});
test('API JSON errors retain their original message',async()=>{assert.deepEqual(await readApiResponse({status:503,text:async()=>'{"success":false,"error":{"message":"Proveedor no disponible"}}'}),{success:false,error:{message:'Proveedor no disponible'}});});
