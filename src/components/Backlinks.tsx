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
  return { key: label.toLowerCase() || "~", label: label || "Other" };
}

const titleOf = (f: BacklinkCandidate): string =>
  f.frontmatter?.title || f.slug?.split("/").pop() || "Untitled";

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

    // Group backlinks by the linking note's type, then order groups by label
    // ("Other" — untyped — sorts last via its "~" key fallback in the label).
    const groups = new Map<string, { label: string; files: BacklinkCandidate[] }>();
    for (const f of backlinkFiles) {
      const { key, label } = typeOf(f.frontmatter?.type);
      const group = groups.get(key) ?? { label, files: [] };
      group.files.push(f);
      groups.set(key, group);
    }
    const sorted = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));

    return (
      <div class={classNames(displayClass, "backlinks")}>
        <h3>{i18n(locale).components.backlinks.title}</h3>
        {backlinkFiles.length > 0 ? (
          sorted.map((group) => (
            <details class="backlinks-group">
              <summary>
                <span class="backlinks-group-label">{group.label}</span>
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
