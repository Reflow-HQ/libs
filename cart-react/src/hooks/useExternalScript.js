import { useEffect, useState } from "react";

const loadedScripts = [];

export default function useExternalScript(url) {
  let [state, setState] = useState(
    url ? (loadedScripts.includes(url) ? "ready" : "loading") : "idle"
  );

  useEffect(() => {
    if (loadedScripts.includes(url)) return;

    if (!url) {
      setState("idle");
      return;
    }

    let script = document.querySelector(`script[src="${url}"]`);

    const handleScript = (e) => {
      const loaded = e.type === "load";

      if (loaded) {
        loadedScripts.push(url);
      }

      setState(loaded ? "ready" : "error");
    };

    if (!script) {
      script = document.createElement("script");
      script.type = "application/javascript";
      script.src = url;
      script.async = true;
      document.body.appendChild(script);
      script.addEventListener("load", handleScript);
      script.addEventListener("error", handleScript);
    }

    script.addEventListener("load", handleScript);
    script.addEventListener("error", handleScript);

    return () => {
      script.removeEventListener("load", handleScript);
      script.removeEventListener("error", handleScript);
    };
  }, [url]);

  return state;
}
