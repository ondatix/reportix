import "@fontsource/funnel-sans/400.css";
import "@fontsource/funnel-sans/500.css";
import "@fontsource/funnel-sans/600.css";
import "@fontsource/funnel-sans/700.css";
import "@fontsource/funnel-sans/400-italic.css";
import "@fontsource/funnel-sans/500-italic.css";
import { initApp } from "./app";
import "./style.css";

const root = document.getElementById("app");
if (root) {
  initApp(root);
}
