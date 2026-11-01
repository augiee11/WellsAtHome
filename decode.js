function decodeXpt(buffer) {
 const data=new DataView(buffer), bytes=new Uint8Array(buffer), txt=new TextDecoder('latin1');
 const fail=()=>{throw Error("Unsupported XPT layout. Use a single-plate Gen5 2.x file like the example, or import CSV with well,time_s,value columns.")};
 if(data.getUint32(0)!==0xd0cf11e0||data.getUint16(30,true)!==9)fail();
 const u=(o)=>data.getUint32(o,true), fat=[];
 if(u(44)>109)fail();
 for(let i=0;i<u(44);i++){let p=(u(76+i*4)+1)*512;for(let j=0;j<512;j+=4)fat.push(u(p+j))}
 function stream(n,limit=bytes.length){
  const sectors=[],seen=new Set();while(n<0xfffffffa){if(seen.has(n)||n>=fat.length||(n+2)*512>bytes.length)fail();seen.add(n);sectors.push(n);n=fat[n]}
  const out=new Uint8Array(Math.min(limit,sectors.length*512)); sectors.forEach((v,i)=>{const len=Math.min(512,out.length-i*512);if(len>0)out.set(bytes.subarray((v+1)*512,(v+1)*512+len),i*512)});return out;
 }
 const dir=stream(u(48)),dv=new DataView(dir.buffer), entries=[];
 for(let p=0;p+128<=dir.length;p+=128){const name=new TextDecoder('utf-16le').decode(dir.slice(p,p+64)).split('\0')[0];if(name==='DATA')entries.push([dv.getUint32(p+116,true),dv.getUint32(p+120,true)])}
 if(entries.length!==1||entries[0][1]<4096)fail();
 const b=stream(...entries[0]),v=new DataView(b.buffer),str=txt.decode(b),n32=(i)=>v.getUint32(i,true);
 const h=str.indexOf('CPlateDataSet')+13;if(h===12||v.getUint16(h,true)!==6)fail();
 const label=str.slice(h+7,h+7+b[h+6]),blocks=[];
 for(let p=h;p+30<b.length;p++){if(n32(p)!==24||v.getUint16(p+4,true)!==7||n32(p+10)!==1||n32(p+14)!==8||n32(p+18)!==12)continue;blocks.push(p)}
 if(blocks.length!==1)fail();
 const p=blocks[0], count=n32(p+6), start=p+30, end=start+count*96*24;
 if(!count||end>b.length||(count>1&&(end+12+16*count>b.length||n32(end+8)!==count)))fail();
 const wells={},times=[];for(let k=0;k<count;k++){
 const sec=count===1?0:Number(v.getBigInt64(end+16+k*16,true))/1000;
 for(let j=0;j<96;j++){const i=start+(k*96+j)*24; if(n32(i)!==1||n32(i+20)!==1)fail();
 if(n32(i+12)||n32(i+16))continue;
 const val=v.getFloat64(i+4,true);if(!Number.isFinite(sec)||!Number.isFinite(val))fail();
 (wells['ABCDEFGH'[Math.floor(j/12)]+(j%12+1)]??=[]).push([sec,val]);}
 }
 if(!Object.keys(wells).length)fail();return {wells,channel:label,unit:str.includes('RFU')?'RFU':'Signal'};
}
