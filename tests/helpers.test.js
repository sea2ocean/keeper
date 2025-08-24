
import { describe, it, expect } from "vitest";
import { chunkText, buildProperties } from "../src/notionClient.js";

describe("chunkText", () => {
  it("chunks long strings", () => {
    const s = "a".repeat(5000);
    const parts = chunkText(s, 1900);
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(1900);
    expect(parts[1].length).toBe(1900);
    expect(parts[2].length).toBe(1200);
  });
});

describe("buildProperties", () => {
  it("builds Notion properties object", () => {
    const props = buildProperties({
      titleName: "Name",
      content: "Hello world",
      url: "https://example.com",
      date: "2025-08-24T00:00:00Z",
      project: "MyProj"
    });
    expect(props["Name"].title[0].text.content).toMatch(/Hello/);
    expect(props["URL"].url).toMatch(/https:/);
    expect(props["Date Captured"].date.start).toMatch(/2025/);
    expect(props["Project"].rich_text[0].text.content).toBe("MyProj");
  });
});
