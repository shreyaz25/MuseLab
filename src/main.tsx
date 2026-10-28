import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BackendProvider, CurrentAnalysisProvider } from "./context/Backend";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <BackendProvider>
        <CurrentAnalysisProvider>
          <App />
        </CurrentAnalysisProvider>
      </BackendProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
