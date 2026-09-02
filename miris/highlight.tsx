/* A tokenizer for the snippets this guide shows, which are all JSX and all
 * short. Prism and Shiki are both larger than everything in miris/ put
 * together, and neither earns that for five code blocks.
 *
 * Deliberately not a parser. It reads left to right and decides each word from
 * the character before and after it, which is enough for JSX attributes and
 * wrong the moment anyone writes something the workshop does not. */

const TOKEN =
  /(\{\/\*[\s\S]*?\*\/\})|("(?:[^"\\]|\\.)*")|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(<\/?|\/>|[<>{}[\]().,:;?|&!=]+)/g;

type Kind = "comment" | "str" | "num" | "tag" | "attr" | "const" | "word" | "punct" | "plain";

export function tokens(code: string): { kind: Kind; text: string }[] {
  const out: { kind: Kind; text: string }[] = [];
  const push = (kind: Kind, text: string) => text && out.push({ kind, text });
  let last = 0;

  for (let m = TOKEN.exec(code); m; m = TOKEN.exec(code)) {
    push("plain", code.slice(last, m.index));
    last = m.index + m[0].length;

    const [all, comment, str, num, word, punct] = m;
    if (comment) push("comment", all);
    else if (str) push("str", all);
    else if (num) push("num", all);
    else if (punct) push("punct", all);
    else if (word) {
      // The character before decides a tag, the one after decides an attribute.
      const before = code.slice(0, m.index).match(/<\/?\s*$/);
      const after = code.slice(last).match(/^\s*=/);
      if (before) push("tag", all);
      else if (after) push("attr", all);
      else if (/^[A-Z0-9_]+$/.test(all)) push("const", all);
      else push("word", all);
    }
  }
  push("plain", code.slice(last));
  return out;
}

/** The snippet, coloured. */
export default function Code({ code }: { code: string }) {
  return (
    <>
      {tokens(code).map((t, i) =>
        t.kind === "plain" ? (
          t.text
        ) : (
          <span key={i} className={`tok-${t.kind}`}>
            {t.text}
          </span>
        ),
      )}
    </>
  );
}
