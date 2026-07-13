(() => {
  "use strict";

  const sliderSelector =
    'flt-semantics > input[type="range"][role="slider"]';

  function labelSlider(slider) {
    const semantics = slider.parentElement;
    const label = semantics?.getAttribute("aria-label")?.trim();
    if (label && slider.getAttribute("aria-label") !== label) {
      // Flutter Web places an incrementable node's accessible label on the
      // flt-semantics wrapper, while browser focus lands on this child input.
      // Mirror the label onto the focus target so its native range control has
      // an accessible name in Chromium and screen readers.
      slider.setAttribute("aria-label", label);
      slider.dataset.gridgoSemanticsLabel = "true";
    } else if (!label && slider.dataset.gridgoSemanticsLabel === "true") {
      slider.removeAttribute("aria-label");
      delete slider.dataset.gridgoSemanticsLabel;
    }
  }

  function syncFlutterSliderLabels(root) {
    if (root instanceof Element && root.matches(sliderSelector)) {
      labelSlider(root);
    }
    root.querySelectorAll?.(sliderSelector).forEach(labelSlider);
  }

  function start() {
    syncFlutterSliderLabels(document);
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") {
          syncFlutterSliderLabels(record.target);
          continue;
        }
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) syncFlutterSliderLabels(node);
        });
      }
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["aria-label"],
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
