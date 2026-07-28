import type { Policy, PolicyBlock } from './types';

// Resolve `**bold**` and `{{PLACEHOLDER}}` spans in a line of policy text. A
// filled placeholder renders its value; an unfilled one renders a highlighted
// [TO BE COMPLETED: NAME] so gaps are obvious rather than silently blank —
// matching the Flutter renderer.
function renderInline(text: string, placeholders: Record<string, string>) {
  const token = /\*\*(.+?)\*\*|\{\{([A-Z_]+)\}\}/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = token.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(<strong key={key++}>{m[1]}</strong>);
    } else {
      const name = m[2];
      const value = placeholders[name] ?? '';
      if (value.trim() === '') {
        nodes.push(
          <mark
            key={key++}
            className="rounded bg-amber-100 px-1 font-semibold text-amber-800"
          >
            [TO BE COMPLETED: {name}]
          </mark>,
        );
      } else {
        nodes.push(value);
      }
    }
    last = token.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Block({
  block,
  placeholders,
}: {
  block: PolicyBlock;
  placeholders: Record<string, string>;
}) {
  if (block.type === 'list') {
    return (
      <ul className="ml-5 list-disc space-y-2 text-[15px] leading-relaxed text-foreground">
        {block.items.map((item, i) => (
          <li key={i}>{renderInline(item, placeholders)}</li>
        ))}
      </ul>
    );
  }
  if (block.type === 'note') {
    return (
      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-[15px] leading-relaxed text-amber-800">
        {renderInline(block.text, placeholders)}
      </p>
    );
  }
  return (
    <p className="text-[15px] leading-relaxed text-foreground">
      {renderInline(block.text, placeholders)}
    </p>
  );
}

export function PolicyView({ policy }: { policy: Policy }) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground">
        Privacy Policy and Terms of Use
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: {policy.lastUpdated} &nbsp;•&nbsp; Version {policy.version}
      </p>

      <nav
        aria-label="Contents"
        className="mt-6 rounded-lg border border-border bg-muted/40 p-4"
      >
        <h2 className="text-sm font-semibold text-primary">Contents</h2>
        <ol className="mt-2 space-y-1">
          {policy.sections.map((s) => (
            <li key={s.number}>
              <a
                href={`#section-${s.number}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {s.number}. {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {policy.sections.map((section) => (
        <section
          key={section.number}
          id={`section-${section.number}`}
          className="mt-8 scroll-mt-6"
        >
          <h2 className="text-lg font-bold text-foreground">
            {section.number}. {section.heading}
          </h2>
          <div className="mt-3 space-y-3">
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} placeholders={policy.placeholders} />
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
