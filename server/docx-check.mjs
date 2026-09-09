import mammoth from 'mammoth';
const result = await mammoth.convertToHtml({path:'../testdata/research-sample.docx'});
console.log(JSON.stringify(result));
