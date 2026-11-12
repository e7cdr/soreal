"use client";

import { useEffect, useRef } from "react";
import { SlidersHorizontal } from "lucide-react";

export default function FilterPopover({ label, count = 0, closeLabel = "Close", children }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      const node = popoverRef.current;
      if (node && node.open && !node.contains(event.target)) {
        node.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function close() {
    if (popoverRef.current) popoverRef.current.removeAttribute("open");
  }

  return (
    <details className="filter-popover" ref={popoverRef}>
      <summary className="toolbar-button">
        <SlidersHorizontal size={15} />
        <span>{label}</span>
        {count > 0 && <span className="filter-count">{count}</span>}
      </summary>
      <div className="filter-popover-panel">
        {children}
        <div className="filter-popover-actions">
          <button type="button" className="toolbar-button" onClick={close}>
            {closeLabel}
          </button>
        </div>
      </div>
    </details>
  );
}
