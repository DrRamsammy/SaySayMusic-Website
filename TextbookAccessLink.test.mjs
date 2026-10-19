import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./TextbookAccessLink.js',import.meta.url),'utf8');
const {textbookAccessLink}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('existing navigation stays unchanged until a secure URL is configured',()=>{
 for(const value of [undefined,'','javascript:alert(1)','http://example.test','https://user:password@example.test'])assert.equal(textbookAccessLink(value),'');
});
test('link uses a separate configured destination and escapes script terminators',()=>{
 const html=textbookAccessLink('https://books.example.test/');assert.match(html,/Textbook Access/);assert.match(html,/https:\/\/books.example.test/);
 const hostile=textbookAccessLink('https://books.example.test/?q=</script>');assert.equal(hostile.split('</script>').length,2);
});
