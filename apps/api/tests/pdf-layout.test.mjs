import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { reportPdf, receiptPdf, invoicePdf } from '../src/lib/pdf.js';
import { env } from '../src/config/env.js';
const columns=['reference','date','station','vehicle','driver','fuel','litres','amount','status'].map(key=>({key,label:key,width:82}));
const rows=[
  {reference:'FUEL-1',date:'13 Oct 2026, 12:34',station:'A station with a very long Nigerian name',vehicle:'LAG-22',driver:'Ada Example',fuel:'Diesel',litres:'123.45',amount:'₦150,000.00',status:'success'},
  {reference:'FUEL-2',date:'13 Oct 2026, 12:35',station:'Second station',vehicle:'LAG-220',driver:'Bola Example',fuel:'Diesel',litres:'10',amount:'₦15,000.00',status:'failed'}
];
function pdfRuns(buffer) {
  const runs=[];const pdf=buffer.toString('latin1');let page=0;
  for(const match of pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content;try{content=inflateSync(Buffer.from(match[1],'latin1')).toString();}catch{continue;}
    if(!content.includes('BT'))continue;
    for(const text of content.matchAll(/BT([\s\S]*?)ET/g)) {
      const position=/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/.exec(text[1]);if(!position)continue;
      const value=[...text[1].matchAll(/<([a-f\d]+)>/gi)].map(part=>Buffer.from(part[1],'hex').toString('latin1')).join('');
      runs.push({page,x:Number(position[1]),y:Number(position[2]),text:value});
    }
    page++;
  }
  return runs;
}
const fixture=()=>reportPdf({title:'Company transactions report',subtitle:'Last 30 days • Fixture fleet',columns,rows});
test('wrapped station text clears the following report row',async()=>{
  const runs=pdfRuns(await fixture());const station=runs.find(run=>run.text.startsWith('A station'));const next=runs.find(run=>run.text==='FUEL-2');
  assert.ok(station&&next);const firstRowStation=runs.filter(run=>run.x===station.x&&run.y<=station.y&&run.y>next.y);
  assert.ok(firstRowStation.length>=3);assert.ok(Math.min(...firstRowStation.map(run=>run.y))-next.y>=9.5,'wrapped text must leave one full text line before the next row');
});
test('PDF money labels use printable NGN text with the built-in font',async()=>{const runs=pdfRuns(await fixture());assert.ok(runs.some(run=>run.text.includes('NGN 150,000.00')));assert.ok(runs.some(run=>run.text.includes('NGN 15,000.00')));});
test('report footer spans the page rather than inheriting the last table column',async()=>{const runs=pdfRuns(await fixture());const footer=runs.filter(run=>run.text.includes('Generated'));assert.equal(footer.length,1);assert.ok(footer[0].x<550);assert.ok(footer[0].text.includes('Obligon LTD'));});
test('long report cells continue onto later pages without losing content',async()=>{const words=Array.from({length:200},(_,i)=>`W${String(i).padStart(3,'0')}`);const runs=pdfRuns(await reportPdf({title:'Long company record',columns,rows:[{...rows[0],station:words.join(' ')}]}));const text=runs.map(run=>run.text).join(' ');for(const word of words)assert.match(text,new RegExp(`\\b${word}\\b`));assert.ok(new Set(runs.map(run=>run.page)).size>1);});

test('receipt, invoice and report dates use the configured business day across UTC midnight',async()=>{
  const RealDate=Date, oldZone=env.BUSINESS_TIMEZONE, oldHostZone=process.env.TZ;
  const instant='2026-10-14T23:30:00Z';
  try {
    process.env.TZ='UTC'; env.BUSINESS_TIMEZONE='Africa/Lagos';
    globalThis.Date=class extends RealDate { constructor(...args){super(...(args.length?args:[instant]));} static now(){return new RealDate(instant).getTime();} };
    const expectedDate=new RealDate(instant).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos'});
    const expectedTime=new RealDate(instant).toLocaleString('en-NG',{timeZone:'Africa/Lagos'});
    assert.notEqual(expectedDate,new RealDate(instant).toLocaleDateString('en-NG',{timeZone:'UTC'}));
    const receipt=pdfRuns(await receiptPdf({reference:'TZ-FIXTURE',createdAt:instant,station:'Fixture station',fuelType:'Diesel',litres:'10',amountLabel:'NGN 100',status:'success'})).map(run=>run.text).join(' ');
    const invoice=pdfRuns(await invoicePdf({number:'TZ-FIXTURE',createdAt:instant,orgName:'Fixture company',planName:'Fixture plan',amountLabel:'NGN 100',status:'paid',periodLabel:'Fixture period'})).map(run=>run.text).join(' ');
    const report=pdfRuns(await fixture()).map(run=>run.text).join(' ');
    assert.ok(receipt.includes(`Date: ${expectedTime}`),receipt);
    assert.ok(invoice.includes(`Issued: ${expectedDate}`),invoice);
    assert.ok(report.includes(`Generated ${expectedTime}`),report);
    env.BUSINESS_TIMEZONE='UTC';
    const utcReceipt=pdfRuns(await receiptPdf({reference:'TZ-UTC',createdAt:instant,station:'Fixture station',fuelType:'Diesel',litres:'10',amountLabel:'NGN 100',status:'success'})).map(run=>run.text).join(' ');
    assert.ok(utcReceipt.includes(`Date: ${new RealDate(instant).toLocaleString('en-NG',{timeZone:'UTC'})}`),utcReceipt);
  } finally {
    globalThis.Date=RealDate; env.BUSINESS_TIMEZONE=oldZone;
    if(oldHostZone===undefined)delete process.env.TZ;else process.env.TZ=oldHostZone;
  }
});
