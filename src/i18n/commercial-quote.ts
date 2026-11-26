import quoteCopy from './commercial-quote-copy.json';
export { quoteCopy };
export function quoteSection(id: string) {
  const section = quoteCopy.sections.find((item) => item.id === id);
  if (!section) throw new Error('Missing quote storefront section: ' + id);
  return section;
}
