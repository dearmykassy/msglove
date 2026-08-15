import { createHash } from "node:crypto";

export type VisibleDomEntryKind =
  | "direct-text"
  | "block-text"
  | "aria-label"
  | "alt-text";

export type VisibleDomEntry = {
  kind: VisibleDomEntryKind;
  tagName: string;
  elementIdentity: string;
  elementOrder: number;
  entryOrder: number;
  value: string;
  occurrences: 1;
};

export type VisibleDomContract = {
  schemaVersion: "massage-love-visible-dom-contract/v2";
  route: string;
  extractorPolicy: {
    scope: "one route body: element-bound direct text, reconstructed semantic blocks, aria-label, and non-empty alt text";
    semanticBlockTags: readonly string[];
    elementIdentity: "AUDITED_ELEMENT_DOCUMENT_ORDER_PLUS_TAG";
    entryIdentity: "ROUTE_ELEMENT_KIND_ENTRY_ORDER";
    scriptsStylesTemplatesNoscriptHiddenExcluded: true;
    whitespace: "NFC_COLLAPSED_WITH_BLOCK_BOUNDARIES";
    comparison: "EXACT_ROUTE_ELEMENT_KIND_ORDER_VALUE_BIDIRECTIONAL";
  };
  occurrenceCount: number;
  uniqueEntryCount: number;
  entries: VisibleDomEntry[];
  digestSha256: string;
};

type TextNode = {
  type: "text";
  value: string;
};

type ElementNode = {
  type: "element";
  tagName: string;
  attributes: Map<string, string>;
  children: Array<ElementNode | TextNode>;
  hidden: boolean;
};

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const SEMANTIC_BLOCK_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "a",
  "button",
  "ul",
  "ol",
  "dl",
  "li",
  "dt",
  "dd",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "blockquote",
] as const;

const SEMANTIC_BLOCK_TAG_SET = new Set<string>(SEMANTIC_BLOCK_TAGS);
const TEXT_BOUNDARY_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "caption",
  "dd",
  "details",
  "dialog",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function decodeHtml(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/giu,
    (entity, decimal: string | undefined, hexadecimal: string | undefined, named: string | undefined) => {
      if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      const names: Record<string, string> = {
        amp: "&",
        apos: "'",
        gt: ">",
        lt: "<",
        nbsp: " ",
        quot: '"',
      };
      return names[named?.toLowerCase() ?? ""] ?? entity;
    },
  );
}

export function normalizeVisibleDomValue(value: string): string {
  return decodeHtml(value).normalize("NFC").replace(/\s+/gu, " ").trim();
}

function bodyMarkup(markup: string): string {
  const match = markup.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/iu);
  return match?.[1] ?? markup;
}

function parseAttributes(token: string, tagName: string): Map<string, string> {
  const opening = token.match(/^<\s*[a-z0-9:-]+/iu)?.[0] ?? `<${tagName}`;
  const raw = token
    .slice(opening.length)
    .replace(/\/?>\s*$/u, "");
  const attributes = new Map<string, string>();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gu;
  for (const match of raw.matchAll(pattern)) {
    attributes.set(
      match[1].toLowerCase(),
      match[2] ?? match[3] ?? match[4] ?? "",
    );
  }
  return attributes;
}

function appendText(parent: ElementNode, value: string): void {
  const previous = parent.children.at(-1);
  if (previous?.type === "text") previous.value += value;
  else parent.children.push({ type: "text", value });
}

function parseMarkup(markup: string): ElementNode {
  const withoutNonContent = bodyMarkup(markup)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/giu, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/giu, "");
  const root: ElementNode = {
    type: "element",
    tagName: "__root__",
    attributes: new Map(),
    children: [],
    hidden: false,
  };
  const stack: ElementNode[] = [root];
  const tokens = withoutNonContent.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/gu) ?? [];

  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<!")) continue;
    if (!token.startsWith("<")) {
      appendText(stack.at(-1) ?? root, token);
      continue;
    }
    const closing = token.match(/^<\/\s*([a-z0-9:-]+)/iu);
    if (closing) {
      const tagName = closing[1].toLowerCase();
      while (stack.length > 1) {
        const frame = stack.pop();
        if (frame?.tagName === tagName) break;
      }
      continue;
    }
    const opening = token.match(/^<\s*([a-z0-9:-]+)/iu);
    if (!opening) continue;
    const tagName = opening[1].toLowerCase();
    const attributes = parseAttributes(token, tagName);
    const parent = stack.at(-1) ?? root;
    const element: ElementNode = {
      type: "element",
      tagName,
      attributes,
      children: [],
      hidden: parent.hidden || attributes.has("hidden"),
    };
    parent.children.push(element);
    if (!VOID_ELEMENTS.has(tagName) && !/\/\s*>$/u.test(token)) stack.push(element);
  }
  return root;
}

