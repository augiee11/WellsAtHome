const spreadsheetNS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function xmlText(value) {
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function worksheet(rows, widths, headerRow, filter) {
  const columns = widths.map((width, i) => '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+width+'" customWidth="1"/>');
  const body = rows.map((values, index) => {
    const row = index + 1;
    const cells = values.map((value, col) => {
      if (value == null) return '';
      const address = String.fromCharCode(65 + col) + row;
      const style = row === headerRow ? 1 : 0;
      const attr = ' r="'+address+'" s="'+style+'"';
      return typeof value === 'number'
        ? '<c'+attr+'><v>'+value+'</v></c>'
        : '<c'+attr+' t="inlineStr"><is><t>'+xmlText(value)+'</t></is></c>';
    });
    return '<row r="'+row+'">'+cells.join('')+'</row>';
  });
  return '<worksheet xmlns="'+spreadsheetNS+'"><cols>'+columns.join('')+'</cols><sheetData>'+body.join('')+'</sheetData>'+(filter ? '<autoFilter ref="'+filter+'"/>' : '')+'</worksheet>';
}

function velocityRows(unit, start, end, wellIds, fits) {
  const rateUnit = unit + '/min';
  const details = [['Well', 'Initial velocity (' + rateUnit + ')', 'R²', 'Start (min)', 'End (min)', 'Reads used', 'Fit status']];
  for (const id of wellIds) {
    const fit = fits[id];
    const status = fit?.slope != null ? 'Calculated' : fit ? 'Insufficient reads in range' : 'Unread well';
    details.push([id, fit?.slope, fit?.rSquared, start, end, fit?.count ?? 0, status]);
  }
  return details;
}

function velocityWorkbook(name, unit, start, end, wellIds, fits) {
  const zip = new JSZip();
  const rateUnit = unit + '/min';
  const plate = [
    ['Initial velocity (' + rateUnit + ')'], ['Experiment', name],
    ['Start (min)', start, 'End (min)', end],
    ['Blank velocity cells indicate no calculable slope.'], ['R² is reported for fits with at least three reads and varying signal.'],
    ['Row', ...Array.from({length:12}, (_, i) => i+1)]
  ];
  for (const row of 'ABCDEFGH') {
    plate.push([row, ...Array.from({length:12}, (_, i) => fits[row+(i+1)]?.slope)]);
  }
  const details = velocityRows(unit, start, end, wellIds, fits);
  zip.file('xl/worksheets/sheet1.xml', worksheet(plate, [34,...Array(12).fill(16)], 6));
  zip.file('xl/worksheets/sheet2.xml', worksheet(details, [10,32,16,16,16,16,30], 1, 'A1:G97'));
  zip.file('xl/workbook.xml', '<workbook xmlns="'+spreadsheetNS+'" xmlns:r="'+officeRel+'"><sheets><sheet name="Plate map" sheetId="1" r:id="rId1"/><sheet name="Well results" sheetId="2" r:id="rId2"/></sheets></workbook>');
  const pkgRel = 'http://schemas.openxmlformats.org/package/2006/relationships';
  function relationships(entries) {
    return '<Relationships xmlns="'+pkgRel+'">'+entries.map(([type,target],i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+officeRel+'/'+type+'" Target="'+target+'"/>').join('')+'</Relationships>';
  }
  zip.file('_rels/.rels', relationships([['officeDocument','xl/workbook.xml']]));
  zip.file('xl/_rels/workbook.xml.rels', relationships([['worksheet','worksheets/sheet1.xml'],['worksheet','worksheets/sheet2.xml'],['styles','styles.xml']]));
  zip.file('xl/styles.xml','<styleSheet xmlns="'+spreadsheetNS+'"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF235747"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  const types = {'workbook':'sheet.main','worksheets/sheet1':'worksheet','worksheets/sheet2':'worksheet','styles':'styles'};
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+Object.entries(types).map(([part,type])=>'<Override PartName="/xl/'+part+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.'+type+'+xml"/>').join('')+'</Types>');
  return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'});
}
