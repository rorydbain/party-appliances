// Minimal real EXIF block for integration tests: no image-library mocks.
function withExif(jpeg = Buffer.from([255, 216, 255, 217])) {
  const ascii = s => Buffer.from(s + '\0');
  const rational = values => { const b = Buffer.alloc(values.length * 8); values.forEach((n, i) => { b.writeUInt32LE(n, i * 8); b.writeUInt32LE(1, i * 8 + 4); }); return b; };
  const ifd0 = 8, exif = ifd0 + 2 + 4 * 12 + 4, gps = exif + 2 + 12 + 4;
  const dirs = [
    [ifd0, [[0x10f, 2, ascii('Canon')], [0x110, 2, ascii('Canon EOS RP')], [0x8769, 4, exif], [0x8825, 4, gps]]],
    [exif, [[0x9003, 2, ascii('2014:08:17 16:42:09')]]],
    [gps, [[1, 2, ascii('N')], [2, 5, rational([55, 57, 0])], [3, 2, ascii('W')], [4, 5, rational([3, 12, 0])]]]
  ];
  const buffer = Buffer.alloc(1024); buffer.write('II'); buffer.writeUInt16LE(42, 2); buffer.writeUInt32LE(ifd0, 4);
  let end = gps + 2 + 4 * 12 + 4;
  for (const [offset, entries] of dirs) {
    buffer.writeUInt16LE(entries.length, offset);
    entries.forEach(([tag, type, value], i) => {
      const at = offset + 2 + i * 12;
      buffer.writeUInt16LE(tag, at); buffer.writeUInt16LE(type, at + 2);
      buffer.writeUInt32LE(type === 4 ? 1 : value.length / (type === 5 ? 8 : 1), at + 4);
      if (type === 4) buffer.writeUInt32LE(value, at + 8);
      else if (value.length <= 4) value.copy(buffer, at + 8);
      else { buffer.writeUInt32LE(end, at + 8); value.copy(buffer, end); end += value.length; }
    });
  }
  const block = Buffer.concat([Buffer.from('Exif\0\0'), buffer.subarray(0, end)]), marker = Buffer.from([255, 225, 0, 0]);
  marker.writeUInt16BE(block.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), marker, block, jpeg.subarray(2)]);
}
module.exports = { withExif };