function directText(element: ElementNode): string {
  return element.children
    .map((child) => {
      if (child.type === "text") return child.value;
      return child.tagName === "br" ? " " : "";
    })
    .join("");
}

function reconstructedText(element: ElementNode): string {
  let result = "";
  for (const child of element.children) {
    if (child.type === "text") {
      result += child.value;
      continue;
    }
    if (child.hidden) continue;
    if (child.tagName === "br") {
      result += " ";
      continue;
    }
    const childText = reconstructedText(child);
    if (!childText) continue;
    result += TEXT_BOUNDARY_TAGS.has(child.tagName)
      ? ` ${childText} `
      : childText;
  }
  return result;
}

function walkElements(root: ElementNode): ElementNode[] {
  const elements: ElementNode[] = [];
  const visit = (element: ElementNode) => {
    for (const child of element.children) {
      if (child.type !== "element" || child.hidden) continue;
      elements.push(child);
      visit(child);
    }
  };
  visit(root);
  return elements;
}

export function extractVisibleDomContract(markup: string, route: string): VisibleDomContract {
  const root = parseMarkup(markup);
  const candidates = walkElements(root).flatMap((element) => {
    const outputs: Array<{ kind: VisibleDomEntryKind; value: string }> = [];
    const direct = normalizeVisibleDomValue(directText(element));
    if (direct) outputs.push({ kind: "direct-text", value: direct });
    if (SEMANTIC_BLOCK_TAG_SET.has(element.tagName)) {
      const block = normalizeVisibleDomValue(reconstructedText(element));
      if (block) outputs.push({ kind: "block-text", value: block });
    }
    const ariaLabel = normalizeVisibleDomValue(element.attributes.get("aria-label") ?? "");
    if (ariaLabel) outputs.push({ kind: "aria-label", value: ariaLabel });
    const alt = normalizeVisibleDomValue(element.attributes.get("alt") ?? "");
    if (alt) outputs.push({ kind: "alt-text", value: alt });
    return outputs.length > 0 ? [{ element, outputs }] : [];
  });

  let entryOrder = 0;
  const entries = candidates.flatMap(({ element, outputs }, index) => {
    const elementOrder = index + 1;
    const elementIdentity = `${element.tagName}@${String(elementOrder).padStart(6, "0")}`;
    return outputs.map(({ kind, value }) => ({
      kind,
      tagName: element.tagName,
      elementIdentity,
      elementOrder,
      entryOrder: (entryOrder += 1),
      value,
      occurrences: 1 as const,
    }));
  });
  const canonical = JSON.stringify({ route, entries });
  return {
    schemaVersion: "massage-love-visible-dom-contract/v2",
    route,
    extractorPolicy: {
      scope:
        "one route body: element-bound direct text, reconstructed semantic blocks, aria-label, and non-empty alt text",
      semanticBlockTags: SEMANTIC_BLOCK_TAGS,
      elementIdentity: "AUDITED_ELEMENT_DOCUMENT_ORDER_PLUS_TAG",
      entryIdentity: "ROUTE_ELEMENT_KIND_ENTRY_ORDER",
      scriptsStylesTemplatesNoscriptHiddenExcluded: true,
      whitespace: "NFC_COLLAPSED_WITH_BLOCK_BOUNDARIES",
      comparison: "EXACT_ROUTE_ELEMENT_KIND_ORDER_VALUE_BIDIRECTIONAL",
    },
    occurrenceCount: entries.length,
    uniqueEntryCount: entries.length,
    entries,
    digestSha256: sha256(canonical),
  };
}

function entryIdentity(entry: VisibleDomEntry): string {
  return [
    entry.kind,
    entry.tagName,
    entry.elementIdentity,
    entry.elementOrder,
    entry.entryOrder,
  ].join("\u0000");
}

export function compareVisibleDomContracts(
  declared: VisibleDomContract,
  rendered: VisibleDomContract,
): {
  declaredButNotRendered: VisibleDomEntry[];
  renderedButNotDeclared: VisibleDomEntry[];
} {
  if (declared.route !== rendered.route) {
    return {
      declaredButNotRendered: declared.entries,
      renderedButNotDeclared: rendered.entries,
    };
  }
  const declaredMap = new Map(declared.entries.map((entry) => [entryIdentity(entry), entry]));
  const renderedMap = new Map(rendered.entries.map((entry) => [entryIdentity(entry), entry]));
  const declaredButNotRendered = declared.entries.filter((entry) => {
    const counterpart = renderedMap.get(entryIdentity(entry));
    return !counterpart || counterpart.value !== entry.value;
  });
  const renderedButNotDeclared = rendered.entries.filter((entry) => {
    const counterpart = declaredMap.get(entryIdentity(entry));
    return !counterpart || counterpart.value !== entry.value;
  });
  return { declaredButNotRendered, renderedButNotDeclared };
}
