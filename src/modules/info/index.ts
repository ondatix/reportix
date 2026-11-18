/**
 * Info module — click-to-open disclosures for explanatory text.
 *
 * Renders a small "ⓘ" trigger next to a label/heading; clicking it reveals a
 * popup showing the given text, dismissed by clicking outside or pressing
 * Escape. Only one popup is open at a time.
 *
 * This is an APG *disclosure*, not a tooltip: it is click-toggled and persists
 * until dismissed, whereas an ARIA tooltip is hover/focus-triggered and
 * transient. The trigger carries `aria-expanded` + `aria-controls` pointing at
 * the popup; the popup itself carries no `role="tooltip"` (which would be inert
 * here, since nothing describes itself by it).
 *
 * **The trigger's accessible name must stay short.** It used to be the full
 * definition text, which leaked into the accessible name of every host element
 * — accessible-name-from-content walks descendants and uses each one's own
 * name, so a `<label>`, `<legend>` or heading wrapping one of these announced
 * an entire paragraph as part of its own name. Callers therefore pass a brief
 * `triggerLabel` (e.g. "Erläuterung: Geschlecht") and the long text goes only
 * into the popup.
 *
 * Self-contained: takes plain strings and returns DOM elements, with no
 * dependency on the rest of the app — including i18n, which is why the trigger
 * label is passed in already localized rather than resolved here.
 */

/** The popup currently open (if any), so opening one closes the previous. */
let openControl: HTMLElement | null = null;

/** Monotonic counter backing the popup ids that `aria-controls` points at. */
let seq = 0;

function closeOpen(): void {
  if (!openControl) return;
  const popup = openControl.querySelector<HTMLElement>(".info-popup");
  const trigger = openControl.querySelector<HTMLElement>(".info-trigger");
  if (popup) popup.hidden = true;
  trigger?.setAttribute("aria-expanded", "false");
  openControl = null;
}

/**
 * Drop the reference to the currently-open popup. Call when the DOM holding
 * these controls is discarded (the app re-renders from scratch on a language
 * switch) — otherwise `openControl` keeps pointing at a detached node, and the
 * next outside-click handler operates on an element that is no longer shown.
 */
export function resetInfoControls(): void {
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
 *
 * `triggerLabel` is the trigger's accessible name and must be short and
 * already localized — see the module header for why.
 */
export function createInfoControl(text: string, triggerLabel: string): HTMLElement {
  bindGlobalListeners();

  const control = document.createElement("span");
  control.className = "info-control";

  const popupId = `info-popup-${++seq}`;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "info-trigger";
  trigger.setAttribute("aria-label", triggerLabel);
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", popupId);
  trigger.textContent = "ⓘ";

  const popup = document.createElement("span");
  popup.className = "info-popup";
  popup.id = popupId;
  popup.setAttribute("role", "note");
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
export function attachInfo(
  target: HTMLElement,
  text: string | undefined,
  triggerLabel: string
): void {
  if (!text || !text.trim()) return;
  target.appendChild(createInfoControl(text, triggerLabel));
}
