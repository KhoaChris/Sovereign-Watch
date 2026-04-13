import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { FeedbackProvider } from "./feedback/feedback-context";
import { StorefrontProvider } from "./storefront/storefront-context";
import "./styles/index.css";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FeedbackProvider>
        <StorefrontProvider>
          <App />
        </StorefrontProvider>
      </FeedbackProvider>
    </BrowserRouter>
  </StrictMode>,
);
