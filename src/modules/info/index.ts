/**
 * Info module — click-to-open tooltips for explanatory text.
 *
 * Renders a small "ⓘ" trigger next to a label/heading; clicking it opens a
 * popup showing the given text, dismissed by clicking outside or pressing
 * Escape. Only one popup is open at a time.
 *
 * Self-contained: takes plain strings and returns DOM elements, with no
 * dependency on the rest of the app, so it can be reused in other projects.
 * The caller resolves the text (e.g. localized `info` or German `definition`)
 * and passes it in.
 */

/** The popup currently open (if any), so opening one closes the previous. */
let openControl: HTMLElement | null = null;

function closeOpen(): void {
  if (!openControl) return;
  const popup = openControl.querySelector<HTMLElement>(".info-popup");
  const trigger = openControl.querySelector<HTMLElement>(".info-trigger");
  if (popup) popup.hidden = true;
  trigger?.setAttribute("aria-expanded", "false");
  openControl = null;
}

// Global dismissers, registered once. Closing on any outside click / Escape.
let listenersBound = false;
function bindGlobalListeners(): void {
  if (listenersBound) return;
  listenersBound = true;
  document.addEventListener("click", (e) => {
    if (openControl && !openControl.contains(e.target as Node)) closeOpen();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOpen();
  });
}

/**
 * Pick the tooltip text for an entity: the localized `info` text when present,
 * otherwise the (German) `definition`. Empty strings count as absent.
 */
export function resolveTooltip(info?: string, definition?: string): string | undefined {
  return (info && info.trim()) || (definition && definition.trim()) || undefined;
}

/**
 * Build an info control: a "ⓘ" trigger button plus a hidden popup holding
 * `text`. Clicking the trigger toggles the popup.
 */
export function createInfoControl(text: string): HTMLElement {
  bindGlobalListeners();

  const control = document.createElement("span");
  control.className = "info-control";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "info-trigger";
  trigger.setAttribute("aria-label", text);
  trigger.setAttribute("aria-expanded", "false");
  trigger.textContent = "ⓘ";

  const popup = document.createElement("span");
  popup.className = "info-popup";
  popup.setAttribute("role", "tooltip");
  popup.textContent = text;
  popup.hidden = true;

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = openControl === control;
    closeOpen();
    if (!isOpen) {
      popup.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      openControl = control;
    }
  });

  control.append(trigger, popup);
  return control;
}

/** Append an info control to `target` when `text` is non-empty; otherwise no-op. */
export function attachInfo(target: HTMLElement, text?: string): void {
  if (!text || !text.trim()) return;
  target.appendChild(createInfoControl(text));
}
