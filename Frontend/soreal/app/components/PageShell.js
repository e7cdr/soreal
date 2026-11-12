export default function PageShell({
  eyebrow,
  title,
  description,
  actions,
  toolbar,
  footer,
  children,
  bodyClassName = "",
  className = "",
}) {
  return (
    <div className={`page-shell ${className}`.trim()}>
      <header className="page-head">
        <div className="page-head-main">
          {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>

      {toolbar && <div className="page-toolbar">{toolbar}</div>}

      <div className={`page-body ${bodyClassName}`.trim()}>{children}</div>

      {footer && <div className="page-footer">{footer}</div>}
    </div>
  );
}
