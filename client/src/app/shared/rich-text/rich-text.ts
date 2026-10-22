/** One piece of a message with a little markup in it: plain text, bold, a link to a page, or a glossary term. */
export type RichNode =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; children: RichNode[] }
  | { kind: 'link'; to: string; children: RichNode[] }
  | { kind: 'term'; of: string; children: RichNode[] };

/**
 * Reads a message written with `[b]…[/b]` (bold), `[link:/page]…[/link]` (a link to a page) and `[term:Name]…[/term]` (a
 * glossary term, by its English name). The markup is part of the message, so a translation puts it where its own word order
 * wants it, instead of the sentence being cut into pieces around each link. A closing tag that matches nothing is kept as
 * the text it was; one left open runs to the end.
 */
export function parseRich(message: string): RichNode[] {
  const root: RichNode[] = [];
  const stack: { node: Exclude<RichNode, { kind: 'text' }>; tag: string }[] = [];
  const current = (): RichNode[] => (stack.length > 0 ? stack[stack.length - 1].node.children : root);
  const pushText = (text: string) => {
    if (text === '') return;
    const list = current();
    const last = list[list.length - 1];
    if (last?.kind === 'text') last.text += text;
    else list.push({ kind: 'text', text });
  };

  let rest = message;
  for (;;) {
    const open = /\[(b|link:[^\]]+|term:[^\]]+)\]|\[\/(b|link|term)\]/.exec(rest);
    if (!open) break;
    pushText(rest.slice(0, open.index));
    rest = rest.slice(open.index + open[0].length);
    if (open[2] !== undefined) {
      // A closing tag: it must close the one that is open.
      if (stack.length > 0 && stack[stack.length - 1].tag === open[2]) stack.pop();
      else pushText(open[0]);
      continue;
    }
    const [tag, ...value] = open[1].split(':');
    const argument = value.join(':');
    const node = tag === 'b' ? ({ kind: 'bold', children: [] } as const) : tag === 'link' ? ({ kind: 'link', to: argument, children: [] } as const) : ({ kind: 'term', of: argument, children: [] } as const);
    const placed = { ...node, children: [] as RichNode[] };
    current().push(placed);
    stack.push({ node: placed, tag });
  }
  pushText(rest);
  return root;
}
