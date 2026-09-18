import { useEffect, useState } from "react";

/**
 * Copying to the clipboard, with the two seconds of feedback that make it
 * believable. `copied` holds the key of whatever went last, so one hook can
 * serve several buttons without any of them lying about the others.
 */
export function useCopy(): { copied: string | null; copy: (key: string, text: string) => void } {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = (key: string, text: string): void => {
    void navigator.clipboard
      .writeText(text)
      .then(() => setCopied(key))
      // Refused — an insecure context, or permission withheld. The code is on
      // screen in large type anyway, which is what people read out loud.
      .catch(() => setCopied(null));
  };

  return { copied, copy };
}
