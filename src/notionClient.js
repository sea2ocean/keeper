
const NOTION_VERSION = "2022-06-28";

export class NotionClient {
  constructor({ token }) {
    this.token = token;
    this.base = "https://api.notion.com/v1";
  }

  async fetchJson(path, init = {}) {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.message || res.statusText;
      throw new Error(`Notion API error: ${msg}`);
    }
    return data;
  }

  async listDatabases() {
    // Use /search with object=database
    const data = await this.fetchJson("/search", {
      method: "POST",
      body: JSON.stringify({
        filter: { property: "object", value: "database" },
        page_size: 100
      })
    });
    return (data.results || []).map(db => ({
      id: db.id,
      title: getTitlePlain(db?.title) || "(untitled)",
      icon: db.icon || null
    }));
  }

  async getDatabaseSchema(database_id) {
    const data = await this.fetchJson(`/databases/${database_id}`);
    const props = data?.properties || {};
    let titlePropertyName = null;
    for (const [name, def] of Object.entries(props)) {
      if (def?.type === "title") {
        titlePropertyName = name;
        break;
      }
    }
    return { properties: props, titlePropertyName };
  }

  async createHighlight({ database_id, content, url, date, project, titleHint }) {
    // Fetch schema to get the "title" property name
    const schema = await this.getDatabaseSchema(database_id);
    const titleName = schema.titlePropertyName || "Name";
    const titleText = (titleHint?.trim() || content.slice(0, 80)).replace(/\s+/g, " ");
    const properties = buildProperties({
      titleName,
      titleText,
      content,
      url,
      date,
      project
    });
    const body = {
      parent: { database_id },
      properties
    };
    return await this.fetchJson("/pages", {
      method: "POST",
      body: JSON.stringify(body)
    });
  }
}

// ---- helpers: keep pure & testable ----

export function chunkText(str, max = 1900) {
  const out = [];
  let i = 0;
  while (i < str.length) {
    out.push(str.slice(i, i + max));
    i += max;
  }
  return out;
}

export function getTitlePlain(title) {
  const arr = Array.isArray(title) ? title : [];
  return arr.map(t => t?.plain_text || t?.text?.content || "").join("");
}

export function buildProperties({ titleName, titleText, content, url, date, project }) {
  return {
    [titleName]: {
      title: [{ type: "text", text: { content: (titleText || "").slice(0, 80) || "Highlight" } }]
    },
    "Content": {
      rich_text: chunkText(content || "", 1900).map(piece => ({
        type: "text",
        text: { content: piece }
      }))
    },
    "URL": { url: url || null },
    "Date Captured": { date: date ? { start: date } : null },
    "Project": {
      rich_text: project ? [{ type: "text", text: { content: project } }] : []
    }
  };
}
