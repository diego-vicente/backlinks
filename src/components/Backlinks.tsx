import type { QuartzComponent, QuartzComponentProps } from "@quartz-community/types";
import { classNames } from "../util/lang";
import { i18n } from "../i18n";
import style from "./styles/backlinks.scss";
import { resolveRelative, simplifySlug } from "../util/path";

export interface BacklinksOptions {
  hideWhenEmpty: boolean;
}

type QuartzComponentConstructor<Options extends object | undefined = undefined> = (
  opts: Options,
) => QuartzComponent;

const defaultOptions: BacklinksOptions = {
  hideWhenEmpty: true,
};

export interface BacklinkCandidate {
  unlisted?: boolean;
  links?: string[];
  slug?: string;
  frontmatter?: { title?: string; type?: unknown };
}

export function selectBacklinkSources<T extends BacklinkCandidate>(
  allFiles: T[],
  currentSlug: string,
): T[] {
  return allFiles.filter((file) => file.unlisted !== true && file.links?.includes(currentSlug));
}

/** Derive a group key + display label from a `type` frontmatter value (wikilink/string). */
function typeOf(raw: unknown): { key: string; label: string } {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value.trim()) return { key: "~", label: "Other" };
  let label = value.trim();
  const wiki = label.match(/^\[\[([^\]]+)\]\]$/);
  if (wiki?.[1]) label = wiki[1];
  label = label.replace(/[|#].*$/, "").trim();
  // key is the type slug (matches the `--lt-<type>` color vars / link palette).
  return { key: label.toLowerCase().replace(/\s+/g, "-") || "~", label: label || "Other" };
}

const titleOf = (f: BacklinkCandidate): string =>
  f.frontmatter?.title || f.slug?.split("/").pop() || "Untitled";

/** A note is an "Obsidian Entity" (a type itself) if it's typed Obsidian Entity OR
 *  it's referenced as some note's `type` (e.g. Travel Itinerary, which is typed
 *  Practice but is itself a type). Both cases = the note's name is a type slug. */
const ENTITY_GROUP = { key: "obsidian-entity", label: "Obsidian Entities" };
function groupFor(
  f: BacklinkCandidate,
  typeSlugs: Set<string>,
): { key: string; label: string } {
  const own = typeOf(f.frontmatter?.type).key;
  const nameSlug = (f.slug ?? "").split("/").pop() ?? "";
  if (own === "obsidian-entity" || typeSlugs.has(nameSlug) || typeSlugs.has(f.slug ?? "")) {
    return ENTITY_GROUP;
  }
  return typeOf(f.frontmatter?.type);
}

export default ((opts?: Partial<BacklinksOptions>) => {
  const options: BacklinksOptions = { ...defaultOptions, ...opts };

  const Backlinks: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
    cfg,
  }: QuartzComponentProps & { displayClass?: string }) => {
    const slug = simplifySlug(fileData.slug as string);
    const locale = cfg.locale ?? "en-US";
    const backlinkFiles = selectBacklinkSources(allFiles as BacklinkCandidate[], slug);
    if (options.hideWhenEmpty && backlinkFiles.length === 0) {
      return null;
    }

    // Set of every type slug used in the vault — a note whose name is in here is
    // itself a type, so it groups under "Obsidian Entities".
    const typeSlugs = new Set<string>();
    for (const f of allFiles as BacklinkCandidate[]) {
      const t = typeOf(f.frontmatter?.type).key;
      if (t && t !== "~") typeSlugs.add(t);
    }

    // Group backlinks by type — entities (types themselves) fold into one group.
    const groups = new Map<string, { key: string; label: string; files: BacklinkCandidate[] }>();
    for (const f of backlinkFiles) {
      const { key, label } = groupFor(f, typeSlugs);
      const group = groups.get(key) ?? { key, label, files: [] };
      group.files.push(f);
      groups.set(key, group);
    }
    // Largest groups first; alphabetical as a tiebreaker for stable ordering.
    const sorted = [...groups.values()].sort(
      (a, b) => b.files.length - a.files.length || a.label.localeCompare(b.label),
    );

    return (
      <div class={classNames(displayClass, "backlinks")}>
        <h3>{i18n(locale).components.backlinks.title}</h3>
        {backlinkFiles.length > 0 ? (
          sorted.map((group) => (
            <details class="backlinks-group">
              <summary>
                {/* Colored by the type's palette var (text only — not a link, no pill bg). */}
                <span
                  class="backlinks-group-label"
                  style={`color: var(--lt-${group.key}, var(--darkgray))`}
                >
                  {group.label}
                </span>
                <span class="backlinks-group-count">{group.files.length}</span>
              </summary>
              <ul>
                {group.files.map((f) => (
                  <li>
                    <a href={resolveRelative(fileData.slug as string, f.slug!)} class="internal">
                      {titleOf(f)}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ))
        ) : (
          <p class="backlinks-empty">{i18n(locale).components.backlinks.noBacklinksFound}</p>
        )}
      </div>
    );
  };

  Backlinks.css = style;
  return Backlinks;
}) satisfies QuartzComponentConstructor;
