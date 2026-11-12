"use client";

import { useEffect, useRef } from "react";
import { MoreHorizontal } from "lucide-react";

export default function ToolbarMenu({ label, children, className = "" }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      const node = menuRef.current;
      if (node && node.open && !node.contains(event.target)) {
        node.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function close() {
    if (menuRef.current) menuRef.current.removeAttribute("open");
  }

  return (
    <details className={`toolbar-menu ${className}`.trim()} ref={menuRef}>
      <summary className="toolbar-button" aria-label={label} title={label}>
        <MoreHorizontal size={16} />
      </summary>
      <div className="toolbar-menu-panel" onClick={close}>
        {children}
      </div>
    </details>
  );
}
