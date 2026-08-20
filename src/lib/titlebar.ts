/**
 * Attributes for a surface standing in for the title bar the window does not
 * have: they hold its content below the close, minimise, and zoom controls
 * macOS floats over the top left corner, and let a pull anywhere on the surface
 * that is not one of our own controls move the window.
 */
export function titleBar(className: string) {
  return { className: `pt-9 ${className}`, "data-tauri-drag-region": "deep" };
}
