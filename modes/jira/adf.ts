type AdfNode = {
  type?: string;
  text?: string;
  content?: AdfNode[];
};

export function adfToText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as AdfNode;
  if (n.type === "text" && n.text) return n.text;
  if (!Array.isArray(n.content)) return "";

  const parts = n.content.map(adfToText);
  if (n.type === "paragraph" || n.type === "heading") return parts.join("") + "\n";
  if (n.type === "bulletList" || n.type === "orderedList") return parts.join("");
  if (n.type === "listItem") return `• ${parts.join("").trim()}\n`;
  return parts.join("");
}

export function textToAdf(text: string): object {
  const paragraphs = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const content =
    paragraphs.length > 0
      ? paragraphs.map((block) => ({
          type: "paragraph",
          content: [{ type: "text", text: block }],
        }))
      : [{ type: "paragraph", content: [{ type: "text", text: text.trim() || "(empty)" }] }];

  return { type: "doc", version: 1, content };
}
