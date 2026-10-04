(function (root, factory) {
  const tools = factory();
  if (typeof module === 'object' && module.exports) module.exports = tools;
  if (root) root.duplicateTools = tools;
})(typeof window === 'undefined' ? null : window, function () {
  function hamming(first, second) {
    if (!/^[a-f0-9]{16}$/i.test(first || '') || !/^[a-f0-9]{16}$/i.test(second || '')) return Infinity;
    let value = BigInt(`0x${first}`) ^ BigInt(`0x${second}`), count = 0;
    while (value) { count++; value &= value - 1n; }
    return count;
  }
  function groupItems(items) {
    const parent = items.map((_, index) => index);
    const find = index => parent[index] === index ? index : (parent[index] = find(parent[index]));
    const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
    const exact = new Map();
    items.forEach((item, index) => {
      if (!/^[a-f0-9]{64}$/i.test(item.contentHash || '')) return;
      if (exact.has(item.contentHash)) join(index, exact.get(item.contentHash)); else exact.set(item.contentHash, index);
    });
    const images = items.map((item, index) => ({ item, index })).filter(({ item }) => item.kind === 'image' && item.width > 0 && item.height > 0 && /^[a-f0-9]{16}$/i.test(item.visualHash || ''));
    for (let a = 0; a < images.length; a++) for (let b = a + 1; b < images.length; b++) {
      const first = images[a].item, second = images[b].item;
      if (Math.abs(Math.log((first.width / first.height) / (second.width / second.height))) <= 0.06 && hamming(first.visualHash, second.visualHash) <= 3) join(images[a].index, images[b].index);
    }
    const groups = new Map();
    items.forEach((item, index) => { const key = find(index); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); });
    return [...groups.values()].filter(group => group.length > 1).map(group => ({
      kind: group.every(item => item.contentHash && item.contentHash === group[0].contentHash) ? 'exact' : 'similar',
      items: group
    })).sort((a, b) => (a.kind === b.kind ? b.items.length - a.items.length : a.kind === 'exact' ? -1 : 1));
  }
  return { hamming, groupItems };
});
