import { describe, expect, it } from "vitest";
import {
  compareVisibleDomContracts,
  extractVisibleDomContract,
} from "@/lib/visible-dom-contract";

describe("route-scoped visible DOM contract", () => {
  it("binds reconstructed link blocks to element identity and order", () => {
    const route = "/contract-case/";
    const declared = extractVisibleDomContract(
      "<body><a href='/one'><strong>Alpha</strong><span> one</span></a><a href='/two'><strong>Beta</strong><span> two</span></a></body>",
      route,
    );
    const swapped = extractVisibleDomContract(
      "<body><a href='/one'><strong>Beta</strong><span> one</span></a><a href='/two'><strong>Alpha</strong><span> two</span></a></body>",
      route,
    );
    const comparison = compareVisibleDomContracts(declared, swapped);

    expect(declared.schemaVersion).toBe("massage-love-visible-dom-contract/v2");
    expect(
      declared.entries.filter((entry) => entry.kind === "block-text" && entry.tagName === "a")
        .map((entry) => entry.value),
    ).toEqual(["Alpha one", "Beta two"]);
    expect(comparison.declaredButNotRendered.length).toBeGreaterThan(0);
    expect(comparison.renderedButNotDeclared.length).toBeGreaterThan(0);
  });

  it("reconstructs required semantic blocks while excluding hidden content", () => {
    const contract = extractVisibleDomContract(
      "<body><h1>Heading <em>inside</em></h1><p>Paragraph</p><button><strong>Call</strong></button><ul><li>One</li><li>Two</li></ul><table><caption>Prices</caption><tbody><tr><th>Time</th><td>60</td></tr></tbody></table><blockquote>Note</blockquote><div hidden>Secret</div><img alt='Quiet lounge'/></body>",
      "/semantic-blocks/",
    );
    const blockTags = new Set(
      contract.entries
        .filter((entry) => entry.kind === "block-text")
        .map((entry) => entry.tagName),
    );

    for (const tag of [
      "h1",
      "p",
      "button",
      "ul",
      "li",
      "table",
      "caption",
      "tr",
      "th",
      "td",
      "blockquote",
    ]) {
      expect(blockTags.has(tag), tag).toBe(true);
    }
    expect(contract.entries.some((entry) => entry.value === "Secret")).toBe(false);
    expect(contract.entries.some((entry) => entry.kind === "alt-text" && entry.value === "Quiet lounge")).toBe(true);
  });

  it("treats hydration comments as text-node joins and rejects route swaps", () => {
    const declared = extractVisibleDomContract("<body><p>60분</p></body>", "/one/");
    const hydrated = extractVisibleDomContract(
      "<body><p>60<!-- -->분</p></body>",
      "/one/",
    );
    expect(compareVisibleDomContracts(declared, hydrated)).toEqual({
      declaredButNotRendered: [],
      renderedButNotDeclared: [],
    });

    const wrongRoute = extractVisibleDomContract("<body><p>60분</p></body>", "/two/");
    expect(compareVisibleDomContracts(declared, wrongRoute).declaredButNotRendered).not.toHaveLength(0);
  });
});
