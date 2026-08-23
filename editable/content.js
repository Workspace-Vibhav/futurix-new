/**
 * Central content overrides.
 *
 * Each rule may target one route or every route. Use `text` for plain text,
 * `html` when line breaks or inline markup are required, and `attrs` for
 * links, image sources, accessibility labels, or other attributes.
 *
 * Example:
 * window.TRESMARES_CONTENT = [
 *   { path: "/en/", selector: ".component--herofulltext h1", html: "Drive<br>to<br>grow" },
 *   { path: "*", selector: ".copyright .wysiwyg", text: "© 2025 Tresmares Capital is registered with the CNMV." },
 *   { path: "*", selector: "a[title='linkedin']", attrs: { href: "https://www.linkedin.com/company/tresmarescapital/" } }
 * ];
 */
window.TRESMARES_CONTENT = window.TRESMARES_CONTENT || [];
