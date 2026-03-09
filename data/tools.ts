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
    description: "an image arranger tool",
    embedSrc: "/_tools/mdbrd/index.html",
  },
  {
    name: "CharCarpet",
    slug: "charcarpet",
    status: "active",
    description: "a character animator tool, text as moving patterns",
    embedSrc: "/_tools/charcarpet/index.html",
  },
  {
    name: "Petri",
    slug: "petri",
    status: "active",
    description: "Random-walker based interactive organism simulator",
    embedSrc: "/_tools/Petri/index.html",
  },
];
