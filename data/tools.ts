export type ToolStatus = "active" | "placeholder";

export type Tool = {
  name: string;
  slug: string;
  status: ToolStatus;
  description: string;
  embedSrc?: string;
};

export const tools: Tool[] = [
  {
    name: "MDBRD",
    slug: "mdbrd",
    status: "active",
    description: "A tiny markdown board for quick thinking and drafts.",
    embedSrc: "/_tools/mdbrd/index.html",
  },
  {
    name: "IMG3DSPACE",
    slug: "img3dspace",
    status: "active",
    description: "Turn images into depthy space experiments.",
    embedSrc: "/_tools/img3dspace/index.html",
  },
  {
    name: "CHARCARPET",
    slug: "charcarpet",
    status: "active",
    description: "Text as texture — playful character fields and patterns.",
    embedSrc: "/_tools/charcarpet/index.html",
  },
  {
    name: "COMING SOON",
    slug: "coming-soon",
    status: "placeholder",
    description: "Coming soon.",
  },
];
