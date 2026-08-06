const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "img",
  "a",
  "span",
  "blockquote",
  "hr",
  "div",
]);

const ALLOWED_IMG_ATTRS = new Set(["src", "alt", "width", "height"]);
const ALLOWED_LINK_ATTRS = new Set(["href", "target", "rel"]);
const ALLOWED_STYLE_PROPS = new Set([
  "font-size",
  "font-style",
  "font-weight",
  "color",
  "text-align",
  "text-decoration",
]);

const HTML_CONTENT_PATTERN = /<[a-z][\s\S]*?>/i;
const FIRST_IMAGE_PATTERN = /<img[^>]+src=["']([^"']+)["']/i;

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeStyle(value: string) {
  return value
    .split(";")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const [property, ...rest] = rule.split(":");
      const normalizedProperty = property?.trim().toLowerCase();
      if (!normalizedProperty || !ALLOWED_STYLE_PROPS.has(normalizedProperty)) {
        return "";
      }

      const styleValue = rest.join(":").trim();
      if (!styleValue || /url\s*\(|expression\s*\(/i.test(styleValue)) {
        return "";
      }

      return `${normalizedProperty}: ${styleValue}`;
    })
    .filter(Boolean)
    .join("; ");
}

function sanitizeElement(element: Element) {
  const tagName = element.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tagName)) {
    const fragment = document.createDocumentFragment();
    while (element.firstChild) {
      fragment.appendChild(element.firstChild);
    }
    element.replaceWith(fragment);
    return;
  }

  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();

    if (name === "style") {
      const sanitizedStyle = sanitizeStyle(attribute.value);
      if (sanitizedStyle) {
        element.setAttribute("style", sanitizedStyle);
      } else {
        element.removeAttribute("style");
      }
      continue;
    }

    if (tagName === "img" && ALLOWED_IMG_ATTRS.has(name)) {
      continue;
    }

    if (tagName === "a" && ALLOWED_LINK_ATTRS.has(name)) {
      continue;
    }

    element.removeAttribute(attribute.name);
  }

  if (tagName === "a") {
    element.setAttribute("rel", "noopener noreferrer");
    element.setAttribute("target", "_blank");
  }

  if (tagName === "img") {
    const src = element.getAttribute("src")?.trim() || "";
    if (!src || /^javascript:/i.test(src)) {
      element.remove();
      return;
    }
    element.setAttribute("loading", "lazy");
  }
}

function sanitizeNewsHtml(html: string) {
  if (typeof window === "undefined") {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      sanitizeElement(node as Element);
    }

    for (const child of [...node.childNodes]) {
      walk(child);
    }
  };

  walk(template.content);
  return template.innerHTML;
}

export function isHtmlNewsContent(content: string) {
  return HTML_CONTENT_PATTERN.test(content);
}

export function formatNewsContentHtml(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    return "";
  }

  if (isHtmlNewsContent(trimmed)) {
    return sanitizeNewsHtml(trimmed);
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function extractNewsPreviewImage(content: string, image?: string | null) {
  if (image?.trim()) {
    return image.trim();
  }

  const match = content.match(FIRST_IMAGE_PATTERN);
  return match?.[1]?.trim() || null;
}

export function splitNewsContentSections(html: string) {
  if (typeof window === "undefined") {
    return { lead: "", bodyHtml: html };
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const firstParagraph = template.content.querySelector("p");

  if (!firstParagraph) {
    return { lead: "", bodyHtml: html };
  }

  const lead = firstParagraph.textContent?.trim() || "";
  firstParagraph.remove();

  return {
    lead,
    bodyHtml: template.innerHTML.trim(),
  };
}
