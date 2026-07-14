import { render } from "preact";
import { QueryClientProvider } from "@tanstack/preact-query";
import { queryClient } from "@/lib/queryClient";
import "./App.css";
import App from "./App";

render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
  document.getElementById("root")!,
);
